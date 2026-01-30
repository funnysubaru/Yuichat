/**
 * 1.3.30: 创建/编辑QA问答弹窗组件
 * 参考 ChatMax 风格设计
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2 } from 'lucide-react';
import { createQAItem, updateQAItem, type QAItem } from '../services/qaService';
import { toast } from 'react-hot-toast';
import { logger } from '../utils/logger';

interface CreateQAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  knowledgeBaseId?: string;
  editingQA?: QAItem | null;
}

export function CreateQAModal({
  isOpen,
  onClose,
  onSuccess,
  knowledgeBaseId,
  editingQA,
}: CreateQAModalProps) {
  const { t } = useTranslation();
  
  // 表单状态
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [similarQuestions, setSimilarQuestions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 编辑模式时加载数据
  useEffect(() => {
    if (editingQA) {
      setQuestion(editingQA.question);
      setAnswer(editingQA.answer);
      setSimilarQuestions(editingQA.similar_questions || []);
    } else {
      // 重置表单
      setQuestion('');
      setAnswer('');
      setSimilarQuestions([]);
    }
  }, [editingQA, isOpen]);

  // 添加相似问题
  const handleAddSimilarQuestion = () => {
    setSimilarQuestions([...similarQuestions, '']);
  };

  // 更新相似问题
  const handleUpdateSimilarQuestion = (index: number, value: string) => {
    const updated = [...similarQuestions];
    updated[index] = value;
    setSimilarQuestions(updated);
  };

  // 删除相似问题
  const handleRemoveSimilarQuestion = (index: number) => {
    setSimilarQuestions(similarQuestions.filter((_, i) => i !== index));
  };

  // 提交表单
  const handleSubmit = async () => {
    // 验证必填字段
    if (!question.trim()) {
      toast.error(t('questionRequired'));
      return;
    }
    if (!answer.trim()) {
      toast.error(t('answerRequired'));
      return;
    }
    if (!knowledgeBaseId) {
      toast.error(t('selectProject'));
      return;
    }

    setIsSubmitting(true);

    try {
      // 过滤空的相似问题
      const filteredSimilarQuestions = similarQuestions.filter(q => q.trim());

      let result;
      if (editingQA) {
        // 更新模式
        result = await updateQAItem(editingQA.id, {
          question: question.trim(),
          answer: answer.trim(),
          similar_questions: filteredSimilarQuestions,
        });
      } else {
        // 创建模式
        result = await createQAItem(
          knowledgeBaseId,
          question.trim(),
          answer.trim(),
          filteredSimilarQuestions
        );
      }

      if (result.success) {
        onSuccess();
      } else {
        toast.error(result.error || t('saveFailed'));
      }
    } catch (error) {
      logger.error('Submit QA error:', error);
      toast.error(t('saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingQA ? t('editQA') : t('createQA')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 用户问题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span> {t('userQuestion')}
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t('inputQuestion')}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* 相似问题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('similarQuestions')}
            </label>
            <div className="space-y-3">
              {similarQuestions.map((sq, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sq}
                    onChange={(e) => handleUpdateSimilarQuestion(index, e.target.value)}
                    placeholder={t('inputSimilarQuestion')}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button
                    onClick={() => handleRemoveSimilarQuestion(index)}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddSimilarQuestion}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('addSimilarQuestion')}
              </button>
            </div>
          </div>

          {/* 回复答案 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span> {t('replyAnswer')}
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={t('inputAnswer')}
              rows={6}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              {t('answerHint')}
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
