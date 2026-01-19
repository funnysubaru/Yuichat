/**
 * 1.2.13: 对话记录服务层
 * 处理对话会话和消息的CRUD操作
 */

import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { ChatMessage } from '../types/chat';

export interface Conversation {
  id: string;
  knowledge_base_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
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
