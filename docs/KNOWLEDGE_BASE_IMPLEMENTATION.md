# 知识库实现文档

## 概述

本文档整理了 sample 文件夹下与知识库相关的代码实现，包括前端和后端的完整实现方案。

## 目录结构

### 前端部分（chatmax-ai）

```
sample/chatmax-ai/
├── lib/
│   ├── client/
│   │   └── doc.ts                    # 文档相关 API 调用
│   └── server/
│       └── ctai/
│           ├── request.ts            # 文件上传和文档管理接口
│           └── utils.ts             # 工具函数
├── components/
│   └── app/
│       └── project/
│           └── Doc.tsx               # 文档上传和管理组件
└── pages/
    └── api/
        └── user-command/            # API 路由
```

### 后端部分（chatmax-后端(1)/AutoLM）

```
sample/chatmax-后端(1)/AutoLM/app/
├── document/                         # 文档处理模块
│   ├── loader/
│   │   └── document_loader.py        # 文档加载器（支持多种格式）
│   ├── splitter/
│   │   └── text_splitter.py          # 文档分割器
│   ├── retrieval/
│   │   └── docs_retrieval.py         # 文档检索
│   └── search/
│       └── docs_search.py            # 文档搜索
├── filesync/                         # 文件同步和处理
│   ├── filesync.py                   # 文件同步主逻辑
│   ├── fileprocessing.py             # 文件处理流程
│   ├── filedownload.py               # 文件下载
│   └── autolmdoc.py                  # 文档元数据生成
├── vectorstore/                      # 向量存储
│   ├── vector_store.py               # 向量存储工厂
│   ├── custom_qdrant.py              # Qdrant 自定义实现
│   └── settings.py                   # 向量存储配置
└── embeddings/                       # 嵌入向量生成
    ├── embeddings.py                 # 嵌入工厂
    └── custom_embeddings.py          # 自定义嵌入实现
```

## 核心功能实现

### 1. 前端文档管理

#### 1.1 文档 API 接口（`lib/client/doc.ts`）

提供以下文档管理接口：

- `addDoc(characterId, docName, docFileId)`: 添加文档到项目
- `getList(characterId)`: 获取文档列表
- `modifyDoc(characterId, docId, docNewName)`: 修改文档名称
- `deleteDoc(characterId, docId)`: 删除文档
- `searchDoc(characterId, nameKeywords)`: 搜索文档
- `docInfo(characterId, docId)`: 获取文档详情
- `upload(filePath)`: 上传文件

#### 1.2 文档上传组件（`components/app/project/Doc.tsx`）

**主要功能：**
- 支持拖拽上传文件
- 文件上传进度显示
- 文档列表展示（文件名、更新时间、处理状态）
- 文档删除功能

**关键实现：**
```typescript
// 使用 react-dropzone 实现文件拖拽上传
const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

// 上传文件
upload(acceptedFiles[0])
  .then((res) => {
    if (res && res.file_id) {
      onUploadOk(res, acceptedFiles[0]);
    }
  });
```

#### 1.3 服务端文档接口（`lib/server/ctai/request.ts`）

**文档管理接口：**
- `document.add`: 添加文档
- `document.delete`: 删除文档
- `document.modify`: 修改文档
- `document.list`: 获取文档列表
- `document.search`: 搜索文档
- `document.info`: 获取文档信息

**文件上传接口：**
- `file_upload`: 文件上传（支持 FormData）

### 2. 后端文档处理流程

#### 2.1 文件同步（`filesync/filesync.py`）

**主要功能：**
- 接收文档同步请求
- 检查文件队列长度
- 返回文档处理状态

**处理流程：**
1. 验证请求参数
2. 检查队列长度（阈值：5）
3. 遍历数据集和文档列表
4. 检查文档状态（待处理/处理中/已完成）
5. 生成请求摘要并加入队列
6. 返回文档状态列表

**状态码：**
- `0`: 处理成功
- 正数：处理中（1-已入队列，2-已下载，3-已切分，4-已求得所有分段embedding）
- 负数：处理失败（对应正数的负数）

#### 2.2 文件处理（`filesync/fileprocessing.py`）

**核心处理流程：**

1. **文档下载**
   - 从 URL 下载文档到本地
   - 支持多种文件格式

2. **文档解析**
   - 根据文件类型选择对应的加载器
   - 支持格式：PDF、DOCX、TXT、XLSX、PPTX、JSON、JYDOC 等

3. **文档分割**
   - 根据文档类型选择分割策略
   - 支持自定义分隔符（`@&@`、`###`）
   - 支持法律文档特殊处理
   - 使用 RecursiveCharacterTextSplitter 进行递归分割

4. **文档标准化**
   - 清理和规范化文档内容
   - 处理特殊字符

5. **向量化存储**
   - 生成文档片段的嵌入向量
   - 存储到 Qdrant 向量数据库
   - 可选：同时存储到 Elasticsearch

