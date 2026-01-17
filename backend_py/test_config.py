#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1.1.3: 配置测试脚本
测试 Supabase 连接和环境变量配置
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client
from langchain_openai import OpenAIEmbeddings

# 加载环境变量
load_dotenv()

def test_env_variables():
    """测试环境变量是否正确配置"""
    print("=" * 60)
    print("📋 环境变量检查")
    print("=" * 60)
    
    required_vars = [
        "OPENAI_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY"
    ]
    
    optional_vars = [
        "DATABASE_URL",
        "USE_PGVECTOR",
        "ENV"
    ]
    
    all_ok = True
    
    for var in required_vars:
        value = os.getenv(var)
        if value and value != f"your_{var.lower()}_here":
            print(f"✅ {var}: {'*' * 10} (已配置)")
        else:
            print(f"❌ {var}: 未配置")
            all_ok = False
    
    print()
    for var in optional_vars:
        value = os.getenv(var)
        if value:
            if var == "DATABASE_URL":
                print(f"ℹ️  {var}: {'*' * 10} (已配置)")
            else:
                print(f"ℹ️  {var}: {value}")
        else:
            print(f"ℹ️  {var}: 未设置（使用默认值）")
    
    print()
    return all_ok

def test_openai():
    """测试 OpenAI API 连接"""
    print("=" * 60)
    print("🤖 OpenAI API 连接测试")
    print("=" * 60)
    
    try:
        embeddings = OpenAIEmbeddings()
        test_text = "测试连接"
        result = embeddings.embed_query(test_text)
        print(f"✅ OpenAI API 连接成功")
        print(f"   向量维度: {len(result)}")
        return True
    except Exception as e:
        print(f"❌ OpenAI API 连接失败: {e}")
        return False

def test_supabase():
    """测试 Supabase 连接"""
    print()
    print("=" * 60)
    print("🗄️  Supabase 连接测试")
    print("=" * 60)
    
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            print("❌ Supabase 配置缺失")
            return False
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # 测试查询 knowledge_bases 表
        result = supabase.table("knowledge_bases").select("id").limit(1).execute()
        print(f"✅ Supabase 连接成功")
        print(f"   URL: {supabase_url}")
        print(f"   knowledge_bases 表可访问")
        return True
    except Exception as e:
        print(f"❌ Supabase 连接失败: {e}")
        return False

def test_pgvector():
    """测试 Supabase pgvector 连接（可选）"""
    print()
    print("=" * 60)
    print("🔢 Supabase pgvector 连接测试（可选）")
    print("=" * 60)
    
    use_pgvector = os.getenv("USE_PGVECTOR", "false").lower() == "true"
    database_url = os.getenv("DATABASE_URL")
    
    if not use_pgvector:
        print("ℹ️  USE_PGVECTOR=false，跳过 pgvector 测试")
        print("   （本地开发使用 Chroma）")
        return True
    
    if not database_url or database_url == "your_database_url_here":
        print("⚠️  USE_PGVECTOR=true 但 DATABASE_URL 未配置")
        print("   请配置 DATABASE_URL 以使用 pgvector")
        return False
    
    try:
        import vecs
        vx = vecs.create_client(database_url)
        print(f"✅ pgvector 连接成功")
        print(f"   DATABASE_URL 已配置")
        return True
    except ImportError:
        print("⚠️  vecs 库未安装")
        print("   请运行: pip install vecs")
        return False
    except Exception as e:
        print(f"❌ pgvector 连接失败: {e}")
        return False

def main():
    """主测试函数"""
    print()
    print("🚀 YuiChat 配置测试工具 v1.1.3")
    print()
    
    results = []
    
    # 测试环境变量
    results.append(("环境变量", test_env_variables()))
    
    # 测试 OpenAI
    results.append(("OpenAI API", test_openai()))
    
    # 测试 Supabase
    results.append(("Supabase", test_supabase()))
    
    # 测试 pgvector（可选）
    results.append(("pgvector", test_pgvector()))
    
    # 总结
    print()
    print("=" * 60)
    print("📊 测试总结")
    print("=" * 60)
    
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{name}: {status}")
    
    all_passed = all(result for _, result in results)
    
    print()
    if all_passed:
        print("🎉 所有测试通过！可以启动服务了。")
        print()
        print("启动命令:")
        print("  cd backend_py")
        print("  chainlit run app.py -w")
    else:
        print("⚠️  部分测试失败，请检查配置。")
    print()

if __name__ == "__main__":
    main()
