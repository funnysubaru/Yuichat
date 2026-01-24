/**
 * 1.3.11: YUIChat 项目 - 引用来源面板组件
 * 展示AI回答的引用来源详情，显示相关度最高的文档片段
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ExternalLink, ChevronRight, ChevronDown, X } from 'lucide-react';
import type { Citation } from '../types/chat';

interface CitationPanelProps {
  citations: Citation[];
  isOpen: boolean;
  onClose: () => void;
  selectedCitationId?: string;
  onSelectCitation?: (id: string) => void;
}

/**
 * 1.3.11: 从 source 中提取显示名称
 * 如果是URL，提取域名；如果是文件路径，提取文件名
 */
function getSourceDisplayName(source: string): string {
  if (!source) return '未知来源';
  
  try {
    // 尝试解析为URL
    const url = new URL(source);
    return url.hostname;
  } catch {
    // 不是URL，尝试提取文件名
    const parts = source.split('/');
    return parts[parts.length - 1] || source;
  }
}

/**
 * 1.3.11: 判断是否为有效的URL
 */
function isValidUrl(source: string): boolean {
  if (!source) return false;
  try {
    new URL(source);
    return true;
  } catch {
    return false;
  }
}

/**
 * 1.3.11: 单个引用项组件
 */
function CitationItem({ 
  citation, 
  index,
  isSelected,
  onSelect
}: { 
  citation: Citation; 
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(isSelected);
  const { t } = useTranslation();
  
  const displayName = getSourceDisplayName(citation.source);
  const isUrl = isValidUrl(citation.source);
  
  // 格式化分数显示
  const scoreDisplay = citation.score !== null && citation.score !== undefined
    ? `${(citation.score * 100).toFixed(1)}%`
    : null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`border rounded-lg overflow-hidden ${
        isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'
      }`}
    >
      {/* 标题栏 */}
      <button
        onClick={() => {
          setIsExpanded(!isExpanded);
          onSelect();
        }}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* 序号 */}
        <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary text-sm font-medium rounded-full flex items-center justify-center">
          {index + 1}
        </span>
        
        {/* 来源信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-700 truncate">
              {displayName}
            </span>
          </div>
          {scoreDisplay && (
            <span className="text-xs text-gray-400 mt-0.5 block">
              {t('relevanceScore') || '相关度'}: {scoreDisplay}
            </span>
          )}
        </div>
        
        {/* 展开/收起图标 */}
        <span className="flex-shrink-0 text-gray-400">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
      </button>
      
      {/* 展开的内容 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-gray-100">
              {/* 来源链接 */}
              {isUrl && (
                <a
                  href={citation.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-3"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t('viewSource') || '查看来源'}
                </a>
              )}
              
              {/* 内容片段 */}
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                {citation.content}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * 1.3.11: 引用来源面板主组件
 */
export function CitationPanel({
  citations,
  isOpen,
  onClose,
  selectedCitationId,
  onSelectCitation
}: CitationPanelProps) {
  const { t } = useTranslation();
  
  if (!isOpen || citations.length === 0) {
    return null;
  }
  
  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col h-full overflow-hidden"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-semibold text-gray-800">
          {t('citationSources') || '引用来源'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* 引用列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {citations.map((citation, index) => (
          <CitationItem
            key={citation.id || `citation-${index}`}
            citation={citation}
            index={index}
            isSelected={selectedCitationId === citation.id}
            onSelect={() => onSelectCitation?.(citation.id)}
          />
        ))}
      </div>
      
      {/* 底部信息 */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <p className="text-xs text-gray-400">
          {t('citationNote') || `显示相关度最高的 ${citations.length} 个文档片段`}
        </p>
      </div>
    </motion.div>
  );
}

export default CitationPanel;
