/**
 * 1.0.0: YUIChat 项目 - 上传知识库模态框
 * ChatMax 风格的上传界面
 */

// 1.0.2: 支持多个网站URL上传
// 1.0.3: 默认显示3个URL输入框，实时URL格式验证，关闭时重置
// 1.0.4: 添加拖拽上传界面
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Video, Globe, Upload, Plus, Trash2, CloudUpload, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UploadKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (type: 'file' | 'audio' | 'website', data: File | string | string[]) => Promise<void>;
}

interface WebsiteUrlItem {
  id: string;
  url: string;
  error?: string;
}

// 1.0.3: 创建默认的3个URL输入框
const createDefaultWebsiteUrls = (): WebsiteUrlItem[] => {
  return [
    { id: `${Date.now()}-1`, url: '' },
    { id: `${Date.now()}-2`, url: '' },
    { id: `${Date.now()}-3`, url: '' },
  ];
};

export function UploadKnowledgeModal({ isOpen, onClose, onUpload }: UploadKnowledgeModalProps) {
  const { t } = useTranslation();
  const [uploadType, setUploadType] = useState<'file' | 'audio' | 'website' | null>(null);
  const [websiteUrls, setWebsiteUrls] = useState<WebsiteUrlItem[]>(createDefaultWebsiteUrls());
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAudioDragOver, setIsAudioDragOver] = useState(false);
  const [autoGenerateQA, setAutoGenerateQA] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // 1.0.3: 当弹窗打开时，如果是网站上传类型，重置为3个输入框
  useEffect(() => {
    if (isOpen && uploadType === 'website') {
      setWebsiteUrls(createDefaultWebsiteUrls());
    }
  }, [isOpen, uploadType]);

  // 1.0.4: 处理文件选择（支持多文件）
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  };

  // 1.0.4: 处理拖拽上传
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

    const files = Array.from(e.dataTransfer.files).filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['txt', 'pdf', 'docx', 'pptx', 'xlsx'].includes(ext || '');
    });

    if (files.length > 0) {
      setSelectedFiles(files);
    }
  };

  // 1.0.4: 处理音视频拖拽上传
  const handleAudioDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAudioDragOver(true);
  };

  const handleAudioDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAudioDragOver(false);
  };

  const handleAudioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAudioDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['mp4', 'mp3', 'wav'].includes(ext || '');
    });

    if (files.length > 0) {
      // 只支持单个文件
      setSelectedAudioFile(files[0]);
    }
  };

  // 1.0.4: 开始上传文件
  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      // 逐个上传文件
      for (const file of selectedFiles) {
        await onUpload('file', file);
      }
      // 上传成功后关闭并重置
      setSelectedFiles([]);
      setUploadType(null);
      setAutoGenerateQA(false);
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 1.0.4: 移除选中的文件
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 1.0.4: 处理音视频文件选择（只支持单个文件）
  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedAudioFile(file);
    }
  };

  // 1.0.4: 开始上传音视频
  const handleStartAudioUpload = async () => {
    if (!selectedAudioFile) return;

    setIsUploading(true);
    try {
      await onUpload('audio', selectedAudioFile);
      setSelectedAudioFile(null);
      setUploadType(null);
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      if (audioInputRef.current) {
        audioInputRef.current.value = '';
      }
    }
  };

  // 1.0.2: 添加新的URL输入框
  const addWebsiteUrl = () => {
    const newId = Date.now().toString();
    setWebsiteUrls([...websiteUrls, { id: newId, url: '' }]);
  };

  // 1.0.2: 删除URL输入框
  // 1.0.3: 至少保留3个输入框
  const removeWebsiteUrl = (id: string) => {
    if (websiteUrls.length > 3) {
      setWebsiteUrls(websiteUrls.filter(item => item.id !== id));
    }
  };

  // 1.0.2: 更新URL值
  // 1.0.3: 实时检查URL格式和重复
  const updateWebsiteUrl = (id: string, url: string) => {
    const updated = websiteUrls.map(item => {
      if (item.id === id) {
        const trimmedUrl = url.trim();
        let error: string | undefined;

        // 如果输入了内容，检查格式
        if (trimmedUrl) {
          // 检查URL格式
          if (!validateUrl(trimmedUrl)) {
            error = t('urlFormatError');
          } else {
            // 检查重复（只有在格式正确时才检查重复）
            const isDuplicate = websiteUrls.some(
              other => other.id !== id && other.url.trim() === trimmedUrl && trimmedUrl !== ''
            );
            if (isDuplicate) {
              error = t('urlDuplicateError');
            }
          }
        }

        return {
          ...item,
          url,
          error
        };
      }
      return item;
    });
    setWebsiteUrls(updated);
  };

  // 1.0.2: 验证URL格式
  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      new URL(url.trim());
      return true;
    } catch {
      return false;
    }
  };

  // 1.0.2: 处理URL输入框的Enter键
  const handleUrlKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = websiteUrls.find(u => u.id === id);
      if (item && item.url.trim() && !item.error) {
        // 如果当前输入框有内容且没有错误，添加新的输入框
        addWebsiteUrl();
      }
    }
  };

  // 1.0.2: 提交多个网站URL
  const handleWebsiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 获取所有有效的URL
    const validUrls = websiteUrls
      .map(item => item.url.trim())
      .filter(url => url && validateUrl(url));

    // 去重
    const uniqueUrls = Array.from(new Set(validUrls));

    if (uniqueUrls.length === 0) {
      return;
    }

    setIsUploading(true);
    try {
      // 如果只有一个URL，保持向后兼容；多个URL则传递数组
      if (uniqueUrls.length === 1) {
        await onUpload('website', uniqueUrls[0]);
      } else {
        await onUpload('website', uniqueUrls);
      }
      onClose();
      setUploadType(null);
      // 1.0.3: 关闭时重置为3个输入框
      setWebsiteUrls(createDefaultWebsiteUrls());
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // 1.0.2: 检查是否可以保存（至少有一个有效URL且没有错误）
  // 1.0.3: 支持只上传1个URL
  const canSave = () => {
    // 至少有一个有效的URL（格式正确且无错误）
    const validUrls = websiteUrls.filter(item => {
      const url = item.url.trim();
      return url && validateUrl(url) && !item.error;
    });
    
    // 至少有一个有效URL，且所有输入框都没有错误
    const hasError = websiteUrls.some(item => item.error);
    
    return validUrls.length >= 1 && !hasError;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  {t('uploadKnowledgeBase')}
                </h2>
                <button
                  onClick={() => {
                    // 1.0.3: 关闭时重置为3个输入框
                    // 1.0.4: 关闭时重置文件选择
                    setWebsiteUrls(createDefaultWebsiteUrls());
                    setUploadType(null);
                    setSelectedFiles([]);
                    setSelectedAudioFile(null);
                    setAutoGenerateQA(false);
                    onClose();
                  }}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {!uploadType ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Local Files */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setUploadType('file');
                        setSelectedFiles([]);
                        setAutoGenerateQA(false);
                      }}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-purple-50 transition-all flex flex-col items-center gap-3"
                    >
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {t('localFiles')}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {t('supportedFormats')}
                        </p>
                      </div>
                    </motion.button>

                    {/* Audio/Video */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setUploadType('audio');
                        setSelectedAudioFile(null);
                      }}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-purple-50 transition-all flex flex-col items-center gap-3"
                    >
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Video className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {t('analyzeAudioVideo')}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {t('audioVideoSubtitle')}
                        </p>
                      </div>
                    </motion.button>

                    {/* Website */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setUploadType('website')}
                      className="p-6 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-purple-50 transition-all flex flex-col items-center gap-3"
                    >
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Globe className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {t('websiteAnalysis')}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {t('websiteAnalysisDesc')}
                        </p>
                      </div>
                    </motion.button>
                  </div>
                ) : uploadType === 'file' ? (
                  <div className="space-y-4">
                    {/* 拖拽上传区域 */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        isDragOver
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <CloudUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-700 mb-2">
                        {t('dragFilesHere')}{' '}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-primary hover:text-primary-dark underline"
                        >
                          {t('selectFiles')}
                        </button>
                      </p>

                      {/* 说明列表 */}
                      <ul className="text-sm text-gray-600 text-left max-w-md mx-auto mt-4 space-y-1">
                        <li>• {t('maxFileSize')}</li>
                        <li>• {t('supportsMultipleFiles')}</li>
                        <li>• {t('supportedFormats')}</li>
                        <li>• {t('waitForTraining')}</li>
                        <li>• {t('maxDocumentChars')}</li>
                      </ul>

                      {/* 提示信息 */}
                      <div className="flex items-center gap-2 justify-center mt-4 text-xs text-gray-500">
                        <AlertCircle className="w-4 h-4" />
                        <span>{t('canCloseDuringUpload')}</span>
                      </div>

                      {/* 隐藏的文件输入 */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.pdf,.docx,.pptx,.xlsx"
                        onChange={handleFileSelect}
                        multiple
                        className="hidden"
                      />
                    </div>

                    {/* 已选择的文件列表 */}
                    {selectedFiles.length > 0 && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          {t('selectedFiles')} ({selectedFiles.length})
                        </h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {selectedFiles.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-sm text-gray-700 truncate">
                                  {file.name}
                                </span>
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 底部按钮 */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadType(null);
                          setSelectedFiles([]);
                          setAutoGenerateQA(false);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {t('previousStep')}
                      </button>

                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoGenerateQA}
                            onChange={(e) => setAutoGenerateQA(e.target.checked)}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700">
                            {t('autoGenerateQA')}
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={handleStartUpload}
                          disabled={selectedFiles.length === 0 || isUploading}
                          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {isUploading ? t('uploading') : t('startUpload')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : uploadType === 'audio' ? (
                  <div className="space-y-4">
                    {/* 拖拽上传区域 */}
                    <div
                      onDragOver={handleAudioDragOver}
                      onDragLeave={handleAudioDragLeave}
                      onDrop={handleAudioDrop}
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        isAudioDragOver
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <CloudUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-700 mb-2">
                        {t('dragFilesHere')}{' '}
                        <button
                          type="button"
                          onClick={() => audioInputRef.current?.click()}
                          className="text-primary hover:text-primary-dark underline"
                        >
                          {t('selectFiles')}
                        </button>
                      </p>

                      {/* 说明列表 */}
                      <ul className="text-sm text-gray-600 text-left max-w-md mx-auto mt-4 space-y-1">
                        <li>• {t('maxAudioFileSize')}</li>
                        <li>• {t('singleFileUploadOnly')}</li>
                        <li>• {t('audioSupportedFormats')}</li>
                        <li>• {t('waitForTraining')}</li>
                      </ul>

                      {/* 提示信息 */}
                      <div className="flex items-center gap-2 justify-center mt-4 text-xs text-gray-500">
                        <AlertCircle className="w-4 h-4" />
                        <span>{t('canCloseDuringUpload')}</span>
                      </div>

                      {/* 隐藏的文件输入 */}
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept=".mp4,.mp3,.wav"
                        onChange={handleAudioSelect}
                        className="hidden"
                      />
                    </div>

                    {/* 已选择的文件 */}
                    {selectedAudioFile && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          {t('selectedFile')}
                        </h4>
                        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Video className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 truncate">
                              {selectedAudioFile.name}
                            </span>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              ({(selectedAudioFile.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedAudioFile(null)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 底部按钮 */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadType(null);
                          setSelectedAudioFile(null);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {t('previousStep')}
                      </button>

                      <button
                        type="button"
                        onClick={handleStartAudioUpload}
                        disabled={!selectedAudioFile || isUploading}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {isUploading ? t('uploading') : t('startUpload')}
                      </button>
                    </div>
                  </div>
                ) : uploadType === 'website' ? (
                  <form onSubmit={handleWebsiteSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('enterWebsiteUrl')}
                      </label>
                      {/* 1.0.3: URL格式说明 */}
                      <p className="text-xs text-gray-500 mb-3">
                        {t('websiteUrlHint')}
                      </p>
                      <div className="space-y-3">
                        {websiteUrls.map((item, index) => (
                          <div key={item.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item.url}
                                onChange={(e) => updateWebsiteUrl(item.id, e.target.value)}
                                onKeyPress={(e) => handleUrlKeyPress(e, item.id)}
                                placeholder={t('websiteUrlPlaceholder')}
                                className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                  item.error
                                    ? 'border-red-300 focus:ring-red-500'
                                    : 'border-gray-300 focus:ring-primary'
                                }`}
                              />
                              {/* 1.0.3: 只有超过3个输入框时才显示删除按钮 */}
                              {websiteUrls.length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => removeWebsiteUrl(item.id)}
                                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                  title={t('remove')}
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              )}
                              {index === websiteUrls.length - 1 && (
                                <button
                                  type="button"
                                  onClick={addWebsiteUrl}
                                  className="p-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                                  title={t('add')}
                                >
                                  <Plus className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                            {item.error && (
                              <p className="text-sm text-red-600">{item.error}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadType(null);
                          // 1.0.3: 取消时重置为3个输入框
                          setWebsiteUrls(createDefaultWebsiteUrls());
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="submit"
                        disabled={!canSave() || isUploading}
                        className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {isUploading ? (
                          <>
                            <Upload className="w-5 h-5 animate-pulse" />
                            {t('saving')}
                          </>
                        ) : (
                          <>
                            <Globe className="w-5 h-5" />
                            {t('save')}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : null}

                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx,.pptx,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleAudioSelect}
                  className="hidden"
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

