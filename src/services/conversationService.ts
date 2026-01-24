/**
 * 1.2.13: 对话记录服务层
 * 处理对话会话和消息的CRUD操作
 * 1.3.14: 添加公开对话支持、筛选查询和搜索功能
 */

import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { ChatMessage } from '../types/chat';
import { calculateExpiresAt, type RetentionPeriod } from './statsService';

// 1.3.14: 来源类型
export type SourceType = 'test' | 'public';

export interface Conversation {
  id: string;
  knowledge_base_id: string;
  user_id: string | null; // 1.3.14: 公开模式下可为空
  title: string;
  created_at: string;
  updated_at: string;
  source_type?: SourceType; // 1.3.14: 来源类型
  session_id?: string; // 1.3.14: 公开用户的会话ID
  expires_at?: string; // 1.3.14: 过期时间
}

// 1.3.14: 带消息预览的对话类型（用于对话数据页面）
export interface ConversationWithPreview extends Conversation {
  firstMessage?: string; // 第一条用户消息
  lastResponse?: string; // 最后一条AI回复
  messageCount?: number; // 消息数量
}

// 1.3.14: 对话筛选条件
export interface ConversationFilter {
  sourceType?: SourceType | 'all';
  startDate?: string;
  endDate?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
  created_at: string;
}

/**
 * 1.2.13: 获取指定知识库的对话列表（按更新时间降序）
 */
export async function listConversations(kbId: string, userId: string): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('knowledge_base_id', kbId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50); // 1.2.13: 限制返回最多50条对话

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Error listing conversations:', error);
    throw error;
  }
}

/**
 * 1.2.13: 创建新对话
 */
export async function createConversation(
  kbId: string,
  userId: string,
  title: string = '新对话'
): Promise<Conversation> {
  try {
    // 1.2.13: 截断标题到100字符
    const truncatedTitle = title.length > 100 ? title.substring(0, 100) : title;

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        knowledge_base_id: kbId,
        user_id: userId,
        title: truncatedTitle,
      })
      .select()
      .single();

    if (error) throw error;

    logger.log('Conversation created:', data);
    return data;
  } catch (error) {
    logger.error('Error creating conversation:', error);
    throw error;
  }
}

/**
 * 1.2.13: 获取对话详情
 */
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 1.2.13: 记录不存在
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error getting conversation:', error);
    throw error;
  }
}

/**
 * 1.2.13: 获取对话消息列表
 */
export async function getConversationMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  try {
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Error getting conversation messages:', error);
    throw error;
  }
}

/**
 * 1.2.13: 删除对话（级联删除消息）
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw error;

    logger.log('Conversation deleted:', conversationId);
  } catch (error) {
    logger.error('Error deleting conversation:', error);
    throw error;
  }
}

/**
 * 1.2.13: 保存消息到对话
 */
export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: any
): Promise<ConversationMessage> {
  try {
    const { data, error } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    // 1.2.13: 更新对话的updated_at时间
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  } catch (error) {
    logger.error('Error saving message:', error);
    throw error;
  }
}

/**
 * 1.2.13: 批量保存消息到对话
 */
export async function saveMessages(
  conversationId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string; metadata?: any }>
): Promise<ConversationMessage[]> {
  try {
    const messagesToInsert = messages.map((msg) => ({
      conversation_id: conversationId,
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata || {},
    }));

    const { data, error } = await supabase
      .from('conversation_messages')
      .insert(messagesToInsert)
      .select();

    if (error) throw error;

    // 1.2.13: 更新对话的updated_at时间
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data || [];
  } catch (error) {
    logger.error('Error saving messages:', error);
    throw error;
  }
}

/**
 * 1.2.13: 更新对话标题
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  try {
    // 1.2.13: 截断标题到100字符
    const truncatedTitle = title.length > 100 ? title.substring(0, 100) : title;

    const { error } = await supabase
      .from('conversations')
      .update({
        title: truncatedTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (error) throw error;

    logger.log('Conversation title updated:', conversationId);
  } catch (error) {
    logger.error('Error updating conversation title:', error);
    throw error;
  }
}

/**
 * 1.2.13: 将ConversationMessage转换为ChatMessage
 */
export function convertToChatMessage(msg: ConversationMessage): ChatMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.created_at).getTime(),
    status: 'completed',
    citations: msg.metadata?.citations || [],
  };
}

// ============================================
// 1.3.14: 新增公开对话和筛选查询功能
// ============================================

