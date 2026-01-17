/**
 * 1.1.2: 外部分享页面
 * 用于生成和管理直接面向用户的 Chainlit 聊天链接
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Copy, ExternalLink, RefreshCw, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export function SharePage() {
  const { t } = useTranslation();
  const [kb, setKb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1.1.2: 获取当前项目（knowledge_base）
  useEffect(() => {
    async function fetchKB() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
      setLoading(false);
    }
    fetchKB();
  }, []);

  const chainlitBaseUrl = import.meta.env.VITE_CHAINLIT_URL || 'http://localhost:8000';
  // 1.1.2: 使用 share_token 作为 kb_id 参数
  const shareUrl = kb ? `${chainlitBaseUrl}/?kb_id=${kb.share_token}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t('linkCopied'));
  };

  const handleRefresh = async () => {
    if (!kb) return;
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_bases')
        .update({ share_token: crypto.randomUUID() })
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

  if (loading) {
    return <div className="p-8 flex items-center justify-center">Loading...</div>;
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
                href={shareUrl}
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
