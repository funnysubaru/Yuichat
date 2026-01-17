// 1.1.2: YUIChat 项目 - 知识库类型定义
export interface KnowledgeBase {
  id: string;
  user_id: string;
  dify_dataset_id?: string;
  name: string;
  description?: string;
  share_token: string; // 1.1.2: 增加分享令牌
  vector_collection?: string; // 1.1.2: 增加向量集合名称
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  knowledge_base_id: string;
  dify_document_id?: string;
  filename: string;
  file_type?: string;
  file_size?: number;
  status: 'processing' | 'completed' | 'failed';
  storage_path?: string; // 1.1.2: 增加存储路径
  processing_metadata?: any; // 1.1.2: 增加处理元数据
  created_at: string;
  updated_at: string;
}

export type DocumentStatus = 'processing' | 'completed' | 'failed';

export interface UploadFileResponse {
  success: boolean;
  fileId?: string;
  documentId?: string;
  error?: string;
}
