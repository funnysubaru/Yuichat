/**
 * 1.2.24: 公开聊天页面 - 用于外部分享
 * 1.2.25: 修复高频问题和欢迎语无法显示的问题，传递知识库对象给 ChatInterface
 * 1.2.28: 添加多语言支持，集成 i18n 和语言切换器
 * 1.2.49: 支持通过 URL 参数设置语言，让分享链接的语言与分享者一致
 * 1.2.59: 统一 loading 动画为 YUI 文字动画
 * 无需登录即可访问，通过 share_token 识别知识库
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChatInterface } from '../components/ChatInterface';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { supabase } from '../lib/supabase';
import { Bot } from 'lucide-react';

export function PublicChatPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [searchParams] = useSearchParams(); // 1.2.49: 读取 URL 参数
  const { t, i18n } = useTranslation(); // 1.2.28: 集成 i18n
  const [kb, setKb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1.2.49: 从 URL 读取语言参数并设置 i18n 语言
  useEffect(() => {
    const langParam = searchParams.get('lang');
    if (langParam && ['zh', 'en', 'ja'].includes(langParam)) {
      // 只在语言参数与当前语言不同时切换
      const currentLang = i18n.language.split('-')[0];
      if (currentLang !== langParam) {
        i18n.changeLanguage(langParam);
      }
    }
  }, [searchParams, i18n]);

  useEffect(() => {
    async function loadKnowledgeBase() {
      if (!shareToken) {
        setError(t('publicChatInvalidLink')); // 1.2.28: 使用翻译
        setLoading(false);
        return;
      }

      try {
        // 1.2.24: 通过 share_token 获取知识库信息（公开访问，无需验证用户权限）
        const { data, error } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('share_token', shareToken)
          .single();

        if (error || !data) {
          setError(t('publicChatInvalidLink')); // 1.2.28: 使用翻译
          setLoading(false);
          return;
        }

        setKb(data);
        setLoading(false);
      } catch (err) {
        console.error('Error loading knowledge base:', err);
        setError(t('publicChatInvalidLink')); // 1.2.28: 使用翻译
        setLoading(false);
      }
    }

    loadKnowledgeBase();
  }, [shareToken, t]); // 1.2.28: 添加 t 依赖

  // 1.2.59: 统一 loading 动画为 YUI 文字动画（与其他页面一致）
  // 1.2.58: 添加动态点点点效果
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="inline-block text-primary font-semibold yui-loading-animation text-2xl">YUI</span>
            <span className="text-gray-600 text-lg thinking-dots">{t('aiThinking')}</span>
          </div>
          <p className="text-gray-600">{t('publicChatLoading')}</p>
        </div>
      </div>
    );
  }

  if (error || !kb) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('publicChatAccessFailed')}</h1>
          <p className="text-gray-600 mb-6">{error || t('publicChatInvalidLink')}</p>
          <p className="text-sm text-gray-500">
            {t('publicChatContactOwner')}
          </p>
        </div>
      </div>
    );
  }

  // 1.2.28: 获取当前语言，用于传递给 ChatInterface
  const currentLang = i18n.language.split('-')[0];

  // 1.2.24: 渲染聊天界面，使用公开访问模式
  return (
    <div className="min-h-screen bg-white">
      {/* 1.2.28: 顶部项目信息栏 - 添加语言切换器 */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* 左侧：项目信息 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{kb.name}</h1>
                <p className="text-sm text-gray-500">{t('publicChatAiAssistant')}</p>
              </div>
            </div>
            
            {/* 右侧：语言切换器 */}
            {/* 1.2.28: 顶部导航栏的语言切换器向下弹出 */}
            <div className="flex items-center">
              <LanguageSwitcher direction="down" />
            </div>
          </div>
        </div>
      </div>

      {/* 聊天界面 */}
      {/* 1.2.25: 传递知识库对象和公开模式标志，使聊天界面能够正确显示欢迎语和高频问题 */}
      {/* 1.2.28: 传递当前语言状态 */}
      <div className="h-[calc(100vh-80px)]">
        <ChatInterface language={currentLang} externalKb={kb} isPublicMode={true} />
      </div>
    </div>
  );
}
