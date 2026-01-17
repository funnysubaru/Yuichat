-- 1.1.8: 创建 Storage bucket 用于存储知识库文件
-- 修复 "Bucket not found" 错误
-- 执行时间: 2026-01-17 14:21:29 UTC
-- 执行方式: MCP Supabase 工具

-- 插入 bucket 配置
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-base-files',
  'knowledge-base-files',
  true,  -- 公开访问（可以通过 RLS 控制）
  52428800,  -- 50MB 文件大小限制
  ARRAY[
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'audio/mpeg',
    'audio/wav',
    'video/mp4'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 创建 Storage 策略：允许认证用户上传文件
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-base-files' AND
    -- 只能上传到自己的知识库目录下
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

-- 创建 Storage 策略：允许认证用户查看自己的文件
CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'knowledge-base-files' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

-- 创建 Storage 策略：允许认证用户删除自己的文件
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'knowledge-base-files' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

-- 创建 Storage 策略：允许公开访问（用于分享功能）
CREATE POLICY "Public can view files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'knowledge-base-files');
