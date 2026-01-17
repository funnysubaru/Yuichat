/**
 * 1.0.0: YUIChat 项目 - 文件上传 Edge Function
 * 处理知识库文件上传到 Dify 并存储元数据到 Supabase
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Get environment variables
const DIFY_API_URL = Deno.env.get('DIFY_API_URL');
const DIFY_API_KEY = Deno.env.get('DIFY_API_KEY');
const DIFY_DEFAULT_DATASET_ID = Deno.env.get('DIFY_DEFAULT_DATASET_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const supabase = createClient(SUPABASE_URL, supabaseAnonKey);
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

    // 2. 解析 FormData
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const datasetId = (formData.get('dataset_id') as string) || DIFY_DEFAULT_DATASET_ID;
    const knowledgeBaseId = formData.get('knowledge_base_id') as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Missing file' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!datasetId) {
      return new Response(
        JSON.stringify({ error: 'Missing dataset_id' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 3. 上传文件到 Dify
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const uploadResponse = await fetch(`${DIFY_API_URL}/v1/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
      },
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return new Response(
        JSON.stringify({ error: `Dify upload failed: ${uploadResponse.status}`, details: errorText }),
        { 
          status: uploadResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;

    if (!fileId) {
      return new Response(
        JSON.stringify({ error: 'Failed to get file ID from Dify' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. 创建文档到 Dify 知识库
    const createDocResponse = await fetch(`${DIFY_API_URL}/v1/datasets/${datasetId}/document/create_by_file`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data_source: 'upload_file',
        file_id: fileId,
      }),
    });

    if (!createDocResponse.ok) {
      const errorText = await createDocResponse.text();
      return new Response(
        JSON.stringify({ error: `Dify document creation failed: ${createDocResponse.status}`, details: errorText }),
        { 
          status: createDocResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const docData = await createDocResponse.json();
    const documentId = docData.id;

    // 5. 存储元数据到 Supabase
    if (SUPABASE_SERVICE_ROLE_KEY && knowledgeBaseId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          knowledge_base_id: knowledgeBaseId,
          dify_document_id: documentId,
          filename: file.name,
          file_type: file.type || file.name.split('.').pop(),
          file_size: file.size,
          status: 'processing',
        });

      if (dbError) {
        console.error('Failed to save document metadata:', dbError);
        // 不返回错误，因为 Dify 上传已成功
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileId,
        documentId,
        message: 'File uploaded successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('File upload error:', error);
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

