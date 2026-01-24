/**
 * 1.3.14: 统计服务
 * 提供对话统计、高频问题分析等功能
 */

import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

// 对话统计数据类型
export interface ConversationStats {
  totalConversations: number;
  testConversations: number;
  publicConversations: number;
  totalMessages: number;
  todayConversations: number;
}

// 高频问题类型
export interface FrequentQuestion {
  question: string;
  frequency: number;
  lastAsked: string;
}

// 保存周期类型
export type RetentionPeriod = 'permanent' | '3_months' | '6_months' | '1_year';

// 对话设置类型
export interface ConversationSettings {
  id: string;
  knowledgeBaseId: string;
  retentionPeriod: RetentionPeriod;
  createdAt: string;
  updatedAt: string;
}

/**
 * 1.3.14: 获取对话统计数据
 */
export async function getConversationStats(kbId: string): Promise<ConversationStats> {
  try {
    const { data, error } = await supabase.rpc('get_conversation_stats', {
      p_knowledge_base_id: kbId,
    });

    if (error) throw error;

    // 函数返回的是数组，取第一个元素
    const stats = data?.[0] || {
      total_conversations: 0,
      test_conversations: 0,
      public_conversations: 0,
      total_messages: 0,
      today_conversations: 0,
    };

    return {
      totalConversations: stats.total_conversations || 0,
      testConversations: stats.test_conversations || 0,
      publicConversations: stats.public_conversations || 0,
      totalMessages: stats.total_messages || 0,
      todayConversations: stats.today_conversations || 0,
    };
  } catch (error) {
    logger.error('Error getting conversation stats:', error);
    // 返回默认值而不是抛出错误
    return {
      totalConversations: 0,
      testConversations: 0,
      publicConversations: 0,
      totalMessages: 0,
      todayConversations: 0,
    };
  }
}

/**
 * 1.3.14: 获取高频问题列表
 */
export async function getFrequentQuestions(
  kbId: string,
  limit: number = 10,
  startDate?: string,
  endDate?: string
): Promise<FrequentQuestion[]> {
  try {
    const { data, error } = await supabase.rpc('get_frequent_questions', {
      p_knowledge_base_id: kbId,
      p_limit: limit,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      question: item.question,
      frequency: item.frequency,
      lastAsked: item.last_asked,
    }));
  } catch (error) {
    logger.error('Error getting frequent questions:', error);
    return [];
  }
}

/**
 * 1.3.14: 获取对话设置
 */
export async function getConversationSettings(kbId: string): Promise<ConversationSettings | null> {
  try {
    const { data, error } = await supabase
      .from('conversation_settings')
      .select('*')
      .eq('knowledge_base_id', kbId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 记录不存在，返回 null
        return null;
      }
      throw error;
    }

    return {
      id: data.id,
      knowledgeBaseId: data.knowledge_base_id,
      retentionPeriod: data.retention_period,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    logger.error('Error getting conversation settings:', error);
    return null;
  }
}

/**
 * 1.3.14: 更新对话保存周期设置
 */
export async function updateRetentionPeriod(
  kbId: string,
  retentionPeriod: RetentionPeriod
): Promise<ConversationSettings | null> {
  try {
    // 尝试更新现有记录
    const { data: existingData, error: selectError } = await supabase
      .from('conversation_settings')
      .select('id')
      .eq('knowledge_base_id', kbId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError;
    }

    if (existingData) {
      // 更新现有记录
      const { data, error } = await supabase
        .from('conversation_settings')
        .update({
          retention_period: retentionPeriod,
          updated_at: new Date().toISOString(),
        })
        .eq('knowledge_base_id', kbId)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        knowledgeBaseId: data.knowledge_base_id,
        retentionPeriod: data.retention_period,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } else {
      // 创建新记录
      const { data, error } = await supabase
        .from('conversation_settings')
        .insert({
          knowledge_base_id: kbId,
          retention_period: retentionPeriod,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        knowledgeBaseId: data.knowledge_base_id,
        retentionPeriod: data.retention_period,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }
  } catch (error) {
    logger.error('Error updating retention period:', error);
    return null;
  }
}

/**
 * 1.3.14: 计算过期时间
 */
export function calculateExpiresAt(retentionPeriod: RetentionPeriod): Date | null {
  if (retentionPeriod === 'permanent') {
    return null;
  }

  const now = new Date();
  switch (retentionPeriod) {
    case '3_months':
      return new Date(now.setMonth(now.getMonth() + 3));
    case '6_months':
      return new Date(now.setMonth(now.getMonth() + 6));
    case '1_year':
      return new Date(now.setFullYear(now.getFullYear() + 1));
    default:
      return null;
  }
}

/**
 * 1.3.14: 获取保存周期的显示文本
 */
export function getRetentionPeriodLabel(period: RetentionPeriod, t: (key: string) => string): string {
  switch (period) {
    case 'permanent':
      return t('retentionPermanent');
    case '3_months':
      return t('retention3Months');
    case '6_months':
      return t('retention6Months');
    case '1_year':
      return t('retention1Year');
    default:
      return period;
  }
}