6. **后续处理（异步）**
   - 生成摘要（Summary）
   - 生成问题（Questions）
   - 自动问答（AutoQA）
   - 主题提取（Topic）

#### 2.3 文档加载器（`document/loader/document_loader.py`）

**支持的文档格式：**

1. **PDF**
   - `FitzTesseractPDFLoader`: 支持 OCR 的 PDF 加载器
   - `PyMuPDFLoader`: PyMuPDF 加载器
   - `PDFMinerLoader`: PDFMiner 加载器
   - `UnstructuredPDFLoader`: 非结构化 PDF 加载器

2. **Word 文档**
   - `WordDocumentLoader`: 支持表格的 Word 加载器
   - `Docx2PythonLoader`: 基于 docx2python 的加载器
   - `UnstructuredWordDocumentLoader`: 非结构化 Word 加载器

3. **Excel**
   - `GeneralExcelLoader`: 通用 Excel 加载器
   - 支持多级表头识别
   - 支持合并单元格处理
   - 支持日期格式转换

4. **PowerPoint**
   - `GeneralPPTXLoader`: PPTX 加载器
   - 支持图片 OCR
   - 支持表格提取

5. **其他格式**
   - `TxtLoader`: 文本文件加载器（自动检测编码）
   - `JsontLoader`: JSON 格式加载器
   - `JyDocLoader`: JYDOC 格式加载器

**关键特性：**
- 自动编码检测（使用 chardet）
- 支持 URL 和本地文件路径
- 支持 S3 存储
- OCR 支持（PDF 图片、PPTX 图片）

#### 2.4 文档分割器（`document/splitter/text_splitter.py`）

**分割策略：**

1. **RecursiveCharacterTextSplitter**（默认）
   - 递归字符分割
   - 支持自定义分隔符：`["\n\n", "。", "！", "\n", ""]`
   - 使用 tiktoken 计算 token 长度

2. **CharacterTextSplitter**
   - 简单字符分割
   - 固定分隔符

3. **RecursiveJsonSplitter**
   - JSON 格式分割
   - 用于 Excel 数据

4. **LegalMarkdownHeaderTextSplitter**
   - 法律文档专用分割器
   - 基于 Markdown 标题分割

**分割参数：**
- `chunk_size`: 块大小（默认从配置读取）
- `chunk_overlap`: 块重叠大小（默认从配置读取）
- `separator`: 分隔符列表

#### 2.5 文档检索（`document/retrieval/docs_retrieval.py`）

**检索策略：**

1. **QQ（Question-Question）检索**
   - 检索与用户问题相似的历史问题
   - 从问题库中找到相似问题
   - 根据相似问题找到对应的文档片段和摘要

2. **QS（Question-Summary）检索**
   - 直接检索与问题相似的摘要
   - 使用摘要向量进行相似度搜索

3. **QD（Question-Document）检索**
   - 直接检索与问题相似的文档片段
   - 使用文档片段向量进行相似度搜索

4. **ES（Elasticsearch）检索**
   - 使用 Elasticsearch 进行全文检索
   - 可选功能（通过配置开启）

**检索流程：**
1. 查询扩展（query expansion）
2. 多线程并行检索（QQ、QS、QD、ES）
3. 文档合并、排序、去重
4. 可选：重排序（rerank）

**重排序：**
- 使用 reranker 模型对检索结果重新排序
- 提高检索精度

#### 2.6 向量存储（`vectorstore/vector_store.py`）

**支持的向量数据库：**

1. **Qdrant**（主要）
   - 支持双写（double write）
   - 支持 BGE 嵌入模型
   - 使用 gRPC 协议

2. **Chroma**（可选）
   - 使用 REST API
   - 支持 HNSW 索引

**集合命名规则：**
```
{data_id}_{collection_type}
或
{data_id}_{collection_type}_bge  # BGE 模型
```

**集合类型：**
- `section`: 文档片段
- `summary`: 文档摘要
- `questions`: 问题库

#### 2.7 嵌入向量生成（`embeddings/`）

**嵌入模型：**
- 支持多种嵌入模型（通过配置选择）
- 支持 BGE（BAAI General Embedding）模型
- 支持双写模式（同时写入两个向量库）

**使用场景：**
- `EmbeddingsUsage.FILE`: 文件处理时使用
- `EmbeddingsUsage.CHAT`: 聊天检索时使用

## 数据流程

### 文档上传流程

```
前端上传文件
    ↓
后端接收文件（file_upload）
    ↓
返回 file_id
    ↓
前端调用 document.add
    ↓
后端加入处理队列（filesync）
    ↓
异步处理：
    1. 下载文件
    2. 解析文档
    3. 分割文档
    4. 生成嵌入向量
    5. 存储到向量数据库
    6. 生成摘要和问题（可选）
    ↓
回调前端（状态更新）
```

### 文档检索流程

