/**
 * 1.1.14: 数据看板页面
 * 支持项目隔离，根据URL参数显示对应项目的统计数据
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, FileText, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../services/authService';
import { logger } from '../utils/logger';

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
      }
      
      setLoading(false);
    }
    loadData();
  }, [searchParams.get('project')]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <span className="inline-block text-primary font-semibold yui-loading-animation text-2xl">YUI</span>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="p-8 text-center">
        <div className="bg-purple-50 rounded-xl p-12 max-w-lg mx-auto border border-purple-100">
          <BarChart3 className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">项目不存在</h2>
          <p className="text-gray-600">请先创建一个项目</p>
        </div>
      </div>
    );
  }

  const completionRate = stats.totalDocuments > 0 
    ? ((stats.completedDocuments / stats.totalDocuments) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('dashboard')}</h1>
        <p className="text-gray-600">{kb.name} - 项目统计</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalDocuments}</div>
          <div className="text-sm text-gray-500">总文档数</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats.completedDocuments}</div>
          <div className="text-sm text-gray-500">已完成</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats.processingDocuments}</div>
          <div className="text-sm text-gray-500">处理中</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stats.failedDocuments}</div>
          <div className="text-sm text-gray-500">失败</div>
        </div>
      </div>

      {/* 完成率 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">处理完成率</h3>
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
    </div>
  );
}
