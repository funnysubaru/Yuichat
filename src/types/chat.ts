// 1.0.0: YUIChat 项目 - 聊天消息类型定义
// 1.3.11: 更新 Citation 类型以匹配后端返回格式
export type MessageRole = 'user' | 'assistant';

export type MessageStatus = 'idle' | 'streaming' | 'completed' | 'error';

// 1.3.11: 更新 Citation 接口以匹配后端返回的数据结构
export interface Citation {
  id: string;              // 1.3.11: 文档片段ID
  source: string;          // 1.3.11: 来源URL或文件名
  content: string;         // 文档片段内容（限制500字符）
  score?: number | null;   // 1.3.11: 相关度分数（可能为null）
  // 1.3.10: 旧字段保留向后兼容
  documentId?: string;
  documentName?: string;
  page?: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  status: MessageStatus;
  error?: string;
  // Optional: image preview URL for user messages
  imageUrl?: string;
  // Citations from knowledge base
  citations?: Citation[];
}

export interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamingMessageId: string | null;
  currentConversationId: string | null;
}

export interface StreamingChunk {
  chunk: string;
  done?: boolean;
  error?: string;
  citations?: Citation[];
}

