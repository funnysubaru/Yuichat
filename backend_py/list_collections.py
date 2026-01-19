#!/usr/bin/env python3
"""
1.1.11: 列出所有可用的向量集合
"""

import os
from pathlib import Path

# 列出所有Chroma集合
chroma_dir = Path("./chroma_db")
if chroma_dir.exists():
    print("=" * 60)
    print("Chroma 向量集合列表")
    print("=" * 60)
    
    collections = [d.name for d in chroma_dir.iterdir() if d.is_dir()]
    
    if collections:
        print(f"找到 {len(collections)} 个向量集合:\n")
        for i, collection in enumerate(collections, 1):
            # 检查集合是否有数据
            collection_path = chroma_dir / collection
            sqlite_file = collection_path / "chroma.sqlite3"
            
            if sqlite_file.exists():
                file_size = sqlite_file.stat().st_size
                print(f"{i}. {collection}")
                print(f"   路径: {collection_path}")
                print(f"   数据库大小: {file_size / 1024:.2f} KB")
            else:
                print(f"{i}. {collection} (空集合)")
            
            print()
    else:
        print("❌ 未找到任何向量集合")
        print(f"   目录: {chroma_dir.absolute()}")
else:
    print("❌ Chroma 数据库目录不存在")
    print(f"   预期路径: {chroma_dir.absolute()}")

print("=" * 60)
print("使用方法:")
print("=" * 60)
print("python test_url_crawl_diagnosis.py <collection_name>")
print("\n例如:")
if collections:
    print(f"python test_url_crawl_diagnosis.py {collections[0]}")
