/**
 * 1.2.49: Vercel Edge Function - 为分享链接生成动态 OG meta tags
 * 
 * 功能：
 * - 检测请求者是否为社交媒体爬虫（Line、Facebook、Twitter 等）
 * - 如果是爬虫，返回带有正确语言的 OG tags 的 HTML
 * - 如果是普通用户，返回带有正确 OG tags 并自动重定向到 SPA 的页面
 * 
 * URL 格式：/api/share/{token}?lang=zh|en|ja
 * 
 * 注意：由于这是 Vite SPA 项目，这个 API 主要用于调试。
 * 实际的 OG tags 由 index.html 中的静态 meta tags 提供。
 * 如需真正的动态 OG tags，建议迁移到 Next.js 或使用预渲染服务。
 */

export const config = {
  runtime: 'edge',
};

// 多语言 OG 内容
const ogContent: Record<string, { title: string; description: string }> = {
  zh: {
    title: 'AI 智能助手',
    description: '欢迎使用 AI 智能问答助手，基于知识库为您提供专业解答',
  },
  en: {
    title: 'AI Assistant',
    description: 'Welcome to AI Assistant - Get professional answers based on the knowledge base',
  },
  ja: {
    title: 'AI アシスタント',
    description: 'AI アシスタントへようこそ - ナレッジベースに基づいた専門的な回答を提供します',
  }
};

// 检测是否为社交媒体爬虫
function isSocialMediaCrawler(userAgent: string): boolean {
  const crawlerPatterns = [
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'LinkedInBot',
    'Pinterest',
    'Slackbot',
    'TelegramBot',
    'WhatsApp',
    'Line',
    'LINE',
    'Discordbot',
  ];
  
  return crawlerPatterns.some(pattern => 
    userAgent.toLowerCase().includes(pattern.toLowerCase())
  );
}

// 获取语言参数
// 1.2.58: 默认语言改为日文
function getLanguage(url: URL): string {
  const lang = url.searchParams.get('lang');
  if (lang && ['zh', 'en', 'ja'].includes(lang)) {
    return lang;
  }
  return 'ja'; // 默认日文
}

function generateHtml(baseUrl: string, path: string, search: string, lang: string, isCrawler: boolean): string {
  const content = ogContent[lang] || ogContent.ja;
  const spaPath = path.replace('/api/share/', '/share/');
  const currentUrl = `${baseUrl}${spaPath}${search}`;
  
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YUIChat - ${content.title}</title>
  <meta name="title" content="YUIChat - ${content.title}">
  <meta name="description" content="${content.description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="YUIChat - ${content.title}">
  <meta property="og:description" content="${content.description}">
  <meta property="og:image" content="${baseUrl}/logo.png">
  <meta property="og:locale" content="${lang === 'zh' ? 'zh_CN' : lang === 'ja' ? 'ja_JP' : 'en_US'}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="YUIChat - ${content.title}">
  <meta name="twitter:description" content="${content.description}">
  <meta name="twitter:image" content="${baseUrl}/logo.png">
  ${!isCrawler ? `<meta http-equiv="refresh" content="0;url=${currentUrl}">
  <script>window.location.replace("${currentUrl}");</script>` : ''}
</head>
<body>
  <noscript><p>${content.description}</p><a href="${currentUrl}">Open YUIChat</a></noscript>
</body>
</html>`;
}

export default function handler(request: Request): Response {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';
  const baseUrl = `${url.protocol}//${url.host}`;
  
  const isCrawler = isSocialMediaCrawler(userAgent);
  const lang = getLanguage(url);
  const html = generateHtml(baseUrl, url.pathname, url.search, lang, isCrawler);
  
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': isCrawler ? 'public, max-age=3600' : 'no-cache',
    },
  });
}
