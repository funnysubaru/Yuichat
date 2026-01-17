# 文档处理流程可视化

## 完整流程图

```
┌──────────────────────────────────────────────────────────────────────┐
│                         用户上传文档                                   │
│                  (前端: UploadKnowledgeModal)                          │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  文件上传到 Supabase Storage                           │
│          (kbService.uploadFileToKB)                                   │
│  • Bucket: knowledge-base-files                                       │
│  • Path: {kb_id}/{random_name}.{ext}                                  │
│  • 获取公开 URL                                                        │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│              调用 Python 后端 /api/process-file                        │
│                    (FastAPI 端点)                                      │
│  POST {                                                               │
│    file_path: "https://...",                                          │
│    collection_name: "kb_xxx"                                          │
│  }                                                                    │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    LangGraph 工作流开始                                │
│                   (workflow.py: app)                                  │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │    节点 1: process_file_node           │
        │    • 从 URL 下载文件                    │
        │    • 根据扩展名选择加载器：               │
        │      - .pdf → PyPDFLoader             │
        │      - .docx → Docx2txtLoader         │
        │      - .xlsx → UnstructuredExcelLoader│
        │    • 加载文档内容                        │
        └───────────────┬────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────┐
        │    节点 2: split_text_node             │
        │    • RecursiveCharacterTextSplitter   │
        │      - chunk_size: 1000                │
        │      - chunk_overlap: 200              │
        │      - separators: ["\n\n", "。", ...]│
        │    • 分割成多个文档块                    │
        └───────────────┬────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────┐
        │   节点 3: embed_and_store_node         │
        │   • 生成 embedding                      │
        │     - 模型: OpenAI text-embedding-ada-2│
        │     - 维度: 1536                        │
        │   • 存储到向量数据库                     │
        │     - Chroma (本地开发)                 │
        │     - pgvector (生产环境)               │
        │   • 创建向量索引                         │
        └───────────────┬────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────┐
        │         向量存储完成                     │
        │   Collection: kb_{timestamp}_{id}      │
        │   Status: Ready for Query              │
        └────────────────────────────────────────┘

════════════════════════════════════════════════════════════════════════
                           检索和问答流程
════════════════════════════════════════════════════════════════════════

        ┌────────────────────────────────────────┐
        │          用户提问                        │
        │    "这个文档讲了什么？"                   │
        └───────────────┬────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────┐
        │      节点 4: chat_node                  │
        │   步骤 1: 生成查询向量                    │
        │     • 使用 OpenAI Embeddings           │
        │     • 将问题转换为 1536 维向量           │
        └───────────────┬────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────┐
        │   步骤 2: 向量相似度搜索                  │
        │     • 在 Chroma/pgvector 中检索         │
        │     • 返回 Top-K 相似文档块              │
        │     • 默认 K=4                          │
        └───────────────┬────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────┐
        │   步骤 3: 构建 Prompt                    │
        │     • System: 专业知识库助手提示           │
        │     • Context: 检索到的文档内容           │
        │     • User: 用户问题                     │
        └───────────────┬────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────┐
        │   步骤 4: LLM 生成回答                   │
        │     • 模型: GPT-4o                      │
        │     • 基于检索内容生成答案                │
        │     • 流式输出（可选）                    │
        └───────────────┬────────────────────────┘
                        │
                        ▼
        ┌────────────────────────────────────────┐
        │         返回答案给用户                    │
        │   包含引用的文档片段（可选）               │
        └────────────────────────────────────────┘
```

---

## 数据流详解

### 1. 文件上传阶段

```
前端 (React)
  │
  ├─ 用户选择文件 (UploadKnowledgeModal.tsx)
  │   • 支持拖拽上传
  │   • 支持多文件
  │   • 格式验证
  │
  ├─ 调用 kbService.uploadFileToKB()
  │   • 获取 knowledge_base 的 vector_collection
  │   • 上传文件到 Supabase Storage
  │   • 生成文件路径和公开 URL
  │
  └─ 调用 Python 后端
      POST /api/process-file
      {
        file_path: "https://supabase.co/storage/...",
        collection_name: "kb_1768659550718_e4z5lg"
      }
```

### 2. 文档处理阶段

```python
# workflow.py

GraphState = {
    "file_path": str,         # 文件URL
    "docs": List[Document],   # 加载的文档
    "splits": List[Document], # 分割后的块
    "collection_name": str,   # 向量集合名称
    "messages": List[...],    # 对话历史
    "context": str,           # 检索到的上下文
    "answer": str             # 生成的答案
}

# 节点执行顺序
workflow = StateGraph(GraphState)
workflow.add_edge("process_file", "split_text")
workflow.add_edge("split_text", "embed_and_store")
workflow.add_edge("embed_and_store", "chat")
```

### 3. 向量存储结构

#### Chroma 本地存储

```
backend_py/chroma_db/
└── kb_1768659550718_e4z5lg/        # Collection
    ├── chroma.sqlite3               # 元数据数据库
    │   ├── embeddings               # 向量数据
    │   ├── documents                # 原始文档内容
    │   └── metadata                 # 文档元数据
    │
    └── d2fb76db-4269-49f2-8c1f-d2a2571f2a9a/  # HNSW 索引
        ├── data_level0.bin          # 向量数据
        ├── header.bin               # 索引头
        ├── length.bin               # 向量长度
        └── link_lists.bin           # 邻居链接
```

#### pgvector 存储（生产环境）

