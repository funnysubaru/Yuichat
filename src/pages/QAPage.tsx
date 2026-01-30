/**
 * 1.3.30: YUIChat 项目 - QA问答管理页面
 * 参考 ChatMax 风格设计
 * 功能：问答对列表、搜索筛选、批量操作、上传记录
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import i18n from '../i18n';
import {
  Search,
  Plus,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Edit2,
  MoreVertical,
  Download,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { CreateQAModal } from '../components/CreateQAModal';
import { BatchUploadQAModal } from '../components/BatchUploadQAModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { supabase, isSupabaseAvailable } from '../lib/supabase';
import { getCurrentUser } from '../services/authService';
import {
  listQAItems,
  deleteQAItem,
  deleteQAItemsBatch,
  listUploadRecords,
  updateQAStatusBatch,
  type QAItem,
  type QAUploadRecord,
  type Pagination,
} from '../services/qaService';
import { logger } from '../utils/logger';
import { toast } from 'react-hot-toast';

// 1.3.30: Tab类型定义
type TabType = 'qa-list' | 'upload-records';

export function QAPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  
  // Tab状态
  const [activeTab, setActiveTab] = useState<TabType>('qa-list');
  
  // 问答列表状态
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  });
  
  // 上传记录状态
  const [uploadRecords, setUploadRecords] = useState<QAUploadRecord[]>([]);
  const [uploadPagination, setUploadPagination] = useState<Pagination>({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
  });
  
  // 知识库状态
  const [currentKb, setCurrentKb] = useState<any>(null);
  
  // 选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  // 弹窗状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchUploadModalOpen, setIsBatchUploadModalOpen] = useState(false);
  const [editingQA, setEditingQA] = useState<QAItem | null>(null);
  
  // 确认弹窗状态
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    isDelete: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    isDelete: false,
    onConfirm: () => {},
  });

  // 加载知识库
  useEffect(() => {
    loadKnowledgeBase();
  }, [searchParams.get('project')]);

  // 加载数据
  useEffect(() => {
    if (currentKb) {
      if (activeTab === 'qa-list') {
        loadQAItems();
      } else {
        loadUploadRecords();
      }
    }
  }, [currentKb, activeTab, pagination.page, searchQuery, sourceFilter]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.action-menu-container')) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const loadKnowledgeBase = async () => {
    try {
      if (!isSupabaseAvailable) {
        setIsLoading(false);
        return;
      }

      const user = await getCurrentUser();
      if (!user) return;

      const projectId = searchParams.get('project');
      let kb = null;

      if (projectId) {
        const { data: kbData, error: kbError } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', user.id)
          .single();

        if (kbError) {
          logger.error('Knowledge base not found:', kbError);
          toast.error(t('projectNotFound'));
          setIsLoading(false);
          return;
        }
        kb = kbData;
      } else {
        const { data: kbData, error: kbError } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (kbError && kbError.code !== 'PGRST116') throw kbError;
        kb = kbData;
      }

      setCurrentKb(kb);
    } catch (error) {
      logger.error('Error loading knowledge base:', error);
      toast.error(t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadQAItems = async () => {
    if (!currentKb) return;
    
    setIsLoading(true);
    try {
      const result = await listQAItems(currentKb.id, {
        search: searchQuery || undefined,
        source: sourceFilter || undefined,
        page: pagination.page,
        pageSize: pagination.page_size,
      });

      if (result.success) {
        setQaItems(result.data);
        setPagination(result.pagination);
      } else {
        toast.error(result.error || t('loadFailed'));
      }
    } catch (error) {
      logger.error('Error loading QA items:', error);
      toast.error(t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadUploadRecords = async () => {
    if (!currentKb) return;
    
    setIsLoading(true);
    try {
      const result = await listUploadRecords(
        currentKb.id,
        uploadPagination.page,
        uploadPagination.page_size
      );

      if (result.success) {
        setUploadRecords(result.data);
        setUploadPagination(result.pagination);
      } else {
        toast.error(result.error || t('loadFailed'));
      }
    } catch (error) {
      logger.error('Error loading upload records:', error);
      toast.error(t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // 删除单个QA
  const handleDelete = (qaId: string) => {
    setConfirmModal({
      isOpen: true,
      title: t('confirmDeleteTitle'),
      description: t('confirmDeleteQA'),
      isDelete: true,
      onConfirm: async () => {
        try {
          const result = await deleteQAItem(qaId);
          if (result.success) {
            toast.success(t('deleteSuccess'));
            loadQAItems();
          } else {
            toast.error(result.error || t('deleteFailed'));
          }
        } catch (error) {
          logger.error('Delete error:', error);
          toast.error(t('deleteFailed'));
        }
      },
    });
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: t('confirmBatchDeleteTitle'),
      description: t('confirmBatchDelete', { count: selectedIds.size }),
      isDelete: true,
      onConfirm: async () => {
        try {
          const result = await deleteQAItemsBatch(Array.from(selectedIds));
          if (result.success) {
            toast.success(t('deleteSuccess'));
            setSelectedIds(new Set());
            loadQAItems();
          } else {
            toast.error(result.error || t('deleteFailed'));
          }
        } catch (error) {
          logger.error('Batch delete error:', error);
          toast.error(t('deleteFailed'));
        }
      },
    });
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(qaItems.map(item => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 单个选择
  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'learned':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'learned':
        return t('statusLearned');
      case 'failed':
        return t('statusFailed');
      case 'pending':
        return t('statusPending');
      default:
        return status;
    }
  };

  // 获取来源文本
  const getSourceText = (source: string) => {
    switch (source) {
      case 'custom':
        return t('sourceCustom');
      case 'batch':
        return t('sourceBatch');
      default:
        return source;
    }
  };

  // 关闭确认弹窗
  const handleConfirmModalClose = (confirmed: boolean) => {
    if (confirmed) {
      confirmModal.onConfirm();
    }
    setConfirmModal({
      ...confirmModal,
      isOpen: false,
    });
  };

  // 处理搜索
  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 });
    loadQAItems();
  };

  // 处理创建成功
  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    setEditingQA(null);
    loadQAItems();
    toast.success(t('saveSuccess'));
  };

  // 处理上传成功
  const handleUploadSuccess = () => {
    setIsBatchUploadModalOpen(false);
    loadQAItems();
    if (activeTab === 'upload-records') {
      loadUploadRecords();
    }
    toast.success(t('uploadSuccess'));
  };

  // 编辑QA
  const handleEdit = (qa: QAItem) => {
    setEditingQA(qa);
    setIsCreateModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 1.3.30: 页面头部 */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('qaManagement')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('qaManagementDesc')}
              {qaItems.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {t('allLearned')}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsBatchUploadModalOpen(true)}
              className="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {t('batchUploadQA')}
            </button>
            <button
              onClick={() => {
                setEditingQA(null);
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('createQA')}
            </button>
          </div>
        </div>
      </div>

      {/* 1.3.30: Tab导航和筛选 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {/* Tab切换 */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('qa-list')}
              className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                activeTab === 'qa-list'
                  ? 'text-primary border-primary'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {t('qaList')}
            </button>
            <button
              onClick={() => setActiveTab('upload-records')}
              className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                activeTab === 'upload-records'
                  ? 'text-primary border-primary'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {t('uploadRecords')}
            </button>
          </div>

          {/* 筛选和搜索 */}
          {activeTab === 'qa-list' && (
            <div className="flex items-center gap-3">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">{t('allSources')}</option>
                <option value="custom">{t('sourceCustom')}</option>
                <option value="batch">{t('sourceBatch')}</option>
              </select>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={t('searchQuestion')}
                  className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('search')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1.3.30: 批量操作栏 */}
      {activeTab === 'qa-list' && selectedIds.size > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {t('selectedCount', { count: selectedIds.size })}
            </span>
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              {t('batchDelete')}
            </button>
          </div>
        </div>
      )}

      {/* 1.3.30: 内容区域 */}
      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="flex items-center justify-center gap-3">
              <span className="inline-block text-primary font-semibold yui-loading-animation">YUI</span>
              <span className="text-gray-600 thinking-dots">{t('aiThinking')}</span>
            </div>
          </div>
        ) : activeTab === 'qa-list' ? (
          /* QA列表 */
          qaItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>{t('noQAData')}</p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                {t('createFirstQA')}
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={qaItems.length > 0 && selectedIds.size === qaItems.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('question')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('wordCount')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('source')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('updateTime')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('action')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {qaItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={(e) => handleSelectOne(item.id, e.target.checked)}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs truncate text-sm text-gray-900" title={item.question}>
                          {item.question}
                        </div>
                        {item.similar_questions && item.similar_questions.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            +{item.similar_questions.length} {t('similarQuestions')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.word_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getSourceText(item.source)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          <span className="text-sm text-gray-700">{getStatusText(item.status)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(item.updated_at).toLocaleString(i18n.language, {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2 action-menu-container relative">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Edit2 className="w-4 h-4" />
                            {t('edit')}
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            {t('delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 分页 */}
              {pagination.total_pages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {t('paginationInfo', {
                      start: (pagination.page - 1) * pagination.page_size + 1,
                      end: Math.min(pagination.page * pagination.page_size, pagination.total),
                      total: pagination.total,
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('prevPage')}
                    </button>
                    <span className="px-3 py-1 text-sm">
                      {pagination.page} / {pagination.total_pages}
                    </span>
                    <button
                      onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                      disabled={pagination.page >= pagination.total_pages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('nextPage')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          /* 上传记录 */
          uploadRecords.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>{t('noUploadRecords')}</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('filename')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('totalCount')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('successCount')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('failedCount')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('uploadTime')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {uploadRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.filename}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.total_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {record.success_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {record.failed_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {record.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                          {record.status === 'processing' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                          {record.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                          <span className="text-sm text-gray-700">
                            {record.status === 'completed' ? t('completed') :
                             record.status === 'processing' ? t('processing') :
                             t('failed')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(record.created_at).toLocaleString(i18n.language, {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* 弹窗 */}
      <CreateQAModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingQA(null);
        }}
        onSuccess={handleCreateSuccess}
        knowledgeBaseId={currentKb?.id}
        editingQA={editingQA}
      />

      <BatchUploadQAModal
        isOpen={isBatchUploadModalOpen}
        onClose={() => setIsBatchUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
        knowledgeBaseId={currentKb?.id}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={handleConfirmModalClose}
        title={confirmModal.title}
        description={confirmModal.description}
        isDelete={confirmModal.isDelete}
      />
    </div>
  );
}
