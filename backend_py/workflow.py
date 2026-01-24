import os
import asyncio
import re  # 1.1.13: 导入 re 用于 collection_name 验证
import tempfile  # 1.2.43: 临时文件处理
import urllib.parse  # 1.2.43: URL 解析
import requests  # 1.2.43: HTTP 请求下载文件
from typing import List, Dict, Any, TypedDict
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
# 1.2.42: 旧版导入（注释保留）
# from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, UnstructuredExcelLoader
# 1.2.42: 新版导入 - 支持更多文件格式
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, UnstructuredExcelLoader
from pptx_loader import GeneralPPTXLoader  # 1.2.42: PPT/PPTX 加载器
from txt_loader import TxtLoader  # 1.2.42: TXT 文本加载器
from langchain_text_splitters import RecursiveCharacterTextSplitter
# 1.2.56: Chroma 改为延迟导入，避免在使用 pgvector 时仍需安装 chromadb
# from langchain_community.vectorstores import Chroma
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.documents import Document  # 1.1.12: 导入 Document 用于错误处理
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv
# 1.1.11: 导入爬虫模块
from crawler import crawl_urls

# 1.2.39: 优先加载 .env.local，然后加载 .env（如果存在）
load_dotenv('.env.local')  # 本地开发配置优先
load_dotenv()  # 回退到 .env

# 1.1.3: 环境配置 - 支持本地/线上数据库切换
USE_PGVECTOR = os.getenv("USE_PGVECTOR", "false").lower() == "true"
# 1.2.56: 调试输出 - 确认配置是否正确加载
print(f"🔧 USE_PGVECTOR 环境变量: {os.getenv('USE_PGVECTOR')} -> {USE_PGVECTOR}")
# 1.1.17: 重命名为 PGVECTOR_DATABASE_URL 避免与 Chainlit 数据持久化冲突
DATABASE_URL = os.getenv("PGVECTOR_DATABASE_URL") or os.getenv("DATABASE_URL")

# 1.2.12: 文档片段数量配置 - 支持可配置的文档片段数量限制
# MAX_CHUNKS: 最终使用的文档片段数量（默认4）
MAX_CHUNKS = int(os.getenv("MAX_CHUNKS", "4"))
# RETRIEVE_K: 检索时获取的文档数量，应该比 MAX_CHUNKS 大以便过滤错误文档（默认8）
RETRIEVE_K = int(os.getenv("RETRIEVE_K", "8"))

# 1.1.3: 如果启用 pgvector，导入 vecs 库
# 1.2.56: Chroma 改为条件导入，避免在使用 pgvector 时仍需安装 chromadb
Chroma = None  # 延迟导入占位符
if USE_PGVECTOR:
    try:
        import vecs
        from vecs import Collection
        print("✅ 使用 Supabase pgvector 作为向量数据库")
    except ImportError:
        print("⚠️ vecs 库未安装，回退到 Chroma")
        USE_PGVECTOR = False
        from langchain_community.vectorstores import Chroma
else:
    from langchain_community.vectorstores import Chroma
    print("✅ 使用 Chroma 作为本地向量数据库")

# 定义状态
# 1.1.11: 添加URL爬虫相关字段
# 1.2.52: 添加 language 字段，支持多语言回复
# 1.3.11: 添加 citations 字段，支持引用来源展示
class GraphState(TypedDict):
    file_path: str
    urls: List[str]  # 1.1.11: URL列表（可选）
    docs: List[Any]
    splits: List[Any]
    collection_name: str
    messages: List[BaseMessage]
    context: str
    answer: str
    language: str  # 1.2.52: 语言设置（zh/en/ja）
    citations: List[Dict[str, Any]]  # 1.3.11: 引用来源列表

# 1.2.43: 从 URL 下载文件到临时目录
def download_file_from_url(url: str) -> str:
    """
    1.2.43: 从 URL 下载文件到临时目录

    Args:
        url: 文件的 URL 地址

    Returns:
        str: 下载后的本地文件路径
    """
    if os.getenv("ENV") == "development":
        print(f"📥 开始下载文件: {url}")

    # 解析 URL 获取文件名
    parsed_url = urllib.parse.urlparse(url)
    path_parts = parsed_url.path.split('/')
    # 获取原始文件名（最后一部分）
    original_filename = path_parts[-1] if path_parts[-1] else 'downloaded_file'
    # URL 解码文件名
    original_filename = urllib.parse.unquote(original_filename)

    # 获取文件扩展名
    file_ext = original_filename.split('.')[-1].lower() if '.' in original_filename else ''

    # 创建临时文件
    temp_dir = tempfile.mkdtemp(prefix='yuichat_')
    local_path = os.path.join(temp_dir, original_filename)

    try:
        # 下载文件
        response = requests.get(url, timeout=60, stream=True)
        response.raise_for_status()

        # 写入本地文件
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        if os.getenv("ENV") == "development":
            file_size = os.path.getsize(local_path)
            print(f"✅ 文件下载完成: {local_path} ({file_size} 字节)")

        return local_path

    except Exception as e:
        # 清理临时目录
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise ValueError(f"文件下载失败: {str(e)}")


