-- 1.3.26: 添加Storage UPDATE策略
-- 修复头像上传失败问题（upsert需要UPDATE权限）

-- 添加UPDATE策略，允许用户更新自己知识库中的文件
CREATE POLICY "Users can update own files" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'knowledge-base-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'knowledge-base-files'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
  )
);
