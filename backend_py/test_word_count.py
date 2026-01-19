"""
1.1.15: 测试字数统计功能
用于验证字数统计是否正确保存到数据库
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def test_word_count():
    """测试字数统计"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Supabase 配置缺失")
        return
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # 查询最近的文档
    result = supabase.table("documents")\
        .select("id, filename, file_type, status, processing_metadata, created_at")\
        .order("created_at", desc=True)\
        .limit(5)\
        .execute()
    
    if not result.data:
        print("❌ 没有找到文档")
        return
    
    print("\n" + "="*80)
    print("📊 文档字数统计测试")
    print("="*80)
    
    for doc in result.data:
        doc_id = doc.get("id")
        filename = doc.get("filename")
        file_type = doc.get("file_type")
        status = doc.get("status")
        metadata = doc.get("processing_metadata") or {}
        word_count = metadata.get("word_count")
        created_at = doc.get("created_at")
        
        print(f"\n📄 文档: {filename}")
        print(f"   ID: {doc_id}")
        print(f"   类型: {file_type}")
        print(f"   状态: {status}")
        print(f"   字数: {word_count if word_count else '❌ 未统计'}")
        print(f"   创建时间: {created_at}")
        print(f"   processing_metadata: {metadata}")
        
        if not word_count:
            print(f"   ⚠️  该文档没有字数统计")
    
    print("\n" + "="*80)
    
    # 测试更新字数
    if result.data:
        test_doc = result.data[0]
        test_doc_id = test_doc.get("id")
        test_metadata = test_doc.get("processing_metadata") or {}
        test_metadata["word_count"] = 12345
        
        print(f"\n🧪 测试更新文档 {test_doc_id} 的字数...")
        update_result = supabase.table("documents")\
            .update({
                "processing_metadata": test_metadata
            })\
            .eq("id", test_doc_id)\
            .execute()
        
        if update_result.data:
            print(f"✅ 更新成功！")
            updated_doc = update_result.data[0]
            updated_word_count = (updated_doc.get("processing_metadata") or {}).get("word_count")
            print(f"   更新后的字数: {updated_word_count}")
        else:
            print(f"❌ 更新失败")

if __name__ == "__main__":
    test_word_count()
