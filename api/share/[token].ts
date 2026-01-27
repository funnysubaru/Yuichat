/**
 * 1.2.49: Vercel Edge Function - 为分享链接生成动态 OG meta tags
 * 1.3.23: 支持从数据库动态读取项目名称和说明作为预览内容
 * 
 * 功能：
 * - 检测请求者是否为社交媒体爬虫（Line、Facebook、Twitter 等）
 * - 如果是爬虫，返回带有正确语言的 OG tags 的 HTML
 * - 如果是普通用户，返回带有正确 OG tags 并自动重定向到 SPA 的页面
 * - 从 Supabase 查询项目名称和说明，动态生成预览内容
 * 
 * URL 格式：/api/share/{token}?lang=zh|en|ja
 */

export const config = {
  runtime: 'edge',
};

// Supabase 配置 - 使用环境变量
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// 1.3.23: 知识库信息接口
interface KnowledgeBaseInfo {
  name: string;
  description: string | null;
}

// 多语言默认 OG 内容（当查询失败时使用）
// 1.3.23: 保留作为后备默认内容
const defaultOgContent: Record<string, { title: string; description: string }> = {
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

// 1.3.23: 从 URL 路径中提取 token
function extractTokenFromPath(pathname: string): string | null {
  // 匹配 /api/share/{token} 或 /share/{token}
  const match = pathname.match(/\/(?:api\/)?share\/([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

// 1.3.23: 从 Supabase 查询知识库信息
async function fetchKnowledgeBaseInfo(shareToken: string): Promise<KnowledgeBaseInfo | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase configuration missing, using default content');
    return null;
  }
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/knowledge_bases?share_token=eq.${shareToken}&select=name,description`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    
    if (!response.ok) {
      console.error('Failed to fetch knowledge base:', response.status);
      return null;
    }
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        name: data[0].name,
        description: data[0].description,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching knowledge base info:', error);
    return null;
  }
}

// 1.3.23: 获取 OG 内容，优先使用项目信息
function getOgContent(
  kbInfo: KnowledgeBaseInfo | null, 
  lang: string
): { title: string; description: string } {
  // 如果有项目信息，使用项目名称和说明
  if (kbInfo) {
    // 处理空字符串和 null，都视为没有说明
    const description = kbInfo.description?.trim() || '';
    return {
      title: kbInfo.name,
      // 如果没有说明文，只显示项目名称（description 为空）
      description: description,
    };
  }
  
  // 后备：使用默认内容
  return defaultOgContent[lang] || defaultOgContent.ja;
}

function generateHtml(
  baseUrl: string, 
  path: string, 
  search: string, 
  lang: string, 
  isCrawler: boolean,
  ogContent: { title: string; description: string }
): string {
  const spaPath = path.replace('/api/share/', '/share/');
  const currentUrl = `${baseUrl}${spaPath}${search}`;
  
  // 1.3.23: 动态生成标题和描述
  // 如果有描述，标题格式为 "YUIChat - {项目名}"，否则只显示项目名
  const pageTitle = ogContent.description 
    ? `YUIChat - ${ogContent.title}`
    : ogContent.title;
  
  // 描述：如果项目有说明则使用，否则留空
  const descriptionMeta = ogContent.description 
    ? `<meta name="description" content="${ogContent.description}">` 
    : '';
  const ogDescriptionMeta = ogContent.description
    ? `<meta property="og:description" content="${ogContent.description}">`
    : '';
  const twitterDescriptionMeta = ogContent.description
    ? `<meta name="twitter:description" content="${ogContent.description}">`
    : '';
  
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="title" content="${pageTitle}">
  ${descriptionMeta}
  <meta property="og:type" content="website">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="${pageTitle}">
  ${ogDescriptionMeta}
  <meta property="og:image" content="${baseUrl}/logo.png">
  <meta property="og:locale" content="${lang === 'zh' ? 'zh_CN' : lang === 'ja' ? 'ja_JP' : 'en_US'}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${pageTitle}">
  ${twitterDescriptionMeta}
  <meta name="twitter:image" content="${baseUrl}/logo.png">
  ${!isCrawler ? `<meta http-equiv="refresh" content="0;url=${currentUrl}">
  <script>window.location.replace("${currentUrl}");</script>` : ''}
</head>
<body>
  <noscript><p>${ogContent.description || ogContent.title}</p><a href="${currentUrl}">Open YUIChat</a></noscript>
</body>
</html>`;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';
  const baseUrl = `${url.protocol}//${url.host}`;
  
  const isCrawler = isSocialMediaCrawler(userAgent);
  const lang = getLanguage(url);
  
  // 1.3.23: 从路径提取 token 并查询项目信息
  const shareToken = extractTokenFromPath(url.pathname);
  let kbInfo: KnowledgeBaseInfo | null = null;
  
  if (shareToken) {
    kbInfo = await fetchKnowledgeBaseInfo(shareToken);
  }
  
  const ogContent = getOgContent(kbInfo, lang);
  const html = generateHtml(baseUrl, url.pathname, url.search, lang, isCrawler, ogContent);
  
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // 1.3.23: 如果查询到了项目信息，缓存时间缩短以便更新后能及时反映
      'Cache-Control': isCrawler 
        ? (kbInfo ? 'public, max-age=1800' : 'public, max-age=3600') 
        : 'no-cache',
    },
  });
}
