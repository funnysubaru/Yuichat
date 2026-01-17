# 故障排除指南

## 版本: 1.1.8

本文档记录 YUIChat 项目开发过程中遇到的常见问题和解决方案。

---

## 问题 1: 文档上传失败 - "Bucket not found" (v1.1.8)

### 错误信息

```
UploadKnowledgeModal.tsx:136 Upload error: StorageApiError: Bucket not found
    at @supabase_supabase-j…?v=6c520970:3861:14
handleStartUpload	@	UploadKnowledgeModal.tsx:136
```

### 问题分析

1. **根本原因**：Supabase Storage 中未创建 `knowledge-base-files` bucket
2. **触发位置**：`src/services/kbService.ts` 第 83-85 行
   ```typescript
   const { data, error } = await supabase.storage
     .from('knowledge-base-files')  // ❌ 这个 bucket 不存在
     .upload(filePath, file);
   ```
3. **发现过程**：
   - 检查所有数据库迁移文件（`supabase/migrations/`）
   - 发现只创建了数据表（`knowledge_bases`, `documents`）
   - 未创建 Storage bucket 配置

### 解决方案

#### 方案 1: 通过 MCP 工具创建（推荐） ✅

使用 Supabase MCP 工具直接执行 SQL：

```sql
-- 1. 创建 bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-base-files',
  'knowledge-base-files',
  true,
  52428800,
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

-- 2. 创建访问策略（4个）
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-base-files' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'knowledge-base-files' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'knowledge-base-files' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'knowledge-base-files');
```

#### 方案 2: 通过 Supabase Dashboard 创建

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择您的项目
3. 进入 **Storage** 页面
4. 点击 **New bucket**
5. 配置：
   - Name: `knowledge-base-files`
   - Public: ✅ 勾选
   - File size limit: `50 MB`
6. 点击 **Create bucket**

#### 方案 3: 通过 SQL Editor 运行迁移脚本

1. 登录 Supabase Dashboard
2. 进入 **SQL Editor**
3. 运行迁移脚本：`supabase/migrations/20260117000002_create_storage_bucket.sql`

### 验证修复

执行以下 SQL 验证配置：

```sql
-- 检查 bucket 是否创建成功
SELECT id, name, public, file_size_limit, created_at 
FROM storage.buckets 
WHERE id = 'knowledge-base-files';

-- 检查策略是否创建成功
SELECT policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
ORDER BY policyname;
```

**期望结果**：
- Bucket 存在，配置正确（50MB限制，公开访问）
- 4个访问策略已创建（INSERT, SELECT, DELETE 权限）

### 预防措施

1. **完整的迁移脚本**：确保所有数据库对象（表、索引、bucket）都有对应的迁移文件
2. **版本控制**：将迁移文件纳入 Git 版本控制
3. **文档化**：在 `docs/` 目录记录配置步骤
4. **自动化测试**：添加集成测试验证 Storage 配置

---

## 问题 2: 待补充

（预留位置，记录未来遇到的其他问题）

---

## 常用调试命令

### 检查 Supabase 连接

```bash
# 测试 Supabase 连接
curl -X GET 'https://your-project.supabase.co/rest/v1/knowledge_bases' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 查看本地 Supabase 日志

```bash
# 启动本地 Supabase（如果配置了）
supabase start

# 查看日志
supabase logs
```

### 检查环境变量

```bash
# 前端环境变量
cat .env.local

# Python 后端环境变量
cat backend_py/.env
```

---

## 相关文档

- [AUTH_CONFIGURATION.md](./AUTH_CONFIGURATION.md) - 认证配置指南
- [SUPABASE_CLI_SETUP.md](./SUPABASE_CLI_SETUP.md) - Supabase CLI 配置
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - 项目状态和待办事项
- [CHANGELOG.md](../CHANGELOG.md) - 版本更新记录

---

**文档版本**: 1.1.8  
**最后更新**: 2026-01-17  
**维护人员**: YUIChat 开发团队
