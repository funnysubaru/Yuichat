import os
from typing import List, Dict, Any, TypedDict
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, UnstructuredExcelLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv

load_dotenv()

# 1.1.3: 环境配置 - 支持本地/线上数据库切换
USE_PGVECTOR = os.getenv("USE_PGVECTOR", "false").lower() == "true"
DATABASE_URL = os.getenv("DATABASE_URL")

# 1.1.3: 如果启用 pgvector，导入 vecs 库
if USE_PGVECTOR:
    try:
        import vecs
        from vecs import Collection
        print("✅ 使用 Supabase pgvector 作为向量数据库")
    except ImportError:
        print("⚠️ vecs 库未安装，回退到 Chroma")
        USE_PGVECTOR = False
else:
    print("✅ 使用 Chroma 作为本地向量数据库")

# 定义状态
class GraphState(TypedDict):
    file_path: str
    docs: List[Any]
    splits: List[Any]
    collection_name: str
    messages: List[BaseMessage]
    context: str
    answer: str

# 1.1.0: 文件处理节点
def process_file_node(state: GraphState):
    file_path = state.get('file_path')
    if not file_path:
        print("No file path provided, skipping file processing.")
        return {"docs": state.get('docs', [])}
        
    print(f"Processing file: {file_path}")
    
    docs = []
    if file_path.endswith('.pdf'):
        loader = PyPDFLoader(file_path)
    elif file_path.endswith('.docx') or file_path.endswith('.doc'):
        loader = Docx2txtLoader(file_path)
    elif file_path.endswith('.xlsx') or file_path.endswith('.xls'):
        # 1.1.0: Excel 建议转换为 CSV 或使用专门处理，这里暂时使用通用加载器
        loader = UnstructuredExcelLoader(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_path}")
        
    docs = loader.load()
    return {"docs": docs}

# 1.1.0: 文本切片节点
def split_text_node(state: GraphState):
    docs = state.get('docs', [])
    if not docs:
        print("No documents to split, skipping.")
        return {"splits": state.get('splits', [])}
        
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    splits = text_splitter.split_documents(docs)
    print(f"Split into {len(splits)} chunks")
    return {"splits": splits}

# 1.1.0: 向量存储节点
# 1.1.3: 支持 Chroma 和 pgvector 切换
def embed_and_store_node(state: GraphState):
    splits = state.get('splits', [])
    collection_name = state.get('collection_name', 'default_collection')
    
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
            
            # 准备数据
            records = [
                (f"{collection_name}_{i}", vector, {"text": text, **metadata})
                for i, (vector, text, metadata) in enumerate(zip(vectors, texts, metadatas))
            ]
            
            # 批量插入
            collection.upsert(records=records)
            
            if os.getenv("ENV") == "development":  # 1.1.3: 仅开发环境输出日志
                print(f"✅ Stored {len(splits)} vectors in Supabase pgvector: {collection_name}")
        except Exception as e:
            print(f"❌ pgvector error: {e}, falling back to Chroma")
            # 1.1.3: 出错时回退到 Chroma
            vectorstore = Chroma.from_documents(
                documents=splits,
                embedding=OpenAIEmbeddings(),
                persist_directory=f"./chroma_db/{collection_name}"
            )
    else:
        # 1.1.0: 使用 Chroma 作为本地向量库（本地开发）
        vectorstore = Chroma.from_documents(
            documents=splits,
            embedding=OpenAIEmbeddings(),
            persist_directory=f"./chroma_db/{collection_name}"
        )
        if os.getenv("ENV") == "development":  # 1.1.3: 仅开发环境输出日志
            print(f"✅ Stored {len(splits)} vectors in Chroma: {collection_name}")
    
    return {"collection_name": collection_name}

# 1.1.0: 检索与问答节点 (RAG)
# 1.1.3: 支持 Chroma 和 pgvector 切换
def chat_node(state: GraphState):
    messages = state.get('messages', [])
    if not messages:
        if os.getenv("ENV") == "development":  # 1.1.3: 仅开发环境输出日志
            print("No messages provided, skipping chat node.")
        return {"answer": "", "messages": []}
        
    collection_name = state['collection_name']
    
    # 获取最后一条消息（用户问题）
    user_query = messages[-1].content
    
    # 1.1.3: 根据配置选择向量数据库
    if USE_PGVECTOR and DATABASE_URL:
        # 使用 Supabase pgvector
        try:
            vx = vecs.create_client(DATABASE_URL)
            collection = vx.get_collection(name=collection_name)
            
            # 生成查询向量
            embeddings_model = OpenAIEmbeddings()
            query_vector = embeddings_model.embed_query(user_query)
            
            # 检索相似文档
            results = collection.query(
                query_vector=query_vector,
                limit=4,
                include_value=False,
                include_metadata=True
            )
            
            # 提取文本
            context = "\n\n".join([record[2].get("text", "") for record in results if record[2]])
            
        except Exception as e:
            print(f"❌ pgvector query error: {e}, falling back to Chroma")
            # 1.1.3: 出错时回退到 Chroma
            vectorstore = Chroma(
                persist_directory=f"./chroma_db/{collection_name}",
                embedding_function=OpenAIEmbeddings()
            )
            retriever = vectorstore.as_retriever()
            relevant_docs = retriever.invoke(user_query)
            context = "\n\n".join([doc.page_content for doc in relevant_docs])
    else:
        # 使用 Chroma（本地开发）
        vectorstore = Chroma(
            persist_directory=f"./chroma_db/{collection_name}",
            embedding_function=OpenAIEmbeddings()
        )
        retriever = vectorstore.as_retriever()
        relevant_docs = retriever.invoke(user_query)
        context = "\n\n".join([doc.page_content for doc in relevant_docs])
    
    # 生成回答
    prompt = ChatPromptTemplate.from_messages([
        ("system", "你是一个专业的知识库助手。请根据以下提供的上下文回答用户的问题。如果上下文中没有相关信息，请诚实地说你不知道。 \n\n上下文:\n{context}"),
        MessagesPlaceholder(variable_name="messages"),
    ])
    
    llm = ChatOpenAI(model="gpt-4o", streaming=True)
    chain = prompt | llm
    
    response = chain.invoke({"context": context, "messages": messages})
    
    return {"answer": response.content, "messages": messages + [response]}

# 1.1.10: 条件路由函数 - 判断是否需要处理文件
def should_process_file(state: GraphState) -> str:
    """
    1.1.10: 根据状态决定下一步
    - 如果有 file_path 且有 docs/splits，说明需要处理文件
    - 如果只有 messages，直接进行聊天
    """
    file_path = state.get('file_path')
    messages = state.get('messages', [])
    
    # 如果有文件路径，进行文件处理
    if file_path and file_path.strip():
        return "split_text"
    
    # 否则直接跳到聊天
    return "chat"

# 构建工作流
def create_workflow():
    workflow = StateGraph(GraphState)

    # 添加节点
    workflow.add_node("process_file", process_file_node)
    workflow.add_node("split_text", split_text_node)
    workflow.add_node("embed_and_store", embed_and_store_node)
    workflow.add_node("chat", chat_node)

    # 1.1.10: 设置边 - 支持条件路由
    workflow.set_entry_point("process_file")
    workflow.add_conditional_edges(
        "process_file",
        should_process_file,
        {
            "split_text": "split_text",
            "chat": "chat"
        }
    )
    workflow.add_edge("split_text", "embed_and_store")
    workflow.add_edge("embed_and_store", "chat")
    workflow.add_edge("chat", END)

    return workflow.compile()

# 导出应用
app = create_workflow()
