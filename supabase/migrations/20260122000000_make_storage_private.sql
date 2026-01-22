-- 1.2.50: 将 Storage bucket 改为私有，防止文件被直接下载
-- 分享聊天功能通过 share_token 访问知识库，不需要直接访问原始文件
-- 执行时间: 2026-01-22

-- 1. 删除公开访问策略
DROP POLICY IF EXISTS "Public can view files" ON storage.objects;

-- 2. 将 bucket 改为私有
UPDATE storage.buckets 
SET public = false 
WHERE id = 'knowledge-base-files';