```
用户提问
    ↓
查询扩展（query expansion）
    ↓
并行检索：
    - QQ: 检索相似问题
    - QS: 检索相似摘要
    - QD: 检索相似文档片段
    - ES: 全文检索（可选）
    ↓
结果合并、排序、去重
    ↓
可选：重排序（rerank）
    ↓
返回检索结果
```

## 技术架构

### 前端技术栈
- **框架**: Next.js
- **UI 库**: Flowbite React
- **文件上传**: react-dropzone
- **状态管理**: React Hooks

### 后端技术栈
- **语言**: Python
- **框架**: Flask/FastAPI（推测）
- **文档处理**: LangChain
- **向量数据库**: Qdrant（主要）、Chroma（可选）
- **全文检索**: Elasticsearch（可选）
- **嵌入模型**: BGE、OpenAI 等
- **OCR**: Tesseract（pytesseract）
- **PDF 处理**: PyMuPDF、PDFMiner
- **Office 文档**: python-docx、openpyxl、python-pptx

### 存储架构
- **向量存储**: Qdrant（支持双写）
- **全文检索**: Elasticsearch（可选）
- **状态管理**: Redis
- **文件存储**: 本地文件系统或 S3

## 配置说明

### 文档处理配置
- `split_chunk_size`: 文档分割块大小
- `split_chunk_overlap`: 文档分割重叠大小
- `download_dir`: 文件下载目录

### 向量存储配置
- `vectorstore.host`: Qdrant 主机地址
- `vectorstore.port`: Qdrant 端口
- `vectorstore_bge.host`: BGE 向量库主机
- `vectorstore_bge.port`: BGE 向量库端口

### 嵌入模型配置
- `embeddings_bge.provider`: BGE 模型提供者
- `embeddings_bge.tokenizer`: BGE tokenizer
- `embeddings_bge.query_instruction`: 查询指令前缀

### 检索配置
- `docretrieval.num_by_qq`: QQ 检索数量
- `docretrieval.num_by_qs`: QS 检索数量
- `docretrieval.num_by_qd`: QD 检索数量
- `docretrieval.retrieval_config`: 检索策略（v1/v2）

## 关键特性

### 1. 多格式支持
- PDF（含 OCR）
- Word（DOCX）
- Excel（XLSX）
- PowerPoint（PPTX）
- 文本文件（TXT）
- JSON
- 音视频（MP4、MP3 等，需 ASR 服务）

### 2. 智能分割
- 根据文档类型选择分割策略
- 支持自定义分隔符
- 法律文档特殊处理
- 保持文档结构信息

### 3. 多策略检索
- 问题-问题检索（QQ）
- 问题-摘要检索（QS）
- 问题-文档检索（QD）
- 全文检索（ES）

### 4. 异步处理
- 文件处理异步化
- 摘要和问题生成异步化
- 自动问答异步化
- 主题提取异步化

### 5. 状态管理
- 文档处理状态跟踪
- Redis 状态存储
- 回调机制更新状态

## 错误处理

### 文档处理错误码
- `ParseErr`: 解析错误
- `DownloadErr`: 下载错误
- `SplitErr`: 分割错误
- `EmbeddingErr`: 嵌入错误
- `ExcelCountOverMaximumErr`: Excel 行数超限
- `ExcelCountLessTwoValueErr`: Excel 行数过少
- `TopicEmptyDocumentErr`: 主题提取文档为空

### 队列管理
- 队列长度限制（默认 5）
- 重复请求检测（基于摘要）
- 错误重试机制

## 性能优化

### 1. 并行处理
- 多线程并行检索
- 异步文件处理
- 批量向量化

### 2. 缓存机制
- Redis 状态缓存
- 嵌入向量缓存
- 查询结果缓存

### 3. 索引优化
- Qdrant HNSW 索引
- Elasticsearch 全文索引
- 元数据索引

## 扩展性

### 1. 插件化架构
- 文档加载器可扩展
- 分割器可扩展
- 嵌入模型可扩展

### 2. 配置驱动
- 通过配置文件控制行为
- 支持多环境配置
- 功能开关

### 3. 多租户支持
- 基于 data_id 隔离
- 独立的向量集合
- 权限控制

## 注意事项

1. **文件大小限制**
   - 单文件最大 20MB
   - 批量总大小限制 1GB
   - 单次最多 50 个文件

2. **处理时间**
   - 大文件处理时间较长
   - 支持异步处理
   - 状态实时更新

3. **存储空间**
   - 向量数据占用较大
   - 需要定期清理
   - 支持文档删除

4. **依赖服务**
   - Qdrant 向量数据库
   - Redis 状态管理
   - Elasticsearch（可选）
   - ASR 服务（音视频处理）

## 总结

该知识库实现提供了完整的文档管理、处理和检索功能，支持多种文档格式，采用向量检索和全文检索相结合的方式，具有良好的扩展性和性能优化。前端提供友好的文档管理界面，后端采用异步处理机制，确保系统的高可用性和可扩展性。

