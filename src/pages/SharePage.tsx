/**
 * 1.1.2: 外部分享页面
 * 1.2.24: 更新为生成前端公开聊天链接（替代 Chainlit）
 * 1.2.49: 分享链接附带当前语言参数，支持社交媒体多语言预览
 * 1.2.59: 统一 loading 动画为 YUI 文字动画
 * 用于生成和管理直接面向用户的聊天链接，支持流式输出
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom'; // 1.1.14: 导入 useSearchParams
import { Share2, Copy, ExternalLink, RefreshCw, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { getCurrentUser } from '../services/authService'; // 1.1.14: 导入用户服务

export function SharePage() {
  const { t, i18n } = useTranslation(); // 1.2.49: 添加 i18n 以获取当前语言
  const [searchParams] = useSearchParams(); // 1.1.14: 读取URL参数
  const [kb, setKb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1.1.14: 从URL参数获取当前项目（knowledge_base），确保知识库隔离
  useEffect(() => {
    async function fetchKB() {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const projectId = searchParams.get('project');
      
      if (projectId) {
        // 1.1.14: 如果提供了项目ID，使用该ID获取知识库（并验证用户权限）
        const { data, error } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', user.id) // 1.1.14: 验证用户权限
          .single();

        if (error) {
          console.error('Error loading knowledge base:', error);
        } else {
          setKb(data);
        }
      } else {
        // 1.1.14: 如果没有提供项目ID，获取第一个知识库作为默认
        const { data, error } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error) {
          setKb(data);
        }
      }
      setLoading(false);
    }
    fetchKB();
  }, [searchParams.get('project')]); // 1.1.14: 监听项目ID参数变化

  // 1.2.24: 使用前端 URL 替代 Chainlit URL，支持流式输出
  // 1.2.52: 区分两种 URL：
  // - shareUrl: 给真实用户的链接，不含语言参数，用户会根据浏览器语言自动选择
  // - testUrl: 管理员测试用的链接，携带当前语言参数
  // 1.3.23: 分享链接使用 /api/share/:token 格式，支持动态 OG 预览
  //         社交媒体爬虫会得到动态 OG 标签，普通用户会被自动重定向到聊天页面
  const frontendBaseUrl = window.location.origin; // 自动获取当前域名
  const currentLang = i18n.language.split('-')[0]; // 获取当前语言（去除地区代码）
  const shareUrl = kb ? `${frontendBaseUrl}/api/share/${kb.share_token}` : ''; // 1.3.23: 使用 API 路由，支持动态 OG 预览
  const testUrl = kb ? `${frontendBaseUrl}/share/${kb.share_token}?lang=${currentLang}` : ''; // 管理员测试用，直接访问聊天页面

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl); // 复制不含语言参数的链接
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t('linkCopied'));
  };

  const handleRefresh = async () => {
    if (!kb) return;
    setIsRefreshing(true);
    try {
      const newToken = crypto.randomUUID();
      // @ts-ignore - Supabase 类型定义问题
      const { data, error } = await supabase
        .from('knowledge_bases')
        .update({ share_token: newToken })
        .eq('id', kb.id)
        .select()
        .single();

      if (error) throw error;
      setKb(data);
      toast.success(t('tokenRefreshed'));
    } catch (err) {
      console.error(err);
      toast.error(t('refreshFailed'));
    } finally {
      setIsRefreshing(false);
    }
  };

  // 1.2.59: 统一 loading 动画为 YUI 文字动画（与其他页面一致）
  // 1.2.60: 将loading动画居中到页面正中
  // 1.2.58: 添加动态点点点效果
  // 1.3.29: 页面loading只显示YUI动画，移除"AI正在思考中"文字
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="inline-block text-primary font-semibold yui-loading-animation text-2xl">YUI</span>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="p-8 text-center">
        <div className="bg-purple-50 rounded-xl p-12 max-w-lg mx-auto border border-purple-100">
          <Share2 className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('noKnowledgeBase')}</h2>
          <p className="text-gray-600">{t('pleaseCreateKBFirst')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('externalShare')}</h1>
        <p className="text-gray-600">{t('shareDescription')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Share2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{kb.name}</h3>
                <p className="text-sm text-gray-500">{t('shareLinkSettings')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                {t('active')}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('publicAccessLink')}
            </label>
            {/* 1.2.52: shareUrl 用于显示和复制（不含语言参数），testUrl 用于访问测试（含语言参数） */}
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-600 font-mono text-sm truncate">
                {shareUrl}
              </div>
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? t('copied') : t('copy')}
              </button>
              <a
                href={testUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                {t('visit')}
              </a>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-1">{t('regenerateLink')}</h4>
                <p className="text-xs text-gray-500">{t('regenerateLinkTip')}</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t('resetLink')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            {t('shareModeInstructions')}
          </h4>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• {t('shareInstruction1')}</li>
            <li>• {t('shareInstruction2')}</li>
            <li>• {t('shareInstruction3')}</li>
          </ul>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-6">
          <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            {t('securityNotice')}
          </h4>
          <p className="text-sm text-purple-800">
            {t('securityNoticeText')}
          </p>
        </div>
      </div>
    </div>
  );
}
