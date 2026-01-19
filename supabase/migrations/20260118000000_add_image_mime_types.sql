-- 1.2.1: 添加图片MIME类型支持到存储桶
-- 修复头像上传错误：mime type image/png is not supported
-- 执行时间: 2026-01-18

-- 更新存储桶配置，添加图片类型支持
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  -- 原有类型
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
  -- 新增图片类型
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml'
]
WHERE id = 'knowledge-base-files';