# 1.1.0: 文件处理节点
# 1.2.42: 扩展支持 PPTX 和 TXT 文件格式
# 1.2.43: 支持从 URL 下载文件
def process_file_node(state: GraphState):
    file_path = state.get('file_path')
    if not file_path:
        print("No file path provided, skipping file processing.")
        return {"docs": state.get('docs', [])}

    print(f"Processing file: {file_path}")

    # 1.2.43: 检查是否是 URL，如果是则先下载到本地
    local_file_path = file_path
    temp_dir_to_cleanup = None

    if file_path.startswith(('http://', 'https://')):
        if os.getenv("ENV") == "development":
            print(f"🌐 检测到 URL，开始下载文件...")
        local_file_path = download_file_from_url(file_path)
        # 记录临时目录以便后续清理
        temp_dir_to_cleanup = os.path.dirname(local_file_path)

    try:
        docs = []
        # 1.2.42: 获取文件扩展名（小写）
        file_ext = local_file_path.lower().split('.')[-1] if '.' in local_file_path else ''

        # 1.2.42: 根据文件类型选择加载器
        if file_ext == 'pdf':
            loader = PyPDFLoader(local_file_path)
        elif file_ext in ['docx', 'doc']:
            loader = Docx2txtLoader(local_file_path)
        elif file_ext in ['xlsx', 'xls']:
            # 1.1.0: Excel 建议转换为 CSV 或使用专门处理，这里暂时使用通用加载器
            loader = UnstructuredExcelLoader(local_file_path)
        elif file_ext in ['pptx', 'ppt']:
            # 1.2.42: PPT/PPTX 文件 - 使用自定义加载器
            # 注意：.ppt 格式需要先转换为 .pptx（python-pptx 只支持 .pptx）
            if file_ext == 'ppt':
                if os.getenv("ENV") == "development":
                    print("⚠️ .ppt 格式不受支持，请转换为 .pptx 格式")
                raise ValueError(f"不支持的文件格式: .ppt，请转换为 .pptx 格式后重新上传")
            loader = GeneralPPTXLoader(local_file_path, enable_ocr=False)
            if os.getenv("ENV") == "development":
                print(f"📊 使用 GeneralPPTXLoader 处理 PPTX 文件")
        elif file_ext == 'txt':
            # 1.2.42: TXT 文本文件 - 使用自定义加载器（支持编码检测）
            loader = TxtLoader(local_file_path)
            if os.getenv("ENV") == "development":
                print(f"📄 使用 TxtLoader 处理 TXT 文件")
        else:
            # 1.2.42: 不支持的文件类型
            raise ValueError(f"不支持的文件类型: {local_file_path}。支持的格式: pdf, docx, xlsx, pptx, txt")

        docs = loader.load()

        # 1.2.42: 打印加载结果
        if os.getenv("ENV") == "development":
            print(f"✅ 文件加载完成，生成 {len(docs)} 个文档")
            for i, doc in enumerate(docs):
                content_preview = doc.page_content[:100].replace('\n', ' ') if doc.page_content else ''
                print(f"  文档 {i+1}: {len(doc.page_content)} 字符, 预览: {content_preview}...")

        return {"docs": docs}

    finally:
        # 1.2.43: 清理临时文件
        if temp_dir_to_cleanup and os.path.exists(temp_dir_to_cleanup):
            import shutil
            shutil.rmtree(temp_dir_to_cleanup, ignore_errors=True)
            if os.getenv("ENV") == "development":
                print(f"🗑️ 已清理临时目录: {temp_dir_to_cleanup}")

# 1.1.11: URL爬虫节点
def crawl_url_node(state: GraphState):
    """1.1.11: 爬取URL并解析为Document"""
    urls = state.get('urls', [])
    if not urls:
        if os.getenv("ENV") == "development":
            print("No URLs provided, skipping URL crawling.")
        return {"docs": state.get('docs', [])}
    
    if os.getenv("ENV") == "development":
        print(f"🕷️ Crawling {len(urls)} URL(s)...")
    
    try:
        # 1.1.11: 在同步函数中调用异步函数
        # 优化事件循环处理，确保线程安全
        import concurrent.futures
        import threading
        
        def run_async_in_thread():
            """在新线程中运行异步代码，创建独立的事件循环"""
            # 创建新的事件循环
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(crawl_urls(urls))
            finally:
                # 确保关闭所有异步资源
                try:
                    # 取消所有待处理的任务
                    pending = asyncio.all_tasks(new_loop)
                    for task in pending:
                        task.cancel()
                    if pending:
                        new_loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
                except:
                    pass
                finally:
                    new_loop.close()
        
        # 总是在新线程中运行，避免事件循环冲突
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(run_async_in_thread)
            docs = future.result(timeout=600)  # 10分钟超时（URL爬取可能需要更长时间）
        
        if os.getenv("ENV") == "development":
            print(f"✅ Successfully crawled {len(docs)} URL(s)")
            # 1.1.12: 打印详细信息用于诊断，区分成功和失败的文档
            for i, doc in enumerate(docs):
                is_error = 'error' in doc.metadata or '解析失败' in doc.page_content or '爬取失败' in doc.page_content
                status = "❌ 失败" if is_error else "✅ 成功"
                print(f"  文档 {i+1}: {status} - 来源={doc.metadata.get('source', 'unknown')}, 内容长度={len(doc.page_content)} 字符")
        
        # 1.1.12: 按照 chatmax 逻辑，检查是否有解析失败的文档
        # 如果有失败的文档，确保它们包含明确的错误标记
        processed_docs = []
        for doc in docs:
            # 检查是否是错误文档
            is_error = (
                'error' in doc.metadata or 
                '爬取失败' in doc.page_content or 
                '解析失败' in doc.page_content or
                doc.page_content.strip().startswith('爬取失败') or
                doc.page_content.strip().startswith('解析失败')
            )
            
            if is_error:
                # 确保错误文档包含明确的错误标记
                if 'error' not in doc.metadata:
                    doc.metadata['error'] = '解析失败'
                if not doc.page_content.strip().startswith('解析失败'):
                    doc.page_content = f"解析失败: {doc.page_content}"
            
            processed_docs.append(doc)
        
        return {"docs": processed_docs}
    except Exception as e:
        error_msg = f"URL crawling failed: {str(e)}"
        if os.getenv("ENV") == "development":
            print(f"❌ {error_msg}")
        # 1.1.12: URL爬虫失败时不中断整个流程，返回错误文档列表
        # 这样至少前端能收到响应，而不是完全失败
        error_docs = [
            Document(
                page_content=f"URL爬取失败: {str(e)}\n原始URL: {url}",
                metadata={
                    "source": url,
                    "title": url,
                    "url": url,
                    "error": str(e)
                }
            )
            for url in urls
        ]
        return {"docs": error_docs}

