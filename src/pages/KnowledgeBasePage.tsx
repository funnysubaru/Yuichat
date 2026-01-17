/**
 * 1.0.0: YUIChat 项目 - 知识库管理页面
 * ChatMax 风格的 UI 设计
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { motion } from 'framer-motion';
import { Search, Plus, FileText, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { UploadKnowledgeModal } from '../components/UploadKnowledgeModal';
import { supabase, isSupabaseAvailable } from '../lib/supabase';
import { getCurrentUser } from '../services/authService';
import { uploadFileToKB } from '../services/kbService';
import type { Document } from '../types/knowledgeBase';
import { logger } from '../utils/logger';
import { toast } from 'react-hot-toast';

export function KnowledgeBasePage() {
  const { t } = useTranslation();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentKb, setCurrentKb] = useState<any>(null);

  useEffect(() => {
    loadKBAndDocuments();
  }, []);

  const loadKBAndDocuments = async () => {
    setIsLoading(true);
    try {
      if (!isSupabaseAvailable) {
        // ... mock 逻辑保持不变 ...
        loadDocuments(); // 调用原有的 mock 加载
        return;
      }

      const user = await getCurrentUser();
      if (!user) return;

      // 1.1.2: 获取当前用户的第一个知识库作为默认（实际应有知识库选择器）
      const { data: kbData, error: kbError } = await supabase
        .from('knowledge_bases')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (kbError && kbError.code !== 'PGRST116') throw kbError;
      
      let kb = kbData;
      if (!kb) {
        // 自动创建一个默认知识库
        const { data: newKb, error: createError } = await supabase
          .from('knowledge_bases')
          .insert({
            user_id: user.id,
            name: t('defaultProject'),
            dify_dataset_id: ''
          })
          .select()
          .single();
        if (createError) throw createError;
        kb = newKb;
      }
      
      setCurrentKb(kb);

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('knowledge_base_id', kb.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      logger.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (type: 'file' | 'audio' | 'website', data: File | string | string[]) => {
    if (!isSupabaseAvailable) {
      alert(t('uiPreviewUpload'));
      return;
    }

    if (!currentKb) {
      toast.error('No knowledge base selected');
      return;
    }

    try {
      if (type === 'file' || type === 'audio') {
        const file = data as File;
        
        // 1.1.2: 使用新的上传流
        toast.loading(t('uploading'), { id: 'upload' });
        
        // 先在数据库创建记录
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .insert({
            knowledge_base_id: currentKb.id,
            filename: file.name,
            file_type: file.name.split('.').pop(),
            file_size: file.size,
            status: 'processing',
            dify_document_id: '' // 不再强制需要
          })
          .select()
          .single();

        if (docError) throw docError;

        // 调用 Python 后端处理
        await uploadFileToKB(currentKb.id, file);
        
        // 更新数据库记录为已完成（实际应由后端回调，这里简化处理）
        await supabase
          .from('documents')
          .update({ status: 'completed' })
          .eq('id', doc.id);

        toast.success(t('success'), { id: 'upload' });
        await loadKBAndDocuments();
      } else if (type === 'website') {
        // TODO: 网站处理逻辑
      }
    } catch (error) {
      logger.error('Upload error:', error);
      toast.error(t('error'), { id: 'upload' });
      throw error;
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm(t('confirmDelete'))) return;

    // 1.0.1: UI 预览模式
    if (!isSupabaseAvailable) {
      // Remove from mock data
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      return;
    }

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      await loadDocuments();
    } catch (error) {
      logger.error('Delete error:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return t('statusCompleted');
      case 'failed':
        return t('statusFailed');
      default:
        return t('statusProcessing');
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Banner */}
      <div className="bg-gradient-to-r from-primary to-primary-dark text-white p-8 md:p-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {t('knowledgeBaseTitle')}
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-6">
            {t('knowledgeBaseSubtitle')}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-6 py-3 bg-white text-primary rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              {t('createNow')}
            </button>
            <button
              className="px-6 py-3 border-2 border-white text-white rounded-lg hover:bg-white/10 transition-colors font-medium"
            >
              {t('createOnlineDoc')}
            </button>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {t('allDocuments')}
            </h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchFileName')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {t('allDocuments')} - {t('noData')}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('fileNameOrUrl')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('fileSize')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('uploadTime')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('action')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-900">{doc.filename}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {doc.fileType || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(2)} KB` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(doc.status)}
                        <span className="text-sm text-gray-700">
                          {getStatusText(doc.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString(i18n.language)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-red-600 hover:text-red-800 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <UploadKnowledgeModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
      />
    </div>
  );
}

