/**
 * 1.0.0: YUIChat 项目 - 文件上传 Edge Function
 * 处理知识库文件上传到 Dify 并存储元数据到 Supabase
 * 
 * 1.1.11: 已废弃 - 不再使用 Dify 集成
 * 当前系统已切换到 LangGraph + Python 后端（backend_py/app.py）
 * 文件上传现在通过 kbService.ts → Python 后端 /api/process-file 处理
 * 保留此文件仅用于历史参考，代码已注释
 */

// 1.1.11: 废弃提示
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: 'Deprecated',
      message: 'This Edge Function has been deprecated. File uploads are now handled by Python backend at /api/process-file',
      deprecated_since: '1.1.11',
      new_endpoint: 'Python backend /api/process-file',
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