# 1.1.0: 文本切片节点
def split_text_node(state: GraphState):
    docs = state.get('docs', [])
    if not docs:
        if os.getenv("ENV") == "development":
            print("No documents to split, skipping.")
        return {"splits": state.get('splits', [])}
    
    # 1.1.12: 按照 chatmax 逻辑，过滤掉错误文档（不进行切片和向量化）
    valid_docs = []
    error_docs = []
    for doc in docs:
        is_error = (
            'error' in doc.metadata or 
            '爬取失败' in doc.page_content or 
            '解析失败' in doc.page_content or
            doc.page_content.strip().startswith('爬取失败') or
            doc.page_content.strip().startswith('解析失败')
        )
        if is_error:
            error_docs.append(doc)
        else:
            valid_docs.append(doc)
    
    if error_docs and os.getenv("ENV") == "development":
        print(f"⚠️ 跳过 {len(error_docs)} 个错误文档的切片和向量化")
        for doc in error_docs:
            print(f"  错误文档: {doc.metadata.get('source', 'unknown')} - {doc.metadata.get('error', '解析失败')}")
    
    if not valid_docs:
        if os.getenv("ENV") == "development":
            print("⚠️ 所有文档都是错误文档，跳过切片")
        return {"splits": state.get('splits', [])}
        
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(valid_docs)
    
    if os.getenv("ENV") == "development":
        print(f"Split into {len(splits)} chunks")
        # 1.1.11: 打印切片来源信息
        url_splits = sum(1 for s in splits if s.metadata.get('source', '').startswith(('http://', 'https://')))
        if url_splits > 0:
            print(f"  其中 {url_splits} 个切片来自URL爬取")
    
    return {"splits": splits}

