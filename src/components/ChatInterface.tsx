/**
 * 1.1.2: YUIChat 项目 - 聊天界面组件 (内部测试)
 * 适配 LangGraph 后端，支持本地测试
 * 1.1.10: 完善测试对话功能，支持基于知识库文档的对话
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, ExternalLink } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import type { ChatMessage, Citation } from '../types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { logger } from '../utils/logger';
import { supabase } from '../lib/supabase';

interface ChatInterfaceProps {
  language?: string;
  onScroll?: (scrollTop: number) => void;
}

const PY_BACKEND_URL = import.meta.env.VITE_PY_BACKEND_URL || 'http://localhost:8000';

export function ChatInterface({ language = 'zh', onScroll }: ChatInterfaceProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentKb, setCurrentKb] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isStreaming,
    addMessage,
    updateMessage,
    appendToMessage,
    setStreaming,
    clearMessages,
    newConversation,
    setCurrentKbId,
  } = useChatStore();

  // 1.1.10: 加载当前知识库
  useEffect(() => {
    async function loadKB() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('knowledge_bases').select('*').eq('user_id', user.id).limit(1).single();
      if (data) {
        setCurrentKb(data);
        setCurrentKbId(data.id);
      }
    }
    loadKB();
  }, [setCurrentKbId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isStreaming || isTyping) {
      scrollToBottom();
    }
  }, [messages, isStreaming, isTyping, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim() || isTyping || !currentKb) return;

    const query = input.trim();
    setInput('');
    setIsTyping(true);

    const userMessageId = addMessage({
      role: 'user',
      content: query,
      status: 'completed',
    });

    const assistantMessageId = addMessage({
      role: 'assistant',
      content: '',
      status: 'streaming',
    });

    try {
      setStreaming(true, assistantMessageId);

      // 1.1.10: 准备对话历史
      const conversationHistory = messages
        .filter(msg => msg.status === 'completed')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      // 1.1.10: 调用后端聊天 API
      const response = await fetch(`${PY_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          kb_id: currentKb.share_token,
          conversation_history: conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Backend error');
      }
      
      const data = await response.json();
      
      if (data.status === 'error') {
        throw new Error(data.message);
      }
      
      // 1.1.10: 更新消息内容
      updateMessage(assistantMessageId, {
        content: data.answer || '抱歉，我无法回答这个问题。',
        status: 'completed',
      });
      
      if (import.meta.env.DEV) {
        logger.log('Chat response:', data);
      }
    } catch (error) {
      logger.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      updateMessage(assistantMessageId, {
        status: 'error',
        error: `对话失败: ${errorMessage}。请确保 Python 后端正在运行，或使用右侧"开始对话"通过 Chainlit 界面进行测试。`,
      });
    } finally {
      setIsTyping(false);
      setStreaming(false, null);
      scrollToBottom();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const chainlitUrl = currentKb ? `${import.meta.env.VITE_CHAINLIT_URL || 'http://localhost:8000'}/?kb_id=${currentKb.share_token}` : '';

  // 1.1.10: 处理新建对话
  const handleNewConversation = () => {
    if (confirm('确定要开始新对话吗？当前对话将被清除。')) {
      newConversation();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* 1.1.2: 顶部提示栏 */}
      <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xs text-purple-700">这是内部测试界面。直接面向用户的界面请使用 Chainlit。</span>
          {/* 1.1.10: 新建对话按钮 */}
          {messages.length > 0 && (
            <button
              onClick={handleNewConversation}
              className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
            >
              新建对话
            </button>
          )}
        </div>
        {chainlitUrl && (
          <a href={chainlitUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
            打开面向用户界面 <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('chatWelcomeTitle')}</h3>
            <p className="text-gray-600 max-w-md">{t('chatWelcomeMessage')}</p>
          </div>
        ) : (
          messages.map((message) => (
            <motion.div key={message.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-4 py-3 ${message.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-900'}`}>
                {message.role === 'assistant' ? (
                  <>
                    <MarkdownRenderer content={message.content} isStreaming={message.status === 'streaming'} />
                    {message.status === 'error' && message.error && (
                      <div className="mt-2 flex flex-col gap-2">
                        <p className="text-red-600 text-sm">{message.error}</p>
                        <a href={chainlitUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                          去 Chainlit 测试 <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
              )}
            </motion.div>
          ))
        )}
        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKeyPress} placeholder={t('chatInputPlaceholder')} disabled={isTyping} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed" />
          <button onClick={handleSend} disabled={!input.trim() || isTyping} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
