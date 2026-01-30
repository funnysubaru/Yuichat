/**
 * 1.3.30: QA问答服务层
 * 提供QA问答的CRUD操作和批量上传功能
 */

import { logger } from '../utils/logger';

const PY_BACKEND_URL = import.meta.env.VITE_PY_BACKEND_URL || 'http://localhost:8000';

// QA问答类型定义
export interface QAItem {
  id: string;
  knowledge_base_id: string;
  question: string;
  answer: string;
  similar_questions: string[];
  source: 'custom' | 'batch';
  word_count: number;
  status: 'pending' | 'learned' | 'failed';
  created_at: string;
  updated_at: string;
}

// 上传记录类型定义
export interface QAUploadRecord {
  id: string;
  knowledge_base_id: string;
  filename: string;
  file_size: number;
  total_count: number;
  success_count: number;
  failed_count: number;
  status: 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

// 分页信息类型
export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

// API响应类型
export interface QAListResponse {
  success: boolean;
  data: QAItem[];
  pagination: Pagination;
  error?: string;
}

export interface QAItemResponse {
  success: boolean;
  data?: QAItem;
  error?: string;
}

export interface QAUploadResponse {
  success: boolean;
  record_id?: string;
  total?: number;
  success_count?: number;
  failed_count?: number;
  parse_errors?: string[];
  error?: string;
}

export interface UploadRecordListResponse {
  success: boolean;
  data: QAUploadRecord[];
  pagination: Pagination;
  error?: string;
}

/**
 * 1.3.30: 创建单个QA问答
 */
export async function createQAItem(
  knowledgeBaseId: string,
  question: string,
  answer: string,
  similarQuestions: string[] = []
): Promise<QAItemResponse> {
  try {
    const response = await fetch(`${PY_BACKEND_URL}/api/qa/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        knowledge_base_id: knowledgeBaseId,
        question,
        answer,
        similar_questions: similarQuestions,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create QA item');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error creating QA item:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 1.3.30: 获取QA问答列表
 */
export async function listQAItems(
  knowledgeBaseId: string,
  options: {
    status?: string;
    source?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<QAListResponse> {
  try {
    const params = new URLSearchParams({
      knowledge_base_id: knowledgeBaseId,
      page: String(options.page || 1),
      page_size: String(options.pageSize || 20),
    });

    if (options.status) params.append('status', options.status);
    if (options.source) params.append('source', options.source);
    if (options.search) params.append('search', options.search);

    const response = await fetch(`${PY_BACKEND_URL}/api/qa/list?${params.toString()}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to list QA items');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error listing QA items:', error);
    return { 
      success: false, 
      error: String(error), 
      data: [], 
      pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 } 
    };
  }
}

/**
 * 1.3.30: 获取单个QA问答详情
 */
export async function getQAItem(qaId: string): Promise<QAItemResponse> {
  try {
    const response = await fetch(`${PY_BACKEND_URL}/api/qa/${qaId}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'QA item not found');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error getting QA item:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 1.3.30: 更新QA问答
 */
export async function updateQAItem(
  qaId: string,
  data: {
    question?: string;
    answer?: string;
    similar_questions?: string[];
    status?: string;
  }
): Promise<QAItemResponse> {
  try {
    const response = await fetch(`${PY_BACKEND_URL}/api/qa/${qaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update QA item');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error updating QA item:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 1.3.30: 删除单个QA问答
 */
export async function deleteQAItem(qaId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${PY_BACKEND_URL}/api/qa/${qaId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete QA item');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error deleting QA item:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 1.3.30: 批量删除QA问答
 */
export async function deleteQAItemsBatch(qaIds: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${PY_BACKEND_URL}/api/qa/batch-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qa_ids: qaIds }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete QA items');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error batch deleting QA items:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 1.3.30: 批量上传QA问答 (xlsx文件)
 */
export async function batchUploadQA(
  knowledgeBaseId: string,
  file: File
): Promise<QAUploadResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('knowledge_base_id', knowledgeBaseId);

    const response = await fetch(`${PY_BACKEND_URL}/api/qa/batch-upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to upload QA file');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error batch uploading QA:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 1.3.30: 获取上传记录列表
 */
export async function listUploadRecords(
  knowledgeBaseId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<UploadRecordListResponse> {
  try {
    const params = new URLSearchParams({
      knowledge_base_id: knowledgeBaseId,
      page: String(page),
      page_size: String(pageSize),
    });

    const response = await fetch(`${PY_BACKEND_URL}/api/qa/upload-records?${params.toString()}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to list upload records');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error listing upload records:', error);
    return { 
      success: false, 
      error: String(error), 
      data: [], 
      pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 } 
    };
  }
}

/**
 * 1.3.30: 批量更新QA学习状态
 */
export async function updateQAStatusBatch(
  qaIds: string[],
  status: 'pending' | 'learned' | 'failed'
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${PY_BACKEND_URL}/api/qa/batch-update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qa_ids: qaIds, status }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update QA status');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error batch updating QA status:', error);
    return { success: false, error: String(error) };
  }
}
