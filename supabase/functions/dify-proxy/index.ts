/**
 * 1.0.0: YUIChat 项目 - Dify 代理 Edge Function
 * 作为 Dify API 的安全网关，处理用户验证、请求转发和流式响应透传
 * 
 * 1.1.11: 已废弃 - 不再使用 Dify 集成
 * 当前系统已切换到 LangGraph + Python 后端（backend_py/app.py）
 * 聊天功能现在通过 ChatInterface.tsx → Python 后端 /api/chat 处理
 * 保留此文件仅用于历史参考，代码已注释
 */

// 1.1.11: 废弃提示
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: 'Deprecated',
      message: 'This Edge Function has been deprecated. Chat functionality is now handled by Python backend at /api/chat',
      deprecated_since: '1.1.11',
      new_endpoint: 'Python backend /api/chat',
    }),
    {
      status: 410, // Gone
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});

// 1.1.11: 以下为旧代码，已废弃，保留用于历史参考
/*
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ... 旧的 Dify 集成代码 ...
*/
