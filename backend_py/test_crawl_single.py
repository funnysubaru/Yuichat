#!/usr/bin/env python3
"""
1.1.11: 测试单个URL爬取（用于验证修复）
"""

import os
import sys
import asyncio
from dotenv import load_dotenv
from crawler import crawl_urls

load_dotenv()

# 测试URL
test_urls = [
    "https://markdown.lovejade.cn/"
]

if len(sys.argv) > 1:
    test_urls = sys.argv[1:]

print("=" * 60)
print("测试URL爬取功能")
print("=" * 60)
print(f"测试URL: {test_urls}\n")

# 设置开发环境以查看详细日志
os.environ["ENV"] = "development"

async def test():
    try:
        docs = await crawl_urls(test_urls)
        
        print(f"\n✅ 爬取完成: {len(docs)} 个文档\n")
        
        for i, doc in enumerate(docs, 1):
            print(f"文档 {i}:")
            print(f"  来源: {doc.metadata.get('source', 'unknown')}")
            print(f"  标题: {doc.metadata.get('title', 'unknown')}")
            print(f"  内容长度: {len(doc.page_content)} 字符")
            
            if 'error' in doc.metadata:
                print(f"  ❌ 错误: {doc.metadata.get('error')}")
            else:
                print(f"  ✅ 成功")
                print(f"  内容预览: {doc.page_content[:200]}...")
            print()
        
        return docs
    except Exception as e:
        print(f"\n❌ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return []

if __name__ == "__main__":
    docs = asyncio.run(test())
    sys.exit(0 if docs and not any(d.metadata.get('error') for d in docs) else 1)
