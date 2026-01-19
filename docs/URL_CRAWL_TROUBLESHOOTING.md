# URL爬虫问题诊断指南

## 问题现象

URL爬取后状态显示"学习成功"，但在测试对话中无法回答相关问题，AI回答"提供的上下文中没有相关信息"。

## 可能原因分析

### 1. 向量存储失败（最可能）

**症状**：
- URL爬取完成，状态显示成功
- 但向量库中没有数据

**诊断方法**：
```bash
cd backend_py
python test_url_crawl_diagnosis.py <collection_name>
```

**检查项**：
- 向量集合是否存在
- 文档数量是否为0
- 是否有错误文档

**解决方案**：
- 检查爬取日志，确认文档是否正确生成
- 检查embedding生成是否失败
- 检查向量存储是否有错误

### 2. collection_name 不匹配

**症状**：
- 爬取时使用的collection_name与检索时使用的不同

**诊断方法**：
1. 查看爬取日志中的collection_name
2. 查看测试对话时使用的collection_name
3. 对比两者是否一致

**检查点**：
- `/api/process-url` 使用的collection_name
- `/api/chat` 查询到的collection_name
- 两者应该都是项目的 `vector_collection`

### 3. 爬取内容为空或解析失败

**症状**：
- 爬取成功但内容为空
- 解析失败但被当作成功处理

**诊断方法**：
```python
# 在crawler.py中添加调试输出
# 检查返回的Document的page_content是否为空
```

**检查点**：
- Document.page_content 长度
- 是否有"解析失败"或"爬取失败"的错误文本
- 元数据中的error字段

### 4. 检索逻辑问题

**症状**：
- 数据已存储但检索不到

**诊断方法**：
- 检查检索时使用的collection_name
- 检查检索参数（k值、相似度阈值等）
- 查看检索日志输出

## 诊断步骤

### 步骤1: 运行诊断脚本

```bash
cd backend_py

# 获取项目的vector_collection
# 可以在Supabase数据库中查询：
# SELECT id, name, vector_collection FROM knowledge_bases;

# 运行诊断脚本
python test_url_crawl_diagnosis.py <vector_collection>
```

### 步骤2: 检查后端日志

启动后端时，确保 `ENV=development`，查看详细日志：

```bash
cd backend_py
export ENV=development
chainlit run app.py
```

查看以下关键日志：
- `🕷️ Crawling X URL(s)...` - 爬取开始
- `✅ Successfully crawled X URL(s)` - 爬取完成
- `Split into X chunks` - 文本切片
- `✅ Stored X vectors in Chroma: <collection_name>` - 向量存储
- `🔍 检索到 X 个相关文档片段` - 检索结果

### 步骤3: 检查向量库

```python
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

collection_name = "your_collection_name"
vectorstore = Chroma(
    persist_directory=f"./chroma_db/{collection_name}",
    embedding_function=OpenAIEmbeddings()
)

# 获取所有文档
collection = vectorstore._collection
all_docs = collection.get()

print(f"文档数量: {len(all_docs.get('ids', []))}")
print(f"向量数量: {len(all_docs.get('embeddings', []))}")

# 检查URL来源的文档
url_docs = [
    (metadata.get('source'), text[:100])
    for metadata, text in zip(
        all_docs.get('metadatas', []),
        all_docs.get('documents', [])
    )
    if metadata.get('source', '').startswith(('http://', 'https://'))
]
print(f"URL来源文档: {len(url_docs)}")
for source, text in url_docs:
    print(f"  {source}: {text}...")
```

### 步骤4: 测试检索

```python
# 测试检索
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
query = "markdown"
docs = retriever.invoke(query)

print(f"查询: {query}")
print(f"找到 {len(docs)} 个相关文档:")
for i, doc in enumerate(docs):
    print(f"[{i+1}] 来源: {doc.metadata.get('source')}")
    print(f"    内容: {doc.page_content[:200]}...")
```

## 常见问题修复

### 问题1: 向量集合为空

**原因**：爬取失败或存储失败

**修复**：
1. 检查爬取日志，确认是否成功
2. 检查OpenAI API密钥是否正确
3. 检查是否有embedding生成的错误
4. 重新爬取URL

### 问题2: collection_name不匹配

**原因**：URL爬取和测试对话使用了不同的collection

**修复**：
1. 确认URL爬取时使用的collection_name
2. 确认测试对话时查询到的collection_name
3. 确保两者一致

### 问题3: 检索不到数据

**原因**：
- 查询语义与存储内容不匹配
- 相似度阈值过高
- k值设置过小

**修复**：
1. 尝试不同的查询词
2. 降低相似度阈值（如果有）
3. 增加k值（检索数量）

### 问题4: 内容解析失败

**原因**：
- 网页需要登录
- 网页有反爬措施
- JavaScript渲染失败

**修复**：
1. 检查爬取日志中的错误信息
2. 尝试手动访问URL确认可访问性
3. 增加等待时间（WAIT_NETWORK_IDLE）
4. 添加Cookie支持（如果需要）

## 调试技巧

### 1. 启用详细日志

```bash
export ENV=development
```

### 2. 添加调试输出

在关键位置添加print语句：
- `crawler.py` 的 `parse_html` 函数
- `workflow.py` 的各个节点
- `app.py` 的API端点

### 3. 手动测试爬取

```python
from crawler import crawl_urls

urls = ["https://markdown.lovejade.cn/"]
docs = await crawl_urls(urls)

for doc in docs:
    print(f"来源: {doc.metadata.get('source')}")
    print(f"内容长度: {len(doc.page_content)}")
    print(f"内容预览: {doc.page_content[:500]}")
```

## 联系支持

如果以上方法都无法解决问题，请提供：
1. 诊断脚本的输出
2. 后端完整日志
3. URL地址
4. collection_name
5. 错误信息（如果有）
