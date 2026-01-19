// 1.0.0: YUIChat 项目 - Markdown 渲染组件
// 1.2.10: 删除打字机效果图标，移除motion导入
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, isStreaming = false }: MarkdownRendererProps) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 leading-relaxed break-words">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-gray-900 text-base">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside mb-2 space-y-1.5 ml-4 pl-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside mb-2 ml-6 pl-0">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed mb-1.5">{children}</li>
          ),
          code: ({ inline, children }) => {
            if (inline) {
              return (
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-sm font-mono text-primary">
                  {children}
                </code>
              );
            }
            return (
              <code className="block p-3 bg-gray-100 rounded-lg text-sm font-mono overflow-x-auto">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-2 overflow-x-auto">{children}</pre>
          ),
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mb-2 mt-3 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mb-2 mt-3 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mb-2 mt-2 first:mt-0">{children}</h3>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-dark underline"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-3 py-1 my-2 bg-purple-50 italic">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {/* 1.2.10: 删除打字机效果图标，只保留isTyping的loading图标 */}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.content === nextProps.content && 
         prevProps.isStreaming === nextProps.isStreaming;
});

