# pgvector vs Supabase Storage Vectors 说明

## 重要说明

**Supabase Storage 的 Vectors 为空是完全正常的！**

项目使用的是 **pgvector**（PostgreSQL 扩展），而不是 Supabase Storage 的 Vectors 功能。

## 两者的区别

### 1. Supabase Storage Vectors
- **位置**：Supabase Dashboard -> Storage -> Vectors
- **状态**：目前处于 Alpha 阶段，仅部分区域可用
- **用途**：Supabase 新推出的向量存储服务
- **项目使用情况**：❌ **未使用**

### 2. pgvector（PostgreSQL 扩展）
- **位置**：PostgreSQL 数据库表中
- **状态**：稳定可用
- **用途**：通过 PostgreSQL 扩展直接在数据库中存储向量
- **项目使用情况**：✅ **正在使用**

## 如何查看实际的向量数据

### 方法 1：通过 Supabase SQL Editor

在 Supabase Dashboard -> SQL Editor 中运行以下查询：

```sql
-- 1. 检查 pgvector 扩展是否已启用
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 2. 查看所有表（vecs 库会自动创建表来存储向量）
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%embeddings%' OR table_name LIKE '%vectors%' OR table_name LIKE 'vecs_%')
ORDER BY table_name;

-- 3. 查看某个 collection 的向量数量
-- 假设 collection 名称是 'kb_xxx'，vecs 会创建表 'kb_xxx_embeddings'
-- 注意：vecs 的表名格式可能不同，需要先查询确认
SELECT COUNT(*) as vector_count 
FROM kb_xxx_embeddings;  -- 替换为实际的表名

-- 4. 查看向量数据的详细信息（示例）
SELECT 
    id,
    LENGTH(embedding::text) as embedding_size,
    metadata
FROM kb_xxx_embeddings
LIMIT 10;
```

### 方法 2：通过 Python 脚本检查

创建检查脚本 `check_vectors.py`：

```python
import os
from dotenv import load_dotenv
import vecs

load_dotenv()

# 从环境变量获取数据库连接
DATABASE_URL = os.getenv("PGVECTOR_DATABASE_URL") or os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL 未配置")
    exit(1)

try:
    # 创建 vecs 客户端
    vx = vecs.create_client(DATABASE_URL)
    
    # 列出所有 collections
    print("📋 所有向量集合（Collections）：")
    collections = vx.list_collections()
    
    if not collections:
        print("  ⚠️ 没有找到任何向量集合")
    else:
        for collection_name in collections:
            print(f"\n  ✅ {collection_name}")
            try:
                collection = vx.get_collection(name=collection_name)
                # 获取集合信息（vecs 内部实现可能不同）
                print(f"     - 集合已创建")
            except Exception as e:
                print(f"     - 错误: {e}")
    
    # 检查特定 collection 的向量数量
    # 注意：需要知道 collection 名称，可以从 knowledge_bases 表的 vector_collection 字段获取
    print("\n💡 提示：要查看具体 collection 的向量数量，需要知道 collection 名称")
    print("   可以从 knowledge_bases 表的 vector_collection 字段获取")
    
except Exception as e:
    print(f"❌ 连接失败: {e}")
```

### 方法 3：通过项目代码检查

在 `backend_py` 目录下运行：

```bash
# 使用项目提供的测试脚本
python test_config.py
```

这会测试 pgvector 连接是否正常。

## 配置检查清单

确保以下配置正确：

1. **环境变量**（生产环境）：
   - `USE_PGVECTOR=true`
   - `PGVECTOR_DATABASE_URL=postgresql://...`（Supabase 数据库连接字符串）

2. **数据库扩展**：
   - 确保 Supabase 项目中已启用 `pgvector` 扩展
   - 在 SQL Editor 中运行：`CREATE EXTENSION IF NOT EXISTS vector;`

3. **向量存储位置**：
   - 向量数据存储在 PostgreSQL 数据库表中
   - 由 `vecs` 库自动管理表结构
   - 每个 collection 对应一个表

## 常见问题

### Q: 为什么 Supabase Storage Vectors 显示 "Coming soon"？
A: 这是 Supabase 的新功能，还在 Alpha 阶段。项目使用的是 pgvector，不需要这个功能。

### Q: 如何确认向量数据已存储？
A: 
1. 检查后端日志（如果 `ENV=development`，会输出存储成功的日志）
2. 通过 SQL Editor 查询 vecs 创建的表
3. 通过 Python 脚本使用 vecs 客户端查询

### Q: 向量数据存储在哪里？
A: 存储在 Supabase PostgreSQL 数据库中，由 `vecs` 库管理的表中。表名通常与 collection 名称相关。

## 相关文档

- [文档处理流程](./DOCUMENT_PROCESSING_FLOW.md)
- [部署状态](./DEPLOYMENT_STATUS.md)
- [环境配置示例](../backend_py/env.example)
