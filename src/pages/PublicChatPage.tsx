/**
 * 1.2.24: 公开聊天页面 - 用于外部分享
 * 无需登录即可访问，通过 share_token 识别知识库
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChatInterface } from '../components/ChatInterface';
import { supabase } from '../lib/supabase';
import { Bot } from 'lucide-react';

export function PublicChatPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [kb, setKb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadKnowledgeBase() {
      if (!shareToken) {
        setError('无效的分享链接');
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
          setError('未找到该知识库或链接已失效');
          setLoading(false);
          return;
        }

        setKb(data);
        setLoading(false);
      } catch (err) {
        console.error('Error loading knowledge base:', err);
        setError('加载知识库失败');
        setLoading(false);
      }
    }

    loadKnowledgeBase();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">加载中...</p>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">访问失败</h1>
          <p className="text-gray-600 mb-6">{error || '该分享链接无效或已失效'}</p>
          <p className="text-sm text-gray-500">
            请联系分享者获取新的链接，或检查链接是否完整。
          </p>
        </div>
      </div>
    );
  }

  // 1.2.24: 渲染聊天界面，使用公开访问模式
  return (
    <div className="min-h-screen bg-white">
      {/* 顶部项目信息栏 */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{kb.name}</h1>
              <p className="text-sm text-gray-500">AI 助手</p>
            </div>
          </div>
        </div>
      </div>

      {/* 聊天界面 */}
      <div className="h-[calc(100vh-80px)]">
        <ChatInterface language="zh" />
      </div>
    </div>
  );
}