# 1.1.0: 向量存储节点
# 1.1.3: 支持 Chroma 和 pgvector 切换
# 1.1.13: 加强知识库隔离，验证 collection_name
def embed_and_store_node(state: GraphState):
    splits = state.get('splits', [])
    collection_name = state.get('collection_name', 'default_collection')
    
    # 1.1.15: 验证 collection_name 格式，确保知识库隔离
    if not collection_name or not isinstance(collection_name, str) or not collection_name.strip():
        error_msg = f"collection_name must be a non-empty string, got: {type(collection_name).__name__}={collection_name}"
        if os.getenv("ENV") == "development":
            print(f"❌ Embed and store node error: {error_msg}")
        raise ValueError(error_msg)
    
    # 1.1.15: 确保 collection_name 符合命名规范（防止注入攻击）
    collection_name = collection_name.strip()
    if not re.match(r'^[a-zA-Z0-9_-]+$', collection_name):
        error_msg = f"Invalid collection_name format: {collection_name}"
        if os.getenv("ENV") == "development":
            print(f"❌ Embed and store node error: {error_msg}")
        raise ValueError(error_msg)
    
    if not splits:
        if os.getenv("ENV") == "development":  # 1.1.3: 仅开发环境输出日志
            print("No splits to store, skipping embedding.")
        return {"collection_name": collection_name}
    
    if USE_PGVECTOR and DATABASE_URL:
        # 1.1.3: 使用 Supabase pgvector（生产环境）
        try:
            vx = vecs.create_client(DATABASE_URL)
            
            # 获取或创建 collection
            try:
                collection = vx.get_collection(name=collection_name)
            except:
                collection = vx.create_collection(
                    name=collection_name,
                    dimension=1536  # OpenAI embeddings 维度
                )
            
            # 生成向量并存储
            embeddings_model = OpenAIEmbeddings()
            texts = [doc.page_content for doc in splits]
            metadatas = [doc.metadata for doc in splits]
            vectors = embeddings_model.embed_documents(texts)
            
            # 1.2.56: 清理文本和 metadata 中的空字符（\u0000），防止 pgvector 插入失败
            def clean_null_chars(obj):
                """递归清理对象中的空字符"""
                if isinstance(obj, str):
                    return obj.replace('\x00', '').replace('\u0000', '')
                elif isinstance(obj, dict):
                    return {k: clean_null_chars(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [clean_null_chars(item) for item in obj]
                return obj
            
            texts = [clean_null_chars(text) for text in texts]
            metadatas = [clean_null_chars(metadata) for metadata in metadatas]
            
            # 准备数据
            records = [
                (f"{collection_name}_{i}", vector, {"text": text, **metadata})
                for i, (vector, text, metadata) in enumerate(zip(vectors, texts, metadatas))
            ]
            
            # 批量插入
            collection.upsert(records=records)
            
            if os.getenv("ENV") == "development":  # 1.1.3: 仅开发环境输出日志
                print(f"✅ Stored {len(splits)} vectors in Supabase pgvector: {collection_name}")
                # 1.1.11: 打印存储的文档来源统计
                url_vectors = sum(1 for m in metadatas if m.get('source', '').startswith(('http://', 'https://')))
                if url_vectors > 0:
                    print(f"  其中 {url_vectors} 个向量来自URL爬取")
        except Exception as e:
            print(f"❌ pgvector error: {e}, falling back to Chroma")
            # 1.2.56: 回退时需要先导入 Chroma
            from langchain_community.vectorstores import Chroma as ChromaFallback
            vectorstore = ChromaFallback.from_documents(
                documents=splits,
                embedding=OpenAIEmbeddings(),
                persist_directory=f"./chroma_db/{collection_name}"
            )
    else:
        # 1.1.0: 使用 Chroma 作为本地向量库（本地开发）
        # 1.2.56: Chroma 已在条件导入块中导入
        vectorstore = Chroma.from_documents(
            documents=splits,
            embedding=OpenAIEmbeddings(),
            persist_directory=f"./chroma_db/{collection_name}"
        )
        if os.getenv("ENV") == "development":  # 1.1.3: 仅开发环境输出日志
            print(f"✅ Stored {len(splits)} vectors in Chroma: {collection_name}")
            # 1.1.11: 打印存储的文档来源统计
            url_vectors = sum(1 for doc in splits if doc.metadata.get('source', '').startswith(('http://', 'https://')))
            if url_vectors > 0:
                print(f"  其中 {url_vectors} 个向量来自URL爬取")
    
    return {"collection_name": collection_name}

# 1.1.0: 检索与问答节点 (RAG)
# 1.1.3: 支持 Chroma 和 pgvector 切换
# 1.1.13: 加强知识库隔离，验证 collection_name
def chat_node(state: GraphState):
    messages = state.get('messages', [])
    if not messages:
        if os.getenv("ENV") == "development":  # 1.1.3: 仅开发环境输出日志
            print("No messages provided, skipping chat node.")
        return {"answer": "", "messages": []}
        
    collection_name = state.get('collection_name')
    
    # 1.1.15: 验证 collection_name，确保知识库隔离
    if not collection_name or not isinstance(collection_name, str) or not collection_name.strip():
        error_msg = f"collection_name must be a non-empty string, got: {type(collection_name).__name__}={collection_name}"
        if os.getenv("ENV") == "development":
            print(f"❌ Chat node error: {error_msg}")
        raise ValueError(error_msg)
    
    # 1.1.15: 确保 collection_name 符合命名规范（防止注入攻击）
    collection_name = collection_name.strip()
    if not re.match(r'^[a-zA-Z0-9_-]+$', collection_name):
        error_msg = f"Invalid collection_name format: {collection_name}"
        if os.getenv("ENV") == "development":
            print(f"❌ Chat node error: {error_msg}")
        raise ValueError(error_msg)
    
    # 获取最后一条消息（用户问题）
    user_query = messages[-1].content
    
    # 1.3.11: 初始化 citations 数组
    citations = []
    
    # 1.1.3: 根据配置选择向量数据库
    if USE_PGVECTOR and DATABASE_URL:
        # 使用 Supabase pgvector
        try:
            vx = vecs.create_client(DATABASE_URL)
            collection = vx.get_collection(name=collection_name)
            
            # 生成查询向量
            embeddings_model = OpenAIEmbeddings()
            query_vector = embeddings_model.embed_query(user_query)
            
            # 1.3.11: 检索相似文档，启用 include_value 获取相似度分数
            # 1.3.10: 旧版本使用 include_value=False
            results = collection.query(
                data=query_vector,
                limit=MAX_CHUNKS,
                include_value=True,  # 1.3.11: 启用相似度分数
                include_metadata=True
            )
            
            # 1.3.11: 提取文本并收集 citations（vecs 返回格式: (id, score, metadata)）
            # 1.3.10: 旧版本返回格式: (id, metadata)
            valid_texts = []
            for record in results:
                # 1.3.11: 根据 include_value 调整解析逻辑
                if len(record) >= 3:
                    record_id = record[0]
                    score = record[1]
                    metadata = record[2] if record[2] else {}
                elif len(record) >= 2:
                    record_id = record[0]
                    score = None
                    metadata = record[1] if record[1] else {}
                else:
                    continue
                    
                text = metadata.get("text", "")
                source = metadata.get("source", metadata.get("url", ""))
                inner_metadata = metadata.get("metadata", {}) if isinstance(metadata, dict) else {}
                
                # 检查是否是错误文档
                is_error = (
                    'error' in inner_metadata or 
                    '爬取失败' in text or 
                    '解析失败' in text or
                    text.strip().startswith('爬取失败') or
                    text.strip().startswith('解析失败')
                )
                if not is_error and text.strip():
                    valid_texts.append(text)
                    # 1.3.11: 收集 citation 信息（限制内容长度为500字符）
                    citations.append({
                        "id": record_id,
                        "source": source,
                        "content": text[:500] if len(text) > 500 else text,
                        "score": float(score) if score is not None else None
                    })
            
            # 1.2.12: 使用可配置的片段数量限制
            context = "\n\n".join(valid_texts[:MAX_CHUNKS])
            # 1.3.11: 限制 citations 数量，只返回相关度最高的前5个
            citations = citations[:5]
            
            # 1.1.11: 检查上下文是否为空
            if not context or not context.strip() or len(context.strip()) < 50:
                if os.getenv("ENV") == "development":
                    print("⚠️ 警告: pgvector检索后上下文为空或过短")
            
        except Exception as e:
            print(f"❌ pgvector query error: {e}, falling back to Chroma")
            # 1.2.56: 回退时需要先导入 Chroma
            from langchain_community.vectorstores import Chroma as ChromaFallback
            vectorstore = ChromaFallback(
                persist_directory=f"./chroma_db/{collection_name}",
                embedding_function=OpenAIEmbeddings()
            )
            # 1.2.12: 使用可配置的检索数量
            retriever = vectorstore.as_retriever(search_kwargs={"k": RETRIEVE_K})
            relevant_docs = retriever.invoke(user_query)
            
            # 1.1.11: 过滤掉错误文档
            valid_docs = []
            for idx, doc in enumerate(relevant_docs):
                is_error = (
                    'error' in doc.metadata or 
                    '爬取失败' in doc.page_content or 
                    '解析失败' in doc.page_content or
                    doc.page_content.strip().startswith('爬取失败') or
                    doc.page_content.strip().startswith('解析失败')
                )
                if not is_error:
                    valid_docs.append(doc)
                    # 1.3.11: 收集 citation 信息（Chroma 回退时）
                    source = doc.metadata.get('source', doc.metadata.get('url', ''))
                    content = doc.page_content[:500] if len(doc.page_content) > 500 else doc.page_content
                    citations.append({
                        "id": f"chroma-fallback-{idx}",
                        "source": source,
                        "content": content,
                        "score": None  # Chroma retriever 不返回分数
                    })
            
            # 1.2.12: 使用可配置的片段数量限制
            if valid_docs:
                relevant_docs = valid_docs[:MAX_CHUNKS]
            
            context = "\n\n".join([doc.page_content for doc in relevant_docs])
            # 1.3.11: 限制 citations 数量
            citations = citations[:5]
            
            # 1.1.11: 检查上下文是否为空
            if not context or not context.strip() or len(context.strip()) < 50:
                if os.getenv("ENV") == "development":
                    print("⚠️ 警告: pgvector回退到Chroma后上下文为空或过短")
    else:
        # 使用 Chroma（本地开发）
        # 1.2.56: Chroma 已在条件导入块中导入
        vectorstore = Chroma(
            persist_directory=f"./chroma_db/{collection_name}",
            embedding_function=OpenAIEmbeddings()
        )
        # 1.2.12: 使用可配置的检索数量
        retriever = vectorstore.as_retriever(search_kwargs={"k": RETRIEVE_K})
        relevant_docs = retriever.invoke(user_query)
        
        # 1.1.11: 过滤掉错误文档（包含"爬取失败"或"error"字段的文档）
        valid_docs = []
        for idx, doc in enumerate(relevant_docs):
            # 检查是否是错误文档
            is_error = (
                'error' in doc.metadata or 
                '爬取失败' in doc.page_content or 
                '解析失败' in doc.page_content or
                doc.page_content.strip().startswith('爬取失败') or
                doc.page_content.strip().startswith('解析失败')
            )
            if not is_error:
                valid_docs.append(doc)
                # 1.3.11: 收集 citation 信息（Chroma 本地模式）
                source = doc.metadata.get('source', doc.metadata.get('url', ''))
                content = doc.page_content[:500] if len(doc.page_content) > 500 else doc.page_content
                citations.append({
                    "id": f"chroma-{idx}",
                    "source": source,
                    "content": content,
                    "score": None  # Chroma retriever 不返回分数
                })
        
        # 1.2.12: 如果过滤后还有文档，使用过滤后的；否则使用原始的（至少返回一些内容）
        original_count = len(relevant_docs)
        if valid_docs:
            # 1.2.12: 使用可配置的片段数量限制
            relevant_docs = valid_docs[:MAX_CHUNKS]
            # 1.3.11: 限制 citations 数量
            citations = citations[:5]
            if os.getenv("ENV") == "development":
                print(f"🔍 检索到 {len(valid_docs)} 个有效文档（已过滤 {original_count - len(valid_docs)} 个错误文档）")
        else:
            # 如果没有有效文档，使用原始结果（可能都是错误文档）
            # 1.2.12: 使用可配置的片段数量限制
            relevant_docs = relevant_docs[:MAX_CHUNKS]
            if os.getenv("ENV") == "development":
                print(f"⚠️ 检索到的文档可能包含错误，使用原始结果")
        
        if os.getenv("ENV") == "development":
            print(f"  最终使用 {len(relevant_docs)} 个文档片段:")
            for i, doc in enumerate(relevant_docs):
                source = doc.metadata.get('source', 'unknown')
                print(f"  [{i+1}] 来源: {source}")
        
        context = "\n\n".join([doc.page_content for doc in relevant_docs])
    
    # 1.2.52: 获取语言设置，默认为中文
    language = state.get('language', 'zh')
    if language not in ['zh', 'en', 'ja']:
        language = 'zh'
    
    # 1.2.52: 多语言空上下文提示
    empty_context_messages = {
        'zh': "抱歉，我在知识库中没有找到与您的问题相关的信息。请尝试：\n1. 使用不同的关键词提问\n2. 确认相关知识库文档已正确上传和索引\n3. 检查查询是否正确",
        'en': "Sorry, I couldn't find any relevant information in the knowledge base related to your question. Please try:\n1. Using different keywords\n2. Confirming the relevant documents have been uploaded and indexed\n3. Checking if your query is correct",
        'ja': "申し訳ありませんが、ナレッジベースにご質問に関連する情報が見つかりませんでした。以下をお試しください：\n1. 異なるキーワードで質問する\n2. 関連ドキュメントがアップロードされ、インデックスされていることを確認する\n3. クエリが正しいか確認する"
    }
    
    # 1.1.11: 如果上下文为空或只有错误信息，给出提示
    if not context or not context.strip() or len(context.strip()) < 50:
        if os.getenv("ENV") == "development":
            print("⚠️ 警告: 上下文为空或过短，可能没有找到相关文档")
        # 返回一个友好的提示（1.2.52: 根据语言返回）
        # 1.3.11: 添加 citations 字段
        return {
            "answer": empty_context_messages.get(language, empty_context_messages['zh']),
            "messages": messages,
            "context": "",
            "citations": []  # 1.3.11: 空上下文时无引用
        }
    
    # 1.2.52: 多语言系统提示词
    system_prompts = {
        'zh': "你是一个专业的知识库助手。请根据以下提供的上下文回答用户的问题。如果上下文中没有相关信息，请诚实地说你不知道。请使用中文回复。\n\n上下文:\n{context}",
        'en': "You are a professional knowledge base assistant. Please answer the user's question based on the context provided below. If there is no relevant information in the context, please honestly say you don't know. Please respond in English.\n\nContext:\n{context}",
        'ja': "あなたはプロフェッショナルなナレッジベースアシスタントです。以下に提供されたコンテキストに基づいてユーザーの質問に答えてください。コンテキストに関連情報がない場合は、正直にわからないと言ってください。日本語で回答してください。\n\nコンテキスト:\n{context}"
    }
    
    # 生成回答
    # 1.2.52: 使用多语言系统提示词
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompts.get(language, system_prompts['zh'])),
        MessagesPlaceholder(variable_name="messages"),
    ])
    
    llm = ChatOpenAI(model="gpt-4o", streaming=True)
    chain = prompt | llm
    
    response = chain.invoke({"context": context, "messages": messages})
    
    # 1.3.11: 添加 citations 字段到返回值
    return {
        "answer": response.content,
        "messages": messages + [response],
        "context": context,
        "citations": citations  # 1.3.11: 引用来源列表
    }

