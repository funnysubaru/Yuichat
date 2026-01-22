/**
 * 1.1.2: 知识库服务层（项目级管理）
 * 处理文件上传到 Supabase Storage 并同步到 Python 后端
 * 注意：knowledge_base 实际上就是"项目"，一个项目包含多个文档
 * 1.1.5: 添加创建项目功能
 * 1.2.53: 修复私有bucket文件下载问题，使用signedUrl替代publicUrl
 */

import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

const PY_BACKEND_URL = import.meta.env.VITE_PY_BACKEND_URL || 'http://localhost:8000';

/**
 * 1.1.5: 创建新项目（知识库）
 */
export async function createKnowledgeBase(name: string, description: string, userId: string) {
  try {
    // 生成唯一的向量集合名称
    const vectorCollection = `kb_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // 生成分享令牌
    const shareToken = crypto.randomUUID();

    const { data, error } = await supabase
      .from('knowledge_bases')
      .insert({
        name,
        description,
        user_id: userId,
        vector_collection: vectorCollection,
        share_token: shareToken,
        dify_dataset_id: null, // 1.1.5: 不再使用 Dify
      })
      .select()
      .single();

    if (error) throw error;

    logger.log('Knowledge base created:', data);
    return data;
  } catch (error) {
    logger.error('Error creating knowledge base:', error);
    throw error;
  }
}

/**
 * 1.1.5: 获取所有项目列表
 */
export async function listKnowledgeBases(userId: string) {
  try {
    const { data, error } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Error listing knowledge bases:', error);
    throw error;
  }
}

export async function uploadFileToKB(kbId: string, file: File) {
  // 1. 获取项目的 vector_collection
  const { data: kb, error: kbError } = await supabase
    .from('knowledge_bases')
    .select('vector_collection')
    .eq('id', kbId)
    .single();

  if (kbError || !kb) throw new Error('Knowledge base not found');

  const collectionName = kb.vector_collection;

  // 2. 上传到 Supabase Storage
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${kbId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('knowledge-base-files')
    .upload(filePath, file);

  if (error) throw error;

  // 3. 1.2.53: 获取文件的签名 URL（bucket 是私有的，不能使用 getPublicUrl）
  // 签名 URL 有效期 1 小时（3600 秒），足够后端下载和处理
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('knowledge-base-files')
    .createSignedUrl(filePath, 3600);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error(`无法生成文件访问URL: ${signedUrlError?.message || '未知错误'}`);
  }

  const fileUrl = signedUrlData.signedUrl;

  // 4. 通知 Python 后端处理，使用项目的统一 vector_collection
  const response = await fetch(`${PY_BACKEND_URL}/api/process-file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_path: fileUrl,
      collection_name: collectionName, // 1.1.2: 使用项目的向量集合
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || '文件下载失败: ' + (errorData.detail || '后端处理错误'));
  }

  return await response.json();
}

export async function getKnowledgeBase(kbId: string) {
  const { data, error } = await supabase
    .from('knowledge_bases')
    .select('*')
    .eq('id', kbId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * 1.1.11: 上传URL到知识库
 */
export async function uploadUrlsToKB(kbId: string, urls: string[]) {
  // 1. 获取项目的 vector_collection
  const { data: kb, error: kbError } = await supabase
    .from('knowledge_bases')
    .select('vector_collection')
    .eq('id', kbId)
    .single();

  if (kbError || !kb) throw new Error('Knowledge base not found');

  const collectionName = kb.vector_collection;

  // 2. 调用 Python 后端处理URL
  const response = await fetch(`${PY_BACKEND_URL}/api/process-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      urls: urls,
      collection_name: collectionName, // 1.1.11: 使用项目的向量集合
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to process URLs in backend');
  }

  return await response.json();
}

export async function updateShareToken(kbId: string) {
  const { data, error } = await supabase
    .from('knowledge_bases')
    .update({ share_token: crypto.randomUUID() })
    .eq('id', kbId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
