/**
 * 1.0.0: YUIChat 项目 - 左侧导航栏
 * ChatMax 风格设计
 * 1.1.5: 修复登出功能
 * 1.2.6: 用户菜单改为鼠标悬停弹出
 * 1.2.30: 根据登录方式显示不同的用户名
 * 1.2.54: 修复新创建项目点击后当前项目不更新的问题
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'; // 1.1.14: 导入 useSearchParams
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
  UserCircle,
  MessageCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCurrentUser, signOut, onAuthStateChange, getUserProviders } from '../services/authService';
import { isSupabaseAvailable, supabase } from '../lib/supabase';
import { listKnowledgeBases } from '../services/kbService'; // 1.1.14: 导入项目列表服务
import { LanguageSwitcher } from './LanguageSwitcher';
import { logger } from '../utils/logger';
import type { KnowledgeBase } from '../types/knowledgeBase';

interface SidebarProps {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ isCollapsed = false }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams(); // 1.1.14: 读取URL参数
  const [currentProject, setCurrentProject] = useState<KnowledgeBase | null>(null);
  const [projects, setProjects] = useState<KnowledgeBase[]>([]); // 1.1.14: 项目列表
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false); // 1.2.6: 用户菜单显示状态
  const [user, setUser] = useState<any>(null);
  const menuRef = useRef<HTMLDivElement>(null); // 1.1.14: 用于点击外部关闭菜单
  const userMenuRef = useRef<HTMLDivElement>(null); // 1.2.6: 用户菜单ref

  // 1.1.14: 加载用户和项目列表
  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      // 1.1.14: 加载项目列表
      if (currentUser && isSupabaseAvailable) {
        try {
          const projectList = await listKnowledgeBases(currentUser.id);
          setProjects(projectList);
        } catch (error) {
          logger.error('Error loading projects:', error);
        }
      }
    };
    loadUser();

    // 1.1.5: 监听认证状态变化
    const { unsubscribe } = onAuthStateChange((currentUser) => {
      setUser(currentUser);
      if (currentUser && isSupabaseAvailable) {
        listKnowledgeBases(currentUser.id).then(setProjects).catch(err => logger.error('Error loading projects:', err));
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
  
  // 1.1.14: 从URL参数加载当前项目
  // 1.2.54: 如果项目ID在列表中找不到，重新加载项目列表
  // 1.2.54: 没有 project 参数时清除当前项目（全局视图模式）
  useEffect(() => {
    const projectId = searchParams.get('project');
    if (projectId && projects.length > 0) {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        setCurrentProject(project);
      } else {
        // 1.2.54: 项目ID在列表中找不到，可能是新创建的项目，重新加载列表
        const reloadProjects = async () => {
          if (user && isSupabaseAvailable) {
            try {
              const projectList = await listKnowledgeBases(user.id);
              setProjects(projectList);
              // 在新列表中查找项目
              const foundProject = projectList.find((p: KnowledgeBase) => p.id === projectId);
              if (foundProject) {
                setCurrentProject(foundProject);
              } else {
                // 1.2.54: 项目在新列表中也找不到（可能已被删除），清除当前项目
                setCurrentProject(null);
              }
            } catch (error) {
              logger.error('Error reloading projects:', error);
            }
          }
        };
        reloadProjects();
      }
    } else if (!projectId) {
      // 1.2.54: 没有 project 参数时清除当前项目，进入全局视图模式
      setCurrentProject(null);
    }
  }, [searchParams.get('project'), projects, user]);
  
  // 1.1.14: 点击外部关闭项目菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProjectMenu(false);
      }
    };
    
    if (showProjectMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProjectMenu]);
  
  // 1.2.6: 点击外部关闭用户菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  // 1.1.14: 获取带项目ID的路径
  const getPathWithProject = (path: string) => {
    const projectId = searchParams.get('project') || currentProject?.id;
    if (projectId && path !== '/') {
      return `${path}?project=${projectId}`;
    }
    return path;
  };
  
  // 1.2.3: 处理菜单项点击，如果是测试对话且已在当前页面，强制刷新
  const handleMenuItemClick = (item: typeof projectMenuItems[0]) => {
    const targetPath = getPathWithProject(item.path);
    // 如果是测试对话，且当前已经在 /chat 页面，添加时间戳参数强制刷新
    if (item.path === '/chat' && location.pathname === '/chat') {
      const separator = targetPath.includes('?') ? '&' : '?';
      navigate(`${targetPath}${separator}_refresh=${Date.now()}`);
    } else {
      navigate(targetPath);
    }
  };
  
  // 1.0.2: 所有菜单项使用多语言
  // 1.3.14: 添加对话数据菜单项
  const projectMenuItems = [
    { icon: BookOpen, label: t('knowledgeBase'), path: '/knowledge-base', id: 'knowledge-base' },
    { icon: Settings, label: t('projectSettings'), path: '/settings', id: 'settings' },
    { icon: MessageSquare, label: t('testChat'), path: '/chat', id: 'chat' },
    { icon: Share2, label: t('externalShare'), path: '/share', id: 'share' },
    { icon: BarChart3, label: t('dashboard'), path: '/dashboard', id: 'dashboard' },
    { icon: MessageSquareMore, label: t('conversationData'), path: '/conversation-data', id: 'conversation-data' },
  ];
  
  // 1.1.14: 切换项目
  const handleProjectChange = (projectId: string) => {
    setShowProjectMenu(false);
    const currentPath = location.pathname;
    navigate(`${currentPath}?project=${projectId}`);
  };

  // 1.0.1: 删除技能中心、创作中心、权益、API 菜单项
  // 1.0.2: 使用多语言
  // 1.3.14: 移除对话数据菜单项（已移到项目菜单中）
  const accountMenuItems = [
    { icon: FolderOpen, label: t('allProjects'), path: '/', id: 'projects' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // 1.2.30: 获取显示名称 - 根据登录方式显示不同的用户名
  const getDisplayName = () => {
    if (!user) return t('user');
    
    // 获取用户的登录方式
    const providers = getUserProviders(user);
    const isThirdPartyLogin = providers.length > 0 && !providers.includes('email');
    
    if (isThirdPartyLogin) {
      // 第三方登录：优先显示 full_name 或 name
      const metadata = user.user_metadata || {};
      return metadata.full_name || metadata.name || user.email?.split('@')[0] || t('user');
    } else {
      // 邮箱登录：显示邮箱前缀
      return user.email?.split('@')[0] || t('user');
    }
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
      {/* 1.2.5: 使用自定义 logo SVG，包含图标和文字，放大尺寸 */}
      <div className="py-4 border-b border-gray-200">
        {/* 1.2.5: 使用SVG logo，增大高度以匹配之前的大小，靠左对齐，容器宽度自适应 */}
        <div className="h-14 flex items-center w-fit ml-4">
          <img 
            src="/logo.svg" 
            alt="YUIChat Logo" 
            className="h-full w-auto object-contain"
            onError={(e) => {
              // 如果SVG加载失败，尝试PNG
              const target = e.target as HTMLImageElement;
              if (target.src.endsWith('.svg')) {
                target.src = '/logo.png';
              } else {
                // 如果都失败，回退到默认图标
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) {
                  fallback.style.display = 'flex';
                }
              }
            }}
          />
          <div className="h-14 w-14 bg-primary rounded-lg flex items-center justify-center hidden">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      {/* Current Project - 1.2.54: 只有选中项目时才显示 */}
      {!isCollapsed && currentProject && (
        <div className="p-4 border-b border-gray-200 relative" ref={menuRef}>
          <div className="text-xs text-gray-500 mb-2">{t('currentProject')}</div>
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary/20 rounded flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">
                  {currentProject.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-900 truncate">
                {currentProject.name}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showProjectMenu ? 'rotate-180' : ''}`} />
          </button>
          
          {/* 1.1.14: 项目下拉菜单 */}
          {showProjectMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectChange(project.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors ${
                    currentProject?.id === project.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className={`w-6 h-6 rounded flex items-center justify-center ${
                    currentProject?.id === project.id ? 'bg-primary/20' : 'bg-gray-200'
                  }`}>
                    <span className={`text-xs font-semibold ${
                      currentProject?.id === project.id ? 'text-primary' : 'text-gray-600'
                    }`}>
                      {project.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-900 truncate flex-1 text-left">{project.name}</span>
                </button>
              ))}
              <div className="border-t border-gray-200 mt-1">
                <button
                  onClick={() => {
                    setShowProjectMenu(false);
                    navigate('/');
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-sm text-gray-600"
                >
                  <FolderOpen className="w-4 h-4" />
                  {t('allProjects')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Menu Container */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Project Menu - 1.2.54: 只有选中项目时才显示项目相关菜单 */}
        {currentProject && (
          <>
            {projectMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => handleMenuItemClick(item)} // 1.2.3: 使用新的点击处理函数
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

            {/* Separator - 只在有项目菜单时显示 */}
            <div className="my-2 border-t border-gray-200" />
          </>
        )}

        {/* Account Menu - 1.2.54: 全局菜单始终显示 */}
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
      {/* 1.2.6: 用户菜单改为鼠标悬停弹出 */}
      <div className="p-4 border-t border-gray-200 relative" ref={userMenuRef}>
        <div className="flex items-center gap-3">
          {/* 1.2.6: 用户信息区域（头像+用户名），触发菜单 */}
          <div 
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
            onMouseEnter={() => setShowUserMenu(true)}
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-gray-600" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate transition-colors ${
                  showUserMenu ? 'text-primary' : 'text-gray-900 hover:text-primary'
                }`}>
                  {getDisplayName()}
                </div>
              </div>
            )}
          </div>
          
          {/* 语言切换按钮 - 独立区域，不触发菜单 */}
          {/* 1.2.6: 点击或悬停语言切换器时关闭用户菜单，避免两个下拉框叠在一起 */}
          {!isCollapsed && (
            <div 
              className="flex-shrink-0 relative z-10"
              onClick={() => setShowUserMenu(false)}
              onMouseEnter={() => setShowUserMenu(false)}
            >
              <LanguageSwitcher />
            </div>
          )}
        </div>
        
        {/* 1.2.6: 用户菜单下拉框 */}
        {showUserMenu && !isCollapsed && (
          <div 
            className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
            onMouseLeave={() => setShowUserMenu(false)}
          >
            {/* 账号中心 */}
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-100"
              onClick={() => {
                setShowUserMenu(false);
                navigate('/account');
              }}
            >
              <UserCircle className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-900">{t('accountCenter')}</span>
            </button>
            
            {/* 意见反馈 */}
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-100"
              onClick={() => {
                setShowUserMenu(false);
                navigate('/feedback');
              }}
            >
              <MessageCircle className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-900">{t('feedback')}</span>
            </button>
            
            {/* 退出登录 */}
            <button
              onClick={() => {
                setShowUserMenu(false);
                handleSignOut();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
            >
              <LogOut className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-900">{t('signOut')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

