# YuiChat 部署状态

**更新时间**: 2026-01-17  
**版本**: 1.1.6

## ✅ 完成的任务

### 1. 环境切换功能 (1.1.3)

已实现本地/线上向量数据库切换功能：

- **本地开发**: 使用 Chroma 本地向量数据库
  - 快速、无需网络
  - 数据存储在 `./chroma_db/` 目录
  - 配置：`USE_PGVECTOR=false`

- **生产环境**: 使用 Supabase pgvector
  - 数据持久化
  - 支持多实例共享
  - 配置：`USE_PGVECTOR=true` + `DATABASE_URL`

### 2. 配置验证

已完成所有配置的验证测试：

- ✅ **环境变量**: 所有必需变量已正确配置
- ✅ **OpenAI API**: 连接成功，向量维度 1536
- ✅ **Supabase**: 连接成功，数据库表可访问
- ✅ **pgvector**: 配置可选（本地开发跳过）

### 3. 服务启动

两个开发环境已成功启动并运行：

- **后端服务 (Chainlit)**: http://localhost:8000
  - Python + LangGraph + Chainlit
  - RAG 工作流
  - 文件处理和问答功能

- **前端服务 (Vite)**: http://127.0.0.1:5179/
  - React + TypeScript
  - 管理界面
  - 项目和知识库管理

## 📋 配置文件

### 后端配置 (`.env.local`)

```env
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Supabase Configuration
SUPABASE_URL=https://ppodcyocqhzrjqujdxqr.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 环境配置
ENV=development

# 向量数据库配置（本地开发）
USE_PGVECTOR=false

# 数据库连接（生产环境需要）
DATABASE_URL=postgresql://postgres...
```

## 🚀 启动命令

### 后端服务

```bash
cd backend_py
chainlit run app.py -w
```

或使用 npm script：
```bash
npm run backend
```

### 前端服务

```bash
npm run dev
```

### 配置测试

```bash
cd backend_py
python test_config.py
```

## 📊 数据库状态

已执行的迁移：
- ✅ `20250101000000_add_knowledge_base_tables.sql` - 创建基础表
- ✅ `20260117000000_update_schema_for_langgraph.sql` - LangGraph 适配
- ✅ `20260117000001_add_share_token.sql` - 分享功能

### 数据库 Schema (1.1.6)

**knowledge_bases 表**：
- ✅ `id` (UUID, Primary Key)
- ✅ `user_id` (UUID, Foreign Key)
- ✅ `name` (TEXT)
- ✅ `description` (TEXT, nullable)
- ✅ `dify_dataset_id` (TEXT, nullable) - 兼容旧版
- ✅ `vector_collection` (TEXT, unique) - 项目向量集合名称
- ✅ `share_token` (UUID, unique) - 外部分享令牌
- ✅ `created_at`, `updated_at` (TIMESTAMPTZ)

**documents 表**：
- ✅ `id` (UUID, Primary Key)
- ✅ `knowledge_base_id` (UUID, Foreign Key)
- ✅ `filename` (TEXT)
- ✅ `file_type`, `file_size` (TEXT, BIGINT)
- ✅ `status` (TEXT: processing/completed/failed)
- ✅ `dify_document_id` (TEXT, nullable) - 兼容旧版
- ✅ `storage_path` (TEXT) - Supabase Storage 路径
- ✅ `processing_metadata` (JSONB) - 处理元数据
- ✅ `created_at`, `updated_at` (TIMESTAMPTZ)

**索引**：
- ✅ `idx_knowledge_bases_share_token` (UNIQUE) - 分享令牌索引

## 🔧 技术改进

### workflow.py (1.1.3)
- 支持双向量数据库（Chroma/pgvector）
- 添加错误处理和自动回退机制
- 环境感知的日志输出

### app.py (1.1.3)
- 修复 HTTP 上下文访问问题
- 安全的 query_params 获取

### 依赖更新
- 修复 `langchain_chroma` 导入问题
- 添加缺失的 `asyncpg` 依赖
- 移除重复的 `supabase-py` 依赖

## 📝 下一步建议

1. **测试功能**
   - 上传文档测试
   - RAG 问答测试
   - 前后端集成测试

3. **生产环境准备**
   - 配置 `USE_PGVECTOR=true`
   - 设置 `DATABASE_URL`
   - 部署到生产服务器

4. **性能优化**
   - 优化向量检索
   - 添加缓存机制
   - 监控和日志

## 📞 支持

如有问题，请参考：
- 配置测试工具: `backend_py/test_config.py`
- 环境配置示例: `backend_py/env.example`
- 项目文档: `docs/` 目录
