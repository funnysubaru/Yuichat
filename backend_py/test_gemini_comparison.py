"""
1.3.37: Gemini vs GPT 对比测试脚本
测试Gemini和GPT在问答质量和响应速度上的差异
"""

import os
import time
import asyncio
import json
from typing import List, Dict, Any
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
load_dotenv()

# 测试问题集（针对法人税法知识库）
TEST_QUESTIONS = [
    {
        "question": "法人税の納税義務者は誰ですか？",
        "language": "ja",
        "description": "日语法律问题"
    },
    {
        "question": "内国法人の所得金額はどのように計算されますか？",
        "language": "ja", 
        "description": "日语计算问题"
    },
    {
        "question": "什么是法人税？",
        "language": "zh",
        "description": "中文基础问题"
    },
    {
        "question": "税法有什么规定？",
        "language": "zh",
        "description": "中文概述问题"
    },
    {
        "question": "退職年金等積立金とは何ですか？",
        "language": "ja",
        "description": "日语专业术语"
    },
]

# 知识库配置
KB_ID = "f870ee08-86b7-4911-932e-7b28f2727276"

async def test_with_provider(provider: str, question: str, language: str) -> Dict[str, Any]:
    """使用指定的LLM提供商测试问题"""
    import httpx
    
    start_time = time.time()
    
    # 设置环境变量
    os.environ["LLM_PROVIDER"] = provider
    
    # 调用本地API
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                "http://localhost:8000/api/chat/stream",
                json={
                    "query": question,
                    "kb_id": KB_ID,
                    "language": language,
                    "conversation_history": []
                }
            )
            
            elapsed = time.time() - start_time
            
            # 解析SSE响应
            answer = ""
            for line in response.text.split("\n"):
                if line.startswith("data: ") and not line.startswith("data: [DONE]"):
                    try:
                        data = json.loads(line[6:])
                        if data.get("answer"):
                            answer = data["answer"]
                        elif data.get("chunk"):
                            answer += data["chunk"]
                    except:
                        pass
            
            return {
                "success": True,
                "provider": provider,
                "elapsed": elapsed,
                "answer": answer[:500] if answer else "",
                "answer_length": len(answer)
            }
        except Exception as e:
            return {
                "success": False,
                "provider": provider,
                "elapsed": time.time() - start_time,
                "error": str(e)
            }


async def run_comparison_test():
    """运行对比测试"""
    print("=" * 80)
    print("🧪 Gemini vs GPT 对比测试")
    print("=" * 80)
    print()
    
    results = []
    
    for i, test_case in enumerate(TEST_QUESTIONS, 1):
        print(f"\n📝 测试 {i}/{len(TEST_QUESTIONS)}: {test_case['description']}")
        print(f"   问题: {test_case['question'][:50]}...")
        print()
        
        # 测试 OpenAI
        print("   🔷 测试 OpenAI GPT-4o-mini...")
        gpt_result = await test_with_provider("openai", test_case["question"], test_case["language"])
        print(f"      耗时: {gpt_result['elapsed']:.2f}秒")
        if gpt_result["success"]:
            print(f"      回答长度: {gpt_result['answer_length']} 字符")
        else:
            print(f"      错误: {gpt_result.get('error', 'Unknown')}")
        
        # 测试 Gemini
        print("   🔶 测试 Gemini 1.5 Flash...")
        gemini_result = await test_with_provider("gemini", test_case["question"], test_case["language"])
        print(f"      耗时: {gemini_result['elapsed']:.2f}秒")
        if gemini_result["success"]:
            print(f"      回答长度: {gemini_result['answer_length']} 字符")
        else:
            print(f"      错误: {gemini_result.get('error', 'Unknown')}")
        
        # 速度对比
        if gpt_result["success"] and gemini_result["success"]:
            speed_diff = gpt_result["elapsed"] - gemini_result["elapsed"]
            faster = "Gemini" if speed_diff > 0 else "GPT"
            print(f"   ⚡ {faster} 快 {abs(speed_diff):.2f} 秒")
        
        results.append({
            "question": test_case["question"],
            "description": test_case["description"],
            "gpt": gpt_result,
            "gemini": gemini_result
        })
    
    # 汇总统计
    print("\n" + "=" * 80)
    print("📊 测试结果汇总")
    print("=" * 80)
    
    gpt_times = [r["gpt"]["elapsed"] for r in results if r["gpt"]["success"]]
    gemini_times = [r["gemini"]["elapsed"] for r in results if r["gemini"]["success"]]
    
    if gpt_times:
        print(f"\n🔷 OpenAI GPT-4o-mini:")
        print(f"   平均耗时: {sum(gpt_times)/len(gpt_times):.2f} 秒")
        print(f"   最快: {min(gpt_times):.2f} 秒")
        print(f"   最慢: {max(gpt_times):.2f} 秒")
    
    if gemini_times:
        print(f"\n🔶 Google Gemini 1.5 Flash:")
        print(f"   平均耗时: {sum(gemini_times)/len(gemini_times):.2f} 秒")
        print(f"   最快: {min(gemini_times):.2f} 秒")
        print(f"   最慢: {max(gemini_times):.2f} 秒")
    
    if gpt_times and gemini_times:
        avg_diff = (sum(gpt_times)/len(gpt_times)) - (sum(gemini_times)/len(gemini_times))
        faster = "Gemini" if avg_diff > 0 else "GPT"
        print(f"\n✨ 结论: {faster} 平均快 {abs(avg_diff):.2f} 秒")
    
    # 保存详细结果
    with open("gemini_comparison_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("\n📄 详细结果已保存到: gemini_comparison_results.json")
    
    # 打印回答对比
    print("\n" + "=" * 80)
    print("📝 回答质量对比（前200字符）")
    print("=" * 80)
    
    for i, r in enumerate(results, 1):
        print(f"\n--- 问题 {i}: {r['description']} ---")
        print(f"问题: {r['question']}")
        if r["gpt"]["success"]:
            print(f"\n🔷 GPT回答:\n{r['gpt']['answer'][:200]}...")
        if r["gemini"]["success"]:
            print(f"\n🔶 Gemini回答:\n{r['gemini']['answer'][:200]}...")


if __name__ == "__main__":
    print("⚠️ 请确保本地后端正在运行 (python app.py)")
    print("⚠️ 请确保已设置 GOOGLE_API_KEY 环境变量")
    print()
    
    # 检查环境变量
    if not os.getenv("GOOGLE_API_KEY"):
        print("❌ 错误: 请设置 GOOGLE_API_KEY 环境变量")
        print("   获取方式: https://makersuite.google.com/app/apikey")
        exit(1)
    
    asyncio.run(run_comparison_test())
