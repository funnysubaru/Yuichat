/**
 * 1.1.14: 数据看板页面
 * 支持项目隔离，根据URL参数显示对应项目的统计数据
 * 1.3.14: 添加对话统计和高频问题展示功能
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { 
  BarChart3, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare,
  Users,
  TrendingUp,
  HelpCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../services/authService';
import { logger } from '../utils/logger';
import { 
  getConversationStats, 
  getFrequentQuestions,
  type ConversationStats,
  type FrequentQuestion
} from '../services/statsService';

export function DashboardPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [kb, setKb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    completedDocuments: 0,
    processingDocuments: 0,
    failedDocuments: 0,
  });
  
  // 1.3.14: 对话统计状态
  const [conversationStats, setConversationStats] = useState<ConversationStats>({
    totalConversations: 0,
    testConversations: 0,
    publicConversations: 0,
    totalMessages: 0,
    todayConversations: 0,
  });
  
  // 1.3.14: 高频问题状态
  const [frequentQuestions, setFrequentQuestions] = useState<FrequentQuestion[]>([]);

  // 1.1.14: 从URL参数加载当前项目并统计文档
  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const projectId = searchParams.get('project');
      
      let currentKb = null;
      
      if (projectId) {
        // 1.1.14: 如果提供了项目ID，使用该ID获取知识库（并验证用户权限）
        const { data, error } = await supabase
          .from('knowledge_bases')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', user.id) // 1.1.14: 验证用户权限
          .single();

        if (error) {
          logger.error('Error loading knowledge base:', error);
        } else {
          currentKb = data;
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
          currentKb = data;
        }
      }
      
      if (currentKb) {
        setKb(currentKb);
        
        // 1.1.14: 统计当前项目的文档
        const { data: documents, error: docError } = await supabase
          .from('documents')
          .select('status')
          .eq('knowledge_base_id', currentKb.id); // 1.1.14: 只统计当前项目的文档

        if (!docError && documents) {
          const total = documents.length;
          const completed = documents.filter(d => d.status === 'completed').length;
          const processing = documents.filter(d => d.status === 'processing').length;
          const failed = documents.filter(d => d.status === 'failed').length;
          
          setStats({
            totalDocuments: total,
            completedDocuments: completed,
            processingDocuments: processing,
            failedDocuments: failed,
          });
        }
        
        // 1.3.14: 加载对话统计数据
        const convStats = await getConversationStats(currentKb.id);
        setConversationStats(convStats);
        
        // 1.3.14: 加载高频问题
        const questions = await getFrequentQuestions(currentKb.id, 10);
        setFrequentQuestions(questions);
      }
      
      setLoading(false);
    }
    loadData();
  }, [searchParams.get('project')]);

  // 1.2.60: 将loading动画居中到页面正中
  // 1.2.58: 添加动态点点点效果
  // 1.3.27: 页面loading只显示YUI动画，移除"AI正在思考中"文字
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
          <BarChart3 className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('projectNotExist')}</h2>
          <p className="text-gray-600">{t('pleaseCreateProject')}</p>
        </div>
      </div>
    );
  }

  const completionRate = stats.totalDocuments > 0 
    ? ((stats.completedDocuments / stats.totalDocuments) * 100).toFixed(1)
    : '0';

  // 1.3.14: 截断问题文本
  const truncateText = (text: string, maxLength: number = 60) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // 1.3.14: 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('dashboard')}</h1>
        <p className="text-gray-600">{kb.name} - {t('projectStats')}</p>
      </div>

      {/* 文档统计卡片 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('documentStats')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalDocuments}</div>
            <div className="text-sm text-gray-500">{t('totalDocuments')}</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.completedDocuments}</div>
            <div className="text-sm text-gray-500">{t('completed')}</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.processingDocuments}</div>
            <div className="text-sm text-gray-500">{t('processing')}</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.failedDocuments}</div>
            <div className="text-sm text-gray-500">{t('failed')}</div>
          </div>
        </div>
      </div>

      {/* 1.3.14: 对话统计卡片 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('conversationStats')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{conversationStats.totalConversations}</div>
            <div className="text-sm text-gray-500">{t('totalConversations')}</div>
            <div className="mt-2 flex gap-2 text-xs">
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                {t('testLabel')}: {conversationStats.testConversations}
              </span>
              <span className="px-2 py-1 bg-green-50 text-green-700 rounded">
                {t('publicLabel')}: {conversationStats.publicConversations}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{conversationStats.todayConversations}</div>
            <div className="text-sm text-gray-500">{t('todayConversations')}</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-teal-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{conversationStats.totalMessages}</div>
            <div className="text-sm text-gray-500">{t('totalMessages')}</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{frequentQuestions.length}</div>
            <div className="text-sm text-gray-500">{t('frequentQuestionsCount')}</div>
          </div>
        </div>
      </div>

      {/* 完成率 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('completionRate')}</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-primary h-4 rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
          <div className="text-2xl font-bold text-primary">{completionRate}%</div>
        </div>
      </div>

      {/* 1.3.14: 高频问题列表 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('frequentQuestions')}</h3>
        {frequentQuestions.length > 0 ? (
          <div className="space-y-3">
            {frequentQuestions.map((item, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary text-sm font-semibold rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 truncate" title={item.question}>
                    {truncateText(item.question)}
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="px-2 py-1 bg-primary/10 text-primary text-sm font-medium rounded">
                    {item.frequency} {t('times')}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(item.lastAsked)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <HelpCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>{t('noFrequentQuestions')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
