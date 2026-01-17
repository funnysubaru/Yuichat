import chainlit as cl
from langchain_core.messages import HumanMessage, AIMessage
from workflow import app as workflow_app
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
import os
import uuid
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# 1.1.2: 初始化 Supabase 客户端（用于查询 vector_collection）
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 1.1.2: 获取 FastAPI 实例以添加自定义路由
from chainlit.server import app as fastapi_app

@fastapi_app.post("/api/process-file")
async def process_file(request: Request):
    """
    1.1.2: 供管理端调用的 API，用于触发文件处理流程
    collection_name 应该是项目的 vector_collection
    """
    try:
        data = await request.json()
        file_path = data.get("file_path")
        collection_name = data.get("collection_name")
        
        if not file_path or not collection_name:
            raise HTTPException(status_code=400, detail="Missing file_path or collection_name")
            
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
        await cl.make_async(workflow_app.invoke)(initial_state)
        
        return JSONResponse(content={
            "status": "success",
            "collection_name": collection_name,
            "message": "File processed and indexed"
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

# 1.1.10: 添加聊天 API 端点
@fastapi_app.post("/api/chat")
async def chat(request: Request):
    """
    1.1.10: 供管理端调用的聊天 API，用于测试对话功能
    支持基于知识库文档的问答
    """
    try:
        data = await request.json()
        query = data.get("query")
        kb_token = data.get("kb_id")  # share_token 或 vector_collection
        conversation_history = data.get("conversation_history", [])
        
        if not query:
            raise HTTPException(status_code=400, detail="Missing query")
        
        if not kb_token:
            raise HTTPException(status_code=400, detail="Missing kb_id")
        
        # 1.1.10: 从 Supabase 获取 vector_collection
        collection_name = kb_token  # 默认值
        
        if supabase:
            try:
                # 尝试通过 share_token 查询
                result = supabase.table("knowledge_bases")\
                    .select("vector_collection")\
                    .eq("share_token", kb_token)\
                    .single()\
                    .execute()
                
                if result.data:
                    collection_name = result.data.get("vector_collection", kb_token)
            except Exception as e:
                # 1.1.10: 如果查询失败，可能 kb_token 本身就是 vector_collection
                if os.getenv("ENV") == "development":
                    print(f"Failed to fetch vector_collection, using kb_token directly: {e}")
        
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
        result = await cl.make_async(workflow_app.invoke)(state)
        
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

# 1.1.0: 存储当前会话的状态
@cl.on_chat_start
async def start():
    # 1.1.2: 从 URL 参数获取 kb_id (share_token)
    # 格式: http://localhost:8000/?kb_id=xxx
    # 1.1.3: 安全获取 http_request，避免在非 HTTP 上下文中出错
    http_request = cl.user_session.get("http_request")
    kb_id = None
    if http_request:
        query_params = http_request.query_params
        kb_id = query_params.get("kb_id")
    
    if kb_id:
        # 1.1.2: 公开访问模式 - 从 Supabase 获取项目的 vector_collection
        collection_name = kb_id  # 默认值
        
        if supabase:
            try:
                # 查询 knowledge_bases 表，根据 share_token 获取 vector_collection
                result = supabase.table("knowledge_bases")\
                    .select("vector_collection, name")\
                    .eq("share_token", kb_id)\
                    .single()\
                    .execute()
                
                if result.data:
                    collection_name = result.data.get("vector_collection", kb_id)
                    project_name = result.data.get("name", "项目")
                    await cl.Message(content=f"欢迎访问 {project_name} 的知识库！您可以询问与该项目相关的任何问题。").send()
            except Exception as e:
                print(f"Failed to fetch vector_collection: {e}")
                await cl.Message(content="正在加载知识库...").send()
        
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
    messages = cl.user_session.get("messages", [])
    collection_name = cl.user_session.get("collection_name")
    
    # 1.1.0: 添加用户新消息
    messages.append(HumanMessage(content=message.content))
    
    # 1.1.0: 准备状态
    state = {
        "messages": messages,
        "collection_name": collection_name,
        "file_path": "",
        "docs": [],
        "splits": [],
        "context": "",
        "answer": ""
    }
    
    # 1.1.2: 调用工作流并显示流式输出（Chainlit 默认不支持 LangGraph 原生流式，这里简单处理）
    # 实际应用中可以使用 astream_events
    result = await cl.make_async(workflow_app.invoke)(state)
    
    answer = result.get("answer", "抱歉，我无法回答这个问题。")
    messages = result.get("messages", [])
    
    cl.user_session.set("messages", messages)
    
    await cl.Message(content=answer).send()

if __name__ == "__main__":
    pass
