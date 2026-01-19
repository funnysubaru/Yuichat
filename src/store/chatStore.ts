// 1.0.0: YUIChat 项目 - 聊天状态管理
// 1.1.10: 添加会话持久化和管理功能
// 1.2.13: 添加对话记录列表管理功能
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, MessageStatus } from '../types/chat';
import type { Conversation } from '../services/conversationService';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamingMessageId: string | null;
  currentConversationId: string | null;
  currentKbId: string | null; // 1.1.10: 当前知识库 ID
  conversations: Conversation[]; // 1.2.13: 对话列表
  
  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  appendToMessage: (id: string, text: string) => void;
  setStreaming: (isStreaming: boolean, messageId?: string | null) => void;
  clearMessages: () => void;
  getConversationHistory: () => Array<{ role: string; content: string }>;
  loadConversationFromHistory: (conversationMessages: ChatMessage[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  getCurrentConversationId: () => string | null;
  setCurrentKbId: (id: string | null) => void; // 1.1.10: 设置当前知识库
  newConversation: () => void; // 1.1.10: 开始新对话
  
  // 1.2.13: 对话列表管理
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  removeConversation: (conversationId: string) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isStreaming: false,
      currentStreamingMessageId: null,
      currentConversationId: null,
      currentKbId: null, // 1.1.10
      conversations: [], // 1.2.13: 对话列表

      addMessage: (message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
        };
        set((state) => ({
          messages: [...state.messages, newMessage],
        }));
        return newMessage.id;
      },

      updateMessage: (id, updates) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          ),
        }));
      },

      appendToMessage: (id, text) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, content: msg.content + text } : msg
          ),
        }));
      },

      setStreaming: (isStreaming, messageId = null) => {
        set({
          isStreaming,
          currentStreamingMessageId: messageId,
        });
      },

      clearMessages: () => {
        set({
          messages: [],
          isStreaming: false,
          currentStreamingMessageId: null,
        });
      },

      getConversationHistory: () => {
        const { messages } = get();
        return messages
          .filter((msg) => msg.status !== 'error')
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));
      },

      loadConversationFromHistory: (conversationMessages) => {
        set({
          messages: conversationMessages,
        });
      },

      setCurrentConversationId: (id) => {
        set({ currentConversationId: id });
      },

      getCurrentConversationId: () => {
        return get().currentConversationId;
      },

      // 1.1.10: 设置当前知识库
      setCurrentKbId: (id) => {
        set({ currentKbId: id });
      },

      // 1.1.10: 开始新对话
      // 1.2.13: 修改为只清空消息，不生成新的conversationId（由服务层创建）
      newConversation: () => {
        set({
          messages: [],
          isStreaming: false,
          currentStreamingMessageId: null,
          currentConversationId: null, // 1.2.13: 清空对话ID，等待服务层创建
        });
      },
      
      // 1.2.13: 设置对话列表
      setConversations: (conversations) => {
        set({ conversations });
      },
      
      // 1.2.13: 添加对话到列表（插入到开头）
      addConversation: (conversation) => {
        set((state) => ({
          conversations: [conversation, ...state.conversations],
        }));
      },
      
      // 1.2.13: 从列表中删除对话
      removeConversation: (conversationId) => {
        set((state) => ({
          conversations: state.conversations.filter((conv) => conv.id !== conversationId),
        }));
      },
      
      // 1.2.13: 更新对话信息
      updateConversation: (conversationId, updates) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId ? { ...conv, ...updates } : conv
          ),
        }));
      },
    }),
    {
      name: 'yuichat-storage', // 1.1.10: localStorage 键名
      partialize: (state) => ({ 
        // 1.1.10: 只持久化消息历史和对话 ID，不持久化流状态
        // 1.2.13: 不持久化对话列表，每次从数据库加载
        messages: state.messages,
        currentConversationId: state.currentConversationId,
        currentKbId: state.currentKbId,
        // conversations: state.conversations, // 1.2.13: 注释掉，对话列表从数据库加载
      }),
    }
  )
);

