# 1.2.24: 移除 Chainlit 依赖，使用独立的 FastAPI 应用
# import chainlit as cl  # 1.2.23: 已替代，使用流式 /api/chat/stream
from langchain_core.messages import HumanMessage, AIMessage
from workflow import app as workflow_app, chat_node_stream  # 1.2.24: 导入流式聊天函数
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import uuid
import re  # 1.1.13: 导入 re 用于 collection_name 验证
import json  # 1.2.24: 用于 SSE 数据格式化
import logging  # 1.2.36: 添加日志模块，用于生产环境错误记录
from dotenv import load_dotenv
from supabase import create_client, Client
from cachetools import TTLCache  # 1.2.39: 高频问题缓存
import asyncio  # 1.2.39: 并行处理

# 1.2.39: 优先加载 .env.local，然后加载 .env（如果存在）
load_dotenv('.env.local')  # 本地开发配置优先
load_dotenv()  # 回退到 .env

# 1.2.36: 配置日志记录器，确保生产环境也能记录错误
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 1.2.39: 高频问题缓存 - TTL 为 6 小时，最多缓存 1000 个结果
# 缓存键格式: f"{kb_token}:{language}"
frequent_questions_cache = TTLCache(maxsize=1000, ttl=21600)

# 1.1.2: 初始化 Supabase 客户端（用于查询 vector_collection）
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 1.2.24: 创建独立的 FastAPI 应用，替代 Chainlit
# 1.2.36: 更新版本号
fastapi_app = FastAPI(
    title="YUIChat API",
    description="YUIChat 后端 API，提供知识库管理和聊天功能",
    version="1.2.39"
)

# 1.2.24: 添加 CORS 中间件，允许前端访问
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1.2.35: 健康检查端点（用于 Cloud Run）
# 1.2.36: 更新版本号
@fastapi_app.get("/health")
async def health_check():
    """健康检查端点，用于 Cloud Run 健康检查"""
    return {
        "status": "healthy",
        "service": "YUIChat API",
        "version": "1.2.39"
    }

