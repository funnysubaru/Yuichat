#!/usr/bin/env python3
"""
1.2.39: 高频问题性能测试脚本
测试优化后的 /api/frequent-questions API 性能
"""
import requests
import time
import json
from dotenv import load_dotenv
import os

# 加载环境变量
load_dotenv('.env.local')
load_dotenv()

# API 配置
API_URL = "http://localhost:8000/api/frequent-questions"

# 从环境变量或命令行获取测试参数
# 你需要提供一个有效的 kb_token (share_token)
TEST_KB_TOKEN = os.getenv("TEST_KB_TOKEN", "your-kb-token-here")
TEST_LANGUAGE = "zh"

def test_frequent_questions():
    """测试高频问题 API 性能"""
    print("=" * 80)
    print("高频问题 API 性能测试")
    print("=" * 80)
    print(f"\nAPI URL: {API_URL}")
    print(f"KB Token: {TEST_KB_TOKEN}")
    print(f"Language: {TEST_LANGUAGE}")
    print("\n" + "=" * 80)
    
    # 第一次请求（无缓存）
    print("\n[测试 1] 首次请求（无缓存）")
    print("-" * 80)
    start_time = time.time()
    
    try:
        response = requests.post(
            API_URL,
            json={
                "kb_id": TEST_KB_TOKEN,
                "language": TEST_LANGUAGE
            },
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        print(f"状态码: {response.status_code}")
        print(f"响应时间: {elapsed_time:.2f} 秒")
        
        if response.status_code == 200:
            data = response.json()
            print(f"状态: {data.get('status')}")
            print(f"是否命中缓存: {data.get('cached', False)}")
            print(f"返回问题数: {len(data.get('questions', []))}")
            print(f"\n返回的问题:")
            for i, q in enumerate(data.get('questions', []), 1):
                print(f"  {i}. {q}")
        else:
            print(f"错误: {response.text}")
    except Exception as e:
        print(f"请求失败: {e}")
        return False
    
    # 等待1秒
    time.sleep(1)
    
    # 第二次请求（应该命中缓存）
    print("\n" + "=" * 80)
    print("[测试 2] 第二次请求（应该命中缓存）")
    print("-" * 80)
    start_time = time.time()
    
    try:
        response = requests.post(
            API_URL,
            json={
                "kb_id": TEST_KB_TOKEN,
                "language": TEST_LANGUAGE
            },
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        print(f"状态码: {response.status_code}")
        print(f"响应时间: {elapsed_time:.2f} 秒")
        
        if response.status_code == 200:
            data = response.json()
            print(f"状态: {data.get('status')}")
            print(f"是否命中缓存: {data.get('cached', False)}")
            print(f"返回问题数: {len(data.get('questions', []))}")
            
            if data.get('cached'):
                print(f"\n✅ 缓存命中！响应时间从首次请求大幅降低")
                print(f"   性能提升: {((elapsed_time / (end_time - start_time)) - 1) * 100:.1f}%")
            else:
                print(f"\n⚠️ 未命中缓存")
        else:
            print(f"错误: {response.text}")
    except Exception as e:
        print(f"请求失败: {e}")
        return False
    
    print("\n" + "=" * 80)
    print("测试完成")
    print("=" * 80)
    
    return True

if __name__ == "__main__":
    print("\n提示: 请确保后端服务已启动 (python app.py)")
    print(f"提示: 如需测试，请设置环境变量 TEST_KB_TOKEN 或修改脚本中的 TEST_KB_TOKEN\n")
    
    if TEST_KB_TOKEN == "your-kb-token-here":
        print("⚠️ 警告: 未设置有效的 TEST_KB_TOKEN")
        print("\n使用方法:")
        print("  export TEST_KB_TOKEN=your-actual-kb-token")
        print("  python test_frequent_questions_performance.py")
        print("\n或直接修改脚本中的 TEST_KB_TOKEN 变量\n")
    else:
        test_frequent_questions()
