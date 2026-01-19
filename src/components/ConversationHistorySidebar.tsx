/**
 * 1.2.13: 对话记录侧边栏组件
 * 参考ChatMax的设计，显示对话记录列表
 * 1.2.16: 改为浮窗形式，默认显示icon，点击展开/收起
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, MessageSquare, ChevronRight } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import {
  listConversations,
  deleteConversation,
  getConversationMessages,
} from '../services/conversationService';
import { convertToChatMessage } from '../services/conversationService';
import { getCurrentUser } from '../services/authService';
import { logger } from '../utils/logger';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from './ConfirmModal';

interface ConversationHistorySidebarProps {
  kbId: string | null;
  onConversationSelect?: (conversationId: string) => void;
  onNewConversation?: () => void;
}

/**
 * 1.2.13: 格式化时间戳为 YYYY-MM-DD HH:mm:ss
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 1.2.13: 截断文本到指定长度
 */
function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function ConversationHistorySidebar({
  kbId,
  onConversationSelect,
  onNewConversation,
}: ConversationHistorySidebarProps) {
  const {
    conversations,
    currentConversationId,
    setConversations,
    removeConversation,
    loadConversationFromHistory,
    setCurrentConversationId,
    clearMessages,
  } = useChatStore();

  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  // 1.2.16: 浮窗展开/收起状态
  const [isExpanded, setIsExpanded] = useState(false);

  // 1.2.13: 加载对话列表
  useEffect(() => {
    if (!kbId) {
      setConversations([]);
      return;
    }

    const loadConversations = async () => {
      try {
        setLoading(true);
        const user = await getCurrentUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const conversationList = await listConversations(kbId, user.id);
        setConversations(conversationList);
      } catch (error) {
        logger.error('Error loading conversations:', error);
        toast.error('加载对话记录失败');
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [kbId, setConversations]);

  // 1.2.13: 处理创建新对话
  const handleNewConversation = async () => {
    if (!kbId) {
      toast.error('请先选择项目');
      return;
    }

    try {
      const user = await getCurrentUser();
      if (!user) {
        toast.error('请先登录');
        return;
      }

      // 1.2.13: 清空当前消息
      clearMessages();
      setCurrentConversationId(null);

      // 1.2.13: 调用回调
      if (onNewConversation) {
        onNewConversation();
      }
    } catch (error) {
      logger.error('Error creating new conversation:', error);
      toast.error('创建新对话失败');
    }
  };

  // 1.2.13: 处理选择对话
  const handleSelectConversation = async (conversationId: string) => {
    try {
      setLoading(true);

      // 1.2.13: 加载对话消息
      const messages = await getConversationMessages(conversationId);
      const chatMessages = messages.map(convertToChatMessage);

      // 1.2.13: 加载到store
      loadConversationFromHistory(chatMessages);
      setCurrentConversationId(conversationId);

      // 1.2.13: 调用回调
      if (onConversationSelect) {
        onConversationSelect(conversationId);
      }
    } catch (error) {
      logger.error('Error loading conversation:', error);
      toast.error('加载对话失败');
    } finally {
      setLoading(false);
    }
  };

  // 1.2.13: 处理删除对话
  const handleDeleteConversation = async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowDeleteModal(true);
  };

  // 1.2.13: 确认删除
  const handleConfirmDelete = async () => {
    if (!selectedConversationId) return;

    try {
      setDeletingId(selectedConversationId);
      await deleteConversation(selectedConversationId);

      // 1.2.13: 从store中移除
      removeConversation(selectedConversationId);

      // 1.2.13: 如果删除的是当前对话，清空消息
      if (selectedConversationId === currentConversationId) {
        clearMessages();
        setCurrentConversationId(null);
        if (onNewConversation) {
          onNewConversation();
        }
      }

      toast.success('删除成功');
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      toast.error('删除失败');
    } finally {
      setDeletingId(null);
      setShowDeleteModal(false);
      setSelectedConversationId(null);
    }
  };

  if (!kbId) {
    return null;
  }

  // 1.2.16: 浮窗icon模式
  // 1.2.18: 改为右侧中间位置，显示"对话记录"文字
  if (!isExpanded) {
    return (
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
          title="对话记录"
        >
          <MessageSquare className="w-5 h-5 text-gray-700 flex-shrink-0" />
          <span className="text-sm text-gray-700 font-medium whitespace-nowrap">对话记录</span>
        </button>
      </div>
    );
  }

  // 1.2.16: 展开的浮窗模式
  // 1.2.18: 改为右侧中间位置
  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
      {/* 标题栏 */}
      {/* 1.2.18: 箭头在左侧，文字在右侧 */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="收起"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">对话记录</h2>
      </div>

      {/* 新增对话按钮 */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={handleNewConversation}
          className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          新增对话
        </button>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">加载中...</div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">暂无对话记录</div>
        ) : (
          <div className="p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`p-3 rounded-lg mb-2 cursor-pointer transition-colors group relative ${
                  currentConversationId === conv.id
                    ? 'bg-purple-50 border border-purple-200'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleSelectConversation(conv.id)}
              >
                {/* 对话标题 */}
                <div className="text-sm text-gray-900 mb-1 line-clamp-2">
                  {truncateText(conv.title, 50)}
                </div>

                {/* 时间戳 */}
                <div className="text-xs text-gray-500">
                  {formatTimestamp(conv.updated_at)}
                </div>

                {/* 删除按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv.id);
                  }}
                  disabled={deletingId === conv.id}
                  className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 disabled:opacity-50"
                  title="删除对话"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 删除确认模态框 */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={(confirmed) => {
          if (confirmed) {
            handleConfirmDelete();
          } else {
            setShowDeleteModal(false);
            setSelectedConversationId(null);
          }
        }}
        title="删除对话"
        description="确定要删除这个对话吗？此操作不可恢复。"
        isDelete={true}
      />
    </div>
  );
}
