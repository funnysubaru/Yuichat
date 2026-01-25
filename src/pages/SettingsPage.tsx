/**
 * 1.1.14: 项目设置页面
 * 支持项目隔离，根据URL参数加载对应项目的设置
 * 1.2.5: 添加tab切换功能
 * 1.2.54: 添加删除项目功能
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Settings, Save, Loader2, Upload, X, Plus, FileText, User, MessageSquare, Brain, Trash2, Languages } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../services/authService';
import { toast } from 'react-hot-toast';
import { logger } from '../utils/logger';
import { ConfirmModal } from '../components/ConfirmModal';

// 1.3.16: 后端 API URL
const PY_BACKEND_URL = import.meta.env.VITE_PY_BACKEND_URL || 'http://localhost:8000';

// 1.2.5: Tab类型定义
type TabType = 'project-info' | 'digital-employee' | 'conversation' | 'skills';

export function SettingsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate(); // 1.2.54: 用于删除后跳转
  // 1.2.5: 当前选中的tab
  const [activeTab, setActiveTab] = useState<TabType>('project-info');
  const [kb, setKb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // 1.2.54: 删除项目相关状态
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // 1.2.0: 聊天配置状态
  const [chatConfig, setChatConfig] = useState<any>({
    avatar_url: '',
    welcome_message: { zh: '', en: '', ja: '' },
    recommended_questions: { zh: [], en: [], ja: [] }
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  // 1.3.16: 翻译相关状态
  const [isTranslatingWelcome, setIsTranslatingWelcome] = useState(false);
  const [isTranslatingQuestions, setIsTranslatingQuestions] = useState<Record<string, boolean>>({});

  // 1.1.14: 从URL参数加载当前项目
  useEffect(() => {
    async function loadKB() {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const projectId = searchParams.get('project');
      
      if (projectId) {
        // 1.1.14: 如果提供了项目ID，使用该ID获取知识库（并验证用户权限）
        const { data, error } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', user.id) // 1.1.14: 验证用户权限
          .single();

        if (error) {
          logger.error('Error loading knowledge base:', error);
          toast.error(t('projectAccessDenied'));
        } else {
          setKb(data);
          setName(data.name || '');
          setDescription(data.description || '');
          // 1.2.0: 加载聊天配置
          const config = data.chat_config || {};
          setChatConfig({
            avatar_url: config.avatar_url || '',
            welcome_message: config.welcome_message || { zh: '', en: '', ja: '' },
            recommended_questions: config.recommended_questions || { zh: [], en: [], ja: [] }
          });
          if (config.avatar_url) {
            setAvatarPreview(config.avatar_url);
          }
        }
      } else {
        // 1.1.14: 如果没有提供项目ID，获取第一个知识库作为默认
        const { data, error } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error) {
          setKb(data);
          setName(data.name || '');
          setDescription(data.description || '');
          // 1.2.0: 加载聊天配置
          const config = data.chat_config || {};
          setChatConfig({
            avatar_url: config.avatar_url || '',
            welcome_message: config.welcome_message || { zh: '', en: '', ja: '' },
            recommended_questions: config.recommended_questions || { zh: [], en: [], ja: [] }
          });
          if (config.avatar_url) {
            setAvatarPreview(config.avatar_url);
          }
        }
      }
      setLoading(false);
    }
    loadKB();
  }, [searchParams.get('project')]);

  // 1.2.0: 处理头像文件选择
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 验证文件类型
      const ext = file.name.split('.').pop()?.toLowerCase();
      const allowedTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      if (!ext || !allowedTypes.includes(ext)) {
        toast.error(t('invalidImageType'));
        return;
      }
      // 验证文件大小（2MB）
      if (file.size > 2 * 1024 * 1024) {
        toast.error(t('imageSizeTooLarge'));
        return;
      }
      setAvatarFile(file);
      // 创建预览URL
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
    }
  };

  // 1.2.0: 处理拖拽上传
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const allowedTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      if (ext && allowedTypes.includes(ext) && file.size <= 2 * 1024 * 1024) {
        setAvatarFile(file);
        const previewUrl = URL.createObjectURL(file);
        setAvatarPreview(previewUrl);
      } else {
        toast.error(t('invalidImageFile'));
      }
    }
  };

  // 1.2.0: 上传头像到Storage
  const handleAvatarUpload = async (file: File): Promise<string> => {
    if (!kb) throw new Error('项目不存在');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar.${fileExt}`;
    const filePath = `${kb.id}/avatars/${fileName}`;
    
    setIsUploadingAvatar(true);
    try {
      // 上传到 Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('knowledge-base-files')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // 获取公开URL
      const { data: { publicUrl } } = supabase.storage
        .from('knowledge-base-files')
        .getPublicUrl(filePath);
      
      return publicUrl;
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // 1.2.0: 添加推荐问题
  const handleAddQuestion = (lang: 'zh' | 'en' | 'ja') => {
    const questions = chatConfig.recommended_questions[lang] || [];
    if (questions.length >= 3) {
      toast.error(t('maxQuestionsReached'));
      return;
    }
    setChatConfig({
      ...chatConfig,
      recommended_questions: {
        ...chatConfig.recommended_questions,
        [lang]: [...questions, '']
      }
    });
  };

  // 1.2.0: 删除推荐问题
  const handleRemoveQuestion = (lang: 'zh' | 'en' | 'ja', index: number) => {
    const questions = chatConfig.recommended_questions[lang] || [];
    setChatConfig({
      ...chatConfig,
      recommended_questions: {
        ...chatConfig.recommended_questions,
        [lang]: questions.filter((_: string, i: number) => i !== index)
      }
    });
  };

  // 1.2.0: 更新推荐问题
  const handleQuestionChange = (lang: 'zh' | 'en' | 'ja', index: number, value: string) => {
    const questions = chatConfig.recommended_questions[lang] || [];
    setChatConfig({
      ...chatConfig,
      recommended_questions: {
        ...chatConfig.recommended_questions,
        [lang]: questions.map((q: string, i: number) => i === index ? value : q)
      }
    });
  };

  // 1.3.16: 调用翻译 API
  const translateText = async (text: string, sourceLang: string, targetLangs: string[]): Promise<Record<string, string>> => {
    try {
      const response = await fetch(`${PY_BACKEND_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          source_lang: sourceLang,
          target_langs: targetLangs
        })
      });
      
      if (!response.ok) {
        throw new Error('Translation failed');
      }
      
      const data = await response.json();
      return data.translations || {};
    } catch (error) {
      logger.error('Translation error:', error);
      throw error;
    }
  };

  // 1.3.16: 自动填充欢迎语
  const handleAutoFillWelcome = async (sourceLang: 'zh' | 'en' | 'ja') => {
    const sourceText = chatConfig.welcome_message[sourceLang];
    if (!sourceText?.trim()) {
      toast.error(t('noSourceTextToTranslate'));
      return;
    }
    
    const targetLangs = (['zh', 'en', 'ja'] as const).filter(lang => lang !== sourceLang);
    
    setIsTranslatingWelcome(true);
    try {
      const translations = await translateText(sourceText, sourceLang, targetLangs);
      
      setChatConfig({
        ...chatConfig,
        welcome_message: {
          ...chatConfig.welcome_message,
          ...translations
        }
      });
      
      toast.success(t('autoFillSuccess'));
    } catch {
      toast.error(t('autoFillFailed'));
    } finally {
      setIsTranslatingWelcome(false);
    }
  };

  // 1.3.16: 自动填充推荐问题
  const handleAutoFillQuestions = async (sourceLang: 'zh' | 'en' | 'ja') => {
    const sourceQuestions = chatConfig.recommended_questions[sourceLang] || [];
    if (sourceQuestions.length === 0 || sourceQuestions.every((q: string) => !q?.trim())) {
      toast.error(t('noSourceTextToTranslate'));
      return;
    }
    
    const targetLangs = (['zh', 'en', 'ja'] as const).filter(lang => lang !== sourceLang);
    
    setIsTranslatingQuestions(prev => ({ ...prev, [sourceLang]: true }));
    try {
      // 翻译每个问题
      const newQuestions: Record<string, string[]> = {
        ...chatConfig.recommended_questions
      };
      
      for (const targetLang of targetLangs) {
        newQuestions[targetLang] = [];
      }
      
      for (const question of sourceQuestions) {
        if (!question?.trim()) {
          for (const targetLang of targetLangs) {
            newQuestions[targetLang].push('');
          }
          continue;
        }
        
        const translations = await translateText(question, sourceLang, targetLangs);
        for (const targetLang of targetLangs) {
          newQuestions[targetLang].push(translations[targetLang] || '');
        }
      }
      
      setChatConfig({
        ...chatConfig,
        recommended_questions: newQuestions
      });
      
      toast.success(t('autoFillSuccess'));
    } catch {
      toast.error(t('autoFillFailed'));
    } finally {
      setIsTranslatingQuestions(prev => ({ ...prev, [sourceLang]: false }));
    }
  };

  const handleSave = async () => {
    if (!kb) return;
    
    setSaving(true);
    try {
      // 1.2.0: 如果有新上传的头像，先上传
      let avatarUrl = chatConfig.avatar_url;
      if (avatarFile) {
        avatarUrl = await handleAvatarUpload(avatarFile);
        setChatConfig(prev => ({ ...prev, avatar_url: avatarUrl }));
      }
      
      // 1.2.0: 保存项目信息和聊天配置
      const { error } = await supabase
        .from('knowledge_bases')
        .update({
          name,
          description,
          chat_config: {
            avatar_url: avatarUrl,
            welcome_message: chatConfig.welcome_message,
            recommended_questions: chatConfig.recommended_questions
          }
        })
        .eq('id', kb.id);

      if (error) throw error;
      
      toast.success(t('settingsSaved'));
      setKb({ ...kb, name, description, chat_config: { ...chatConfig, avatar_url: avatarUrl } });
      setAvatarFile(null); // 清除待上传文件
    } catch (error) {
      logger.error('Error saving settings:', error);
      toast.error(t('settingsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // 1.2.54: 处理删除项目
  const handleDeleteProject = async () => {
    if (!kb) return;
    
    setDeleting(true);
    try {
      // 删除项目（knowledge_base）
      // 相关的 documents 和 conversations 会通过数据库级联删除
      const { error } = await supabase
        .from('knowledge_bases')
        .delete()
        .eq('id', kb.id);

      if (error) throw error;
      
      toast.success(t('deleteProjectSuccess'));
      // 跳转到全部项目页面
      navigate('/');
    } catch (error) {
      logger.error('Error deleting project:', error);
      toast.error(t('deleteProjectFailed'));
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // 1.2.54: 处理删除确认弹窗关闭
  const handleDeleteModalClose = (confirmed: boolean) => {
    if (confirmed) {
      handleDeleteProject();
    } else {
      setShowDeleteModal(false);
    }
  };

  // 1.2.60: 将loading动画居中到页面正中
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="inline-block text-primary font-semibold yui-loading-animation text-2xl">YUI</span>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="p-8 text-center">
        <div className="bg-purple-50 rounded-xl p-12 max-w-lg mx-auto border border-purple-100">
          <Settings className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('projectNotFound')}</h2>
          <p className="text-gray-600">{t('pleaseCreateProjectFirst')}</p>
        </div>
      </div>
    );
  }

  // 1.2.5: Tab配置
  const tabs = [
    { id: 'project-info' as TabType, label: t('tabProjectInfo'), icon: FileText },
    { id: 'digital-employee' as TabType, label: t('tabDigitalEmployee'), icon: User },
    { id: 'conversation' as TabType, label: t('tabConversation'), icon: MessageSquare },
    { id: 'skills' as TabType, label: t('tabSkills'), icon: Brain, badge: 'Beta' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 1.2.5: 固定标题和标签栏区域 */}
      <div className="bg-white border-b border-gray-200 px-8 pt-8 flex-shrink-0 z-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('projectSettings')}</h1>
          <p className="text-gray-600">{t('projectSettingsDescription')}</p>
        </div>
        
        {/* 1.2.5: Tab导航栏 */}
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors relative flex items-center gap-2 ${
                  isActive
                    ? 'text-primary'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded">
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1.2.5: 可滚动的内容区域 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-8 max-w-4xl mx-auto w-full">
        {/* 1.2.5: 项目信息Tab */}
        {activeTab === 'project-info' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Settings className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{t('tabProjectInfo')}</h3>
                  <p className="text-sm text-gray-500">{t('modifyProjectInfo')}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('projectName')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('projectNamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('projectDescription')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('projectDescriptionPlaceholder')}
                />
              </div>

              {/* 1.2.54: 按钮区域 - 保存和删除 */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('saving')}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {t('save')}
                    </>
                  )}
                </button>
                {/* 1.2.54: 删除项目按钮 */}
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={deleting}
                  className="px-6 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('deleting')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {t('deleteProject')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1.2.5: 数字员工Tab */}
        {activeTab === 'digital-employee' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{t('tabDigitalEmployee')}</h3>
                    <p className="text-sm text-gray-500">{t('digitalEmployeeConfig')}</p>
                  </div>
                </div>
                <button className="px-4 py-2 text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  {t('edit')}
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* 1.2.5: 数字员工配置内容待实现 */}
              <div className="text-center py-12 text-gray-500">
                <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>{t('digitalEmployeeDeveloping')}</p>
              </div>
            </div>
          </div>
        )}

        {/* 1.2.5: 对话设置Tab - 将原来的聊天配置移到这里 */}
        {activeTab === 'conversation' && (
          <div className="space-y-6">
            {/* 1.2.5: 标题区域 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t('tabConversation')}</h3>
                <p className="text-sm text-gray-500">{t('conversationConfig')}</p>
              </div>
            </div>

            {/* AI头像上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('aiAvatar')}
            </label>
            <div className="flex items-start gap-4">
              {/* 头像预览 */}
              <div className="relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              
              {/* 上传区域 */}
              <div className="flex-1">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                    isDragOver ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'
                  }`}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      {t('clickOrDragUpload')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('avatarUploadHint')}
                    </p>
                  </div>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* 欢迎语（多语言） - 1.3.16: 添加自动填充功能 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('welcomeMessageMultiLang')}
            </label>
            <p className="text-xs text-gray-500 mb-3">
              {t('autoFillHint')}
            </p>
            <div className="space-y-4">
              {(['zh', 'en', 'ja'] as const).map((lang) => (
                <div key={lang}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-500">
                      {lang === 'zh' ? '中文' : lang === 'en' ? '英文' : '日文'}
                    </label>
                    {/* 1.3.16: 自动填充按钮 */}
                    {chatConfig.welcome_message[lang]?.trim() && (
                      <button
                        type="button"
                        onClick={() => handleAutoFillWelcome(lang)}
                        disabled={isTranslatingWelcome}
                        className="text-xs text-primary hover:text-primary-dark flex items-center gap-1 disabled:opacity-50"
                        title={t('autoFillOtherLangs')}
                      >
                        {isTranslatingWelcome ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Languages className="w-3 h-3" />
                        )}
                        {t('autoFillOtherLangs')}
                      </button>
                    )}
                  </div>
                  <textarea
                    value={chatConfig.welcome_message[lang] || ''}
                    onChange={(e) => setChatConfig({
                      ...chatConfig,
                      welcome_message: {
                        ...chatConfig.welcome_message,
                        [lang]: e.target.value
                      }
                    })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder={lang === 'zh' ? '请输入欢迎语...' : lang === 'en' ? 'Enter welcome message...' : '歓迎メッセージを入力...'}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 推荐问题（多语言） - 1.3.16: 添加自动填充功能 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('recommendedQuestionsMultiLang')}
            </label>
            <p className="text-xs text-gray-500 mb-3">
              {t('autoFillQuestionsHint')}
            </p>
            <div className="space-y-4">
              {(['zh', 'en', 'ja'] as const).map((lang) => (
                <div key={lang}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs text-gray-500">
                      {lang === 'zh' ? '中文' : lang === 'en' ? '英文' : '日文'}
                    </label>
                    <div className="flex items-center gap-2">
                      {/* 1.3.16: 自动填充按钮 */}
                      {(chatConfig.recommended_questions[lang] || []).some((q: string) => q?.trim()) && (
                        <button
                          type="button"
                          onClick={() => handleAutoFillQuestions(lang)}
                          disabled={isTranslatingQuestions[lang]}
                          className="text-xs text-primary hover:text-primary-dark flex items-center gap-1 disabled:opacity-50"
                          title={t('autoFillOtherLangs')}
                        >
                          {isTranslatingQuestions[lang] ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Languages className="w-3 h-3" />
                          )}
                          {t('autoFillOtherLangs')}
                        </button>
                      )}
                      {(chatConfig.recommended_questions[lang] || []).length < 3 && (
                        <button
                          type="button"
                          onClick={() => handleAddQuestion(lang)}
                          className="text-xs text-primary hover:text-primary-dark flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          {t('addQuestion')}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(chatConfig.recommended_questions[lang] || []).map((question: string, index: number) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={question}
                          onChange={(e) => handleQuestionChange(lang, index, e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder={t('questionIndex', { index: index + 1 })}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(lang, index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end pt-6 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving || isUploadingAvatar}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {t('saveConfig')}
                </>
              )}
            </button>
          </div>
          </div>
        )}

        {/* 1.2.5: 技能设置Tab */}
        {activeTab === 'skills' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{t('tabSkills')}</h3>
                  <p className="text-sm text-gray-500">{t('skillsConfig')}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* 1.2.5: 技能设置内容待实现 */}
              <div className="text-center py-12 text-gray-500">
                <Brain className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>{t('skillsDeveloping')}</p>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* 1.2.54: 删除项目确认弹窗 */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={handleDeleteModalClose}
        title={t('deleteProjectConfirmTitle')}
        description={t('deleteProjectConfirmDescription', { projectName: kb?.name || '' })}
        isDelete={true}
      />
    </div>
  );
}
