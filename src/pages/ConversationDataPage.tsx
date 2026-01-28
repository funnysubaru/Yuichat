/**
 * 1.3.14: 对话数据页面
 * 提供对话记录的查看、筛选、搜索功能
 * 支持日期范围选择、来源类型筛选、关键词搜索
 * 支持数据保存周期设置
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Calendar, 
  Filter, 
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp,
  Settings,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../services/authService';
import { logger } from '../utils/logger';
import { 
  listConversationsWithFilter,
  getConversationMessages,
  type ConversationWithPreview,
  type ConversationFilter,
  type SourceType
} from '../services/conversationService';
import {
  getConversationSettings,
  updateRetentionPeriod,
  getRetentionPeriodLabel,
  type RetentionPeriod,
  type ConversationSettings
} from '../services/statsService';

export function ConversationDataPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [kb, setKb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationWithPreview[]>([]);
  
  // 筛选状态
  const [sourceType, setSourceType] = useState<SourceType | 'all'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  
  // 展开的对话ID
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // 设置面板
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ConversationSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // 初始化日期范围（默认最近7天）
  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(weekAgo.toISOString().split('T')[0]);
  }, []);

  // 加载知识库
  useEffect(() => {
    async function loadKb() {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const projectId = searchParams.get('project');
      
      if (projectId) {
        const { data, error } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          logger.error('Error loading knowledge base:', error);
        } else {
          setKb(data);
          // 加载设置
          const settingsData = await getConversationSettings(data.id);
          setSettings(settingsData);
        }
      }
      
      setLoading(false);
    }
    loadKb();
  }, [searchParams.get('project')]);

  // 加载对话列表
  const loadConversations = useCallback(async () => {
    if (!kb) return;
    
    setLoading(true);
    try {
      const filter: ConversationFilter = {
        sourceType,
        startDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
        endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
        keyword: keyword || undefined,
        limit: 100,
      };
      
      const data = await listConversationsWithFilter(kb.id, filter);
      setConversations(data);
    } catch (error) {
      logger.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [kb, sourceType, startDate, endDate, keyword]);

  // 当筛选条件变化时重新加载
  useEffect(() => {
    if (kb) {
      loadConversations();
    }
  }, [kb, sourceType, startDate, endDate, keyword, loadConversations]);

  // 处理搜索
  const handleSearch = () => {
    setKeyword(searchInput);
  };

  // 处理键盘回车搜索
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 展开/收起对话详情
  const toggleExpand = async (conversationId: string) => {
    if (expandedId === conversationId) {
      setExpandedId(null);
      setExpandedMessages([]);
    } else {
      setExpandedId(conversationId);
      setLoadingMessages(true);
      try {
        const messages = await getConversationMessages(conversationId);
        setExpandedMessages(messages);
      } catch (error) {
        logger.error('Error loading messages:', error);
        setExpandedMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    }
  };

  // 更新保存周期
  const handleUpdateRetention = async (period: RetentionPeriod) => {
    if (!kb) return;
    
    setSavingSettings(true);
    try {
      const newSettings = await updateRetentionPeriod(kb.id, period);
      setSettings(newSettings);
    } catch (error) {
      logger.error('Error updating retention period:', error);
    } finally {
      setSavingSettings(false);
    }
  };

  // 格式化日期时间
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 截断文本
  const truncateText = (text: string | undefined, maxLength: number = 80) => {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // 获取来源类型标签
  const getSourceTypeLabel = (type: SourceType | undefined) => {
    if (type === 'test') return t('testConversationLabel');
    if (type === 'public') return t('realConversationLabel');
    return '-';
  };

  // 获取来源类型颜色
  const getSourceTypeColor = (type: SourceType | undefined) => {
    if (type === 'test') return 'bg-blue-100 text-blue-700';
    if (type === 'public') return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-700';
  };

  // 1.2.58: 添加动态点点点效果
  // 1.3.27: 页面loading只显示YUI动画，移除"AI正在思考中"文字
  if (loading && !kb) {
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
          <MessageSquare className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('projectNotExist')}</h2>
          <p className="text-gray-600">{t('pleaseSelectProject')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('conversationData')}</h1>
          <p className="text-gray-600">{kb.name}</p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5" />
          <span>{t('settings')}</span>
        </button>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('retentionSettings')}</h3>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{t('dataRetentionPeriod')}:</span>
            <div className="flex gap-2">
              {(['permanent', '3_months', '6_months', '1_year'] as RetentionPeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => handleUpdateRetention(period)}
                  disabled={savingSettings}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settings?.retentionPeriod === period || (!settings && period === 'permanent')
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getRetentionPeriodLabel(period, t)}
                </button>
              ))}
            </div>
            {savingSettings && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          </div>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* 日期范围 */}
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">{t('selectDate')}:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* 来源类型筛选 */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType | 'all')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">{t('allSources')}</option>
              <option value="test">{t('testConversations')}</option>
              <option value="public">{t('publicConversations')}</option>
            </select>
          </div>

          {/* 搜索框 */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('searchPlaceholder')}
                className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {t('search')}
            </button>
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={loadConversations}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 对话列表 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* 表头 */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-600">
          <div className="col-span-1">{t('source')}</div>
          <div className="col-span-3">{t('firstQuestion')}</div>
          <div className="col-span-4">{t('lastResponse')}</div>
          <div className="col-span-1 text-center">{t('messages')}</div>
          <div className="col-span-2">{t('time')}</div>
          <div className="col-span-1">{t('actions')}</div>
        </div>

        {/* 列表内容 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>{t('noData')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversations.map((conv) => (
              <div key={conv.id}>
                {/* 对话行 */}
                <div 
                  className={`grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                    expandedId === conv.id ? 'bg-gray-50' : ''
                  }`}
                  onClick={() => toggleExpand(conv.id)}
                >
                  <div className="col-span-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSourceTypeColor(conv.source_type)}`}>
                      {getSourceTypeLabel(conv.source_type)}
                    </span>
                  </div>
                  <div className="col-span-3 text-gray-700 truncate" title={conv.firstMessage}>
                    {truncateText(conv.firstMessage, 50)}
                  </div>
                  <div className="col-span-4 text-gray-500 truncate" title={conv.lastResponse}>
                    {truncateText(conv.lastResponse, 60)}
                  </div>
                  <div className="col-span-1 text-center text-gray-600">
                    {conv.messageCount || 0}
                  </div>
                  <div className="col-span-2 text-gray-500 text-sm">
                    {formatDateTime(conv.created_at)}
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    {expandedId === conv.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* 展开的消息详情 */}
                {expandedId === conv.id && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    ) : expandedMessages.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        {t('noMessages')}
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {expandedMessages.map((msg, idx) => (
                          <div
                            key={msg.id || idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                                msg.role === 'user'
                                  ? 'bg-primary text-white'
                                  : 'bg-white border border-gray-200 text-gray-700'
                              }`}
                            >
                              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                              <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                                {formatDateTime(msg.created_at)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
