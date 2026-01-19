#!/usr/bin/env python3
"""
1.1.11: URL爬虫诊断工具
用于检查URL爬取后的数据是否正确存储到向量库
"""

import os
import sys
from dotenv import load_dotenv
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

load_dotenv()

# 检查参数
if len(sys.argv) < 2:
    print("用法: python test_url_crawl_diagnosis.py <collection_name>")
    print("示例: python test_url_crawl_diagnosis.py kb_1734567890_abc123")
    sys.exit(1)

collection_name = sys.argv[1]

print(f"🔍 诊断向量集合: {collection_name}\n")

# 1. 检查Chroma数据库
print("=" * 60)
print("1. 检查Chroma向量数据库")
print("=" * 60)

try:
    vectorstore = Chroma(
        persist_directory=f"./chroma_db/{collection_name}",
        embedding_function=OpenAIEmbeddings()
    )
    
    # 获取所有文档
    collection = vectorstore._collection
    all_docs = collection.get(include=['metadatas', 'documents'])
    
    print(f"✅ 向量集合存在")
    ids = all_docs.get('ids', []) or []
    metadatas = all_docs.get('metadatas', []) or []
    documents = all_docs.get('documents', []) or []
    
    print(f"   文档数量: {len(ids)}")
    print(f"   元数据数量: {len(metadatas)}")
    print(f"   内容数量: {len(documents)}")
    
    if len(ids) == 0:
        print("\n❌ 警告: 向量集合为空，没有存储任何文档！")
        print("   可能的原因:")
        print("   1. URL爬取失败")
        print("   2. 文档切片失败")
        print("   3. 向量存储失败")
        sys.exit(1)
    
    # 显示前几个文档的元数据
    print(f"\n前5个文档的元数据:")
    for i, (doc_id, metadata, text) in enumerate(zip(
        ids[:5],
        metadatas[:5],
        documents[:5]
    )):
        print(f"\n文档 {i+1} (ID: {doc_id}):")
        print(f"  元数据: {metadata}")
        print(f"  内容预览: {text[:200]}..." if len(text) > 200 else f"  内容: {text}")
    
    # 2. 测试检索
    print("\n" + "=" * 60)
    print("2. 测试向量检索")
    print("=" * 60)
    
    test_queries = [
        "markdown",
        "Markdown语法",
        "如何编写",
        "文档"
    ]
    
    for query in test_queries:
        print(f"\n查询: '{query}'")
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
        docs = retriever.invoke(query)
        
        if docs:
            print(f"  找到 {len(docs)} 个相关文档:")
            for i, doc in enumerate(docs):
                print(f"  [{i+1}] 来源: {doc.metadata.get('source', 'unknown')}")
                print(f"      内容: {doc.page_content[:150]}...")
        else:
            print(f"  ❌ 未找到相关文档")
    
    # 3. 统计URL来源
    print("\n" + "=" * 60)
    print("3. 统计文档来源")
    print("=" * 60)
    
    url_count = 0
    file_count = 0
    unknown_count = 0
    
    for metadata in metadatas:
        if not metadata:
            unknown_count += 1
            continue
        source = metadata.get('source', '')
        if source.startswith('http://') or source.startswith('https://'):
            url_count += 1
        elif source.endswith(('.pdf', '.docx', '.xlsx', '.txt')):
            file_count += 1
        else:
            unknown_count += 1
    
    print(f"  URL来源: {url_count} 个文档")
    print(f"  文件来源: {file_count} 个文档")
    print(f"  未知来源: {unknown_count} 个文档")
    
    # 4. 检查是否有错误文档
    print("\n" + "=" * 60)
    print("4. 检查错误文档")
    print("=" * 60)
    
    error_docs = []
    for metadata, text in zip(metadatas, documents):
        if not metadata or not text:
            continue
        metadata_str = str(metadata)
        if 'error' in metadata_str or '解析失败' in text or '爬取失败' in text:
            error_docs.append({
                'metadata': metadata,
                'text': text[:200] if text else ''
            })
    
    if error_docs:
        print(f"❌ 发现 {len(error_docs)} 个错误文档:")
        for i, doc in enumerate(error_docs):
            print(f"\n  错误文档 {i+1}:")
            print(f"    元数据: {doc['metadata']}")
            print(f"    内容: {doc['text']}")
    else:
        print("✅ 未发现错误文档")
    
    print("\n" + "=" * 60)
    print("✅ 诊断完成")
    print("=" * 60)
    
except FileNotFoundError:
    print(f"❌ 错误: 找不到向量集合目录 './chroma_db/{collection_name}'")
    print("   可能的原因:")
    print("   1. collection_name 不正确")
    print("   2. 数据尚未存储")
    sys.exit(1)
except Exception as e:
    print(f"❌ 错误: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
