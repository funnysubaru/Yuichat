/**
 * 1.0.0: YUIChat 项目 - 左侧导航栏
 * ChatMax 风格设计
 * 1.1.5: 修复登出功能
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// 1.0.1: 删除未使用的图标导入（技能中心、创作中心、权益、API）
import {
  BookOpen,
  Settings,
  MessageSquare,
  Share2,
  BarChart3,
  FolderOpen,
  MessageSquareMore,
  ChevronDown,
  User,
  LogOut,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCurrentUser, signOut, onAuthStateChange } from '../services/authService';
import { isSupabaseAvailable } from '../lib/supabase';
import { LanguageSwitcher } from './LanguageSwitcher';
import { logger } from '../utils/logger';

interface SidebarProps {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ isCollapsed = false }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentProject, setCurrentProject] = useState('');
  
  // 1.0.2: 初始化项目名称
  useEffect(() => {
    setCurrentProject(t('defaultProject'));
  }, [t]);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    };
    loadUser();

    // 1.1.5: 监听认证状态变化
    const { unsubscribe } = onAuthStateChange((currentUser) => {
      setUser(currentUser);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 1.0.2: 所有菜单项使用多语言
  const projectMenuItems = [
    { icon: BookOpen, label: t('knowledgeBase'), path: '/knowledge-base', id: 'knowledge-base' },
    { icon: Settings, label: t('projectSettings'), path: '/settings', id: 'settings' },
    { icon: MessageSquare, label: t('testChat'), path: '/chat', id: 'chat' },
    { icon: Share2, label: t('externalShare'), path: '/share', id: 'share' },
    { icon: BarChart3, label: t('dashboard'), path: '/dashboard', id: 'dashboard' },
  ];

  // 1.0.1: 删除技能中心、创作中心、权益、API 菜单项
  // 1.0.2: 使用多语言
  const accountMenuItems = [
    { icon: FolderOpen, label: t('allProjects'), path: '/', id: 'projects' },
    { icon: MessageSquareMore, label: t('conversationData'), path: '/conversations', id: 'conversations' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // 1.1.5: 修复登出功能
  const handleSignOut = async () => {
    if (!isSupabaseAvailable) {
      return;
    }

    try {
      logger.log('Signing out...');
      const { error } = await signOut();
      
      if (error) {
        logger.error('Sign out error:', error);
        alert('登出失败，请重试');
        return;
      }

      logger.log('Sign out successful');
      // 登出成功后，App.tsx 会监听到认证状态变化并自动显示登录页面
    } catch (error) {
      logger.error('Sign out exception:', error);
      alert('登出失败，请重试');
    }
  };

  return (
    <div
      className={`bg-gray-50 border-r border-gray-200 flex flex-col h-screen transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="text-xl font-bold text-primary">YUIChat</span>
          )}
        </div>
      </div>

      {/* Current Project */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="text-xs text-gray-500 mb-2">{t('currentProject')}</div>
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary/20 rounded flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">Y</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{currentProject}</span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Project Menu */}
      <div className="flex-1 overflow-y-auto py-2">
        {projectMenuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${
                active
                  ? 'bg-primary/10 text-primary border-r-2 border-primary'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </button>
          );
        })}

        {/* Separator */}
        <div className="my-2 border-t border-gray-200" />

        {/* Account Menu */}
        {!isCollapsed && (
          <div className="px-4 py-2">
            <div className="text-xs text-gray-500 mb-2">{t('account')}</div>
          </div>
        )}
        {accountMenuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${
                active
                  ? 'bg-primary/10 text-primary border-r-2 border-primary'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* User Info */}
      {/* 1.0.4: 语言切换按钮移到用户信息区域，放在用户信息右边 */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-gray-600" />
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {user?.email?.split('@')[0] || t('user')}
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  {t('signOut')}
                </button>
              </div>
              {/* 语言切换按钮 */}
              <div className="flex-shrink-0">
                <LanguageSwitcher />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