@fastapi_app.post("/api/process-file")
async def process_file(request: Request):
    """
    1.1.13: 供管理端调用的 API，用于触发文件处理流程
    collection_name 应该是项目的 vector_collection
    1.1.13: 加强知识库隔离，验证 collection_name 格式
    """
    try:
        data = await request.json()
        file_path = data.get("file_path")
        collection_name = data.get("collection_name")
        
        if not file_path or not collection_name:
            raise HTTPException(status_code=400, detail="Missing file_path or collection_name")
        
        # 1.1.13: 验证 collection_name 格式，确保知识库隔离
        if not isinstance(collection_name, str) or not re.match(r'^[a-zA-Z0-9_-]+$', collection_name):
            raise HTTPException(status_code=400, detail="Invalid collection_name format")
            
        # 1.1.2: 运行工作流进行文件预处理
        initial_state = {
            "file_path": file_path,
            "collection_name": collection_name,
            "messages": [], # 1.1.2: 传入空消息列表，workflow.py 会跳过 chat 节点
            "docs": [],
            "splits": [],
            "context": "",
            "answer": ""
        }
        
        # 执行工作流
        # 1.2.24: 移除 cl.make_async，使用 asyncio.to_thread 处理同步调用
        import asyncio
        final_state = await asyncio.to_thread(workflow_app.invoke, initial_state)
        
        # 1.1.15: 统计文件字数并更新数据库
        docs = final_state.get('docs', [])
        if os.getenv("ENV") == "development":
            print(f"🔍 DEBUG: process_file - docs count: {len(docs) if docs else 0}")
        
        if docs and supabase:
            try:
                # 计算所有文档的总字数
                total_word_count = sum(len(doc.page_content) for doc in docs if doc.page_content)
                if os.getenv("ENV") == "development":
                    print(f"🔍 DEBUG: process_file - total_word_count: {total_word_count}")
                
                # 通过 collection_name 查询 knowledge_base_id
                kb_result = supabase.table("knowledge_bases")\
                    .select("id")\
                    .eq("vector_collection", collection_name)\
                    .single()\
                    .execute()
                
                if kb_result.data:
                    kb_id = kb_result.data.get("id")
                    
                    # 通过文件路径匹配文档（需要从file_path提取文件名）
                    # file_path 格式可能是: https://xxx.supabase.co/storage/v1/object/public/knowledge-base-files/{kb_id}/{filename}
                    import urllib.parse
                    parsed_path = urllib.parse.urlparse(file_path)
                    path_parts = parsed_path.path.split('/')
                    # 尝试提取文件名（最后一部分）
                    if path_parts:
                        # 可能格式: /storage/v1/object/public/knowledge-base-files/{kb_id}/{filename}
                        filename = path_parts[-1] if path_parts[-1] else (path_parts[-2] if len(path_parts) > 1 else '')
                        
                        # 更新文档的字数（通过 kb_id 和 status='processing' 匹配最近创建的文档）
                        # 先查询符合条件的文档
                        docs_result = supabase.table("documents")\
                            .select("id, processing_metadata, created_at")\
                            .eq("knowledge_base_id", kb_id)\
                            .eq("status", "processing")\
                            .execute()
                        
                        # 在Python中排序，取最新的文档
                        if docs_result.data and len(docs_result.data) > 0:
                            docs_result.data.sort(key=lambda x: x.get("created_at", ""), reverse=True)
                        
                        if docs_result.data and len(docs_result.data) > 0:
                            # 更新第一个匹配的文档（通常是最新创建的）
                            doc_data = docs_result.data[0]
                            doc_id = doc_data.get("id")
                            # 合并现有的 processing_metadata，避免覆盖其他字段
                            existing_metadata = doc_data.get("processing_metadata") or {}
                            existing_metadata["word_count"] = total_word_count
                            
                            update_result = supabase.table("documents")\
                                .update({
                                    "processing_metadata": existing_metadata
                                })\
                                .eq("id", doc_id)\
                                .execute()
                            if os.getenv("ENV") == "development":
                                print(f"📊 Updated word_count for file (doc_id: {doc_id}): {total_word_count} (kb_id: {kb_id})")
                        else:
                            # 1.1.15: 如果找不到 processing 状态的文档，尝试通过文件名和 kb_id 匹配最近的文档
                            # 这可能是前端已经更新了状态
                            if filename:
                                # 尝试通过文件名匹配（去掉扩展名后匹配，因为上传的文件名可能包含随机前缀）
                                file_ext = filename.split('.')[-1] if '.' in filename else ''
                                docs_result2 = supabase.table("documents")\
                                    .select("id, processing_metadata, created_at")\
                                    .eq("knowledge_base_id", kb_id)\
                                    .ilike("file_type", file_ext)\
                                    .execute()
                                
                                if docs_result2.data and len(docs_result2.data) > 0:
                                    docs_result2.data.sort(key=lambda x: x.get("created_at", ""), reverse=True)
                                    doc_data = docs_result2.data[0]
                                    doc_id = doc_data.get("id")
                                    existing_metadata = doc_data.get("processing_metadata") or {}
                                    existing_metadata["word_count"] = total_word_count
                                    
                                    update_result = supabase.table("documents")\
                                        .update({
                                            "processing_metadata": existing_metadata
                                        })\
                                        .eq("id", doc_id)\
                                        .execute()
                                    if os.getenv("ENV") == "development":
                                        print(f"📊 Updated word_count for file (by filename match, doc_id: {doc_id}): {total_word_count}")
                            if os.getenv("ENV") == "development":
                                print(f"⚠️ No processing document found for kb_id {kb_id}, trying alternative matching...")
                            
                            # 1.1.15: 备用方案 - 尝试匹配最近的文档（不依赖状态）
                            # 查询最近创建的文档（无论状态如何）
                            alt_docs_result = supabase.table("documents")\
                                .select("id, processing_metadata, created_at, filename")\
                                .eq("knowledge_base_id", kb_id)\
                                .execute()
                            
                            if alt_docs_result.data and len(alt_docs_result.data) > 0:
                                # 按创建时间排序
                                alt_docs_result.data.sort(key=lambda x: x.get("created_at", ""), reverse=True)
                                # 尝试匹配文件类型
                                for alt_doc in alt_docs_result.data[:3]:  # 只检查最近3个文档
                                    alt_doc_filename = alt_doc.get("filename", "")
                                    if file_ext and alt_doc_filename.endswith(f".{file_ext}"):
                                        doc_id = alt_doc.get("id")
                                        existing_metadata = alt_doc.get("processing_metadata") or {}
                                        existing_metadata["word_count"] = total_word_count
                                        
                                        update_result = supabase.table("documents")\
                                            .update({
                                                "processing_metadata": existing_metadata
                                            })\
                                            .eq("id", doc_id)\
                                            .execute()
                                        if os.getenv("ENV") == "development":
                                            print(f"📊 Updated word_count (alternative match, doc_id: {doc_id}): {total_word_count}")
                                        break
            except Exception as e:
                import traceback
                if os.getenv("ENV") == "development":
                    print(f"⚠️ Failed to update word_count for file: {e}")
                    print(f"   Traceback: {traceback.format_exc()}")
        else:
            if os.getenv("ENV") == "development":
                if not docs:
                    print(f"⚠️ process_file: docs is empty")
                if not supabase:
                    print(f"⚠️ process_file: supabase client not available")
        
        return JSONResponse(content={
            "status": "success",
            "collection_name": collection_name,
            "message": "File processed and indexed"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

# 1.1.13: 添加URL爬虫 API 端点（加强知识库隔离）
@fastapi_app.post("/api/process-url")
async def process_url(request: Request):
    """
    1.1.13: 供管理端调用的 API，用于触发URL爬取和处理流程
    collection_name 应该是项目的 vector_collection
    1.1.13: 加强知识库隔离，验证 collection_name 格式
    """
    from urllib.parse import urlparse
    
    try:
        data = await request.json()
        urls = data.get("urls")
        collection_name = data.get("collection_name")
        
        # 验证参数
        if not urls:
            raise HTTPException(status_code=400, detail="Missing urls")
        
        if not collection_name:
            raise HTTPException(status_code=400, detail="Missing collection_name")
        
        # 1.1.13: 验证 collection_name 格式，确保知识库隔离
        if not isinstance(collection_name, str) or not re.match(r'^[a-zA-Z0-9_-]+$', collection_name):
            raise HTTPException(status_code=400, detail="Invalid collection_name format")
        
        # 确保urls是列表
        if isinstance(urls, str):
            urls = [urls]
        
        # 验证URL格式
        valid_urls = []
        for url in urls:
            url = url.strip()
            if not url:
                continue
            try:
                result = urlparse(url)
                if not all([result.scheme, result.netloc]):
                    if os.getenv("ENV") == "development":
                        print(f"⚠️ Invalid URL format: {url}")
                    continue
                # 只支持http和https
                if result.scheme not in ['http', 'https']:
                    if os.getenv("ENV") == "development":
                        print(f"⚠️ URL must start with http:// or https://: {url}")
                    continue
                valid_urls.append(url)
            except Exception as e:
                if os.getenv("ENV") == "development":
                    print(f"⚠️ URL validation error: {url} - {str(e)}")
                continue
        
        if not valid_urls:
            raise HTTPException(status_code=400, detail="No valid URLs provided. URLs must start with http:// or https://")
        
        if os.getenv("ENV") == "development":
            print(f"🕷️ Processing {len(valid_urls)} URL(s) for collection: {collection_name}")
        
        # 1.1.11: 运行工作流进行URL爬取和处理
        initial_state = {
            "urls": valid_urls,  # 1.1.11: 传递URL列表
            "collection_name": collection_name,
            "file_path": "",  # 不使用文件路径
            "messages": [],  # 传入空消息列表，workflow.py 会跳过 chat 节点
            "docs": [],
            "splits": [],
            "context": "",
            "answer": ""
        }
        
        # 执行工作流
        # 1.2.24: 移除 cl.make_async，使用 asyncio.to_thread 处理同步调用
        import asyncio
        final_state = await asyncio.to_thread(workflow_app.invoke, initial_state)
        
        # 1.1.12: 按照 chatmax 逻辑，检查是否有解析失败的文档
        docs = final_state.get('docs', [])
        error_docs = []
        valid_docs = []
        
        # 1.1.15: 构建 URL -> 字数的映射
        url_word_counts = {}
        
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
                # 1.1.15: 统计字数（非错误文档）
                source_url = doc.metadata.get('source', '')
                if source_url:
                    # 计算文档内容的字符数（中文字符和其他字符都算1个）
                    word_count = len(doc.page_content)
                    url_word_counts[source_url] = word_count
                    if os.getenv("ENV") == "development":
                        print(f"🔍 URL字数统计: {source_url} -> {word_count} 字符")
                else:
                    if os.getenv("ENV") == "development":
                        print(f"⚠️ 文档缺少 source URL: metadata={doc.metadata}")
        
        # 1.1.15: 更新数据库中的字数统计
        if os.getenv("ENV") == "development":
            print(f"🔍 DEBUG: process_url - url_word_counts: {url_word_counts}")
            print(f"🔍 DEBUG: process_url - supabase available: {supabase is not None}")
        
        if supabase and url_word_counts:
            try:
                # 通过 collection_name 查询 knowledge_base_id
                kb_result = supabase.table("knowledge_bases")\
                    .select("id")\
                    .eq("vector_collection", collection_name)\
                    .single()\
                    .execute()
                
                if kb_result.data:
                    kb_id = kb_result.data.get("id")
                    for url, word_count in url_word_counts.items():
                        if os.getenv("ENV") == "development":
                            print(f"🔍 Trying to update word_count for URL: {url}, word_count: {word_count}")
                        
                        # 先尝试通过 storage_path 匹配
                        doc_result = supabase.table("documents")\
                            .select("id, processing_metadata, filename, storage_path")\
                            .eq("knowledge_base_id", kb_id)\
                            .eq("storage_path", url)\
                            .limit(1)\
                            .execute()
                        
                        # 如果 storage_path 匹配失败，尝试通过 filename 匹配
                        if not doc_result.data or len(doc_result.data) == 0:
                            if os.getenv("ENV") == "development":
                                print(f"   ⚠️ Not found by storage_path, trying filename...")
                            doc_result = supabase.table("documents")\
                                .select("id, processing_metadata, filename, storage_path")\
                                .eq("knowledge_base_id", kb_id)\
                                .eq("filename", url)\
                                .limit(1)\
                                .execute()
                        
                        # 如果还是匹配不到，尝试通过 URL 的部分匹配（处理 URL 参数变化的情况）
                        if not doc_result.data or len(doc_result.data) == 0:
                            if os.getenv("ENV") == "development":
                                print(f"   ⚠️ Not found by filename, trying partial match...")
                            # 提取基础URL（去掉参数和锚点）
                            from urllib.parse import urlparse
                            parsed = urlparse(url)
                            base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                            # 尝试匹配包含基础URL的文档
                            all_docs = supabase.table("documents")\
                                .select("id, processing_metadata, filename, storage_path, created_at")\
                                .eq("knowledge_base_id", kb_id)\
                                .eq("file_type", "url")\
                                .execute()
                            
                            if all_docs.data:
                                # 查找最匹配的文档（按创建时间排序，匹配基础URL）
                                matching_docs = [d for d in all_docs.data 
                                               if (d.get("filename") or "").startswith(base_url) or 
                                                  (d.get("storage_path") or "").startswith(base_url)]
                                if matching_docs:
                                    matching_docs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
                                    doc_result.data = [matching_docs[0]]
                        
                        if doc_result.data and len(doc_result.data) > 0:
                            doc_id = doc_result.data[0].get("id")
                            # 合并现有的 processing_metadata，避免覆盖其他字段
                            existing_metadata = doc_result.data[0].get("processing_metadata") or {}
                            existing_metadata["word_count"] = word_count
                            
                            update_result = supabase.table("documents")\
                                .update({
                                    "processing_metadata": existing_metadata
                                })\
                                .eq("id", doc_id)\
                                .execute()
                            if os.getenv("ENV") == "development":
                                print(f"✅ Updated word_count for URL {url}: {word_count} (doc_id: {doc_id}, kb_id: {kb_id})")
                        else:
                            if os.getenv("ENV") == "development":
                                print(f"❌ Document not found for URL {url} in kb_id {kb_id}")
                                # 列出所有URL文档用于调试
                                all_url_docs = supabase.table("documents")\
                                    .select("id, filename, storage_path, created_at")\
                                    .eq("knowledge_base_id", kb_id)\
                                    .eq("file_type", "url")\
                                    .limit(5)\
                                    .execute()
                                if all_url_docs.data:
                                    print(f"   Available URL docs: {[(d.get('id'), d.get('filename'), d.get('storage_path')) for d in all_url_docs.data]}")
                else:
                    if os.getenv("ENV") == "development":
                        print(f"⚠️ Knowledge base not found for collection_name: {collection_name}")
            except Exception as e:
                import traceback
                if os.getenv("ENV") == "development":
                    print(f"⚠️ Failed to update word_count for URLs: {e}")
                    print(f"   Traceback: {traceback.format_exc()}")
        
        # 1.1.12: 如果有错误文档，返回部分成功或失败状态
        if error_docs:
            if valid_docs:
                # 部分成功
                return JSONResponse(content={
                    "status": "partial_success",
                    "collection_name": collection_name,
                    "urls_processed": len(valid_docs),
                    "urls_failed": len(error_docs),
                    "message": f"成功处理 {len(valid_docs)} 个URL，失败 {len(error_docs)} 个URL",
                    "errors": [doc.metadata.get('error', '解析失败') for doc in error_docs]
                })
            else:
                # 全部失败
                return JSONResponse(
                    status_code=400,
                    content={
                        "status": "error",
                        "collection_name": collection_name,
                        "urls_processed": 0,
                        "urls_failed": len(error_docs),
                        "message": f"所有URL解析失败",
                        "errors": [doc.metadata.get('error', '解析失败') for doc in error_docs]
                    }
                )
        
        # 全部成功
        return JSONResponse(content={
            "status": "success",
            "collection_name": collection_name,
            "urls_processed": len(valid_docs),
            "message": f"Successfully processed {len(valid_docs)} URL(s) and indexed"
        })
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if os.getenv("ENV") == "development":
            print(f"❌ URL processing error: {error_msg}")
        
        # 根据错误类型返回不同的状态码
        status_code = 500
        if "timeout" in error_msg.lower() or "超时" in error_msg:
            status_code = 504
        elif "无法访问" in error_msg or "无法连接" in error_msg or "connection" in error_msg.lower():
            status_code = 502
        
        return JSONResponse(
            status_code=status_code,
            content={"status": "error", "message": error_msg}
        )

# 1.1.13: 添加聊天 API 端点（加强知识库隔离）
@fastapi_app.post("/api/chat")
async def chat(request: Request):
    """
    1.1.13: 供管理端调用的聊天 API，用于测试对话功能
    支持基于知识库文档的问答
    1.1.13: 加强知识库隔离，确保用户只能访问有权限的知识库
    """
    try:
        data = await request.json()
        query = data.get("query")
        kb_token = data.get("kb_id")  # share_token 或 vector_collection
        conversation_history = data.get("conversation_history", [])
        user_id = data.get("user_id")  # 1.1.13: 可选，用于权限验证
        
        if not query:
            raise HTTPException(status_code=400, detail="Missing query")
        
        if not kb_token:
            raise HTTPException(status_code=400, detail="Missing kb_id")
        
        # 1.1.13: 从 Supabase 获取 vector_collection 并验证权限
        collection_name = None
        kb_data = None
        
        if supabase:
            try:
                # 1.1.13: 尝试通过 share_token 查询知识库信息
                result = supabase.table("knowledge_bases")\
                    .select("vector_collection, user_id, id")\
                    .eq("share_token", kb_token)\
                    .single()\
                    .execute()
                
                if result.data:
                    kb_data = result.data
                    vector_collection = kb_data.get("vector_collection")
                    
                    # 1.1.15: 验证 vector_collection 是否有效（不为 None 且不为空字符串）
                    if vector_collection and isinstance(vector_collection, str) and vector_collection.strip():
                        collection_name = vector_collection.strip()
                    else:
                        # 1.1.15: 如果 vector_collection 为空，使用 kb_token 作为后备
                        if os.getenv("ENV") == "development":
                            print(f"⚠️ vector_collection is empty for kb_id {kb_token}, using kb_token as collection_name")
                        collection_name = kb_token
                    
                    # 1.1.13: 权限验证 - 如果提供了 user_id，验证用户是否有权限访问
                    if user_id:
                        kb_user_id = kb_data.get("user_id")
                        if kb_user_id != user_id:
                            # 1.1.13: 用户不是知识库所有者，但可以通过 share_token 访问（公开分享）
                            if os.getenv("ENV") == "development":
                                print(f"⚠️ User {user_id} accessing shared knowledge base {kb_data.get('id')} via share_token")
                    else:
                        # 1.1.13: 未提供 user_id，允许通过 share_token 访问（公开分享模式）
                        if os.getenv("ENV") == "development":
                            print(f"⚠️ Accessing knowledge base via share_token without user_id (public share mode)")
                else:
                    # 1.1.13: 如果通过 share_token 查询失败，尝试直接使用 kb_token 作为 vector_collection
                    # 但需要验证该 collection 是否属于某个知识库（可选，用于向后兼容）
                    if os.getenv("ENV") == "development":
                        print(f"⚠️ Knowledge base not found by share_token, using kb_token as collection_name: {kb_token}")
                    collection_name = kb_token
            except Exception as e:
                # 1.1.13: 如果查询失败，可能 kb_token 本身就是 vector_collection（向后兼容）
                if os.getenv("ENV") == "development":
                    print(f"⚠️ Failed to fetch knowledge base info, using kb_token as collection_name: {e}")
                collection_name = kb_token
        else:
            # 1.1.15: 如果没有 Supabase 连接，直接使用 kb_token
            collection_name = kb_token
        
        # 1.1.15: 确保 collection_name 不为空且是有效字符串
        if not collection_name or not isinstance(collection_name, str) or not collection_name.strip():
            raise HTTPException(status_code=404, detail="Knowledge base not found or invalid kb_id: collection_name is empty")
        
        # 1.1.10: 构建消息历史
        from langchain_core.messages import HumanMessage, AIMessage
        messages = []
        for msg in conversation_history:
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg.get("content", "")))
            elif msg.get("role") == "assistant":
                messages.append(AIMessage(content=msg.get("content", "")))
        
        # 添加当前用户问题
        messages.append(HumanMessage(content=query))
        
        # 1.1.10: 准备状态并调用工作流
        state = {
            "messages": messages,
            "collection_name": collection_name,
            "file_path": "",  # 不需要处理文件
            "docs": [],
            "splits": [],
            "context": "",
            "answer": ""
        }
        
        # 执行工作流（只执行 chat 节点）
        # 1.2.24: 移除 cl.make_async，直接使用异步调用
        result = workflow_app.invoke(state)
        
        answer = result.get("answer", "抱歉，我无法回答这个问题。")
        context = result.get("context", "")
        
        return JSONResponse(content={
            "status": "success",
            "answer": answer,
            "context": context,
            "collection_name": collection_name
        })
    except Exception as e:
        if os.getenv("ENV") == "development":  # 1.1.10: 仅开发环境输出详细错误
            print(f"Chat API error: {e}")
        return JSONResponse(status_code=500, content={
            "status": "error", 
            "message": str(e)
        })

