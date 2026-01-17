/**
 * 1.0.0: YUIChat 项目 - Dify 代理 Edge Function
 * 作为 Dify API 的安全网关，处理用户验证、请求转发和流式响应透传
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Get environment variables
const DIFY_API_URL = Deno.env.get('DIFY_API_URL');
const DIFY_API_KEY = Deno.env.get('DIFY_API_KEY');
const DIFY_DEFAULT_DATASET_ID = Deno.env.get('DIFY_DEFAULT_DATASET_ID');

if (!DIFY_API_URL || !DIFY_API_KEY) {
  throw new Error('Missing DIFY_API_URL or DIFY_API_KEY environment variables');
}

/**
 * 验证用户身份
 */
async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. 验证用户身份
    const user = await getUser(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 2. 解析请求体
    const body = await req.json();
    const { query, conversation_id, user_id, response_mode = 'streaming' } = body;

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Missing query parameter' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. 构建 Dify API 请求
    const difyUrl = `${DIFY_API_URL}/v1/chat-messages`;
    const difyBody = {
      inputs: {
        user_name: user.email || user.id,
      },
      query: query,
      response_mode: response_mode,
      conversation_id: conversation_id || undefined,
      user: user_id || user.id, // 多租户隔离
    };

    // 4. 转发请求到 Dify
    const difyResponse = await fetch(difyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(difyBody),
    });

    if (!difyResponse.ok) {
      const errorText = await difyResponse.text();
      return new Response(
        JSON.stringify({ error: `Dify API error: ${difyResponse.status}`, details: errorText }),
        { 
          status: difyResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 5. 透传流式响应
    if (response_mode === 'streaming') {
      return new Response(difyResponse.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // 非流式响应
      const data = await difyResponse.json();
      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (error) {
    console.error('Dify proxy error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

