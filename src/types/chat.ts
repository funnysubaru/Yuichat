// 1.0.0: YUIChat 项目 - 聊天消息类型定义
export type MessageRole = 'user' | 'assistant';

export type MessageStatus = 'idle' | 'streaming' | 'completed' | 'error';

export interface Citation {
  documentId: string;
  documentName: string;
  page?: number;
  content: string;
  score?: number;
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

