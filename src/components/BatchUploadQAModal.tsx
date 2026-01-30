/**
 * 1.3.30: 批量上传QA问答弹窗组件
 * 参考 ChatMax 风格设计
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { batchUploadQA } from '../services/qaService';
import { toast } from 'react-hot-toast';
import { logger } from '../utils/logger';

interface BatchUploadQAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  knowledgeBaseId?: string;
}

export function BatchUploadQAModal({
  isOpen,
  onClose,
  onSuccess,
  knowledgeBaseId,
}: BatchUploadQAModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    total?: number;
    successCount?: number;
    failedCount?: number;
    errors?: string[];
  } | null>(null);

  // 下载模板
  const handleDownloadTemplate = () => {
    // 1.3.30: 下载模板文件
    const link = document.createElement('a');
    link.href = '/templates/qa_template.xlsx';
    link.download = 'qa_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 选择文件
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 验证文件类型
      if (!file.name.endsWith('.xlsx')) {
        toast.error(t('onlyXlsxSupported'));
        return;
      }
      // 验证文件大小 (最大20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast.error(t('fileTooLarge'));
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  // 拖拽上传
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx')) {
        toast.error(t('onlyXlsxSupported'));
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(t('fileTooLarge'));
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  // 上传文件
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error(t('selectFile'));
      return;
    }
    if (!knowledgeBaseId) {
      toast.error(t('selectProject'));
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const result = await batchUploadQA(knowledgeBaseId, selectedFile);

      if (result.success) {
        setUploadResult({
          success: true,
          total: result.total,
          successCount: result.success_count,
          failedCount: result.failed_count,
          errors: result.parse_errors,
        });

        // 如果全部成功，延迟关闭弹窗
        if (result.failed_count === 0) {
          setTimeout(() => {
            onSuccess();
          }, 1500);
        }
      } else {
        setUploadResult({
          success: false,
          errors: [result.error || t('uploadFailed')],
        });
      }
    } catch (error) {
      logger.error('Upload error:', error);
      setUploadResult({
        success: false,
        errors: [String(error)],
      });
    } finally {
      setIsUploading(false);
    }
  };

  // 重置状态
  const handleClose = () => {
    setSelectedFile(null);
    setUploadResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('batchUploadQA')}</h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 模板下载提示 */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-gray-700">
                {t('templateDownloadHint')}{' '}
                <button
                  onClick={handleDownloadTemplate}
                  className="text-primary hover:underline font-medium"
                >
                  {t('downloadTemplate')}
                </button>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {t('multipleQuestionsHint')}
              </p>
            </div>
          </div>

          {/* 上传区域 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              selectedFile
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 hover:border-primary hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {selectedFile ? (
              <div className="space-y-2">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-primary" />
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setUploadResult(null);
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  {t('removeFile')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-12 h-12 mx-auto text-gray-400" />
                <p className="text-sm text-gray-600">{t('uploadDocument')}</p>
                <p className="text-xs text-gray-400">
                  {t('uploadHint')}
                </p>
              </div>
            )}
          </div>

          {/* 上传结果 */}
          {uploadResult && (
            <div
              className={`p-4 rounded-lg ${
                uploadResult.success && uploadResult.failedCount === 0
                  ? 'bg-green-50'
                  : uploadResult.success
                  ? 'bg-yellow-50'
                  : 'bg-red-50'
              }`}
            >
              {uploadResult.success ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">
                    {t('uploadComplete')}
                  </p>
                  <div className="text-sm text-gray-600">
                    <p>{t('totalRecords')}: {uploadResult.total}</p>
                    <p className="text-green-600">{t('successRecords')}: {uploadResult.successCount}</p>
                    {uploadResult.failedCount && uploadResult.failedCount > 0 && (
                      <p className="text-red-600">{t('failedRecords')}: {uploadResult.failedCount}</p>
                    )}
                  </div>
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      <p className="font-medium mb-1">{t('parseErrors')}:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {uploadResult.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {uploadResult.errors.length > 5 && (
                          <li>... {t('andMore', { count: uploadResult.errors.length - 5 })}</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-600">{t('uploadFailed')}</p>
                    {uploadResult.errors?.map((error, index) => (
                      <p key={index} className="text-sm text-gray-600 mt-1">{error}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="px-6 py-2.5 text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading && (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