# 1.2.24: 流式版本的 chat_node，用于支持 SSE 流式输出
async def chat_node_stream(state: GraphState):
    """
    1.2.24: 流式版本的聊天节点，支持实时输出 AI 回复
    与 chat_node 类似，但使用 astream 生成器返回数据块
    """
    messages = state.get('messages', [])
    if not messages:
        if os.getenv("ENV") == "development":
            print("No messages provided, skipping chat node.")
        yield {"answer": "", "done": True}
        return
        
    collection_name = state.get('collection_name')
    
    # 1.2.24: 验证 collection_name，确保知识库隔离
    if not collection_name or not isinstance(collection_name, str) or not collection_name.strip():
        error_msg = f"collection_name must be a non-empty string, got: {type(collection_name).__name__}={collection_name}"
        if os.getenv("ENV") == "development":
            print(f"❌ Chat node error: {error_msg}")
        raise ValueError(error_msg)
    
    # 1.2.24: 确保 collection_name 符合命名规范（防止注入攻击）
    collection_name = collection_name.strip()
    if not re.match(r'^[a-zA-Z0-9_-]+$', collection_name):
        error_msg = f"Invalid collection_name format: {collection_name}"
        if os.getenv("ENV") == "development":
            print(f"❌ Chat node error: {error_msg}")
        raise ValueError(error_msg)
    
    # 获取最后一条消息（用户问题）
    user_query = messages[-1].content
    
    # 1.3.11: 初始化 citations 数组
    citations = []
    
    # 1.2.24: 向量检索（与 chat_node 相同的逻辑）
    context = ""
    if USE_PGVECTOR and DATABASE_URL:
        # 使用 Supabase pgvector
        try:
            vx = vecs.create_client(DATABASE_URL)
            collection = vx.get_collection(name=collection_name)
            
            # 生成查询向量
            embeddings_model = OpenAIEmbeddings()
            query_vector = embeddings_model.embed_query(user_query)
            
            # 1.3.11: 检索相似文档，启用 include_value 获取相似度分数
            results = collection.query(
                data=query_vector,
                limit=MAX_CHUNKS,
                include_value=True,  # 1.3.11: 启用相似度分数
                include_metadata=True
            )
            
            # 1.3.11: 提取文本并收集 citations
            valid_texts = []
            for record in results:
                # 1.3.11: 根据 include_value 调整解析逻辑
                if len(record) >= 3:
                    record_id = record[0]
                    score = record[1]
                    metadata = record[2] if record[2] else {}
                elif len(record) >= 2:
                    record_id = record[0]
                    score = None
                    metadata = record[1] if record[1] else {}
                else:
                    continue
                    
                text = metadata.get("text", "")
                source = metadata.get("source", metadata.get("url", ""))
                inner_metadata = metadata.get("metadata", {}) if isinstance(metadata, dict) else {}
                
                is_error = (
                    'error' in inner_metadata or 
                    '爬取失败' in text or 
                    '解析失败' in text or
                    text.strip().startswith('爬取失败') or
                    text.strip().startswith('解析失败')
                )
                if not is_error and text.strip():
                    valid_texts.append(text)
                    # 1.3.11: 收集 citation 信息（限制内容长度为500字符）
                    citations.append({
                        "id": record_id,
                        "source": source,
                        "content": text[:500] if len(text) > 500 else text,
                        "score": float(score) if score is not None else None
                    })
            
            context = "\n\n".join(valid_texts[:MAX_CHUNKS])
            # 1.3.11: 限制 citations 数量
            citations = citations[:5]
            
            if not context or not context.strip() or len(context.strip()) < 50:
                if os.getenv("ENV") == "development":
                    print("⚠️ 警告: pgvector检索后上下文为空或过短")
            
        except Exception as e:
            print(f"❌ pgvector query error: {e}, falling back to Chroma")
            # 1.2.56: 回退时需要先导入 Chroma
            from langchain_community.vectorstores import Chroma as ChromaFallback
            vectorstore = ChromaFallback(
                persist_directory=f"./chroma_db/{collection_name}",
                embedding_function=OpenAIEmbeddings()
            )
            retriever = vectorstore.as_retriever(search_kwargs={"k": RETRIEVE_K})
            relevant_docs = retriever.invoke(user_query)
            
            valid_docs = []
            for idx, doc in enumerate(relevant_docs):
                is_error = (
                    'error' in doc.metadata or 
                    '爬取失败' in doc.page_content or 
                    '解析失败' in doc.page_content or
                    doc.page_content.strip().startswith('爬取失败') or
                    doc.page_content.strip().startswith('解析失败')
                )
                if not is_error:
                    valid_docs.append(doc)
                    # 1.3.11: 收集 citation 信息（Chroma 回退时）
                    source = doc.metadata.get('source', doc.metadata.get('url', ''))
                    content = doc.page_content[:500] if len(doc.page_content) > 500 else doc.page_content
                    citations.append({
                        "id": f"chroma-stream-fallback-{idx}",
                        "source": source,
                        "content": content,
                        "score": None
                    })
            
            if valid_docs:
                relevant_docs = valid_docs[:MAX_CHUNKS]
            
            context = "\n\n".join([doc.page_content for doc in relevant_docs])
            # 1.3.11: 限制 citations 数量
            citations = citations[:5]
    else:
        # 使用 Chroma（本地开发）
        # 1.2.56: Chroma 已在条件导入块中导入
        vectorstore = Chroma(
            persist_directory=f"./chroma_db/{collection_name}",
            embedding_function=OpenAIEmbeddings()
        )
        retriever = vectorstore.as_retriever(search_kwargs={"k": RETRIEVE_K})
        relevant_docs = retriever.invoke(user_query)
        
        valid_docs = []
        for idx, doc in enumerate(relevant_docs):
            is_error = (
                'error' in doc.metadata or 
                '爬取失败' in doc.page_content or 
                '解析失败' in doc.page_content or
                doc.page_content.strip().startswith('爬取失败') or
                doc.page_content.strip().startswith('解析失败')
            )
            if not is_error:
                valid_docs.append(doc)
                # 1.3.11: 收集 citation 信息（Chroma 本地模式）
                source = doc.metadata.get('source', doc.metadata.get('url', ''))
                content = doc.page_content[:500] if len(doc.page_content) > 500 else doc.page_content
                citations.append({
                    "id": f"chroma-stream-{idx}",
                    "source": source,
                    "content": content,
                    "score": None
                })
        
        original_count = len(relevant_docs)
        if valid_docs:
            relevant_docs = valid_docs[:MAX_CHUNKS]
            # 1.3.11: 限制 citations 数量
            citations = citations[:5]
            if os.getenv("ENV") == "development":
                print(f"🔍 检索到 {len(valid_docs)} 个有效文档（已过滤 {original_count - len(valid_docs)} 个错误文档）")
        else:
            relevant_docs = relevant_docs[:MAX_CHUNKS]
            if os.getenv("ENV") == "development":
                print(f"⚠️ 检索到的文档可能包含错误，使用原始结果")
        
        context = "\n\n".join([doc.page_content for doc in relevant_docs])
    
    # 1.2.52: 获取语言设置，默认为中文
    language = state.get('language', 'zh')
    if language not in ['zh', 'en', 'ja']:
        language = 'zh'
    
    # 1.2.52: 多语言空上下文提示
    empty_context_messages = {
        'zh': "抱歉，我在知识库中没有找到与您的问题相关的信息。",
        'en': "Sorry, I couldn't find any relevant information in the knowledge base related to your question.",
        'ja': "申し訳ありませんが、ナレッジベースにご質問に関連する情報が見つかりませんでした。"
    }
    
    # 1.2.24: 如果上下文为空，返回友好提示
    # 1.3.11: 添加 citations 字段
    if not context or not context.strip() or len(context.strip()) < 50:
        if os.getenv("ENV") == "development":
            print("⚠️ 警告: 上下文为空或过短，可能没有找到相关文档")
        yield {
            "answer": empty_context_messages.get(language, empty_context_messages['zh']),
            "done": True,
            "context": "",
            "citations": []  # 1.3.11: 空上下文时无引用
        }
        return
    
    # 1.2.52: 多语言系统提示词
    system_prompts = {
        'zh': "你是一个专业的知识库助手。请根据以下提供的上下文回答用户的问题。如果上下文中没有相关信息，请诚实地说你不知道。请使用中文回复。\n\n上下文:\n{context}",
        'en': "You are a professional knowledge base assistant. Please answer the user's question based on the context provided below. If there is no relevant information in the context, please honestly say you don't know. Please respond in English.\n\nContext:\n{context}",
        'ja': "あなたはプロフェッショナルなナレッジベースアシスタントです。以下に提供されたコンテキストに基づいてユーザーの質問に答えてください。コンテキストに関連情報がない場合は、正直にわからないと言ってください。日本語で回答してください。\n\nコンテキスト:\n{context}"
    }
    
    # 1.2.24: 生成流式回答
    # 1.2.52: 使用多语言系统提示词
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompts.get(language, system_prompts['zh'])),
        MessagesPlaceholder(variable_name="messages"),
    ])
    
    llm = ChatOpenAI(model="gpt-4o", streaming=True)
    chain = prompt | llm
    
    # 1.2.24: 使用 astream 进行流式输出
    full_response = ""
    async for chunk in chain.astream({"context": context, "messages": messages}):
        if chunk.content:
            full_response += chunk.content
            # 发送数据块
            yield {
                "chunk": chunk.content,
                "done": False
            }
    
    # 1.2.24: 发送完成标记，包含完整答案和上下文
    # 1.3.11: 添加 citations 字段
    yield {
        "answer": full_response,
        "context": context,
        "done": True,
        "citations": citations  # 1.3.11: 引用来源列表
    }

