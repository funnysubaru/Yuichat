// 1.1.14: YUIChat 项目 - 自定义确认弹窗组件
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: (confirmed: boolean) => void;
  title: string;
  description: string;
  isDelete?: boolean; // 是否为删除操作，用于显示不同的按钮颜色
}

export function ConfirmModal({
  isOpen,
  onClose,
  title,
  description,
  isDelete = false,
}: ConfirmModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onClose(false)}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <h2 className={`text-xl font-bold ${isDelete ? 'text-red-600' : 'text-gray-900'}`}>
                  {title}
                </h2>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-gray-700">{description}</p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => onClose(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => onClose(true)}
                  className={`px-4 py-2 text-white rounded-lg transition-colors ${
                    isDelete
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-primary hover:bg-primary-dark'
                  }`}
                >
                  {t('confirm')}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
