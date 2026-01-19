/**
 * 1.0.0: YUIChat 项目 - 主应用组件
 * ChatMax 风格布局
 * 1.1.5: 添加认证页面，未登录显示登录页
 */

import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { ChatInterface } from './components/ChatInterface';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { AllProjectsPage } from './pages/AllProjectsPage';
import { SharePage } from './pages/SharePage';
import { PublicChatPage } from './pages/PublicChatPage'; // 1.2.24: 公开聊天页面
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { AuthPage } from './pages/AuthPage';
import { AuthModal } from './components/AuthModal';
import { getCurrentUser, onAuthStateChange } from './services/authService';
import { isSupabaseAvailable } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import './i18n';

function App() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // 1.1.5: 添加加载状态

  // Check if current route should show sidebar and top nav
  // 1.2.6: 外部分享管理页面显示侧边栏，只有公开分享链接（带参数）不显示
  const showLayout = !(location.pathname.startsWith('/share/') && location.pathname !== '/share');

  useEffect(() => {
    // Load initial user
    const loadUser = async () => {
      setIsLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsLoading(false);
    };

    loadUser();

    // Subscribe to auth changes
    const { unsubscribe } = onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    getCurrentUser().then(setUser);
  };

  // 1.1.5: 加载中显示加载状态
  if (isLoading && isSupabaseAvailable) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <span className="inline-block text-primary font-semibold yui-loading-animation text-2xl">YUI</span>
      </div>
    );
  }

  // 1.1.5: 如果用户未登录且不是分享页面，显示认证页面
  // 1.2.6: 只有公开分享链接（带参数）不需要登录，管理页面需要登录
  const isPublicShareLink = location.pathname.startsWith('/share/') && location.pathname !== '/share';
  if (!user && isSupabaseAvailable && !isPublicShareLink && !location.pathname.startsWith('/auth')) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-white">
      <Routes>
        {/* Auth Page - No layout */}
        <Route path="/auth" element={<AuthPage />} />
        
        {/* Public Chat Page - No layout, no login required */}
        {/* 1.2.24: 公开聊天页面，通过 share_token 访问，无需登录 */}
        <Route path="/share/:shareToken" element={<PublicChatPage />} />

        {/* Main App Routes */}
        <Route
          path="*"
          element={
            <div className="flex h-screen overflow-hidden">
              {/* Sidebar */}
              {showLayout && (
                <Sidebar
                  isCollapsed={isSidebarCollapsed}
                  onCollapsedChange={setIsSidebarCollapsed}
                />
              )}

              {/* Main Content */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Top Nav - Only show on knowledge base pages */}
                {showLayout && location.pathname.startsWith('/knowledge-base') && (
                  <TopNav />
                )}

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto">
                  <Routes>
                    <Route path="/" element={<AllProjectsPage />} />
                    <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
                    <Route path="/knowledge-base/documents" element={<KnowledgeBasePage />} />
                    <Route path="/chat" element={<ChatInterface />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/share" element={<SharePage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                  </Routes>
                </main>
              </div>

              {/* Auth Modal */}
              <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                onSuccess={handleAuthSuccess}
              />
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;

