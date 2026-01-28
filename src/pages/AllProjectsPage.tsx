/**
 * 1.0.4: YUIChat 项目 - 全部项目页面
 * 显示所有项目卡片，包括创建项目卡片
 * 1.1.5: 实现创建项目功能
 * 1.1.17: 在项目卡片蓝色区域显示完整项目名称，最多两行，超出显示省略号
 * 1.3.17: 项目卡片改为淡紫色背景，在项目名称下方显示项目说明（一行，超出显示...）
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseAvailable } from '../lib/supabase';
import { getCurrentUser } from '../services/authService';
import { createKnowledgeBase, listKnowledgeBases } from '../services/kbService';
import type { KnowledgeBase } from '../types/knowledgeBase';
import { logger } from '../utils/logger';

interface Project {
  id: string;
  name: string;
  description?: string;
  avatar?: string; // 项目头像文字（如"示例"、"東"、"日"）
  gradient?: string; // 项目卡片渐变背景
}

export function AllProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      // 1.0.4: UI 预览模式 - 显示 mock 数据
      if (!isSupabaseAvailable) {
        const mockProjects: Project[] = [
          {
            id: 'mock-1',
            name: t('exampleProject'),
            description: '示例项目描述',
            avatar: '示例',
            gradient: 'from-primary/80 to-primary',
          },
          {
            id: 'mock-2',
            name: '東映株式会社',
            description: 'Toei Co., Ltd.',
            avatar: '東',
            gradient: 'from-primary/80 to-primary',
          },
          {
            id: 'mock-3',
            name: '日本信号株式会社',
            description: 'Nippon Signal Co., Ltd.',
            avatar: '日',
            gradient: 'from-primary/80 to-primary',
          },
        ];
        setProjects(mockProjects);
        setIsLoading(false);
        return;
      }

      const user = await getCurrentUser();
      if (!user) {
        logger.log('No user logged in, showing empty list');
        setProjects([]);
        setIsLoading(false);
        return;
      }

      // 1.1.5: 使用新的 listKnowledgeBases 服务
      const data = await listKnowledgeBases(user.id);

      const formattedProjects: Project[] = (data || []).map((kb: KnowledgeBase) => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        avatar: kb.name.charAt(0),
        gradient: 'from-primary/80 to-primary',
      }));

      setProjects(formattedProjects);
    } catch (error) {
      logger.error('Error loading projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (name: string, description: string) => {
    // 1.1.5: 实现创建项目逻辑
    try {
      const user = await getCurrentUser();
      if (!user) {
        logger.error('Cannot create project: user not logged in');
        alert('请先登录');
        return;
      }

      logger.log('Creating project:', { name, description });
      await createKnowledgeBase(name, description, user.id);
      
      // 重新加载项目列表
      await loadProjects();
      
      logger.log('Project created successfully');
    } catch (error) {
      logger.error('Error creating project:', error);
      alert('创建项目失败，请重试');
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          {t('allProjects')}
        </h1>

        {/* 1.2.60: 将loading动画居中到页面正中 */}
        {/* 1.2.58: 添加动态点点点效果 */}
        {/* 1.3.27: 页面loading只显示YUI动画，移除"AI正在思考中"文字 */}
        {isLoading ? (
          <div className="h-[70vh] flex items-center justify-center">
            <span className="inline-block text-primary font-semibold yui-loading-animation text-2xl">YUI</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* 创建项目卡片 */}
            <div className="flex flex-col">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-white rounded-lg p-6 min-h-[200px] flex flex-col items-center justify-center cursor-pointer relative overflow-hidden hover:shadow-lg transition-all"
              >
                {/* 背景装饰 - 半透明蓝色圆形和椭圆形 */}
                <div className="absolute inset-0">
                  <div className="absolute top-4 right-4 w-20 h-20 bg-blue-200/30 rounded-full blur-xl"></div>
                  <div className="absolute bottom-4 left-4 w-24 h-16 bg-blue-200/30 rounded-full blur-xl"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-blue-200/20 rounded-full blur-lg"></div>
                </div>

                {/* 内容 */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mb-4">
                    <Plus className="w-8 h-8 text-white" />
                  </div>
                </div>
              </motion.button>
              {/* 标签 */}
              <span className="text-sm font-medium text-gray-700 text-center mt-3">
                {t('createProject')}
              </span>
            </div>

            {/* 项目卡片 */}
            {projects.map((project) => (
              <div key={project.id} className="flex flex-col">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/knowledge-base?project=${project.id}`)}
                  className={`bg-gradient-to-br ${project.gradient || 'from-primary/80 to-primary'} rounded-lg p-6 min-h-[200px] flex flex-col items-center justify-center cursor-pointer relative overflow-hidden`}
                >
                  {/* 1.3.17: 背景装饰 - 淡紫色主题几何图案 */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-white rounded-lg rotate-45"></div>
                  </div>

                  {/* 1.3.17: 项目内容 - 显示项目名称和说明 */}
                  <div className="relative z-10 text-center w-full px-2">
                    <div className="text-lg font-bold text-white line-clamp-2">
                      {project.name}
                    </div>
                    {/* 1.3.17: 项目说明 - 仅在有说明时显示，限制一行 */}
                    {project.description && (
                      <div className="text-sm text-white/80 mt-2 line-clamp-1">
                        {project.description}
                      </div>
                    )}
                  </div>
                </motion.div>
                {/* 标签 */}
                <span className="text-sm font-medium text-gray-700 text-center mt-3">
                  {project.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 创建项目模态框 */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}