# 1.2.24: 新增流式聊天端点，支持 SSE 实时显示
@fastapi_app.post("/api/chat/stream")
async def chat_stream(request: Request):
    """
    1.2.24: 流式聊天 API，支持实时显示答案
    使用 FastAPI 原生 StreamingResponse 实现 SSE
    """
    try:
        data = await request.json()
        query = data.get("query")
        kb_token = data.get("kb_id")  # share_token 或 vector_collection
        conversation_history = data.get("conversation_history", [])
        user_id = data.get("user_id")  # 可选，用于权限验证
        
        if not query:
            raise HTTPException(status_code=400, detail="Missing query")
        
        if not kb_token:
            raise HTTPException(status_code=400, detail="Missing kb_id")
        
        # 1.2.24: 从 Supabase 获取 vector_collection 并验证权限（与 /api/chat 相同逻辑）
        collection_name = None
        kb_data = None
        
        if supabase:
            try:
                result = supabase.table("knowledge_bases")\
                    .select("vector_collection, user_id, id")\
                    .eq("share_token", kb_token)\
                    .single()\
                    .execute()
                
                if result.data:
                    kb_data = result.data
                    vector_collection = kb_data.get("vector_collection")
                    
                    if vector_collection and isinstance(vector_collection, str) and vector_collection.strip():
                        collection_name = vector_collection.strip()
                    else:
                        if os.getenv("ENV") == "development":
                            print(f"⚠️ vector_collection is empty for kb_id {kb_token}, using kb_token as collection_name")
                        collection_name = kb_token
                    
                    # 权限验证
                    if user_id:
                        kb_user_id = kb_data.get("user_id")
                        if kb_user_id != user_id:
                            if os.getenv("ENV") == "development":
                                print(f"⚠️ User {user_id} accessing shared knowledge base {kb_data.get('id')} via share_token")
                    else:
                        if os.getenv("ENV") == "development":
                            print(f"⚠️ Accessing knowledge base via share_token without user_id (public share mode)")
                else:
                    if os.getenv("ENV") == "development":
                        print(f"⚠️ Knowledge base not found by share_token, using kb_token as collection_name: {kb_token}")
                    collection_name = kb_token
            except Exception as e:
                if os.getenv("ENV") == "development":
                    print(f"⚠️ Failed to fetch knowledge base info, using kb_token as collection_name: {e}")
                collection_name = kb_token
        else:
            collection_name = kb_token
        
        # 确保 collection_name 有效
        if not collection_name or not isinstance(collection_name, str) or not collection_name.strip():
            raise HTTPException(status_code=404, detail="Knowledge base not found or invalid kb_id: collection_name is empty")
        
        # 构建消息历史
        messages = []
        for msg in conversation_history:
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg.get("content", "")))
            elif msg.get("role") == "assistant":
                messages.append(AIMessage(content=msg.get("content", "")))
        
        # 添加当前用户问题
        messages.append(HumanMessage(content=query))
        
        # 准备状态
        state = {
            "messages": messages,
            "collection_name": collection_name,
            "file_path": "",
            "docs": [],
            "splits": [],
            "context": "",
            "answer": ""
        }
        
        # 1.2.24: 定义 SSE 流式生成器
        async def generate():
            try:
                # 调用流式聊天函数
                async for chunk_data in chat_node_stream(state):
                    if chunk_data.get("done"):
                        # 发送完成消息，包含完整答案和上下文
                        yield f"data: {json.dumps({'answer': chunk_data.get('answer', ''), 'context': chunk_data.get('context', ''), 'done': True})}\n\n"
                    else:
                        # 发送数据块
                        chunk_text = chunk_data.get("chunk", "")
                        if chunk_text:
                            yield f"data: {json.dumps({'chunk': chunk_text})}\n\n"
                
                # 发送结束标记
                yield "data: [DONE]\n\n"
            except Exception as e:
                # 错误处理
                error_data = json.dumps({'error': str(e), 'done': True})
                yield f"data: {error_data}\n\n"
                if os.getenv("ENV") == "development":
                    print(f"❌ Stream chat error: {e}")
        
        # 1.2.24: 返回流式响应
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # 禁用 Nginx buffering
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        if os.getenv("ENV") == "development":
            print(f"❌ Stream chat setup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 1.2.0: 获取聊天配置 API
# 1.2.21: 改为POST请求，避免Chainlit拦截GET请求
@fastapi_app.post("/api/chat-config")
async def get_chat_config(request: Request):
    """
    获取项目的聊天配置（欢迎语、推荐问题等）
    1.2.21: 改为POST请求，避免Chainlit拦截GET请求
    """
    try:
        # 1.2.21: 支持从body或query参数获取参数
        body = await request.json() if request.headers.get("content-type") == "application/json" else {}
        kb_token = body.get("kb_id") or request.query_params.get("kb_id")
        language = body.get("language") or request.query_params.get("language", "zh")
        
        if not kb_token:
            return JSONResponse(status_code=400, content={
                "status": "error",
                "message": "Missing kb_id"
            })
        
        # 从 Supabase 获取 chat_config 和项目名称
        chat_config = None
        project_name = "YUIChat"  # 默认项目名称
        if supabase:
            try:
                result = supabase.table("knowledge_bases")\
                    .select("chat_config, name")\
                    .eq("share_token", kb_token)\
                    .single()\
                    .execute()
                
                if result.data:
                    chat_config = result.data.get("chat_config", {})
                    project_name = result.data.get("name", "YUIChat")
            except Exception as e:
                if os.getenv("ENV") == "development":
                    print(f"⚠️ Failed to fetch chat_config: {e}")
                chat_config = {}
        else:
            chat_config = {}
        
        # 标准化语言代码
        if language not in ["zh", "en", "ja"]:
            language = "zh"
        
        # 提取对应语言的配置
        welcome_message = ""
        recommended_questions = []
        
        if chat_config:
            welcome_message = chat_config.get("welcome_message", {}).get(language, "")
            recommended_questions = chat_config.get("recommended_questions", {}).get(language, [])
        
        return JSONResponse(content={
            "status": "success",
            "project_name": project_name,  # 1.2.13: 返回项目名称用于替换 Chainlit logo
            "avatar_url": chat_config.get("avatar_url", "") if chat_config else "",
            "welcome_message": welcome_message,
            "recommended_questions": recommended_questions[:3] if recommended_questions else []
        })
    except Exception as e:
        if os.getenv("ENV") == "development":
            print(f"Chat config API error: {e}")
        return JSONResponse(status_code=500, content={
            "status": "error",
            "message": str(e)
        })

# 1.2.0: 获取高频问题 API
# 1.2.11: 基于文档生成常见问题，确保每个问题都有回复
# 1.2.12: 改为POST请求，避免Chainlit拦截GET请求
# 1.2.36: 改进错误处理和日志记录，确保生产环境也能追踪问题
# 1.2.39: 性能优化 - 添加缓存、并行处理、使用更快模型
@fastapi_app.post("/api/frequent-questions")
async def get_frequent_questions(request: Request):
    """
    获取高频问题（当项目未配置推荐问题时使用）
    1.2.11: 基于上传的文档生成问题，并确保每个问题都有回复
    1.2.12: 改为POST请求，避免Chainlit拦截GET请求
    1.2.36: 改进错误处理和日志记录，确保生产环境也能追踪问题
    1.2.39: 性能优化 - 缓存(6h)、并行embedding、gpt-4o-mini、并行验证
    """
    # 1.2.36: 使用 logger 记录 API 调用（生产环境也会记录）
    logger.info("API called: /api/frequent-questions")
    if os.getenv("ENV") == "development":
        print(f"✅ DEBUG: /api/frequent-questions API called")
    try:
        # 1.2.12: 支持从body或query参数获取参数
        try:
            data = await request.json()
            kb_token = data.get("kb_id") or request.query_params.get("kb_id")
            language = data.get("language") or request.query_params.get("language", "zh")
        except:
            # 如果没有body，从query参数获取
            kb_token = request.query_params.get("kb_id")
            language = request.query_params.get("language", "zh")
        
        if not kb_token:
            logger.warning("Missing kb_id parameter in frequent-questions request")
            return JSONResponse(status_code=400, content={
                "status": "error",
                "message": "Missing kb_id"
            })
        
        # 标准化语言代码
        if language not in ["zh", "en", "ja"]:
            language = "zh"
        
        # 1.2.39: 检查缓存
        cache_key = f"{kb_token}:{language}"
        if cache_key in frequent_questions_cache:
            cached_questions = frequent_questions_cache[cache_key]
            logger.info(f"Cache hit for kb_token: {kb_token}, language: {language}")
            if os.getenv("ENV") == "development":
                print(f"✅ DEBUG: Cache hit, returning cached questions")
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "questions": cached_questions,
                    "cached": True  # 1.2.39: 标记为缓存结果
                },
                headers={"Content-Type": "application/json"}
            )
        
        logger.info(f"Processing frequent questions request for kb_token: {kb_token}, language: {language}")
        
        # 1.2.11: 从 Supabase 获取 vector_collection
        # 1.2.36: 改进错误日志记录
        # 1.2.40: 简化查询逻辑，支持通过 id 或 share_token 查询
        collection_name = None
        if supabase:
            try:
                # 1.2.39: 支持通过 id 或 share_token 查询（兼容前端传递 project id）
                # 先尝试通过 share_token 查询
                result = supabase.table("knowledge_bases")\
                    .select("vector_collection")\
                    .eq("share_token", kb_token)\
                    .limit(1)\
                    .execute()
                
                # 如果通过 share_token 未找到，尝试通过 id 查询
                if not result.data or len(result.data) == 0:
                    result = supabase.table("knowledge_bases")\
                        .select("vector_collection")\
                        .eq("id", kb_token)\
                        .limit(1)\
                        .execute()
                
                if result.data and len(result.data) > 0:
                    data = result.data[0]  # 获取第一条记录
                    vector_collection = data.get("vector_collection")
                    if os.getenv("ENV") == "development":
                        print(f"🔍 DEBUG: Found vector_collection: {vector_collection}")
                    if vector_collection and isinstance(vector_collection, str) and vector_collection.strip():
                        collection_name = vector_collection.strip()
                        logger.info(f"Found collection_name: {collection_name} for kb_token: {kb_token}")
                        if os.getenv("ENV") == "development":
                            print(f"✅ DEBUG: Using collection_name: {collection_name}")
                    else:
                        logger.warning(f"vector_collection is empty or invalid for kb_token: {kb_token}, value: {vector_collection}")
                        if os.getenv("ENV") == "development":
                            print(f"⚠️ DEBUG: vector_collection is empty or invalid: {vector_collection}")
                else:
                    logger.warning(f"No data found in knowledge_bases for kb_token: {kb_token}")
                    if os.getenv("ENV") == "development":
                        print(f"⚠️ DEBUG: No data found for kb_token: {kb_token}")
            except Exception as e:
                logger.error(f"Failed to fetch vector_collection from Supabase for kb_token {kb_token}: {str(e)}", exc_info=True)
                if os.getenv("ENV") == "development":
                    print(f"⚠️ Failed to fetch vector_collection: {e}")
        else:
            logger.error("Supabase client not initialized - missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
            if os.getenv("ENV") == "development":
                print(f"⚠️ DEBUG: Supabase client not initialized")
        
        # 如果没有找到 collection_name，使用默认问题
        if not collection_name:
            logger.warning(f"collection_name is None for kb_token: {kb_token}, returning default questions")
            if os.getenv("ENV") == "development":
                print(f"⚠️ DEBUG: collection_name is None, using default questions")
            default_questions = {
                "zh": [
                    "您能介绍一下这个项目吗？",
                    "有哪些常见问题？",
                    "如何使用这个系统？"
                ],
                "en": [
                    "Can you introduce this project?",
                    "What are the common questions?",
                    "How to use this system?"
                ],
                "ja": [
                    "このプロジェクトについて紹介していただけますか？",
                    "よくある質問は何ですか？",
                    "このシステムの使い方は？"
                ]
            }
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "questions": default_questions.get(language, default_questions["zh"])
                },
                headers={"Content-Type": "application/json"}
            )
        
        # 1.2.11: 从向量库检索文档片段
        from langchain_openai import OpenAIEmbeddings, ChatOpenAI
        from langchain_community.vectorstores import Chroma
        from langchain_core.prompts import ChatPromptTemplate
        import vecs
        
        # 尝试从向量库检索文档
        sample_docs = []
        try:
            # 1.2.11: 使用通用查询词检索文档
            query_texts = {
                "zh": ["介绍", "说明", "概述", "功能", "使用方法"],
                "en": ["introduction", "overview", "features", "how to use", "description"],
                "ja": ["紹介", "概要", "機能", "使い方", "説明"]
            }
            
            query_words = query_texts.get(language, query_texts["zh"])
            
            # 根据配置选择向量数据库
            USE_PGVECTOR = os.getenv("USE_PGVECTOR", "false").lower() == "true"
            DATABASE_URL = os.getenv("PGVECTOR_DATABASE_URL") or os.getenv("DATABASE_URL")
            
            if USE_PGVECTOR and DATABASE_URL:
                # 使用 pgvector
                try:
                    logger.info(f"Attempting to query pgvector collection: {collection_name}")
                    vx = vecs.create_client(DATABASE_URL)
                    collection = vx.get_collection(name=collection_name)
                    embeddings_model = OpenAIEmbeddings()
                    
                    # 1.2.39: 并行生成所有查询词的 embeddings
                    query_words_to_use = query_words[:3]  # 只使用前3个查询词
                    if os.getenv("ENV") == "development":
                        print(f"🔍 DEBUG: Parallel embedding {len(query_words_to_use)} query words")
                    
                    # 并行调用 embed_query
                    query_vectors = await asyncio.gather(*[
                        asyncio.to_thread(embeddings_model.embed_query, word)
                        for word in query_words_to_use
                    ])
                    
                    # 对每个查询词检索文档
                    all_results = []
                    for idx, query_word in enumerate(query_words_to_use):
                        query_vector = query_vectors[idx]
                        # 1.2.39: vecs 0.4.5 API: data 替代 query_vector
                        results = collection.query(
                            data=query_vector,
                            limit=2,
                            include_value=False,
                            include_metadata=True
                        )
                        logger.info(f"pgvector query for '{query_word}' returned {len(results)} results")
                        for record in results:
                            # 1.2.39: vecs 返回格式: (id, metadata)
                            if len(record) > 1 and record[1]:  # 确保有metadata
                                text = record[1].get("text", "")
                                metadata = record[1].get("metadata", {}) if isinstance(record[1], dict) else {}
                                is_error = (
                                    'error' in metadata or 
                                    '爬取失败' in text or 
                                    '解析失败' in text or
                                    text.strip().startswith('爬取失败') or
                                    text.strip().startswith('解析失败')
                                )
                                if not is_error and text.strip() and len(text.strip()) > 50:
                                    all_results.append(text)
                    
                    # 去重并限制数量
                    sample_docs = list(dict.fromkeys(all_results))[:10]  # 最多10个文档片段
                    logger.info(f"Retrieved {len(sample_docs)} valid documents from pgvector for collection: {collection_name}")
                    if os.getenv("ENV") == "development":
                        print(f"✅ DEBUG: Retrieved {len(sample_docs)} documents from pgvector (parallel)")
                except Exception as e:
                    logger.error(f"pgvector query failed for collection {collection_name}: {str(e)}", exc_info=True)
                    logger.warning(f"Falling back to Chroma for collection: {collection_name}")
                    if os.getenv("ENV") == "development":
                        print(f"⚠️ pgvector query error: {e}, falling back to Chroma")
                    # 回退到 Chroma（注意：Cloud Run 环境中可能无法访问本地文件系统）
                    logger.warning(f"Attempting Chroma fallback for collection: {collection_name} (may fail in Cloud Run)")
                    try:
                        vectorstore = Chroma(
                            persist_directory=f"./chroma_db/{collection_name}",
                            embedding_function=OpenAIEmbeddings()
                        )
                        retriever = vectorstore.as_retriever(search_kwargs={"k": 10})
                        for query_word in query_words[:3]:
                            docs = retriever.invoke(query_word)
                            logger.info(f"Chroma query for '{query_word}' returned {len(docs)} docs")
                            for doc in docs:
                                if doc.page_content and len(doc.page_content.strip()) > 50:
                                    is_error = (
                                        'error' in doc.metadata or 
                                        '爬取失败' in doc.page_content or 
                                        '解析失败' in doc.page_content
                                    )
                                    if not is_error:
                                        sample_docs.append(doc.page_content)
                        sample_docs = list(dict.fromkeys(sample_docs))[:10]
                        logger.info(f"Retrieved {len(sample_docs)} documents from Chroma (fallback) for collection: {collection_name}")
                        if os.getenv("ENV") == "development":
                            print(f"✅ DEBUG: Retrieved {len(sample_docs)} documents from Chroma (fallback)")
                    except Exception as chroma_error:
                        logger.error(f"Chroma fallback also failed for collection {collection_name}: {str(chroma_error)}", exc_info=True)
                        raise  # 重新抛出异常，让外层处理
            else:
                # 使用 Chroma
                if os.getenv("ENV") == "development":
                    print(f"🔍 DEBUG: Using Chroma, collection_name: {collection_name}")
                try:
                    vectorstore = Chroma(
                        persist_directory=f"./chroma_db/{collection_name}",
                        embedding_function=OpenAIEmbeddings()
                    )
                    retriever = vectorstore.as_retriever(search_kwargs={"k": 10})
                    for query_word in query_words[:3]:
                        docs = retriever.invoke(query_word)
                        if os.getenv("ENV") == "development":
                            print(f"🔍 DEBUG: Query '{query_word}' returned {len(docs)} docs")
                        for doc in docs:
                            if doc.page_content and len(doc.page_content.strip()) > 50:
                                is_error = (
                                    'error' in doc.metadata or 
                                    '爬取失败' in doc.page_content or 
                                    '解析失败' in doc.page_content
                                )
                                if not is_error:
                                    sample_docs.append(doc.page_content)
                    sample_docs = list(dict.fromkeys(sample_docs))[:10]
                    if os.getenv("ENV") == "development":
                        print(f"✅ DEBUG: Retrieved {len(sample_docs)} documents from Chroma")
                except Exception as e:
                    if os.getenv("ENV") == "development":
                        print(f"❌ DEBUG: Chroma error: {e}")
                    raise
        except Exception as e:
            logger.error(f"Failed to retrieve documents from vector database (collection: {collection_name}): {str(e)}", exc_info=True)
            if os.getenv("ENV") == "development":
                print(f"⚠️ Failed to retrieve documents: {e}")
                import traceback
                traceback.print_exc()
            sample_docs = []
        
        # 1.2.11: 如果有文档，使用LLM生成问题；否则使用默认问题
        if os.getenv("ENV") == "development":
            print(f"🔍 DEBUG: sample_docs count: {len(sample_docs)}")
        if sample_docs and len(sample_docs) > 0:
            # 构建上下文
            context = "\n\n".join(sample_docs[:5])  # 最多使用5个文档片段
            
            # 1.2.39: 使用更快的模型 gpt-4o-mini
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
            
            prompts = {
                "zh": """基于以下文档内容，生成3个用户最可能问的常见问题。

要求：
1. 问题必须基于文档内容，确保能从文档中找到明确的答案
2. 问题要具体、实用，不要过于宽泛（避免"介绍"、"说明"等过于宽泛的问题）
3. 每个问题都要确保文档中有足够的信息可以回答
4. 问题应该以问号（？）结尾
5. 只返回问题列表，每行一个问题，不要添加编号、前缀或其他说明文字
6. 问题应该是完整的疑问句，可以直接用于提问

示例格式：
什么是XXX？
如何XXX？
XXX有哪些特点？

文档内容：
{context}

请生成3个常见问题（每行一个问题，以问号结尾）：""",
                "en": """Based on the following document content, generate 3 common questions that users are most likely to ask.

Requirements:
1. Questions must be based on the document content, ensuring clear answers can be found in the documents
2. Questions should be specific and practical, not too broad (avoid questions like "introduce" or "explain" that are too general)
3. Each question must have sufficient information in the documents to answer it
4. Questions should end with a question mark (?)
5. Only return the question list, one question per line, without numbering, prefixes, or other explanatory text
6. Questions should be complete interrogative sentences that can be used directly for asking

Example format:
What is XXX?
How to XXX?
What are the features of XXX?

Document content:
{context}

Please generate 3 common questions (one per line, ending with a question mark):""",
                "ja": """以下の文書内容に基づいて、ユーザーが最も尋ねそうな3つのよくある質問を生成してください。

要件：
1. 質問は文書内容に基づく必要があり、文書から明確な答えを見つけられることを確認してください
2. 質問は具体的で実用的である必要があり、広すぎてはいけません（「紹介」「説明」など、広すぎる質問は避けてください）
3. 各質問には、文書に回答できる十分な情報が必要です
4. 質問は疑問符（？）で終わる必要があります
5. 質問リストのみを返し、各行に1つの質問を、番号、接頭辞、その他の説明を追加せずに返してください
6. 質問は完全な疑問文である必要があり、直接質問に使用できる形式である必要があります

例の形式：
XXXとは何ですか？
XXXはどのようにXXXしますか？
XXXにはどのような特徴がありますか？

文書内容：
{context}

3つのよくある質問を生成してください（各行に1つの質問、疑問符で終わる）："""
            }
            
            prompt_template = prompts.get(language, prompts["zh"])
            prompt = ChatPromptTemplate.from_template(prompt_template)
            
            try:
                if os.getenv("ENV") == "development":
                    print(f"🔍 DEBUG: Generating questions with LLM, context length: {len(context)}")
                # 1.2.24: 移除 cl.make_async，使用 asyncio.to_thread 处理同步调用
                # 1.2.39: asyncio 已在文件顶部导入，无需重复导入
                response = await asyncio.to_thread(llm.invoke, prompt.format(context=context))
                generated_text = response.content.strip()
                if os.getenv("ENV") == "development":
                    print(f"🔍 DEBUG: LLM generated text: {generated_text[:200]}...")
                
                # 解析生成的问题
                questions = []
                # 1.2.11: 改进问题解析逻辑，处理各种格式
                lines = generated_text.split('\n')
                for line in lines:
                    line = line.strip()
                    # 跳过空行
                    if not line:
                        continue
                    # 移除可能的编号（如 "1. ", "1)", "- ", "• " 等）
                    line = re.sub(r'^[\d\.\)\-\s•·]+', '', line)
                    # 移除可能的引号
                    line = line.strip('"\'「」『』')
                    # 确保问题有足够长度且以问号结尾（中文问号或英文问号）
                    if line and len(line) > 5 and (line.endswith('?') or line.endswith('？')):
                        questions.append(line)
                
                # 如果解析后问题不足，尝试其他解析方式
                if len(questions) < 3:
                    # 尝试按句号、问号分割
                    sentences = re.split(r'[。！？\n]', generated_text)
                    for sentence in sentences:
                        sentence = sentence.strip()
                        if sentence and len(sentence) > 5 and (sentence.endswith('?') or sentence.endswith('？')):
                            sentence = re.sub(r'^[\d\.\)\-\s•·]+', '', sentence)
                            sentence = sentence.strip('"\'「」『』')
                            if sentence and sentence not in questions:
                                questions.append(sentence)
                
                if os.getenv("ENV") == "development":
                    print(f"🔍 DEBUG: Parsed {len(questions)} questions: {questions}")
                
                # 1.2.11: 验证每个问题是否有回复（通过快速检索测试）
                # 1.2.39: 优化验证 - 并行处理 + 批量 embedding + 复用连接
                embeddings_model = OpenAIEmbeddings()
                questions_to_validate = questions[:5]  # 1.2.39: 只验证前5个问题
                
                if os.getenv("ENV") == "development":
                    print(f"🔍 DEBUG: Validating {len(questions_to_validate)} questions in parallel")
                
                # 1.2.39: 批量生成所有问题的 embeddings（一次 API 调用）
                question_vectors = await asyncio.to_thread(
                    embeddings_model.embed_documents, 
                    questions_to_validate
                )
                
                # 1.2.39: 复用数据库连接（只创建一次）
                vx = None
                collection = None
                if USE_PGVECTOR and DATABASE_URL:
                    try:
                        vx = vecs.create_client(DATABASE_URL)
                        collection = vx.get_collection(name=collection_name)
                    except Exception as e:
                        logger.warning(f"Failed to initialize pgvector connection: {e}")
                
                # 定义验证单个问题的函数
                async def validate_single_question(question, query_vector):
                    """验证单个问题是否能找到有效文档"""
                    try:
                        found_doc = False
                        use_chroma_fallback = False
                        
                        if collection:
                            try:
                                results = collection.query(
                                    data=query_vector,
                                    limit=1,
                                    include_value=False,
                                    include_metadata=True
                                )
                                if results and len(results) > 0:
                                    record = results[0]
                                    if len(record) > 1 and record[1]:
                                        text = record[1].get("text", "")
                                        metadata = record[1].get("metadata", {}) if isinstance(record[1], dict) else {}
                                        is_error = (
                                            'error' in metadata or 
                                            '爬取失败' in text or 
                                            '解析失败' in text or
                                            text.strip().startswith('爬取失败') or
                                            text.strip().startswith('解析失败')
                                        )
                                        if not is_error and text.strip() and len(text.strip()) > 50:
                                            found_doc = True
                                    else:
                                        use_chroma_fallback = True
                                else:
                                    use_chroma_fallback = True
                            except Exception as e:
                                if os.getenv("ENV") == "development":
                                    print(f"⚠️ pgvector validation error for '{question}': {e}")
                                use_chroma_fallback = True
                        else:
                            use_chroma_fallback = True
                        
                        # Chroma 回退
                        if use_chroma_fallback and not found_doc:
                            try:
                                vectorstore = Chroma(
                                    persist_directory=f"./chroma_db/{collection_name}",
                                    embedding_function=OpenAIEmbeddings()
                                )
                                retriever = vectorstore.as_retriever(search_kwargs={"k": 1})
                                docs = await asyncio.to_thread(retriever.invoke, question)
                                if docs and len(docs) > 0:
                                    doc = docs[0]
                                    is_error = (
                                        'error' in doc.metadata or 
                                        '爬取失败' in doc.page_content or 
                                        '解析失败' in doc.page_content
                                    )
                                    if not is_error and doc.page_content and len(doc.page_content.strip()) > 50:
                                        found_doc = True
                            except Exception as e:
                                if os.getenv("ENV") == "development":
                                    print(f"⚠️ Chroma validation error for '{question}': {e}")
                        
                        if found_doc:
                            if os.getenv("ENV") == "development":
                                print(f"✅ DEBUG: Question validated: {question}")
                            return question
                        else:
                            if os.getenv("ENV") == "development":
                                print(f"⚠️ DEBUG: Question has no valid reply: {question}")
                            return None
                    except Exception as e:
                        if os.getenv("ENV") == "development":
                            print(f"⚠️ Failed to validate question '{question}': {e}")
                        return None
                
                # 1.2.39: 并行验证所有问题
                validation_results = await asyncio.gather(*[
                    validate_single_question(q, qv) 
                    for q, qv in zip(questions_to_validate, question_vectors)
                ])
                
                # 过滤出有效问题
                valid_questions = [q for q in validation_results if q is not None]
                
                if len(valid_questions) >= 3:
                    # 1.2.39: 保存到缓存
                    result_questions = valid_questions[:3]
                    frequent_questions_cache[cache_key] = result_questions
                    logger.info(f"Cached {len(result_questions)} questions for kb_token: {kb_token}, language: {language}")
                    
                    return JSONResponse(
                        status_code=200,
                        content={
                            "status": "success",
                            "questions": result_questions
                        },
                        headers={"Content-Type": "application/json"}
                    )
                elif len(valid_questions) > 0:
                    # 如果只有部分问题有效，补充默认问题
                    default_questions = {
                        "zh": ["您能介绍一下这个项目吗？", "有哪些常见问题？", "如何使用这个系统？"],
                        "en": ["Can you introduce this project?", "What are the common questions?", "How to use this system?"],
                        "ja": ["このプロジェクトについて紹介していただけますか？", "よくある質問は何ですか？", "このシステムの使い方は？"]
                    }
                    default_qs = default_questions.get(language, default_questions["zh"])
                    # 合并有效问题和默认问题
                    final_questions = valid_questions + [q for q in default_qs if q not in valid_questions]
                    result_questions = final_questions[:3]
                    
                    # 1.2.39: 保存到缓存（即使是部分生成+默认问题的组合）
                    frequent_questions_cache[cache_key] = result_questions
                    logger.info(f"Cached {len(result_questions)} questions (partial) for kb_token: {kb_token}, language: {language}")
                    
                    return JSONResponse(
                        status_code=200,
                        content={
                            "status": "success",
                            "questions": result_questions
                        },
                        headers={"Content-Type": "application/json"}
                    )
            except Exception as e:
                logger.error(f"Failed to generate questions with LLM (collection: {collection_name}, language: {language}): {str(e)}", exc_info=True)
                if os.getenv("ENV") == "development":
                    print(f"⚠️ Failed to generate questions: {e}")
                    import traceback
                    traceback.print_exc()
                # 生成失败时，继续执行下面的代码返回默认问题
        
        # 如果没有文档或生成失败，返回默认问题
        logger.warning(f"Returning default questions for kb_token: {kb_token}, reason: no documents or generation failed (docs_count: {len(sample_docs) if 'sample_docs' in locals() else 0})")
        if os.getenv("ENV") == "development":
            print(f"⚠️ DEBUG: No documents or generation failed, using default questions")
        default_questions = {
            "zh": [
                "您能介绍一下这个项目吗？",
                "有哪些常见问题？",
                "如何使用这个系统？"
            ],
            "en": [
                "Can you introduce this project?",
                "What are the common questions?",
                "How to use this system?"
            ],
            "ja": [
                "このプロジェクトについて紹介していただけますか？",
                "よくある質問は何ですか？",
                "このシステムの使い方は？"
            ]
        }
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "questions": default_questions.get(language, default_questions["zh"])
            },
            headers={"Content-Type": "application/json"}
        )
    except Exception as e:
        # 1.2.36: 记录完整的错误信息，包括堆栈跟踪（生产环境也会记录）
        logger.error(f"Frequent questions API error: {str(e)}", exc_info=True)
        if os.getenv("ENV") == "development":
            print(f"❌ Frequent questions API error: {e}")
            import traceback
            traceback.print_exc()
        # 出错时返回默认问题，确保总是返回JSON响应
        try:
            # 尝试从请求中获取语言参数
            try:
                data = await request.json()
                language = data.get("language", "zh")
            except:
                language = request.query_params.get("language", "zh")
            if language not in ["zh", "en", "ja"]:
                language = "zh"
        except:
            language = "zh"
        
        logger.warning(f"Returning default questions due to exception for language: {language}")
        default_questions = {
            "zh": ["您能介绍一下这个项目吗？", "有哪些常见问题？", "如何使用这个系统？"],
            "en": ["Can you introduce this project?", "What are the common questions?", "How to use this system?"],
            "ja": ["このプロジェクトについて紹介していただけますか？", "よくある質問は何ですか？", "このシステムの使い方は？"]
        }
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "questions": default_questions.get(language, default_questions["zh"])
            },
            headers={"Content-Type": "application/json"}
        )

