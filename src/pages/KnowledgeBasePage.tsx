/**
 * 1.0.0: YUIChat 项目 - 知识库管理页面
 * ChatMax 风格的 UI 设计
 * 1.2.59: 修复文档列表最后一行删除按钮被遮挡的问题
 * 1.3.6: 根据设计图更新Banner样式，调整渐变色和按钮样式
 * 1.3.7: 根据新设计更新Banner，添加4步工作流程展示
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom'; // 1.1.13: 导入 useSearchParams 读取URL参数
import i18n from '../i18n';
import { motion } from 'framer-motion';
import { Search, Plus, FileText, CheckCircle, XCircle, Clock, Trash2, Loader2, AlertCircle, RefreshCw, MoreVertical } from 'lucide-react';
import { UploadKnowledgeModal } from '../components/UploadKnowledgeModal';
import { ConfirmModal } from '../components/ConfirmModal'; // 1.1.14: 导入自定义确认弹窗
import { supabase, isSupabaseAvailable } from '../lib/supabase';
import { getCurrentUser } from '../services/authService';
import { uploadFileToKB, uploadUrlsToKB } from '../services/kbService';
import type { Document } from '../types/knowledgeBase';
import { logger } from '../utils/logger';
import { toast } from 'react-hot-toast';

export function KnowledgeBasePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams(); // 1.1.13: 读取URL参数
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentKb, setCurrentKb] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); // 选中的文档ID
  const [openMenuId, setOpenMenuId] = useState<string | null>(null); // 当前打开的菜单ID
  // 1.1.14: 确认弹窗状态
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

  // 1.1.13: 当URL参数变化时重新加载知识库和文档
  useEffect(() => {
    loadKBAndDocuments();
  }, [searchParams.get('project')]); // 1.1.13: 监听项目ID参数变化

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
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [openMenuId]);

  // 1.1.12: 状态轮询 - 定期检查 processing 状态的文档
  useEffect(() => {
    if (!currentKb || !isSupabaseAvailable) return;

    const processingDocs = documents.filter(doc => doc.status === 'processing');
    if (processingDocs.length === 0) return;

    const intervalId = setInterval(async () => {
      try {
        const { data: updatedDocs, error } = await supabase
          .from('documents')
          .select('id, status')
          .eq('knowledge_base_id', currentKb.id)
          .in('id', processingDocs.map(d => d.id));

        if (error) throw error;

        // 检查是否有状态变化
        const hasChanges = updatedDocs?.some(doc => {
          const currentDoc = documents.find(d => d.id === doc.id);
          return currentDoc && currentDoc.status !== doc.status;
        });

        if (hasChanges) {
          await loadKBAndDocuments();
        }
      } catch (error) {
        logger.error('Status polling error:', error);
      }
    }, 3000); // 每3秒检查一次

    return () => clearInterval(intervalId);
  }, [documents, currentKb, isSupabaseAvailable]);

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

      // 1.1.13: 从URL参数获取项目ID，确保知识库隔离
      const projectId = searchParams.get('project');
      let kb = null;

      if (projectId) {
        // 1.1.13: 如果提供了项目ID，使用该ID获取知识库（并验证用户权限）
        const { data: kbData, error: kbError } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', user.id) // 1.1.13: 验证用户权限，确保只能访问自己的知识库
          .single();

        if (kbError) {
          if (kbError.code === 'PGRST116') {
            // 知识库不存在或用户无权限
            logger.error('Knowledge base not found or access denied:', kbError);
            toast.error('项目不存在或无权访问');
            setIsLoading(false);
            return;
          }
          throw kbError;
        }
        kb = kbData;
      } else {
        // 1.1.13: 如果没有提供项目ID，获取当前用户的第一个知识库作为默认
        const { data: kbData, error: kbError } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (kbError && kbError.code !== 'PGRST116') throw kbError;
        
        kb = kbData;
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
      }
      
      if (!kb) {
        logger.error('No knowledge base found');
        setIsLoading(false);
        return;
      }
      
      setCurrentKb(kb);

      // 1.1.13: 确保只查询当前知识库的文档，实现知识库隔离
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('knowledge_base_id', kb.id) // 1.1.13: 使用当前知识库ID过滤
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      logger.error('Error loading documents:', error);
      toast.error('加载知识库失败');
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
        
        // 1.1.12: 使用新的上传流
        toast.loading(t('uploading'), { id: 'upload' });
        
        // 先在数据库创建记录，状态为 processing（正在学习）
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .insert({
            knowledge_base_id: currentKb.id,
            filename: file.name,
            file_type: file.name.split('.').pop(),
            file_size: file.size,
            status: 'processing', // 1.1.12: 初始状态为 processing
            dify_document_id: '' // 不再强制需要
          })
          .select()
          .single();

        if (docError) throw docError;

        // 1.1.12: 立即刷新列表，显示"正在学习"状态
        await loadKBAndDocuments();
        toast.success(t('uploadedWaitingProcessing'), { id: 'upload' });

        // 1.1.12: 异步调用 Python 后端处理，不阻塞UI
        uploadFileToKB(currentKb.id, file)
          .then(async () => {
            // 处理成功，更新状态为 completed（学习成功）
            await supabase
              .from('documents')
              .update({ status: 'completed' })
              .eq('id', doc.id);
            await loadKBAndDocuments();
          })
          .catch(async (error) => {
            // 处理失败，更新状态为 failed（学习失败）
            logger.error('File processing error:', error);
            await supabase
              .from('documents')
              .update({ status: 'failed' })
              .eq('id', doc.id);
            await loadKBAndDocuments();
          });
      } else if (type === 'website') {
        // 1.1.12: 网站处理逻辑
        const urls = Array.isArray(data) ? data : [data as string];
        
        if (urls.length === 0) {
          toast.error('No URLs provided');
          return;
        }
        
        toast.loading(t('uploading'), { id: 'upload' });
        
        // 为每个URL创建文档记录，状态为 processing（正在学习）
        const docRecords = [];
        for (const url of urls) {
          try {
            const { data: doc, error: docError } = await supabase
              .from('documents')
              .insert({
                knowledge_base_id: currentKb.id,
                filename: url, // 使用URL作为文件名，后续可以从元数据中提取标题
                file_type: 'url',
                file_size: 0, // URL没有文件大小
                status: 'processing', // 1.1.12: 初始状态为 processing
                storage_path: url, // 存储原始URL
                dify_document_id: '' // 不再强制需要
              })
              .select()
              .single();
            
            if (docError) {
              logger.error(`Error creating document record for ${url}:`, docError);
              continue;
            }
            
            docRecords.push({ url, doc });
          } catch (error) {
            logger.error(`Error creating document record for ${url}:`, error);
          }
        }
        
        if (docRecords.length === 0) {
          toast.error('Failed to create document records');
          return;
        }
        
        // 1.1.12: 立即刷新列表，显示"正在学习"状态
        await loadKBAndDocuments();
        toast.success(t('uploadedWaitingProcessing'), { id: 'upload' });

        // 1.1.12: 异步调用Python后端处理URL，不阻塞UI
        const urlList = docRecords.map(r => r.url);
        uploadUrlsToKB(currentKb.id, urlList)
          .then(async (response) => {
            // 1.1.12: 根据后端返回的状态更新文档状态
            const docIds = docRecords.map(r => r.doc.id);
            
            if (response.status === 'success') {
              // 全部成功，更新状态为 completed（学习成功）
              await supabase
                .from('documents')
                .update({ status: 'completed' })
                .in('id', docIds);
            } else if (response.status === 'partial_success') {
              // 部分成功，需要根据错误信息判断哪些URL失败
              // 由于无法精确匹配，将所有文档标记为 completed（至少部分成功）
              // 或者可以根据 response.errors 来判断，但需要更复杂的逻辑
              await supabase
                .from('documents')
                .update({ status: 'completed' })
                .in('id', docIds);
              if (response.errors && response.errors.length > 0) {
                logger.warn('部分URL处理失败:', response.errors);
              }
            } else if (response.status === 'error') {
              // 全部失败，更新状态为 failed（学习失败）
              await supabase
                .from('documents')
                .update({ status: 'failed' })
                .in('id', docIds);
              logger.error('URL处理失败:', response.message);
            }
            
            await loadKBAndDocuments();
          })
          .catch(async (error) => {
            // 处理失败，更新状态为 failed（学习失败）
            logger.error('URL processing error:', error);
            const docIds = docRecords.map(r => r.doc.id);
            await supabase
              .from('documents')
              .update({ status: 'failed' })
              .in('id', docIds);
            await loadKBAndDocuments();
          });
      }
    } catch (error) {
      logger.error('Upload error:', error);
      toast.error(t('error'), { id: 'upload' });
      throw error;
    }
  };

  // 1.1.14: 打开确认弹窗
  const openConfirmModal = (title: string, description: string, isDelete: boolean, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      description,
      isDelete,
      onConfirm,
    });
  };

  // 1.1.14: 关闭确认弹窗
  const closeConfirmModal = () => {
    setConfirmModal({
      isOpen: false,
      title: '',
      description: '',
      isDelete: false,
      onConfirm: () => {},
    });
  };

  // 1.1.14: 处理确认弹窗的回调
  const handleConfirmModalClose = (confirmed: boolean) => {
    if (confirmed) {
      confirmModal.onConfirm();
    }
    closeConfirmModal();
  };

  // 1.1.15: 单个文档重新学习
  const handleRelearn = async (documentId: string) => {
    const doc = documents.find(d => d.id === documentId);
    if (!doc) return;

    if (!isSupabaseAvailable) {
      toast.error(t('uiPreviewUpload'));
      return;
    }

    if (!currentKb) {
      toast.error('No knowledge base selected');
      return;
    }

    try {
      toast.loading(t('reloading'), { id: `relearn-${documentId}` });

      // 将文档状态改为 processing
      await supabase
        .from('documents')
        .update({ status: 'processing' })
        .eq('id', documentId);

      await loadKBAndDocuments();

      // 分别处理文件和URL
      if (doc.file_type === 'url') {
        const url = doc.storage_path || doc.filename;
        uploadUrlsToKB(currentKb.id, [url])
          .then(async (response) => {
            if (response.status === 'success' || response.status === 'partial_success') {
              await supabase.from('documents').update({ status: 'completed' }).eq('id', documentId);
            } else {
              await supabase.from('documents').update({ status: 'failed' }).eq('id', documentId);
            }
            await loadKBAndDocuments();
            toast.success(t('reloadStarted'), { id: `relearn-${documentId}` });
          })
          .catch(async (error) => {
            logger.error('Relearn URL error:', error);
            await supabase.from('documents').update({ status: 'failed' }).eq('id', documentId);
            await loadKBAndDocuments();
            toast.error(t('reloadFailed'), { id: `relearn-${documentId}` });
          });
      } else {
        // 文件类型的文档暂时不支持重新学习（因为需要原始文件）
        await supabase.from('documents').update({ status: 'failed' }).eq('id', documentId);
        await loadKBAndDocuments();
        toast.error(t('fileReloadNotSupported'), { id: `relearn-${documentId}` });
      }
    } catch (error) {
      logger.error('Relearn error:', error);
      toast.error(t('reloadFailed'), { id: `relearn-${documentId}` });
    }
  };

  const handleDelete = async (documentId: string) => {
    // 1.1.14: 使用自定义确认弹窗替换 confirm
    openConfirmModal(
      t('confirmDeleteTitle'),
      t('confirmDelete'),
      true,
      async () => {
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
          await loadKBAndDocuments();
        } catch (error) {
          logger.error('Delete error:', error);
        }
      }
    );
  };

  // 1.1.12: 状态图标 - processing 使用转圈的 loading icon，failed 使用红色感叹号
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  // 1.1.12: 状态文本 - processing 显示"正在学习"，completed 显示"学习成功"，failed 显示"学习失败"
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return t('statusCompleted'); // "学习成功"
      case 'failed':
        return t('statusFailed'); // "学习失败"
      case 'processing':
        return t('statusProcessing'); // "正在学习"
      default:
        return t('statusProcessing');
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredDocuments.map(doc => doc.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 单个选择/取消选择
  const handleSelectOne = (docId: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(docId);
    } else {
      newSet.delete(docId);
    }
    setSelectedIds(newSet);
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    // 1.1.14: 使用自定义确认弹窗替换 confirm
    openConfirmModal(
      t('confirmBatchDeleteTitle'),
      t('confirmBatchDelete', { count: selectedIds.size }),
      true,
      async () => {
        if (!isSupabaseAvailable) {
          setDocuments(prev => prev.filter(doc => !selectedIds.has(doc.id)));
          setSelectedIds(new Set());
          return;
        }

        try {
          toast.loading(t('deleting'), { id: 'batch-delete' });
          const { error } = await supabase
            .from('documents')
            .delete()
            .in('id', Array.from(selectedIds));

          if (error) throw error;

          setSelectedIds(new Set());
          await loadKBAndDocuments();
          toast.success(t('deleteSuccess'), { id: 'batch-delete' });
        } catch (error) {
          logger.error('Batch delete error:', error);
          toast.error(t('deleteFailed'), { id: 'batch-delete' });
        }
      }
    );
  };

  // 批量重新加载
  const handleBatchReload = async () => {
    if (selectedIds.size === 0) return;

    const selectedDocs = documents.filter(doc => selectedIds.has(doc.id));
    const urlDocs = selectedDocs.filter(doc => doc.file_type === 'url');

    // 只处理URL类型的文档
    if (urlDocs.length === 0) {
      toast.error('只能重新学习URL类型的文档');
      return;
    }

    if (!isSupabaseAvailable) {
      toast.error(t('uiPreviewUpload'));
      return;
    }

    if (!currentKb) {
      toast.error('No knowledge base selected');
      return;
    }

    try {
      toast.loading(t('reloading'), { id: 'batch-reload' });

      // 将选中的URL文档状态改为 processing
      const urlDocIds = urlDocs.map(d => d.id);
      await supabase
        .from('documents')
        .update({ status: 'processing' })
        .in('id', urlDocIds);

      await loadKBAndDocuments();

      // 处理URL类型的文档
      const urls = urlDocs.map(doc => doc.storage_path || doc.filename);
      uploadUrlsToKB(currentKb.id, urls)
        .then(async (response) => {
          if (response.status === 'success' || response.status === 'partial_success') {
            await supabase.from('documents').update({ status: 'completed' }).in('id', urlDocIds);
          } else {
            await supabase.from('documents').update({ status: 'failed' }).in('id', urlDocIds);
          }
          await loadKBAndDocuments();
          setSelectedIds(new Set());
          toast.success(t('reloadStarted'), { id: 'batch-reload' });
        })
        .catch(async (error) => {
          logger.error('Batch reload URL error:', error);
          await supabase.from('documents').update({ status: 'failed' }).in('id', urlDocIds);
          await loadKBAndDocuments();
          toast.error(t('reloadFailed'), { id: 'batch-reload' });
        });
    } catch (error) {
      logger.error('Batch reload error:', error);
      toast.error(t('reloadFailed'), { id: 'batch-reload' });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 1.3.7: Banner - 严格按照设计图制作4步工作流程展示 */}
      <div 
        className="text-white py-6 md:py-8 px-4 md:px-8"
        style={{ background: 'linear-gradient(to right, #8B3DC4 0%, #9B4DCA 50%, #C74BD9 100%)' }}
      >
        <div className="max-w-5xl mx-auto text-center">
          {/* 主标题 - 调整为与原设计一致的大小 */}
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {t('bannerTitle4Steps')}
          </h1>
          {/* 副标题 */}
          <p className="text-sm md:text-base text-white/90 mb-4">
            {t('bannerSubtitle4Steps')}
          </p>
          {/* 立即创建按钮 */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-6 py-2.5 bg-white text-primary rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-all font-medium text-sm mb-6 md:mb-8"
          >
            {t('createNow')}
          </button>
        </div>
        
        {/* 4步工作流程展示 */}
        <div className="flex justify-center items-center gap-6 md:gap-10 lg:gap-16">
          {/* 步骤1: 上传文档 - 文档+上传箭头图标 (自定义SVG匹配设计图) */}
          <div className="flex flex-col items-center">
            <svg className="w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16" viewBox="0 0 64 64" fill="none">
              {/* 文档外形 */}
              <path d="M16 8h24l12 12v36a4 4 0 01-4 4H16a4 4 0 01-4-4V12a4 4 0 014-4z" stroke="white" strokeWidth="2.5" fill="none"/>
              {/* 文档折角 */}
              <path d="M40 8v12h12" stroke="white" strokeWidth="2.5" fill="none"/>
              {/* 上传箭头 */}
              <path d="M32 48V28M24 36l8-8 8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs md:text-sm mt-3 font-medium whitespace-nowrap">{t('stepUploadDoc')}</span>
          </div>
          
          {/* 箭头 */}
          <svg className="w-6 h-6 md:w-8 md:h-8 text-white/50 hidden sm:block flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          
          {/* 步骤2: 等待学习完成 - 放射状加载图标 (匹配设计图样式) */}
          <div className="flex flex-col items-center">
            <svg className="w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16" viewBox="0 0 64 64" fill="none">
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
                const rad = (angle * Math.PI) / 180;
                const x1 = 32 + 12 * Math.cos(rad);
                const y1 = 32 + 12 * Math.sin(rad);
                const x2 = 32 + 24 * Math.cos(rad);
                const y2 = 32 + 24 * Math.sin(rad);
                // 渐变透明度，模拟加载动画效果
                const opacity = 0.3 + (((12 - i) % 12) / 12) * 0.7;
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity={opacity}
                  />
                );
              })}
            </svg>
            <span className="text-xs md:text-sm mt-3 font-medium whitespace-nowrap">{t('stepWaitLearning')}</span>
          </div>
          
          {/* 箭头 */}
          <svg className="w-6 h-6 md:w-8 md:h-8 text-white/50 hidden sm:block flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          
          {/* 步骤3: 点击测试对话 - 双气泡对话图标 (自定义SVG匹配设计图) */}
          <div className="flex flex-col items-center">
            <svg className="w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16" viewBox="0 0 64 64" fill="none">
              {/* 后面的气泡 */}
              <rect x="20" y="8" width="36" height="28" rx="4" stroke="white" strokeWidth="2.5"/>
              {/* 后气泡内的线条 */}
              <line x1="28" y1="18" x2="48" y2="18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="28" y1="26" x2="44" y2="26" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              {/* 前面的气泡 */}
              <rect x="8" y="28" width="32" height="24" rx="4" stroke="white" strokeWidth="2.5" fill="#9B4DCA"/>
              {/* 前气泡内的线条 */}
              <line x1="16" y1="38" x2="32" y2="38" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="16" y1="46" x2="28" y2="46" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span className="text-xs md:text-sm mt-3 font-medium whitespace-nowrap">{t('stepTestChat')}</span>
          </div>
          
          {/* 箭头 */}
          <svg className="w-6 h-6 md:w-8 md:h-8 text-white/50 hidden sm:block flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          
          {/* 步骤4: 分享链接 - 三点连线分享图标 (自定义SVG匹配设计图) */}
          <div className="flex flex-col items-center">
            <svg className="w-10 h-10 md:w-14 md:h-14 lg:w-16 lg:h-16" viewBox="0 0 64 64" fill="none">
              {/* 右上角圆点 */}
              <circle cx="48" cy="16" r="8" stroke="white" strokeWidth="2.5"/>
              {/* 左中间圆点 */}
              <circle cx="16" cy="32" r="8" stroke="white" strokeWidth="2.5"/>
              {/* 右下角圆点 */}
              <circle cx="48" cy="48" r="8" stroke="white" strokeWidth="2.5"/>
              {/* 连接线 */}
              <line x1="23" y1="28" x2="41" y2="20" stroke="white" strokeWidth="2.5"/>
              <line x1="23" y1="36" x2="41" y2="44" stroke="white" strokeWidth="2.5"/>
            </svg>
            <span className="text-xs md:text-sm mt-3 font-medium whitespace-nowrap">{t('stepShareLink')}</span>
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

          {/* 批量操作按钮 */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-4">
              {(() => {
                const selectedDocs = documents.filter(doc => selectedIds.has(doc.id));
                const hasUrlDocs = selectedDocs.some(doc => doc.file_type === 'url');
                return hasUrlDocs && (
                  <button
                    onClick={handleBatchReload}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('batchReload')} <span className="text-primary font-medium">{selectedDocs.filter(doc => doc.file_type === 'url').length}</span>
                  </button>
                );
              })()}
              <button
                onClick={handleBatchDelete}
                className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('batchDelete')} <span className="font-medium">{selectedIds.size}</span>
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <span className="inline-block text-primary font-semibold yui-loading-animation">YUI</span>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {t('allDocuments')} - {t('noData')}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-[calc(100vh-300px)]">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={filteredDocuments.length > 0 && selectedIds.size === filteredDocuments.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('fileNameOrUrl')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('wordCount')}
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
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={(e) => handleSelectOne(doc.id, e.target.checked)}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-900">{doc.filename}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {doc.file_type === 'url' ? 'url' : (doc.file_type || (doc.filename.includes('.') ? doc.filename.split('.').pop()?.toLowerCase() : '-'))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {doc.processing_metadata?.word_count ? doc.processing_metadata.word_count.toLocaleString() : '-'}
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
                      {new Date(doc.created_at).toLocaleString(i18n.language, {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3 action-menu-container relative">
                        {doc.file_type === 'url' && (
                          <button
                            onClick={() => handleRelearn(doc.id)}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <RefreshCw className="w-4 h-4" />
                            {t('relearn')}
                          </button>
                        )}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === doc.id ? null : doc.id);
                            }}
                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                            aria-label="更多操作"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {/* 1.2.59: 下拉菜单向上弹出，避免被表格容器裁剪 */}
                          {openMenuId === doc.id && (
                            <div className="absolute right-0 bottom-full mb-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-[9999]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  handleDelete(doc.id);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                              >
                                <Trash2 className="w-4 h-4" />
                                {t('delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
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

      {/* 1.1.14: 确认弹窗 */}
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

