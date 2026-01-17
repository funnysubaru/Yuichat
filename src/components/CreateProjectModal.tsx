/**
 * 1.0.4: YUIChat 项目 - 创建项目模态框
 * 参考截图设计，包含知识库名称和描述说明
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

export function CreateProjectModal({ isOpen, onClose, onCreate }: CreateProjectModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !description.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      await onCreate(name.trim(), description.trim());
      // 重置表单
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleOneClickGenerate = () => {
    // TODO: 实现一键生成描述功能
    // 这里可以调用 AI API 生成描述
    setDescription(t('generatedDescriptionPlaceholder'));
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
                  {t('createProject')}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* 知识库名称 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('knowledgeBaseName')}
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('knowledgeBaseNamePlaceholder')}
                      maxLength={30}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                      {name.length}/30
                    </span>
                  </div>
                </div>

                {/* 描述说明 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('description')}
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('descriptionPlaceholder')}
                      rows={6}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleOneClickGenerate}
                      className="absolute bottom-3 right-3 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      {t('oneClickGenerate')}
                    </button>
                  </div>
                </div>

                {/* 提示信息 */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs">
                    ●
                  </div>
                  <span>{t('roleSelectionHint')}</span>
                </div>

                {/* 底部按钮 */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={!name.trim() || !description.trim() || isCreating}
                    className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCreating ? t('creating') : t('create')}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

