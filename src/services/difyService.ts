/**
 * 1.0.0: YUIChat 项目 - Dify 服务层
 * 处理与 Dify API 的交互，包括流式响应解析
 * 1.0.1: 支持无 Supabase 配置的 UI 预览模式
 */

import { supabase, isSupabaseAvailable } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { Citation } from '../types/chat';

// Supabase Edge Function URL
const getDifyProxyUrl = (): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL');
  }
  return `${supabaseUrl}/functions/v1/dify-proxy`;
};

// Dify SSE 事件类型
interface DifySSEEvent {
  event: 'message' | 'message_end' | 'agent_thought' | 'error';
  answer?: string;
  metadata?: {
    retriever_resources?: Array<{
      content: string;
      dataset_id: string;
      dataset_name: string;
      document_id: string;
      document_name: string;
      score?: number;
    }>;
  };
  error?: string;
}

/**
 * 解析 Dify SSE 流式响应
 */
function parseSSEChunk(chunk: string): DifySSEEvent[] {
  const events: DifySSEEvent[] = [];
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));
        events.push(data);
      } catch (error) {
        logger.error('Failed to parse SSE data:', error, line);
      }
    }
  }
  
  return events;
}

/**
 * 将 Dify 的 retriever_resources 转换为 Citation 格式
 */
function convertToCitations(resources?: DifySSEEvent['metadata']['retriever_resources']): Citation[] {
  if (!resources || resources.length === 0) {
    return [];
  }
  
  return resources.map((resource) => ({
    documentId: resource.document_id,
    documentName: resource.document_name,
    content: resource.content,
    score: resource.score,
  }));
}

/**
 * 获取 Dify 流式响应
 * 1.0.1: 支持无 Supabase 配置模式（返回 mock 数据用于 UI 预览）
 */
export async function* getDifyStreamingResponse(
  query: string,
  conversationId: string | null,
  userId: string
): AsyncGenerator<{ text?: string; citations?: Citation[]; done?: boolean; error?: string }, void, unknown> {
  // UI preview mode: return mock response
  if (!isSupabaseAvailable) {
    const mockResponse = `这是基于您的知识库的回答示例。您的问题："${query}"\n\n在 UI 预览模式下，这是模拟的响应。配置 Supabase 和 Dify 后，将显示真实的 AI 回答。`;
    const words = mockResponse.split('');
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 30));
      yield { text: words[i] };
    }
    yield { 
      citations: [
        { documentId: 'mock-1', documentName: '示例文档.pdf', content: '示例内容', score: 0.95 }
      ],
      done: true 
    };
    return;
  }

  const url = getDifyProxyUrl();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('User not authenticated');
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        conversation_id: conversationId,
        user_id: userId,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dify API error: ${response.status} ${errorText}`);
    }
    
    if (!response.body) {
      throw new Error('Response body is null');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let citations: Citation[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // 发送最后的引用来源
        if (citations.length > 0) {
          yield { citations, done: true };
        } else {
          yield { done: true };
        }
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      const events = parseSSEChunk(buffer);
      
      // 处理完整的事件
      for (const event of events) {
        if (event.event === 'message' && event.answer) {
          yield { text: event.answer };
        } else if (event.event === 'message_end') {
          if (event.metadata?.retriever_resources) {
            citations = convertToCitations(event.metadata.retriever_resources);
            yield { citations, done: true };
          } else {
            yield { done: true };
          }
        } else if (event.event === 'error') {
          yield { error: event.error || 'Unknown error', done: true };
          break;
        }
      }
      
      // 清空已处理的数据
      const lastNewlineIndex = buffer.lastIndexOf('\n');
      if (lastNewlineIndex !== -1) {
        buffer = buffer.slice(lastNewlineIndex + 1);
      }
    }
  } catch (error) {
    logger.error('Error in getDifyStreamingResponse:', error);
    yield { 
      error: error instanceof Error ? error.message : 'Unknown error',
      done: true 
    };
  }
}

/**
 * 发送消息到 Dify（非流式）
 */
export async function sendMessageToDify(
  query: string,
  conversationId: string | null,
  userId: string
): Promise<{ answer: string; citations: Citation[]; conversationId: string }> {
  const url = getDifyProxyUrl();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('User not authenticated');
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      conversation_id: conversationId,
      user_id: userId,
      response_mode: 'blocking',
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dify API error: ${response.status} ${errorText}`);
  }
  
  const data = await response.json();
  const citations = convertToCitations(data.metadata?.retriever_resources);
  
  return {
    answer: data.answer || '',
    citations,
    conversationId: data.conversation_id || conversationId || '',
  };
}

