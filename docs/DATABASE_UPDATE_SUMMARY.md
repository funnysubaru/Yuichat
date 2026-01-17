# Supabase 数据库更新总结

**更新时间**: 2026-01-17  
**版本**: 1.1.7  
**执行方式**: MCP Supabase 工具

---

## ✅ 更新完成

### 1. 迁移执行状态

通过 MCP 连接 Supabase 成功执行了所有待处理的数据库迁移：

| 迁移名称 | 状态 | 说明 |
|---------|------|------|
| `initial_schema_setup` | ✅ 已完成 | 初始化数据库 Schema |
| `20250101000000_add_knowledge_base_tables` | ✅ 已完成 | 创建知识库和文档基础表 |
| `20260117000000_update_schema_for_langgraph` | ✅ 已完成 | LangGraph 架构适配 |
| `add_share_token_to_knowledge_bases` | ✅ 新增完成 | 添加分享令牌功能 |

### 2. 数据库 Schema 详情

#### knowledge_bases 表

```sql
CREATE TABLE knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    description TEXT,
    
    -- 1.1.0: 兼容旧版 Dify
    dify_dataset_id TEXT,
    
    -- 1.1.0: LangGraph 架构
    vector_collection TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
    
    -- 1.1.7: 分享功能
    share_token UUID UNIQUE DEFAULT gen_random_uuid(),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

**索引**：
- ✅ `idx_knowledge_bases_share_token` (UNIQUE) - 用于快速查询分享令牌

#### documents 表

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id),
    filename TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    
    -- 1.1.0: 兼容旧版 Dify
    dify_document_id TEXT,
    
    -- 1.1.0: LangGraph 架构
    storage_path TEXT,
    processing_metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🎯 新增功能支持

### 1. 项目级分享功能

每个知识库（项目）现在都有唯一的 `share_token`，可用于：

- 生成外部访问链接
- 无需登录即可访问项目的聊天界面
- 通过 Chainlit 的 `kb_id` 参数传递令牌

**使用示例**：
```
http://localhost:8000/?kb_id=<share_token>
```

### 2. 向量集合管理

每个项目有独立的 `vector_collection`：

- 项目下所有文档共享同一个向量集合
- 支持 Chroma 本地数据库（开发环境）
- 支持 Supabase pgvector（生产环境）

### 3. 文件存储路径

`documents` 表的 `storage_path` 字段：

- 记录文件在 Supabase Storage 中的路径
- 便于文件管理和下载
- 支持文件删除和更新

### 4. 处理元数据

`processing_metadata` JSONB 字段可存储：

- 文档切片数量
- 向量化状态
- 错误信息
- 处理时间等

---

## 🔍 验证结果

### 执行的验证查询

```sql
-- 验证 share_token 字段和索引
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE 
    schemaname = 'public' 
    AND tablename = 'knowledge_bases' 
    AND indexname LIKE '%share_token%';
```

**结果**：
```json
{
  "indexname": "idx_knowledge_bases_share_token",
  "indexdef": "CREATE UNIQUE INDEX idx_knowledge_bases_share_token ON public.knowledge_bases USING btree (share_token)"
}
```

✅ 索引创建成功，查询性能优化完成

---

## 📊 当前数据库状态

### 表统计

| 表名 | 行数 | RLS 启用 | 状态 |
|-----|------|---------|------|
| `knowledge_bases` | 0 | ✅ | 就绪 |
| `documents` | 0 | ✅ | 就绪 |
| `customers` | 0 | ✅ | 就绪 |
| `products` | 0 | ✅ | 就绪 |
| `prices` | 0 | ✅ | 就绪 |
| `subscriptions` | 0 | ✅ | 就绪 |
| `clients` | 0 | ✅ | 就绪 |

### 外键约束

✅ 所有外键约束配置正确：
- `knowledge_bases.user_id` → `auth.users.id`
- `documents.knowledge_base_id` → `knowledge_bases.id`

---

## 🚀 下一步操作

### 1. 功能测试

现在可以测试以下功能：

```bash
# 1. 启动前端（终端1）
npm run dev

# 2. 启动后端（终端2）
cd backend_py
chainlit run app.py -w
```

**测试流程**：
1. 创建新项目（knowledge_base）
2. 验证 `share_token` 自动生成
3. 上传文档到项目
4. 验证 `storage_path` 正确记录
5. 测试分享链接访问

### 2. 数据验证

```sql
-- 查看创建的项目
SELECT id, name, vector_collection, share_token 
FROM knowledge_bases 
LIMIT 5;

-- 查看上传的文档
SELECT id, filename, status, storage_path, processing_metadata 
FROM documents 
LIMIT 5;
```

### 3. 生产环境准备

- [ ] 配置 Supabase Storage bucket
- [ ] 设置 RLS 策略（如需调整）
- [ ] 配置 `USE_PGVECTOR=true`
- [ ] 设置 `DATABASE_URL`
- [ ] 部署 Edge Functions

---

## 📝 技术说明

### MCP 工具使用

本次更新使用了以下 MCP 工具：

1. `mcp_supabase-yuichat_list_migrations` - 查看迁移历史
2. `mcp_supabase-yuichat_list_tables` - 检查表结构
3. `mcp_supabase-yuichat_apply_migration` - 应用迁移
4. `mcp_supabase-yuichat_execute_sql` - 执行验证查询

### 优势

- ✅ 无需手动登录 Supabase Dashboard
- ✅ 自动化迁移执行
- ✅ 即时验证结果
- ✅ 可追溯的操作记录

---

## ⚠️ 注意事项

1. **向后兼容**：保留了 `dify_dataset_id` 和 `dify_document_id` 字段，确保旧数据可用
2. **唯一性约束**：`vector_collection` 和 `share_token` 都是唯一的，避免冲突
3. **默认值**：新创建的项目会自动生成 `vector_collection` 和 `share_token`
4. **RLS 策略**：所有表都启用了 Row Level Security，确保数据安全

---

## 📞 问题排查

如果遇到问题，可以：

1. 查看迁移历史：
   ```bash
   # 使用 MCP 工具
   mcp_supabase-yuichat_list_migrations
   ```

2. 检查表结构：
   ```bash
   # 使用 MCP 工具
   mcp_supabase-yuichat_list_tables
   ```

3. 查看日志：
   - Supabase Dashboard: https://supabase.com/dashboard/project/ppodcyocqhzrjqujdxqr/logs
   - 本地日志：`backend_py/` 目录下的输出

---

**更新完成！数据库已就绪，可以开始使用新功能。** 🎉
