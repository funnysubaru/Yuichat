-- 1.3.28: 创建专门用于头像的公开bucket
-- 修复头像上传后刷新无法显示预览、测试对话机器人icon不显示的问题
-- 原因：knowledge-base-files bucket是私有的，但头像需要公开访问
-- 解决方案：创建独立的公开bucket专门存储头像
-- 执行时间: 2026-01-28

-- 1. 创建头像专用bucket（公开访问）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- 公开访问
  2097152,  -- 2MB 文件大小限制
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];

-- 2. 创建上传策略：认证用户可以上传自己知识库的头像
CREATE POLICY "Users can upload own kb avatars" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
  )
);

-- 3. 创建更新策略：用户可以更新自己知识库的头像
CREATE POLICY "Users can update own kb avatars" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
  )
);

-- 4. 创建删除策略：用户可以删除自己知识库的头像
CREATE POLICY "Users can delete own kb avatars" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
  )
);

-- 5. 创建公开读取策略：任何人可以查看头像（用于聊天界面和外部分享）
CREATE POLICY "Public can view avatars" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');