/**
 * 1.3.14: 生成会话ID（用于公开用户标识）
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 1.3.14: 获取或创建会话ID（存储在 localStorage）
 */
export function getOrCreateSessionId(): string {
  const STORAGE_KEY = 'yuichat_session_id';
  let sessionId = localStorage.getItem(STORAGE_KEY);
  
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(STORAGE_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * 1.3.14: 创建公开对话（外部分享用户）
 */
export async function createPublicConversation(
  kbId: string,
  sessionId: string,
  title: string = '新对话',
  retentionPeriod?: RetentionPeriod
): Promise<Conversation> {
  try {
    const truncatedTitle = title.length > 100 ? title.substring(0, 100) : title;
    const expiresAt = retentionPeriod ? calculateExpiresAt(retentionPeriod) : null;

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        knowledge_base_id: kbId,
        user_id: null, // 公开模式不关联用户
        title: truncatedTitle,
        source_type: 'public',
        session_id: sessionId,
        expires_at: expiresAt?.toISOString() || null,
      })
      .select()
      .single();

    if (error) throw error;

    logger.log('Public conversation created:', data);
    return data;
  } catch (error) {
    logger.error('Error creating public conversation:', error);
    throw error;
  }
}

/**
 * 1.3.14: 带筛选条件的对话列表查询（用于对话数据页面）
 */
export async function listConversationsWithFilter(
  kbId: string,
  filter: ConversationFilter = {}
): Promise<ConversationWithPreview[]> {
  try {
    const {
      sourceType = 'all',
      startDate,
      endDate,
      keyword,
      limit = 50,
      offset = 0,
    } = filter;

    // 构建基础查询
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('knowledge_base_id', kbId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 添加来源类型筛选
    if (sourceType && sourceType !== 'all') {
      query = query.eq('source_type', sourceType);
    }

    // 添加日期范围筛选
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: conversations, error } = await query;

    if (error) throw error;

    if (!conversations || conversations.length === 0) {
      return [];
    }

    // 获取每个对话的消息预览
    const conversationIds = conversations.map((c) => c.id);
    const { data: messages, error: msgError } = await supabase
      .from('conversation_messages')
      .select('conversation_id, role, content')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true });

    if (msgError) {
      logger.error('Error getting messages for preview:', msgError);
    }

    // 处理关键词搜索和消息预览
    const result: ConversationWithPreview[] = [];
    
    for (const conv of conversations) {
      const convMessages = messages?.filter((m) => m.conversation_id === conv.id) || [];
      const firstUserMsg = convMessages.find((m) => m.role === 'user');
      const lastAssistantMsg = [...convMessages].reverse().find((m) => m.role === 'assistant');

      // 如果有关键词，检查是否匹配
      if (keyword) {
        const keywordLower = keyword.toLowerCase();
        const matchesTitle = conv.title?.toLowerCase().includes(keywordLower);
        const matchesMessage = convMessages.some((m) =>
          m.content?.toLowerCase().includes(keywordLower)
        );
        
        if (!matchesTitle && !matchesMessage) {
          continue; // 跳过不匹配的对话
        }
      }

      result.push({
        ...conv,
        firstMessage: firstUserMsg?.content,
        lastResponse: lastAssistantMsg?.content,
        messageCount: convMessages.length,
      });
    }

    return result;
  } catch (error) {
    logger.error('Error listing conversations with filter:', error);
    throw error;
  }
}

/**
 * 1.3.14: 搜索对话记录
 */
export async function searchConversations(
  kbId: string,
  keyword: string,
  limit: number = 50
): Promise<ConversationWithPreview[]> {
  return listConversationsWithFilter(kbId, { keyword, limit });
}

/**
 * 1.3.14: 获取对话记录总数（用于分页）
 */
export async function getConversationCount(
  kbId: string,
  filter: Omit<ConversationFilter, 'limit' | 'offset'> = {}
): Promise<number> {
  try {
    const { sourceType = 'all', startDate, endDate } = filter;

    let query = supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('knowledge_base_id', kbId);

    if (sourceType && sourceType !== 'all') {
      query = query.eq('source_type', sourceType);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { count, error } = await query;

    if (error) throw error;

    return count || 0;
  } catch (error) {
    logger.error('Error getting conversation count:', error);
    return 0;
  }
}

/**
 * 1.3.14: 获取公开对话的会话ID对应的对话列表
 */
export async function listPublicConversations(
  kbId: string,
  sessionId: string
): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('knowledge_base_id', kbId)
      .eq('source_type', 'public')
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Error listing public conversations:', error);
    return [];
  }
}
