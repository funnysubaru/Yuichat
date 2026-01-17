/**
 * 1.0.0: YUIChat 项目 - 顶部导航栏
 * ChatMax 风格设计
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// 1.0.2: 使用多语言
const getTabs = (t: (key: string) => string) => [
  { id: 'documents', label: t('cloudDocuments'), path: '/knowledge-base/documents' },
  { id: 'qa', label: t('qaChat'), path: '/knowledge-base/qa' },
  { id: 'synonyms', label: t('synonymLibrary'), path: '/knowledge-base/synonyms' },
  { id: 'confused-words', label: t('confusingWords'), path: '/knowledge-base/confused-words' },
];

export function TopNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const tabs = getTabs(t);

  const isActive = (path: string) => {
    if (path === '/knowledge-base/documents') {
      return location.pathname === '/knowledge-base' || location.pathname === '/knowledge-base/documents';
    }
    return location.pathname === path;
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Tabs */}
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                isActive(tab.path)
                  ? 'text-primary'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {isActive(tab.path) && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Right Side Actions */}
        {/* 1.0.4: 语言切换按钮已移到 Sidebar 用户信息区域 */}
        <div className="flex items-center gap-3">
          {/* Start Conversation Button */}
          <button
            onClick={() => navigate('/chat')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{t('startConversation')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