# 1.1.11: 入口节点 - 根据输入类型路由到不同处理节点
def entry_node(state: GraphState):
    """1.1.11: 入口节点，不做任何处理，仅用于路由"""
    return state

# 1.1.11: 入口路由函数 - 决定处理文件、URL还是直接聊天
def route_entry(state: GraphState) -> str:
    """
    1.1.11: 根据状态决定入口点
    - 如果有 file_path → process_file
    - 如果有 urls → crawl_url
    - 否则直接跳到聊天
    """
    file_path = state.get('file_path', '')
    urls = state.get('urls', [])
    
    if file_path and file_path.strip():
        return "process_file"
    elif urls and len(urls) > 0:
        return "crawl_url"
    else:
        # 直接跳到聊天
        return "chat"

# 1.1.10: 条件路由函数 - 判断是否需要处理文件
def should_process_file(state: GraphState) -> str:
    """
    1.1.10: 根据状态决定下一步（从process_file节点）
    - 如果有 file_path，进行文件处理后到split_text
    - 否则直接跳到聊天
    """
    file_path = state.get('file_path', '')
    
    # 如果有文件路径，进行文件处理
    if file_path and file_path.strip():
        return "split_text"
    
    # 否则直接跳到聊天
    return "chat"

# 构建工作流
# 1.1.11: 更新工作流以支持URL爬虫
def create_workflow():
    workflow = StateGraph(GraphState)

    # 添加节点
    workflow.add_node("entry", entry_node)  # 1.1.11: 添加入口节点
    workflow.add_node("process_file", process_file_node)
    workflow.add_node("crawl_url", crawl_url_node)  # 1.1.11: 添加爬虫节点
    workflow.add_node("split_text", split_text_node)
    workflow.add_node("embed_and_store", embed_and_store_node)
    workflow.add_node("chat", chat_node)

    # 1.1.11: 设置入口点 - 根据输入类型路由
    workflow.set_entry_point("entry")
    workflow.add_conditional_edges(
        "entry",
        route_entry,
        {
            "process_file": "process_file",
            "crawl_url": "crawl_url",
            "chat": "chat"
        }
    )
    
    # 1.1.10: 文件处理节点的条件路由
    workflow.add_conditional_edges(
        "process_file",
        should_process_file,
        {
            "split_text": "split_text",
            "chat": "chat"
        }
    )
    
    # 1.1.11: URL爬虫节点直接到split_text
    workflow.add_edge("crawl_url", "split_text")
    
    # 文本切片后到向量存储
    workflow.add_edge("split_text", "embed_and_store")
    
    # 向量存储后到聊天
    workflow.add_edge("embed_and_store", "chat")
    
    # 聊天节点结束
    workflow.add_edge("chat", END)

    return workflow.compile()

# 导出应用
app = create_workflow()