# 1.2.24: 以下 Chainlit 相关代码已被流式 /api/chat/stream 替代
# 保留注释以便参考原有实现
"""
# 1.2.23: 已替代 - 以下代码使用 Chainlit 框架实现面向用户的聊天
# 1.2.24: 现在使用 React 前端 + /api/chat/stream 实现流式聊天
# 1.1.0: 存储当前会话的状态
@cl.on_chat_start
async def start():
    # 1.1.2: 从 URL 参数获取 kb_id (share_token)
    # 格式: http://localhost:8000/?kb_id=xxx
    # 1.1.17: 尝试从 http_referer 获取 kb_id
    from urllib.parse import urlparse, parse_qs

    kb_id = None

    # 1.1.17: 从 http_referer 获取 kb_id
    http_referer = cl.user_session.get("http_referer")
    if os.getenv("ENV") == "development":
        print(f"🔍 DEBUG on_chat_start called")
        client_type = cl.user_session.get("client_type")
        session_id = cl.user_session.get("id")
        print(f"🔍 DEBUG: http_referer = {http_referer}")
        print(f"🔍 DEBUG: client_type = {client_type}")
        print(f"🔍 DEBUG: session_id = {session_id}")

    if http_referer:
        try:
            parsed_url = urlparse(http_referer)
            query_params = parse_qs(parsed_url.query)
            kb_id = query_params.get("kb_id", [None])[0]
            if os.getenv("ENV") == "development":
                print(f"🔍 DEBUG: parsed kb_id = {kb_id} from http_referer")
        except Exception as e:
            if os.getenv("ENV") == "development":
                print(f"⚠️ Failed to parse http_referer: {e}")
            kb_id = None
    
    if kb_id:
        # 1.1.2: 公开访问模式 - 从 Supabase 获取项目的 vector_collection
        collection_name = None  # 初始化为 None，确保后续验证生效
        
        if supabase:
            try:
                # 1.2.0: 查询 knowledge_bases 表，获取 vector_collection 和 chat_config
                result = supabase.table("knowledge_bases")\
                    .select("vector_collection, name, chat_config")\
                    .eq("share_token", kb_id)\
                    .single()\
                    .execute()
                
                if result.data:
                    vector_collection = result.data.get("vector_collection")
                    # 1.1.15: 验证 vector_collection 是否有效
                    if vector_collection and isinstance(vector_collection, str) and vector_collection.strip():
                        collection_name = vector_collection.strip()
                        project_name = result.data.get("name", "项目")
                        
                        # 1.2.0: 读取聊天配置
                        chat_config = result.data.get("chat_config", {})
                        
                        # 1.2.0: 检测语言（从请求头或默认中文）
                        language = "zh"  # TODO: 从请求头检测语言
                        
                        # 1.2.0: 获取欢迎语和头像
                        welcome_message = ""
                        avatar_url = ""
                        recommended_questions = []
                        
                        if chat_config:
                            welcome_message = chat_config.get("welcome_message", {}).get(language, "")
                            avatar_url = chat_config.get("avatar_url", "")
                            recommended_questions = chat_config.get("recommended_questions", {}).get(language, [])
                        
                        # 1.2.0: 如果没有配置欢迎语，使用默认欢迎语
                        if not welcome_message:
                            welcome_message = f"欢迎访问 {project_name} 的知识库！您可以询问与该项目相关的任何问题。"
                        
                        # 1.2.0: 发送欢迎语（带头像）
                        if avatar_url:
                            # 1.2.24: 设置动态头像
                            await cl.Avatar(name="Assistant", url=avatar_url).send()
                            # Chainlit支持通过author参数传递头像URL
                            await cl.Message(content=welcome_message, author="Assistant").send()
                        else:
                            await cl.Message(content=welcome_message, author="Assistant").send()
                        
                        # 1.2.0: 如果未配置推荐问题，获取高频问题
                        if not recommended_questions:
                            # 调用高频问题API（或直接使用默认问题）
                            default_questions = {
                                "zh": [
                                    "您能介绍一下这个项目吗？",
                                    "有哪些常见问题？",
                                    "如何使用这个系统？"
                                ],
                                "en": [
                                    "Can you introduce this project?",
                                    "What are the common questions?",
                                    "How to use this system?"
                                ],
                                "ja": [
                                    "このプロジェクトについて紹介していただけますか？",
                                    "よくある質問は何ですか？",
                                    "このシステムの使い方は？"
                                ]
                            }
                            recommended_questions = default_questions.get(language, default_questions["zh"])
                        
                        # 1.2.0: 发送推荐问题（使用ActionButton）
                        if recommended_questions and len(recommended_questions) > 0:
                            actions = []
                            for question in recommended_questions[:3]:
                                actions.append(
                                    cl.Action(name=question, value=question, label=question)
                                )
                            if actions:
                                await cl.Message(content="", actions=actions, author="Assistant").send()
                    else:
                        # 1.2.1: 如果 vector_collection 为空，使用 kb_id 作为后备，但仍发送欢迎语
                        if os.getenv("ENV") == "development":
                            print(f"⚠️ vector_collection is empty for kb_id {kb_id}, using kb_id as collection_name")
                        collection_name = kb_id
                        # 1.2.1: 即使 vector_collection 为空，也发送默认欢迎语
                        default_welcome = "欢迎访问知识库！您可以询问与该项目相关的任何问题。"
                        await cl.Message(content=default_welcome, author="Assistant").send()
                else:
                    # 1.2.1: 数据库查询返回空结果，发送默认欢迎语
                    if os.getenv("ENV") == "development":
                        print(f"⚠️ No data found for kb_id {kb_id}, using kb_id as collection_name")
                    collection_name = kb_id
                    # 1.2.1: 即使查询失败，也发送默认欢迎语
                    default_welcome = "欢迎访问知识库！您可以询问与该项目相关的任何问题。"
                    await cl.Message(content=default_welcome, author="Assistant").send()
            except Exception as e:
                # 1.2.1: 数据库查询失败，发送默认欢迎语
                if os.getenv("ENV") == "development":
                    print(f"⚠️ Failed to fetch vector_collection: {e}, using kb_id as collection_name")
                collection_name = kb_id
                # 1.2.1: 即使查询失败，也发送默认欢迎语
                default_welcome = "欢迎访问知识库！您可以询问与该项目相关的任何问题。"
                await cl.Message(content=default_welcome, author="Assistant").send()
        else:
            # 1.2.1: Supabase 客户端未初始化，使用 kb_id，发送默认欢迎语
            if os.getenv("ENV") == "development":
                print(f"⚠️ Supabase client not available, using kb_id as collection_name")
            collection_name = kb_id
            # 1.2.1: 即使 Supabase 未初始化，也发送默认欢迎语
            default_welcome = "欢迎访问知识库！您可以询问与该项目相关的任何问题。"
            await cl.Message(content=default_welcome, author="Assistant").send()
        
        # 1.1.15: 最终验证 - 确保 collection_name 有效（必须是非空字符串）
        if not collection_name or not isinstance(collection_name, str):
            collection_name = kb_id  # 使用 kb_id 作为最后的保障
        
        # 1.1.15: 清理并验证格式（去除首尾空格）
        collection_name = collection_name.strip()
        
        if not collection_name:
            # 1.1.15: 如果 kb_id 本身也是空的，生成一个临时值
            collection_name = f"temp_{uuid.uuid4().hex[:8]}"
            if os.getenv("ENV") == "development":
                print(f"⚠️ Both kb_id and collection_name are empty, using temporary: {collection_name}")
        
        # 1.1.15: 调试输出
        if os.getenv("ENV") == "development":
            print(f"✅ Setting collection_name to: {collection_name} for kb_id: {kb_id}")
        
        cl.user_session.set("collection_name", collection_name)
        cl.user_session.set("messages", [])
        cl.user_session.set("is_public", True)
    else:
        # 1.1.1: 设置初始状态（用于测试模式）
        cl.user_session.set("messages", [])
        cl.user_session.set("collection_name", str(uuid.uuid4()))
        cl.user_session.set("is_public", False)
        
        # 1.1.0: 引导用户上传文件
        files = None
        while files is None:
            files = await cl.AskFileMessage(
                content="欢迎使用 YUIChat！请上传 PDF、Word 或 Excel 文件开始分析。",
                accept=[
                    "application/pdf", 
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                ],
                max_size_mb=20,
                timeout=180,
            ).send()

        file = files[0]
        
        msg = cl.Message(content=f"正在处理文件: {file.name}...")
        await msg.send()

        initial_state = {
            "file_path": file.path,
            "collection_name": cl.user_session.get("collection_name"),
            "messages": [HumanMessage(content="你好")], # 占位符
            "docs": [],
            "splits": [],
            "context": "",
            "answer": ""
        }
        
        result = await cl.make_async(workflow_app.invoke)(initial_state)
        cl.user_session.set("messages", result.get("messages", []))
        await msg.update(content=f"文件 {file.name} 处理完成！现在你可以开始提问了。")

@cl.on_message
async def main(message: cl.Message):
    from urllib.parse import urlparse, parse_qs

    messages = cl.user_session.get("messages", [])
    collection_name = cl.user_session.get("collection_name")

    # 1.1.17: 如果 collection_name 无效，尝试从 http_referer 动态获取
    # 这是为了解决 Chainlit 2.3.0 在 on_chat_start 中的 ContextVar 问题
    if not collection_name or not isinstance(collection_name, str) or not collection_name.strip():
        http_referer = cl.user_session.get("http_referer")
        if os.getenv("ENV") == "development":
            print(f"🔍 on_message: collection_name invalid, trying http_referer: {http_referer}")

        kb_id = None
        if http_referer:
            try:
                parsed_url = urlparse(http_referer)
                query_params = parse_qs(parsed_url.query)
                kb_id = query_params.get("kb_id", [None])[0]
                if os.getenv("ENV") == "development":
                    print(f"🔍 on_message: parsed kb_id = {kb_id}")
            except Exception as e:
                if os.getenv("ENV") == "development":
                    print(f"⚠️ on_message: Failed to parse http_referer: {e}")

        # 1.1.17: 如果获取到 kb_id，从 Supabase 获取 collection_name
        if kb_id and supabase:
            try:
                result = supabase.table("knowledge_bases")\
                    .select("vector_collection")\
                    .eq("share_token", kb_id)\
                    .single()\
                    .execute()

                if result.data and result.data.get("vector_collection"):
                    collection_name = result.data.get("vector_collection").strip()
                    cl.user_session.set("collection_name", collection_name)
                    cl.user_session.set("messages", [])
                    if os.getenv("ENV") == "development":
                        print(f"✅ on_message: Set collection_name = {collection_name}")
            except Exception as e:
                if os.getenv("ENV") == "development":
                    print(f"⚠️ on_message: Failed to fetch collection_name: {e}")

    # 1.1.15: 再次验证 collection_name 是否有效
    if not collection_name or not isinstance(collection_name, str) or not collection_name.strip():
        error_msg = "知识库配置错误：collection_name 无效。请重新访问知识库链接。"
        if os.getenv("ENV") == "development":
            print(f"❌ Chainlit message error: collection_name is invalid: {collection_name}")
        await cl.Message(content=error_msg, author="Assistant").send()
        return
    
    # 1.1.0: 添加用户新消息
    messages.append(HumanMessage(content=message.content))
    
    # 1.1.0: 准备状态
    state = {
        "messages": messages,
        "collection_name": collection_name.strip(),
        "file_path": "",
        "docs": [],
        "splits": [],
        "context": "",
        "answer": ""
    }
    
    # 1.1.2: 调用工作流并显示流式输出（Chainlit 默认不支持 LangGraph 原生流式，这里简单处理）
    # 实际应用中可以使用 astream_events
    try:
        result = await cl.make_async(workflow_app.invoke)(state)
        
        answer = result.get("answer", "抱歉，我无法回答这个问题。")
        messages = result.get("messages", [])
        
        cl.user_session.set("messages", messages)
        
        # 1.2.23: 显式设置 author 以匹配 public/avatars/assistant.png
        await cl.Message(content=answer, author="Assistant").send()
    except ValueError as e:
        # 1.1.15: 处理 collection_name 验证错误
        error_msg = f"知识库配置错误：{str(e)}。请重新访问知识库链接。"
        if os.getenv("ENV") == "development":
            print(f"❌ Chainlit workflow error: {e}")
        await cl.Message(content=error_msg, author="Assistant").send()
    except Exception as e:
        error_msg = f"对话过程中发生错误：{str(e)}"
        if os.getenv("ENV") == "development":
            print(f"❌ Chainlit unexpected error: {e}")
        await cl.Message(content=error_msg, author="Assistant").send()
"""  # 1.2.24: Chainlit 代码块结束

# 1.2.24: 使用 uvicorn 启动 FastAPI 应用
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        fastapi_app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
