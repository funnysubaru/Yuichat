#!/usr/bin/env python3
"""
1.1.11: 测试检索功能（模拟聊天节点的检索逻辑）
"""

import os
import sys
from dotenv import load_dotenv
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

if len(sys.argv) < 3:
    print("用法: python test_chat_retrieval.py <collection_name> <query>")
    print("示例: python test_chat_retrieval.py kb_1768659550718_e4z5lg '什么是Arya？'")
    sys.exit(1)

collection_name = sys.argv[1]
query = sys.argv[2]

print("=" * 60)
print("测试检索功能（模拟chat_node）")
print("=" * 60)
print(f"集合: {collection_name}")
print(f"查询: {query}\n")

os.environ["ENV"] = "development"

try:
    # 1. 检索文档（模拟chat_node的检索逻辑）
    print("1. 检索相关文档...")
    vectorstore = Chroma(
        persist_directory=f"./chroma_db/{collection_name}",
        embedding_function=OpenAIEmbeddings()
    )
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
    relevant_docs = retriever.invoke(query)
    
    print(f"✅ 检索到 {len(relevant_docs)} 个相关文档片段:\n")
    for i, doc in enumerate(relevant_docs):
        source = doc.metadata.get('source', 'unknown')
        is_error = 'error' in doc.metadata or '爬取失败' in doc.page_content
        print(f"  [{i+1}] 来源: {source}")
        print(f"      状态: {'❌ 错误文档' if is_error else '✅ 正常文档'}")
        print(f"      内容长度: {len(doc.page_content)} 字符")
        print(f"      内容预览: {doc.page_content[:150]}...")
        print()
    
    # 2. 构建上下文
    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    print(f"2. 构建上下文...")
    print(f"   上下文总长度: {len(context)} 字符\n")
    
    if not context.strip():
        print("❌ 警告: 上下文为空，无法回答问题")
        sys.exit(1)
    
    # 3. 模拟LLM调用
    print("3. 调用LLM生成回答...\n")
    messages = [HumanMessage(content=query)]
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "你是一个专业的知识库助手。请根据以下提供的上下文回答用户的问题。如果上下文中没有相关信息，请诚实地说你不知道。 \n\n上下文:\n{context}"),
        MessagesPlaceholder(variable_name="messages"),
    ])
    
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    chain = prompt | llm
    
    response = chain.invoke({"context": context, "messages": messages})
    
    print("=" * 60)
    print("LLM回答:")
    print("=" * 60)
    print(response.content)
    print("\n" + "=" * 60)
    
except FileNotFoundError as e:
    print(f"❌ 错误: 找不到向量集合目录 './chroma_db/{collection_name}'")
    print("   请确认 collection_name 是否正确")
    sys.exit(1)
except Exception as e:
    print(f"❌ 错误: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
