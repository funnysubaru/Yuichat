# 架构说明：项目级外部分享

## 数据模型

```
knowledge_bases（项目表）
├── id (UUID)
├── user_id (UUID) - 所属用户
├── name (TEXT) - 项目名称
├── vector_collection (TEXT, UNIQUE) - 向量集合名称（自动生成）
└── share_token (UUID, UNIQUE) - 公开访问令牌

documents（文档表）
├── id (UUID)
├── knowledge_base_id (UUID) - 所属项目
├── filename (TEXT)
├── status (TEXT)
└── ... 其他字段
```

## 工作流程

### 1. 创建项目
- 用户创建新项目时，自动生成：
  - `vector_collection`: 唯一的向量集合 ID（所有文档共享）
  - `share_token`: 公开分享令牌

### 2. 上传文档
- 用户在项目中上传多个文档
- 所有文档使用项目的 `vector_collection` 进行向量化
- 向量统一存储在 Chroma 的 `./chroma_db/{vector_collection}` 目录

### 3. 生成分享链接
- 格式：`http://localhost:8000/?kb_id={share_token}`
- 外部用户访问该链接时：
  1. Chainlit 接收 `kb_id` 参数
  2. 查询 Supabase 获取对应的 `vector_collection`
  3. 加载该向量集合（包含项目下所有文档的向量）
  4. 用户可以基于项目内所有文档进行问答

## 关键优势

1. **项目级管理**：一个项目 = 一个向量集合，便于管理
2. **文档聚合**：项目下所有文档自动聚合到同一向量空间
3. **灵活扩展**：随时添加新文档到项目，自动索引到现有向量集合
4. **访问控制**：通过 `share_token` 实现项目级别的公开访问

## 示例

假设项目"产品文档"：
- 包含文档：`用户手册.pdf`, `API文档.docx`, `FAQ.xlsx`
- `vector_collection`: `abc-123-xyz`
- `share_token`: `def-456-uvw`
- 分享链接：`http://localhost:8000/?kb_id=def-456-uvw`

外部用户访问该链接后，可以询问：
- "如何使用XXX功能？"（来自用户手册）
- "API接口的鉴权方式是什么？"（来自API文档）
- "常见问题有哪些？"（来自FAQ）

系统会从所有3个文档中检索相关内容并回答。
