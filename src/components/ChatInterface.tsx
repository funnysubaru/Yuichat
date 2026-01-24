/**
 * 1.1.2: YUIChat 项目 - 聊天界面组件 (内部测试)
 * 适配 LangGraph 后端，支持本地测试
 * 1.1.10: 完善测试对话功能，支持基于知识库文档的对话
 * 1.2.10: 修复AI头像重复显示问题，streaming状态时完全隐藏消息，只显示loading行
 * 1.2.13: 集成对话记录侧边栏，支持对话管理和历史记录
 * 1.2.14: 修复对话记录未保存问题，添加创建对话和防重复保存机制
 * 1.2.16: 优化布局，输入框固定在底部，对话记录改为浮窗形式
 * 1.2.17: 输入框固定在网页最下方，使用fixed定位
 * 1.2.23: 实现项目头像显示功能，消息列表和加载状态都使用项目设置的头像，未设置时使用默认头像
 * 1.2.52: 修复语言切换后AI回复语言不正确的问题，在聊天请求中传递language参数
 * 1.2.55: 当知识库没有文档时，显示提示信息并禁用输入框
 * 1.2.56: 修复公开聊天页面继承测试对话历史的问题，公开模式初始化时清空消息
 * 1.2.57: 修复公开模式加载卡住的问题，正确设置loadingDocuments状态，优化异步加载高频问题
 * 1.2.58: 修复生产环境每次点击测试对话不刷新聊天的问题，首次进入/chat时也需要清空消息
 * 1.3.0: 新增 follow_up 推荐问题显示功能，支持后续问题推荐
 * 1.3.11: 新增引用来源展示功能，支持查看AI回答的文档来源
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useLocation } from 'react-router-dom'; // 1.2.2: 导入 useLocation 检测路由变化
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, ExternalLink, FileText } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import type { ChatMessage, Citation } from '../types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ConversationHistorySidebar } from './ConversationHistorySidebar';
import { CitationPanel } from './CitationPanel'; // 1.3.11: 引用来源面板
import { logger } from '../utils/logger';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast'; // 1.1.15: 导入 toast 用于错误提示
import {
  createConversation,
  saveMessage,
  updateConversationTitle,
  addConversation,
} from '../services/conversationService';
import { getCurrentUser } from '../services/authService';

// 1.2.23: AI头像组件
interface AvatarProps {
  avatarUrl: string | null;
  size?: 'sm' | 'md';
}

function Avatar({ avatarUrl, size = 'md' }: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const sizeClass = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 'w-5 h-5' : 'w-5 h-5';
  
  // 如果没有头像URL或加载失败，显示默认图标
  if (!avatarUrl || hasError) {
    return (
      <div className={`${sizeClass} bg-primary rounded-full flex items-center justify-center flex-shrink-0`}>
        <Bot className={`${iconSize} text-white`} />
      </div>
    );
  }
  
  return (
    <img
      src={avatarUrl}
      alt="AI Assistant"
      className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      onError={() => setHasError(true)}
    />
  );
}

interface ChatInterfaceProps {
  language?: string;
  onScroll?: (scrollTop: number) => void;
  // 1.2.25: 支持外部传入知识库对象（用于公开分享页面）
  externalKb?: any;
  isPublicMode?: boolean; // 是否为公开访问模式（不需要登录）
}

const PY_BACKEND_URL = import.meta.env.VITE_PY_BACKEND_URL || 'http://localhost:8000';

export function ChatInterface({ language = 'zh', onScroll, externalKb, isPublicMode = false }: ChatInterfaceProps) {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams(); // 1.1.13: 读取URL参数
  const location = useLocation(); // 1.2.2: 获取当前路由信息
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentKb, setCurrentKb] = useState<any>(null);
  // 1.2.0: 聊天配置状态
  const [chatConfig, setChatConfig] = useState<{
    avatarUrl: string;
    welcomeMessage: string;
    recommendedQuestions: string[];
  } | null>(null);
  // 1.2.12: 初始化为true，避免首次渲染显示默认问题
  // 如果知识库没有配置的推荐问题，需要从API获取，应该显示loading状态
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  // 1.2.55: 跟踪知识库是否有文档
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  // 1.3.0: follow_up 推荐问题状态
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  // 1.3.11: 引用来源面板状态
  const [showCitationPanel, setShowCitationPanel] = useState(false);
  const [selectedCitationId, setSelectedCitationId] = useState<string | undefined>(undefined);
  const [currentCitations, setCurrentCitations] = useState<Citation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef<string>(''); // 1.2.2: 记录上一个路由路径
  const fetchingQuestionsRef = useRef<boolean>(false); // 1.2.11: 防止重复请求
  const abortControllerRef = useRef<AbortController | null>(null); // 1.2.11: 用于取消请求
  const configLoadedRef = useRef<string | null>(null); // 1.2.11: 跟踪已加载配置的知识库ID，防止重复加载
  const savedMessageIdsRef = useRef<Set<string>>(new Set()); // 1.2.14: 跟踪已保存的消息ID，防止重复保存
  const [sidebarWidth, setSidebarWidth] = useState(240); // 1.2.17: 侧边栏宽度状态

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
    currentKbId: storeKbId, // 1.2.1: 从store获取当前的kbId
    currentConversationId, // 1.2.13: 当前对话ID
    setCurrentConversationId, // 1.2.13: 设置当前对话ID
    addConversation, // 1.2.13: 添加对话到列表
    updateConversation, // 1.3.4: 更新对话信息（用于实时更新标题）
  } = useChatStore();

  // 1.1.15: 从URL参数加载当前知识库，确保知识库隔离
  // 当项目切换时，清空对话历史
  // 1.2.25: 支持外部传入知识库对象（用于公开分享页面）
  const projectId = searchParams.get('project'); // 1.1.15: 在useEffect外部获取，避免依赖问题
  
  // 1.2.56: 公开模式初始化时清空消息，防止继承测试对话的历史记录
  // 使用 ref 确保只在组件首次挂载时执行一次
  const publicModeInitializedRef = useRef<boolean>(false);
  useEffect(() => {
    if (isPublicMode && !publicModeInitializedRef.current) {
      // 公开模式首次加载时清空所有消息，确保用户看到的是全新对话
      clearMessages();
      setCurrentConversationId(null);
      publicModeInitializedRef.current = true;
      if (import.meta.env.DEV) {
        logger.log('PublicMode initialized: cleared message history to start fresh conversation');
      }
    }
  }, [isPublicMode, clearMessages, setCurrentConversationId]);
  
  useEffect(() => {
    async function loadKB() {
      // 1.2.25: 如果是公开模式且提供了外部知识库，直接使用
      if (isPublicMode && externalKb) {
        const previousKbId = currentKb?.id;
        
        // 如果知识库变化，清空对话历史
        if (previousKbId && previousKbId !== externalKb.id) {
          clearMessages();
          if (import.meta.env.DEV) {
            logger.log(`External KB changed from ${previousKbId} to ${externalKb.id}, clearing conversation history`);
          }
        }
        
        setCurrentKb(externalKb);
        setCurrentKbId(externalKb.id);
        
        // 重置配置加载标记
        if (previousKbId && previousKbId !== externalKb.id) {
          configLoadedRef.current = null;
        }
        
        // 1.2.57: 公开模式下不需要检查文档数量，直接设置为有文档
        // 公开分享的知识库默认是有内容的，检查文档数会增加不必要的延迟
        setHasDocuments(true);
        setLoadingDocuments(false);
        
        // 设置聊天配置
        const config = externalKb.chat_config || {};
        const currentLang = i18n.language.split('-')[0];
        const lang = ['zh', 'en', 'ja'].includes(currentLang) ? currentLang : 'zh';
        const avatarUrl = config.avatar_url || '';
        const welcomeMessage = config.welcome_message?.[lang] || config.welcome_message?.zh || t('chatWelcomeMessage');
        const recommendedQuestions = config.recommended_questions?.[lang] || [];
        
        // 1.2.57: 立即设置 chatConfig，让界面先显示欢迎语
        setChatConfig({
          avatarUrl,
          welcomeMessage,
          recommendedQuestions: recommendedQuestions.length > 0 ? recommendedQuestions.slice(0, 3) : []
        });
        
        if (recommendedQuestions.length > 0) {
          // 有配置的推荐问题，不需要从API获取
          setLoadingQuestions(false);
        } else {
          // 1.2.57: 没有配置推荐问题，需要从API异步加载
          setLoadingQuestions(true);
        }
        
        // 如果消息为空且配置未加载，触发加载
        if (messages.length === 0 && configLoadedRef.current !== externalKb.id) {
          // 让useEffect自动加载
        }
        
        return;
      }
      
      // 1.2.25: 如果不是公开模式，需要验证用户权限
      const { data: { user } } = await supabase.auth.getUser();
      if (!user && !isPublicMode) return;
      
      // 1.2.1: 如果项目ID变化，清空对话历史（不同项目的对话应该隔离）
      const previousKbId = currentKb?.id;
      
      let kb = null;
      if (projectId) {
        // 1.1.15: 如果提供了项目ID，使用该ID获取知识库（并验证用户权限）
        const { data, error } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', user!.id) // 1.1.15: 验证用户权限
          .single();
        
        if (error) {
          logger.error('Error loading knowledge base:', error);
          return;
        }
        kb = data;
      } else {
        // 1.1.15: 如果没有提供项目ID，获取第一个知识库作为默认
        const { data } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('user_id', user!.id)
          .limit(1)
          .single();
        kb = data;
      }
      
      if (kb) {
        // 1.2.1: 如果知识库变化，清空对话历史（包括首次加载时如果store中的kbId不同）
        if ((previousKbId && previousKbId !== kb.id) || (storeKbId && storeKbId !== kb.id)) {
          clearMessages(); // 1.2.1: 切换项目时清空对话历史
          if (import.meta.env.DEV) {
            logger.log(`Project changed from ${previousKbId || storeKbId} to ${kb.id}, clearing conversation history`);
          }
        }
        
        setCurrentKb(kb);
        setCurrentKbId(kb.id);

        // 1.2.55: 检查知识库是否有文档
        setLoadingDocuments(true);
        try {
          const { count, error: countError } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('knowledge_base_id', kb.id);

          if (!countError) {
            setHasDocuments(count !== null && count > 0);
          } else {
            logger.error('Error checking documents count:', countError);
            setHasDocuments(null);
          }
        } catch (docError) {
          logger.error('Error checking documents:', docError);
          setHasDocuments(null);
        } finally {
          setLoadingDocuments(false);
        }

        // 1.2.11: 如果知识库变化，重置配置加载标记
        if (previousKbId && previousKbId !== kb.id) {
          configLoadedRef.current = null;
        }
        
        // 1.2.12: 立即设置chatConfig（包含欢迎语和头像），避免欢迎语闪烁
        // 即使推荐问题需要从API获取，也要先设置欢迎语和头像
        const config = kb.chat_config || {};
        const currentLang = i18n.language.split('-')[0];
        const lang = ['zh', 'en', 'ja'].includes(currentLang) ? currentLang : 'zh';
        const avatarUrl = config.avatar_url || '';
        const welcomeMessage = config.welcome_message?.[lang] || config.welcome_message?.zh || t('chatWelcomeMessage');
        const recommendedQuestions = config.recommended_questions?.[lang] || [];
        
        // 1.2.12: 立即设置chatConfig，确保欢迎语和头像立即显示
        // 1.2.39: 保留已有的推荐问题，避免覆盖API返回的结果
        if (recommendedQuestions.length > 0) {
          // 如果有配置的推荐问题，直接设置完整的chatConfig
          setChatConfig({
            avatarUrl,
            welcomeMessage,
            recommendedQuestions: recommendedQuestions.slice(0, 3)
          });
          setLoadingQuestions(false);
        } else {
          // 如果没有配置的推荐问题，保留已有的recommendedQuestions（可能是API已返回的）
          // 只更新欢迎语和头像
          setChatConfig(prev => ({
            avatarUrl,
            welcomeMessage,
            recommendedQuestions: prev?.recommendedQuestions || []
          }));
        }
        
        // 1.2.11: 如果消息为空且配置未加载，触发加载（不再重置chatConfig，避免循环）
        if (messages.length === 0 && configLoadedRef.current !== kb.id) {
          // 不设置chatConfig为null，让useEffect自动加载（如果还需要从API获取问题）
        }
      }
    }
    loadKB();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, externalKb, isPublicMode]); // 1.2.25: 监听外部知识库和公开模式变化

  // 1.2.3: 检测路由变化，当从其他页面导航到测试对话时，刷新聊天框并显示欢迎语
  // 同时检测 URL 完整路径（包括查询参数）的变化和 _refresh 参数
  // 1.2.58: 修复首次进入 /chat 时不清空消息的问题（previousPath 为空时也需要处理）
  useEffect(() => {
    const currentPath = location.pathname;
    const currentSearch = location.search;
    const refreshParam = searchParams.get('_refresh'); // 1.2.3: 检测刷新参数
    
    // 1.2.4: 如果检测到 _refresh 参数，清空消息并移除该参数，然后触发配置重新加载
    // 1.3.3: 同时清空 currentConversationId，确保下次提问时创建新对话
    if (refreshParam && currentPath === '/chat') {
      clearMessages();
      setCurrentConversationId(null); // 1.3.3: 清空当前对话ID，开始新对话
      // 移除 _refresh 参数，避免 URL 中保留
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('_refresh');
      const newSearch = newSearchParams.toString();
      const newUrl = newSearch ? `${currentPath}?${newSearch}` : currentPath;
      window.history.replaceState({}, '', newUrl);
      // 1.2.11: 重置配置加载标记，而不是直接设置chatConfig为null
      if (currentKb) {
        configLoadedRef.current = null;
        loadChatConfig(currentKb);
      }
      if (import.meta.env.DEV) {
        logger.log(`Refresh parameter detected, clearing messages and starting new conversation`);
      }
      return;
    }
    
    const currentFullPath = `${currentPath}${currentSearch}`;
    const previousPath = previousPathRef.current;
    
    // 如果当前路径是 /chat，且之前不是 /chat，说明是从其他页面导航过来的
    // 或者如果当前路径是 /chat，但 URL 完整路径发生了变化（比如 project 参数变化），也刷新
    // 1.2.58: 修复条件判断，首次进入（previousPath为空）时也需要清空消息
    if (currentPath === '/chat') {
      // 1.2.58: 提取 previousPath 中的路径部分（去掉查询参数）
      const previousPathOnly = previousPath.split('?')[0];
      
      if (previousPathOnly !== '/chat') {
        // 1.2.58: 从其他页面导航到 /chat（包括首次进入时 previousPath 为空的情况）
        // 1.3.3: 同时清空 currentConversationId，确保开始新对话
        clearMessages();
        setCurrentConversationId(null); // 1.3.3: 清空当前对话ID
        // 1.2.11: 重置配置加载标记，使用loadChatConfig统一处理
        if (currentKb) {
          configLoadedRef.current = null;
          loadChatConfig(currentKb);
        }
        if (import.meta.env.DEV) {
          logger.log(`Navigated to /chat from ${previousPath || '(initial)'}, starting new conversation`);
        }
      } else if (previousPathOnly === '/chat' && currentFullPath !== previousPath) {
        // 在 /chat 页面内，但 URL 发生了变化（比如点击侧边栏的测试对话）
        // 1.3.3: 同时清空 currentConversationId，确保开始新对话
        clearMessages();
        setCurrentConversationId(null); // 1.3.3: 清空当前对话ID
        // 1.2.11: 重置配置加载标记，使用loadChatConfig统一处理
        if (currentKb) {
          configLoadedRef.current = null;
          loadChatConfig(currentKb);
        }
        if (import.meta.env.DEV) {
          logger.log(`URL changed within /chat, starting new conversation`);
        }
      }
    }
    
    // 更新上一个路径（使用完整路径）
    previousPathRef.current = currentFullPath;
  }, [location.pathname, location.search, searchParams, clearMessages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 1.2.16: 当有新消息时自动滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      // 使用setTimeout确保DOM更新后再滚动
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [messages, scrollToBottom]);
  
  // 1.2.16: 当正在输入时也滚动到底部
  useEffect(() => {
    if (isStreaming || isTyping) {
      scrollToBottom();
    }
  }, [isStreaming, isTyping, scrollToBottom]);

  // 1.2.0: 获取高频问题（当项目未配置推荐问题时使用）
  // 1.2.5: 改进错误处理，API 失败时使用默认问题
  // 1.2.11: 添加请求去重和超时处理，防止资源泄漏
  // 1.2.39: 统一使用 share_token 查询，更安全
  const fetchFrequentQuestions = useCallback(async (lang: string) => {
    // 1.2.39: 添加调试日志
    console.log('[DEBUG] fetchFrequentQuestions called', { 
      hasCurrentKb: !!currentKb, 
      shareToken: currentKb?.share_token,
      lang 
    });
    if (!currentKb?.share_token) {
      console.warn('[DEBUG] No share_token, skipping frequent questions fetch');
      return [];
    }
    
    // 1.2.11: 如果正在请求，取消之前的请求
    // 1.3.5: 取消请求后重置状态，允许新请求继续
    if (fetchingQuestionsRef.current && abortControllerRef.current) {
      abortControllerRef.current.abort();
      // 1.3.5: 重置状态，让新请求可以正常进行
      fetchingQuestionsRef.current = false;
      abortControllerRef.current = null;
    }
    
    fetchingQuestionsRef.current = true;
    setLoadingQuestions(true);
    
    // 1.2.11: 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      // 1.2.11: 添加超时处理（30秒）
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, 30000);
      
      // 1.2.12: 改为POST请求，避免Chainlit拦截GET请求
      const response = await fetch(
        `${PY_BACKEND_URL}/api/frequent-questions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            kb_id: currentKb.share_token,
            language: lang
          }),
          signal
        }
      );
      
      clearTimeout(timeoutId);
      
      // 1.2.11: 改进错误处理，即使响应不是JSON格式也尝试解析
      if (response.ok) {
        try {
          const data = await response.json();
          console.log('[DEBUG] Frequent questions API response:', data);
          if (data.status === 'success' && Array.isArray(data.questions)) {
            console.log('[DEBUG] Returning questions:', data.questions);
            return data.questions || [];
          }
        } catch (jsonError) {
          // 如果JSON解析失败，检查响应内容类型
          const contentType = response.headers.get('content-type');
          if (import.meta.env.DEV) {
            logger.warn('API returned non-JSON response, content-type:', contentType);
          }
          // 继续执行，返回默认问题
        }
      } else {
        // 响应不成功，尝试读取错误信息
        try {
          const errorData = await response.json();
          if (import.meta.env.DEV) {
            logger.warn('API returned error:', errorData);
          }
        } catch {
          // 忽略JSON解析错误
        }
      }
    } catch (error: any) {
      // 1.2.11: 如果是取消请求，不记录错误
      if (error.name === 'AbortError') {
        if (import.meta.env.DEV) {
          logger.warn('Frequent questions request was aborted');
        }
        return [];
      }
      
      if (import.meta.env.DEV) {
        logger.error('Failed to fetch frequent questions:', error);
      }
      // 1.2.5: API 失败时返回默认问题，而不是空数组
      const defaultQuestions = {
        zh: [
          "您能介绍一下这个项目吗？",
          "有哪些常见问题？",
          "如何使用这个系统？"
        ],
        en: [
          "Can you introduce this project?",
          "What are the common questions?",
          "How to use this system?"
        ],
        ja: [
          "このプロジェクトについて紹介していただけますか？",
          "よくある質問は何ですか？",
          "このシステムの使い方は？"
        ]
      };
      return defaultQuestions[lang as keyof typeof defaultQuestions] || defaultQuestions.zh;
    } finally {
      fetchingQuestionsRef.current = false;
      setLoadingQuestions(false);
      abortControllerRef.current = null;
    }
    // 1.2.5: 如果所有尝试都失败，返回默认问题
    const defaultQuestions = {
      zh: [
        "您能介绍一下这个项目吗？",
        "有哪些常见问题？",
        "如何使用这个系统？"
      ],
      en: [
        "Can you introduce this project?",
        "What are the common questions?",
        "How to use this system?"
      ],
      ja: [
        "このプロジェクトについて紹介していただけますか？",
        "よくある質問は何ですか？",
        "このシステムの使い方は？"
      ]
    };
    return defaultQuestions[lang as keyof typeof defaultQuestions] || defaultQuestions.zh;
  }, [currentKb?.share_token]);

  // 1.2.4: 加载聊天配置的辅助函数
  // 1.2.11: 添加防重复加载逻辑
  // 1.2.12: 在加载问题时先设置loading状态，避免显示默认问题
  // 1.2.56: 优化加载体验 - 先显示欢迎语，异步加载高频问题
  const loadChatConfig = useCallback((kb: any) => {
    if (!kb) return;
    
    // 1.2.11: 如果已经加载过这个知识库的配置，跳过
    if (configLoadedRef.current === kb.id && chatConfig) {
      return;
    }
    
    const config = kb.chat_config || {};
    const currentLang = i18n.language.split('-')[0];
    const lang = ['zh', 'en', 'ja'].includes(currentLang) ? currentLang : 'zh';
    const avatarUrl = config.avatar_url || '';
    const welcomeMessage = config.welcome_message?.[lang] || config.welcome_message?.zh || t('chatWelcomeMessage');
    let recommendedQuestions = config.recommended_questions?.[lang] || [];
    
    if (recommendedQuestions.length === 0) {
      // 1.2.56: 立即设置 chatConfig（欢迎语和头像），让界面先显示
      setChatConfig({
        avatarUrl,
        welcomeMessage,
        recommendedQuestions: []
      });
      
      // 1.2.56: 标记高频问题正在加载（用于显示骨架屏）
      setLoadingQuestions(true);
      
      // 1.2.12: fetchFrequentQuestions 内部已管理 loading 状态，这里直接调用
      fetchFrequentQuestions(lang).then((questions) => {
        if (import.meta.env.DEV) {
          console.log('[DEBUG] fetchFrequentQuestions resolved with:', questions);
        }
        // 1.2.11: 标记已加载
        configLoadedRef.current = kb.id;
        // 1.2.12: 更新chatConfig，添加推荐问题
        setChatConfig({
          avatarUrl,
          welcomeMessage,
          recommendedQuestions: questions.slice(0, 3)
        });
        if (import.meta.env.DEV) {
          console.log('[DEBUG] chatConfig updated with questions:', questions.slice(0, 3));
        }
      }).catch((error) => {
        if (import.meta.env.DEV) {
          console.error('[DEBUG] fetchFrequentQuestions error:', error);
        }
        // 1.2.11: 即使失败也标记已加载，避免重复请求
        configLoadedRef.current = kb.id;
        // 1.2.56: 失败时保持现有的chatConfig（欢迎语和头像），使用默认问题
        // setLoadingQuestions(false) 会在 fetchFrequentQuestions 内部调用
      });
    } else {
      // 1.2.11: 标记已加载
      configLoadedRef.current = kb.id;
      // 1.2.12: 如果有配置的推荐问题，更新chatConfig（如果已经设置过，这里只是更新推荐问题）
      setChatConfig({
        avatarUrl,
        welcomeMessage,
        recommendedQuestions: recommendedQuestions.slice(0, 3)
      });
      // 1.2.12: 如果有配置的推荐问题，不需要从API获取，关闭loading状态
      setLoadingQuestions(false);
    }
  }, [i18n.language, t, fetchFrequentQuestions, chatConfig]);

  // 1.2.0: 加载聊天配置
  // 1.2.4: 添加 chatConfig 为 null 的检测，确保重置后能重新加载
  // 1.2.11: 修复无限循环问题，只在知识库变化或配置为空时加载
  // 1.2.12: 在需要加载时立即设置loading状态，避免显示默认问题
  // 1.2.39: 修复 configLoadedRef 逻辑bug，避免每次渲染都重置问题
  useEffect(() => {
    if (!currentKb || messages.length > 0) return;
    
    // 1.2.39: 如果已经加载过这个知识库的配置，直接跳过
    if (configLoadedRef.current === currentKb.id) {
      return;
    }
    
    // 1.2.12: 检查是否需要从API获取问题，如果需要则立即设置loading状态
    const config = currentKb.chat_config || {};
    const currentLang = i18n.language.split('-')[0];
    const lang = ['zh', 'en', 'ja'].includes(currentLang) ? currentLang : 'zh';
    const recommendedQuestions = config.recommended_questions?.[lang] || [];
    
    // 如果没有配置的推荐问题，需要从API获取，立即设置loading状态
    if (recommendedQuestions.length === 0) {
      setLoadingQuestions(true);
    }
    
    loadChatConfig(currentKb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKb?.id, messages.length, i18n.language]); // 1.2.11: 移除 chatConfig 和 loadChatConfig 依赖，避免循环
  
  // 1.2.11: 组件卸载时清理请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      fetchingQuestionsRef.current = false;
    };
  }, []);

  // 1.2.23: 获取AI头像URL的辅助函数
  // 优先使用项目设置的头像，如果没有则返回null（使用默认图标）
  const getAvatarUrl = useCallback(() => {
    return chatConfig?.avatarUrl || currentKb?.chat_config?.avatar_url || null;
  }, [chatConfig?.avatarUrl, currentKb?.chat_config?.avatar_url]);

  // 1.2.17: 检测侧边栏宽度
  useEffect(() => {
    const updateSidebarWidth = () => {
      const sidebar = document.querySelector('[class*="bg-gray-50"][class*="border-r"]') as HTMLElement;
      if (sidebar) {
        const width = sidebar.offsetWidth;
        setSidebarWidth(width);
      } else {
        // 如果没有找到侧边栏，可能是分享页面，设置为0
        setSidebarWidth(0);
      }
    };

    // 初始检测
    updateSidebarWidth();

    // 监听窗口大小变化
    window.addEventListener('resize', updateSidebarWidth);

    // 使用 MutationObserver 监听侧边栏类名变化（展开/收起）
    const observer = new MutationObserver(updateSidebarWidth);
    const sidebar = document.querySelector('[class*="bg-gray-50"][class*="border-r"]');
    if (sidebar) {
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class'],
        childList: false,
        subtree: false,
      });
    }

    return () => {
      window.removeEventListener('resize', updateSidebarWidth);
      observer.disconnect();
    };
  }, []);

  // 1.2.0: 处理推荐问题点击
  // 1.2.9: 修复点击无反应问题，添加调试日志和错误处理
  // 1.2.14: 添加创建对话和保存消息的逻辑
  const handleRecommendedQuestionClick = async (question: string) => {
    if (import.meta.env.DEV) {
      logger.log('Recommended question clicked:', { question, isTyping, hasCurrentKb: !!currentKb });
    }
    
    if (isTyping) {
      if (import.meta.env.DEV) {
        logger.warn('Cannot click: isTyping is true');
      }
      return;
    }
    
    if (!currentKb) {
      if (import.meta.env.DEV) {
        logger.warn('Cannot click: currentKb is null');
      }
      toast.error('请先选择一个项目');
      return;
    }
    
    if (!question.trim()) {
      if (import.meta.env.DEV) {
        logger.warn('Cannot click: question is empty');
      }
      return;
    }

    // 1.2.14: 如果没有对话，创建新对话
    // 1.2.25: 公开模式下不需要创建对话记录
    if (!isPublicMode && !currentConversationId && messages.length === 0) {
      try {
        const user = await getCurrentUser();
        if (!user) {
          toast.error('请先登录');
          return;
        }

        const title = chatConfig?.welcomeMessage?.substring(0, 50) || '新对话';
        const conversation = await createConversation(currentKb.id, user.id, title);
        addConversation(conversation);
        setCurrentConversationId(conversation.id);
      } catch (error) {
        logger.error('Error creating conversation:', error);
        toast.error('创建对话失败');
        return;
      }
    }
    
    const query = question.trim();
    setInput('');
    setIsTyping(true);
    setFollowUpQuestions([]); // 1.3.0: 清空之前的 follow_up 问题

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

      // 1.1.15: 准备对话历史（只包含当前项目的对话）
      const conversationHistory = messages
        .filter(msg => msg.status === 'completed')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      // 1.1.15: 调用后端聊天 API（确保使用当前项目的知识库）
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1.1.15: 确保使用当前项目的 share_token
      if (!currentKb.share_token) {
        throw new Error('当前项目没有有效的分享令牌');
      }
      
      if (import.meta.env.DEV) {
        logger.log('Sending chat request:', {
          query,
          kb_id: currentKb.share_token,
          kb_name: currentKb.name,
          kb_id_db: currentKb.id,
        });
      }
      
      // 1.2.52: 添加语言参数，确保AI回复使用正确的语言
      const currentLangNonStream = i18n.language.split('-')[0];
      const langNonStream = ['zh', 'en', 'ja'].includes(currentLangNonStream) ? currentLangNonStream : 'zh';
      
      const response = await fetch(`${PY_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          kb_id: currentKb.share_token,
          conversation_history: conversationHistory,
          user_id: user?.id,
          language: langNonStream, // 1.2.52: 传递语言参数
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
      // 1.2.14: 添加citations支持
      // 1.3.11: 处理 citations 引用来源
      const citations = data.citations || [];
      updateMessage(assistantMessageId, {
        content: data.answer || '抱歉，我无法回答这个问题。',
        status: 'completed',
        citations: citations,
      });
      
      // 1.3.11: 更新 citations 状态
      setCurrentCitations(citations);
      if (citations.length > 0) {
        setShowCitationPanel(true);
      }

      // 1.3.0: 处理 follow_up 推荐问题（非流式响应）
      if (data.follow_up && Array.isArray(data.follow_up)) {
        const questions = data.follow_up
          .map((q: any) => q.content || q)
          .filter((q: string) => q && q.trim());
        setFollowUpQuestions(questions);
        if (import.meta.env.DEV) {
          logger.log('Received follow_up questions (non-stream):', questions);
        }
      } else {
        setFollowUpQuestions([]);
      }

      // 1.2.14: 如果是第一条AI回复，更新对话标题
      // 1.3.4: 同时更新 store，实现侧边栏实时刷新
      if (currentConversationId && messages.length === 0) {
        const title = (data.answer || '新对话').substring(0, 50);
        try {
          await updateConversationTitle(currentConversationId, title);
          updateConversation(currentConversationId, { title }); // 1.3.4: 实时更新 UI
        } catch (error) {
          logger.error('Error updating conversation title:', error);
        }
      }
      
      if (import.meta.env.DEV) {
        logger.log('Chat response:', data);
      }
    } catch (error) {
      logger.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      updateMessage(assistantMessageId, {
        status: 'error',
        error: `对话失败: ${errorMessage}。请确保 Python 后端正在运行。`,
      });
    } finally {
      setIsTyping(false);
      setStreaming(false, null);
      scrollToBottom();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping || !currentKb) {
      if (!currentKb) {
        logger.error('No knowledge base selected');
        toast.error('请先选择一个项目');
      }
      return;
    }

    const query = input.trim();
    setInput('');
    setIsTyping(true);
    setFollowUpQuestions([]); // 1.3.0: 清空之前的 follow_up 问题

    // 1.2.13: 如果没有对话，创建新对话
    // 1.2.25: 公开模式下不需要创建对话记录
    if (!isPublicMode && !currentConversationId && messages.length === 0) {
      try {
        const user = await getCurrentUser();
        if (!user) {
          toast.error('请先登录');
          setIsTyping(false);
          return;
        }

        const title = chatConfig?.welcomeMessage?.substring(0, 50) || '新对话';
        const conversation = await createConversation(currentKb.id, user.id, title);
        addConversation(conversation);
        setCurrentConversationId(conversation.id);
      } catch (error) {
        logger.error('Error creating conversation:', error);
        toast.error('创建对话失败');
        setIsTyping(false);
        return;
      }
    }

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

      // 1.1.15: 准备对话历史（只包含当前项目的对话）
      const conversationHistory = messages
        .filter(msg => msg.status === 'completed')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      // 1.1.15: 调用后端聊天 API（确保使用当前项目的知识库）
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1.1.15: 确保使用当前项目的 share_token
      if (!currentKb.share_token) {
        throw new Error('当前项目没有有效的分享令牌');
      }
      
      if (import.meta.env.DEV) {
        logger.log('Sending chat request:', {
          query,
          kb_id: currentKb.share_token,
          kb_name: currentKb.name,
          kb_id_db: currentKb.id,
        });
      }
      
      // 1.2.24: 使用流式端点实现实时显示
      // 1.2.52: 添加语言参数，确保AI回复使用正确的语言
      const currentLang = i18n.language.split('-')[0];
      const lang = ['zh', 'en', 'ja'].includes(currentLang) ? currentLang : 'zh';
      
      const response = await fetch(`${PY_BACKEND_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          kb_id: currentKb.share_token, // 1.1.15: 使用当前项目的 share_token
          conversation_history: conversationHistory,
          user_id: user?.id, // 1.1.15: 传递用户ID用于权限验证
          language: lang, // 1.2.52: 传递语言参数
        }),
      });

      if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // 1.2.24: 解析 SSE 流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContext = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // 流结束，更新消息状态
          updateMessage(assistantMessageId, {
            status: 'completed',
          });
          break;
        }
        
        // 解码数据
        buffer += decoder.decode(value, { stream: true });
        
        // 解析 SSE 格式: data: {json}\n\n
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // 去掉 "data: " 前缀
            
            if (data === '[DONE]') {
              updateMessage(assistantMessageId, {
                status: 'completed',
              });
              if (import.meta.env.DEV) {
                logger.log('Stream completed');
              }
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              
              if (parsed.chunk) {
                // 1.2.24: 流式追加内容
                appendToMessage(assistantMessageId, parsed.chunk);
              }
              
              if (parsed.done && parsed.answer) {
                // 收到完整答案，保存上下文
                fullContext = parsed.context || '';
                
                // 1.3.11: 处理 citations 引用来源
                if (parsed.citations && Array.isArray(parsed.citations)) {
                  const citations = parsed.citations as Citation[];
                  setCurrentCitations(citations);
                  // 更新消息的 citations
                  updateMessage(assistantMessageId, {
                    citations: citations,
                  });
                  // 如果有引用，自动显示引用面板
                  if (citations.length > 0) {
                    setShowCitationPanel(true);
                  }
                  if (import.meta.env.DEV) {
                    logger.log('Received citations:', citations.length);
                  }
                } else {
                  setCurrentCitations([]);
                }
                
                // 1.3.0: 处理 follow_up 推荐问题
                if (parsed.follow_up && Array.isArray(parsed.follow_up)) {
                  const questions = parsed.follow_up
                    .map((q: any) => q.content || q)
                    .filter((q: string) => q && q.trim());
                  setFollowUpQuestions(questions);
                  if (import.meta.env.DEV) {
                    logger.log('Received follow_up questions:', questions);
                  }
                } else {
                  setFollowUpQuestions([]);
                }
                
                if (import.meta.env.DEV) {
                  logger.log('Received full answer with context');
                }
              }
            } catch (e) {
              // JSON 解析错误，忽略
              if (import.meta.env.DEV) {
                logger.warn('Failed to parse SSE data:', data);
              }
            }
          }
        }
      }
      
      // 1.2.15: 标题更新逻辑已移至 autoSaveMessage，这里不再需要
      
      if (import.meta.env.DEV) {
        logger.log('Stream chat completed');
      }
    } catch (error) {
      logger.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      updateMessage(assistantMessageId, {
        status: 'error',
        error: `对话失败: ${errorMessage}。请确保 Python 后端正在运行。`,
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

  // 1.2.25: 改为指向前端公开分享页面，替代 Chainlit
  // 1.2.52: 从内部测试打开时携带当前语言参数，让公开页面继承语言设置
  const currentLangForShare = i18n.language.split('-')[0];
  const langForShare = ['zh', 'en', 'ja'].includes(currentLangForShare) ? currentLangForShare : 'zh';
  const publicShareUrl = currentKb ? `${window.location.origin}/share/${currentKb.share_token}?lang=${langForShare}` : '';
  // 保留 chainlitUrl 用于错误提示中的链接（向后兼容）
  const chainlitUrl = currentKb ? `${import.meta.env.VITE_CHAINLIT_URL || 'http://localhost:8000'}/?kb_id=${currentKb.share_token}` : '';

  // 1.1.10: 处理新建对话
  // 1.2.13: 修改为清空对话并创建新的对话记录
  // 1.2.14: 重置已保存消息ID集合
  const handleNewConversation = async () => {
    if (confirm('确定要开始新对话吗？当前对话将被清除。')) {
      newConversation();
      savedMessageIdsRef.current.clear(); // 1.2.14: 清空已保存消息ID集合
    }
  };

  // 1.2.13: 处理新对话
  // 1.2.14: 重置已保存消息ID集合
  const handleNewConversationFromSidebar = async () => {
    clearMessages();
    setCurrentConversationId(null);
    savedMessageIdsRef.current.clear(); // 1.2.14: 清空已保存消息ID集合
    if (import.meta.env.DEV) {
      logger.log('New conversation created from sidebar');
    }
  };

  // 1.2.13: 处理选择对话
  // 1.2.14: 重置已保存消息ID集合
  const handleConversationSelect = async (conversationId: string) => {
    setCurrentConversationId(conversationId);
    savedMessageIdsRef.current.clear(); // 1.2.14: 切换对话时清空已保存消息ID集合
    if (import.meta.env.DEV) {
      logger.log('Conversation selected:', conversationId);
    }
  };

  // 1.3.1: 使用 ref 跟踪正在保存的消息ID，防止并发保存
  const savingMessageIdRef = useRef<string | null>(null);

  // 1.2.13: 自动保存消息到数据库
  // 1.2.14: 修复标题更新逻辑，防止重复保存
  // 1.2.25: 公开模式下不保存消息
  // 1.3.1: 彻底修复消息重复保存问题
  const saveMessageToDb = useCallback(
    async (message: ChatMessage, allMessages: ChatMessage[]) => {
      if (isPublicMode || !currentConversationId || !currentKb) return;

      // 1.3.1: 检查消息是否来自数据库（UUID格式）
      // 从数据库加载的消息ID是UUID格式，新创建的消息ID以 'msg-' 开头
      if (!message.id.startsWith('msg-')) {
        if (import.meta.env.DEV) {
          logger.log('Message from database, skipping save:', message.id);
        }
        return;
      }

      // 1.3.1: 检查是否已保存或正在保存
      if (savedMessageIdsRef.current.has(message.id)) {
        if (import.meta.env.DEV) {
          logger.log('Message already saved, skipping:', message.id);
        }
        return;
      }

      // 1.3.1: 检查是否正在保存同一条消息
      if (savingMessageIdRef.current === message.id) {
        if (import.meta.env.DEV) {
          logger.log('Message is being saved, skipping:', message.id);
        }
        return;
      }

      // 1.3.1: 标记正在保存
      savingMessageIdRef.current = message.id;

      try {
        const user = await getCurrentUser();
        if (!user) {
          savingMessageIdRef.current = null;
          return;
        }

        // 1.2.13: 保存消息到数据库
        await saveMessage(
          currentConversationId,
          message.role,
          message.content,
          {
            citations: message.citations || [],
          }
        );

        // 1.2.14: 标记消息已保存
        savedMessageIdsRef.current.add(message.id);

        if (import.meta.env.DEV) {
          logger.log('Message saved successfully:', message.id);
        }

        // 1.2.15: 修复标题更新逻辑
        // 1.3.4: 更新标题后同时更新 store，实现 UI 实时刷新
        const completedMessages = allMessages.filter(msg => msg.status === 'completed');
        const userMessages = completedMessages.filter(msg => msg.role === 'user');
        const assistantMessages = completedMessages.filter(msg => msg.role === 'assistant');
        
        if (message.role === 'user' && userMessages.length === 1) {
          const title = message.content.substring(0, 50);
          await updateConversationTitle(currentConversationId, title);
          // 1.3.4: 同时更新 store 中的对话标题，实现侧边栏实时刷新
          updateConversation(currentConversationId, { title });
        }
        else if (message.role === 'assistant' && assistantMessages.length === 1 && userMessages.length === 0) {
          const title = message.content.substring(0, 50);
          await updateConversationTitle(currentConversationId, title);
          // 1.3.4: 同时更新 store 中的对话标题，实现侧边栏实时刷新
          updateConversation(currentConversationId, { title });
        }
      } catch (error) {
        logger.error('Error auto-saving message:', error);
      } finally {
        savingMessageIdRef.current = null;
      }
    },
    [isPublicMode, currentConversationId, currentKb, updateConversation]
  );

  // 1.2.13: 监听消息变化，自动保存
  // 1.2.14: 当对话ID变化时，重置已保存消息ID集合
  // 1.3.1: 同时将当前加载的消息ID添加到已保存集合中（它们本来就是从数据库加载的）
  useEffect(() => {
    if (currentConversationId) {
      savedMessageIdsRef.current.clear();
      // 1.3.1: 将所有非 msg- 开头的消息ID添加到已保存集合（它们是从数据库加载的）
      messages.forEach(msg => {
        if (!msg.id.startsWith('msg-')) {
          savedMessageIdsRef.current.add(msg.id);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId]);

  // 1.3.1: 保存所有未保存的已完成消息（不只是最后一条）
  useEffect(() => {
    if (messages.length === 0 || !currentConversationId) return;

    // 1.3.1: 遍历所有消息，保存未保存的已完成消息
    messages.forEach(message => {
      if (
        message.status === 'completed' &&
        message.id.startsWith('msg-') &&
        !savedMessageIdsRef.current.has(message.id) &&
        savingMessageIdRef.current !== message.id
      ) {
        saveMessageToDb(message, messages);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentConversationId]);

  return (
    <div className="flex-1 flex flex-row min-h-0 bg-white relative">
      {/* 1.2.13: 主聊天区域 */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* 1.1.2: 顶部提示栏 */}
        {/* 1.2.25: 公开模式下不显示内部测试提示 */}
        {/* 1.2.52: 使用 i18n 多语言 */}
        {!isPublicMode && (
          <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-xs text-purple-700">{t('internalTestInterface')}</span>
              {/* 1.1.10: 新建对话按钮 */}
              {messages.length > 0 && (
                <button
                  onClick={handleNewConversation}
                  className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
                >
                  {t('newChat')}
                </button>
              )}
            </div>
            {/* 1.2.25: 改为指向公开分享页面 */}
            {publicShareUrl && (
              <a href={publicShareUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-purple-600 flex items-center gap-1 hover:text-purple-700 hover:underline">
                {t('openPublicSharePage')} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* 1.2.17: 对话消息区域 - 可滚动，为底部固定输入框留出空间 */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6 pb-24 space-y-4 min-h-0">
        {messages.length === 0 ? (
          // 1.2.55: 如果知识库没有文档，显示空知识库提示
          !loadingDocuments && hasDocuments === false ? (
            <div className="flex flex-col min-h-full py-8">
              {/* 空知识库提示 - 聊天消息样式 */}
              <div className="flex gap-3 justify-start">
                {/* AI头像 */}
                <div className="flex-shrink-0">
                  <Avatar avatarUrl={getAvatarUrl()} size="md" />
                </div>

                {/* 提示消息气泡 */}
                <div className="flex-1 max-w-3xl">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3 inline-block">
                    <p className="text-gray-800 leading-relaxed">
                      {t('emptyKnowledgeBaseMessage')}
                    </p>
                  </div>
                  {/* 跳转按钮 */}
                  <div className="mt-4">
                    <a
                      href={`/knowledge-base?project=${projectId}`}
                      className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
                    >
                      {t('goToKnowledgeBase')}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          // 1.2.7: 优化欢迎界面UI，使其更像聊天消息样式
          // 1.2.12: 如果chatConfig还未加载，显示loading状态
          // 1.2.56: 优化加载体验 - 只等待 chatConfig 和文档检查，高频问题可以异步加载
          !chatConfig || loadingDocuments ? (
            <div className="flex flex-col min-h-full py-8">
              {/* Loading状态 - 聊天消息样式 */}
              <div className="flex gap-3 justify-start">
                {/* AI头像 - 1.2.23: 使用Avatar组件，显示用户配置的头像，如果还没有配置则显示默认头像 */}
                <div className="flex-shrink-0">
                  {currentKb ? (
                    <Avatar avatarUrl={getAvatarUrl()} size="md" />
                  ) : (
                    // 如果currentKb还没有加载，显示骨架屏（避免默认头像闪烁）
                    <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
                  )}
                </div>

                {/* Loading消息气泡 */}
                <div className="flex-1 max-w-3xl">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3 inline-block">
                    <div className="flex items-center gap-2">
                      {/* YUI旋转放大缩小动画 */}
                      <span
                        className="inline-block text-primary font-semibold yui-loading-animation"
                      >
                        YUI
                      </span>
                      {/* 1.2.27: 国际化思考中文本 */}
                      <p className="text-gray-800 leading-relaxed">
                        {t('aiThinking')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col min-h-full py-8">
              {/* AI消息气泡 - 包含头像和欢迎语 */}
              <div className="flex gap-3 justify-start mb-6">
                {/* AI头像 - 1.2.23: 使用Avatar组件 */}
                <div className="flex-shrink-0">
                  <Avatar avatarUrl={getAvatarUrl()} size="md" />
                </div>

                {/* 欢迎语消息气泡 */}
                <div className="flex-1 max-w-3xl">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3 inline-block">
                    <p className="text-gray-800 leading-relaxed">
                      {chatConfig.welcomeMessage}
                    </p>
                  </div>
                </div>
              </div>

            {/* 推荐问题按钮 - 1.2.56: 异步加载时显示骨架屏或默认问题 */}
            <div className="space-y-3 max-w-3xl ml-[52px]" key={chatConfig?.recommendedQuestions?.join(',') || 'default'}>
              {/* 1.2.56: 如果正在加载问题且没有缓存的问题，显示骨架屏 */}
              {loadingQuestions && (!chatConfig?.recommendedQuestions || chatConfig.recommendedQuestions.length === 0) ? (
                // 骨架屏加载动画
                <>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={`skeleton-${i}`}
                      className="w-full px-4 py-3 bg-gray-100 rounded-xl animate-pulse"
                    >
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  ))}
                </>
              ) : (
                // 1.2.39: 简化渲染逻辑，直接渲染推荐问题或默认问题
                (chatConfig?.recommendedQuestions && chatConfig.recommendedQuestions.length > 0
                  ? chatConfig.recommendedQuestions
                  : [t('defaultQuestion1'), t('defaultQuestion2'), t('defaultQuestion3')]
                ).map((question: string, index: number) => (
                  <motion.button
                    key={`question-${question.substring(0, 20)}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRecommendedQuestionClick(question);
                    }}
                    disabled={isTyping}
                    className="w-full px-4 py-3 text-left bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span className="text-gray-800 text-sm">
                      {question}
                    </span>
                  </motion.button>
                ))
              )}
            </div>

            {/* 1.2.8: 添加免责声明 */}
            {/* 1.2.28: 使用 i18n 翻译免责声明 */}
            <div className="mt-6 ml-[52px] text-xs text-gray-400">
              {t('aiGeneratedDisclaimer')}
            </div>
          </div>
          ))
        ) : (
          messages.map((message) => {
            // 1.2.10: 当消息状态为streaming时，完全隐藏这个消息，只显示isTyping的loading行
            if (message.role === 'assistant' && message.status === 'streaming') {
              return null;
            }
            
            return (
              <motion.div key={message.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  // 1.2.23: 使用项目头像，如果没有设置则使用默认头像
                  <Avatar avatarUrl={getAvatarUrl()} size="sm" />
                )}
                <div className={`max-w-[80%] rounded-lg px-4 py-3 ${message.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-900'}`}>
                  {message.role === 'assistant' ? (
                    <>
                      <MarkdownRenderer content={message.content} isStreaming={message.status === 'streaming'} />
                      {/* 1.3.11: 引用来源标签 */}
                      {message.citations && message.citations.length > 0 && message.status === 'completed' && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <button
                            onClick={() => {
                              setCurrentCitations(message.citations || []);
                              setShowCitationPanel(true);
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-full hover:bg-primary/20 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            <span>{t('citationSources') || '引用来源'}: {message.citations.length}</span>
                          </button>
                        </div>
                      )}
                      {message.status === 'error' && message.error && (
                        <div className="mt-2 flex flex-col gap-2">
                          <p className="text-red-600 text-sm">{message.error}</p>
                          {/* 1.2.25: 改为指向公开分享页面 */}
                          {publicShareUrl && (
                            <a href={publicShareUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                              在公开页面重试 <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
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
            );
          })
        )}
        {/* 1.3.0: 显示 follow_up 推荐问题 */}
        {!isTyping && followUpQuestions.length > 0 && messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="ml-11 space-y-2 mt-4"
          >
            <p className="text-xs text-gray-500 mb-2">{t('followUpQuestions') || '您可能还想问：'}</p>
            <div className="flex flex-wrap gap-2">
              {followUpQuestions.slice(0, 3).map((question, index) => (
                <motion.button
                  key={`followup-${index}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => {
                    setFollowUpQuestions([]); // 清空当前 follow_up
                    handleRecommendedQuestionClick(question);
                  }}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700 text-left"
                >
                  {question}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
        {isTyping && (
          <div className="flex gap-3 justify-start">
            {/* 1.2.23: 使用项目头像，如果没有设置则使用默认头像 */}
            <Avatar avatarUrl={getAvatarUrl()} size="sm" />
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <span className="inline-block text-gray-400 font-semibold yui-loading-animation text-sm">YUI</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 1.2.17: 输入框固定在网页最下方 */}
      {/* 1.2.55: 当知识库没有文档时禁用输入框 */}
      <div className="fixed bottom-0 right-0 border-t border-gray-200 bg-white z-40" style={{ left: `${sidebarWidth}px` }}>
        <div className="px-4 py-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={hasDocuments === false ? t('emptyKnowledgeBasePlaceholder') : t('chatInputPlaceholder')}
              disabled={isTyping || hasDocuments === false}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping || hasDocuments === false}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isTyping ? <span className="inline-block text-white font-semibold yui-loading-animation text-xs">YUI</span> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 1.3.11: 引用来源面板 */}
      <AnimatePresence>
        {showCitationPanel && currentCitations.length > 0 && (
          <CitationPanel
            citations={currentCitations}
            isOpen={showCitationPanel}
            onClose={() => {
              setShowCitationPanel(false);
              setSelectedCitationId(undefined); // 1.3.11: 关闭时清除选中状态
            }}
            selectedCitationId={selectedCitationId}
            onSelectCitation={setSelectedCitationId}
          />
        )}
      </AnimatePresence>

      {/* 1.2.16: 对话记录浮窗 */}
      {/* 1.2.25: 公开模式下不显示对话记录 */}
      {!isPublicMode && (
        <ConversationHistorySidebar
          kbId={currentKb?.id || null}
          onConversationSelect={handleConversationSelect}
          onNewConversation={handleNewConversationFromSidebar}
        />
      )}
    </div>
  );
}