```sql
-- Supabase 向量扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 向量集合表
CREATE TABLE vector_collections (
    id UUID PRIMARY KEY,
    name TEXT UNIQUE,
    dimension INT,
    metadata JSONB
);

-- 向量数据表
CREATE TABLE vector_documents (
    id UUID PRIMARY KEY,
    collection_id UUID REFERENCES vector_collections(id),
    embedding VECTOR(1536),  -- OpenAI 向量维度
    content TEXT,
    metadata JSONB
);

-- 创建 HNSW 索引以加速搜索
CREATE INDEX ON vector_documents 
USING hnsw (embedding vector_cosine_ops);
```

---

## 关键配置参数

### 文档分割参数

```python
RecursiveCharacterTextSplitter(
    chunk_size=1000,         # 每块最大字符数
    chunk_overlap=200,       # 重叠字符数（保持上下文连贯）
    length_function=len,     # 长度计算函数
    separators=[             # 分隔符优先级
        "\n\n",              # 段落分隔
        "。",                # 中文句号
        "！",                # 中文感叹号
        "\n",                # 换行符
        ""                   # 字符级分隔（最后手段）
    ]
)
```

**为什么选择这些参数？**
- `chunk_size=1000`: 平衡上下文完整性和检索精度
- `chunk_overlap=200`: 避免重要信息在边界丢失
- 分隔符顺序: 优先在自然段落边界分割

### Embedding 参数

```python
OpenAIEmbeddings(
    model="text-embedding-ada-002",  # OpenAI 嵌入模型
    dimensions=1536,                  # 向量维度
    encoding_format="float",          # 编码格式
    max_retries=3,                    # 重试次数
    timeout=60                        # 超时时间（秒）
)
```

### 检索参数

```python
# 相似度搜索
retriever = vectorstore.as_retriever(
    search_type="similarity",    # 搜索类型：相似度
    search_kwargs={
        "k": 4,                  # 返回 Top-4 结果
        "score_threshold": 0.5   # 相似度阈值（可选）
    }
)
```

---

## 性能优化策略

### 1. 批量处理

```python
# 批量生成 embedding（减少 API 调用）
texts = [doc.page_content for doc in splits]
embeddings = embeddings_model.embed_documents(texts)

# 批量插入向量数据库
vectorstore.add_texts(
    texts=texts,
    embeddings=embeddings,
    metadatas=[doc.metadata for doc in splits]
)
```

### 2. 缓存策略

```python
# 文档内容哈希（避免重复处理）
import hashlib

def get_document_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()

# 检查缓存
if doc_hash in processed_hashes:
    return cached_result
```

### 3. 异步处理

```python
# 异步生成 embedding
async def process_documents_async(docs):
    tasks = [
        embeddings_model.aembed_query(doc.page_content)
        for doc in docs
    ]
    return await asyncio.gather(*tasks)
```

---

## 错误处理

### 文档加载失败

```python
try:
    docs = loader.load()
except Exception as e:
    logger.error(f"Failed to load document: {e}")
    raise ValueError(f"Unsupported file type or corrupted file")
```

### Embedding 生成失败

```python
try:
    embeddings = embeddings_model.embed_documents(texts)
except openai.RateLimitError:
    logger.warning("Rate limit exceeded, retrying...")
    time.sleep(5)
    embeddings = embeddings_model.embed_documents(texts)
except Exception as e:
    logger.error(f"Embedding generation failed: {e}")
    raise
```

### 向量存储失败

```python
try:
    collection.upsert(records=records)
except Exception as e:
    logger.error(f"Vector storage failed: {e}")
    # 回滚事务或记录失败文档
    failed_docs.append(doc_id)
```

---

## 监控指标

### 关键性能指标（KPI）

1. **处理成功率**: 成功处理的文档数 / 总上传文档数
2. **平均处理时间**: 从上传到可查询的总时间
3. **Embedding 生成时间**: OpenAI API 调用延迟
4. **检索准确率**: 检索到相关文档的比例
5. **用户满意度**: 基于答案质量的评分

### 日志示例

```python
logger.info(f"Document processing started: {file_name}")
logger.info(f"Document loaded: {len(docs)} pages")
logger.info(f"Document split: {len(splits)} chunks")
logger.info(f"Embeddings generated: {len(embeddings)} vectors")
logger.info(f"Vectors stored in collection: {collection_name}")
logger.info(f"Processing completed in {elapsed_time:.2f}s")
```

---

## 测试用例

### 单元测试

```python
def test_document_splitting():
    text = "测试文档。" * 100
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=100,
        chunk_overlap=20
    )
    chunks = splitter.split_text(text)
    assert len(chunks) > 1
    assert all(len(chunk) <= 100 for chunk in chunks)
```

### 集成测试

```python
async def test_end_to_end_processing():
    # 1. 上传文件
    file_path = await upload_file(test_file)
    
    # 2. 处理文档
    result = await workflow_app.ainvoke({
        "file_path": file_path,
        "collection_name": "test_collection"
    })
    
    # 3. 验证存储
    assert collection_exists("test_collection")
    
    # 4. 测试检索
    query = "测试问题"
    docs = retriever.invoke(query)
    assert len(docs) > 0
```

---

## 相关文档

- [测试报告](./DOCUMENT_PROCESSING_TEST_REPORT.md)
- [知识库实现](./KNOWLEDGE_BASE_IMPLEMENTATION.md)
- [API 文档](./API_DOCUMENTATION.md)
