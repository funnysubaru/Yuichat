"""
1.3.10: Follow-up 推荐问题相关性优化测试
测试内容：
1. 查询扩展功能测试
2. 二次相似度验证测试
3. 推荐问题相关性测试
"""

import os
import sys
import asyncio
import json
from typing import List, Dict, Any

# 添加 backend_py 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend_py'))

# 设置环境变量
os.environ.setdefault("ENV", "development")

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend_py', '.env.local'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend_py', '.env'))


def print_header(title: str):
    """打印测试标题"""
    print("\n" + "=" * 60)
    print(f" {title}")
    print("=" * 60)


def print_result(success: bool, message: str):
    """打印测试结果"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"  {status}: {message}")


class TestFollowUpOptimization:
    """Follow-up 优化测试类"""
    
    def __init__(self):
        self.results = []
    
    async def test_query_expander(self):
        """测试查询扩展功能"""
        print_header("测试 1: 查询扩展功能")
        
        try:
            from query_expander import expand_query, generate_synonyms, generate_related_queries
            
            test_query = "AI摄像头的全球部署效果如何？"
            
            # 测试同义词扩展
            print(f"\n  原始查询: {test_query}")
            synonyms = await generate_synonyms(test_query, "zh")
            print(f"  同义词扩展 ({len(synonyms)} 个):")
            for s in synonyms:
                print(f"    - {s}")
            
            success_synonyms = len(synonyms) > 0
            print_result(success_synonyms, f"同义词扩展返回 {len(synonyms)} 个结果")
            
            # 测试相关问题扩展
            related = await generate_related_queries(test_query, "zh")
            print(f"  相关问题扩展 ({len(related)} 个):")
            for r in related:
                print(f"    - {r}")
            
            success_related = len(related) > 0
            print_result(success_related, f"相关问题扩展返回 {len(related)} 个结果")
            
            # 测试综合扩展
            expanded = await expand_query(test_query, "zh")
            print(f"  综合扩展 ({len(expanded)} 个):")
            for e in expanded:
                print(f"    - {e}")
            
            success_expand = len(expanded) > 1  # 应该包含原始查询 + 扩展
            print_result(success_expand, f"综合扩展返回 {len(expanded)} 个查询")
            
            self.results.append(("查询扩展功能", success_synonyms and success_related and success_expand))
            return success_synonyms and success_related and success_expand
            
        except Exception as e:
            print(f"  ❌ 测试失败: {e}")
            self.results.append(("查询扩展功能", False))
            return False
    
    async def test_cosine_similarity(self):
        """测试余弦相似度计算"""
        print_header("测试 2: 余弦相似度计算")
        
        try:
            from question_retriever import cosine_similarity
            import numpy as np
            
            # 测试相同向量
            vec1 = [1.0, 0.0, 0.0]
            vec2 = [1.0, 0.0, 0.0]
            sim_same = cosine_similarity(vec1, vec2)
            success_same = abs(sim_same - 1.0) < 0.001
            print_result(success_same, f"相同向量相似度 = {sim_same:.4f} (期望 1.0)")
            
            # 测试正交向量
            vec3 = [0.0, 1.0, 0.0]
            sim_orthogonal = cosine_similarity(vec1, vec3)
            success_orthogonal = abs(sim_orthogonal) < 0.001
            print_result(success_orthogonal, f"正交向量相似度 = {sim_orthogonal:.4f} (期望 0.0)")
            
            # 测试相反向量
            vec4 = [-1.0, 0.0, 0.0]
            sim_opposite = cosine_similarity(vec1, vec4)
            success_opposite = abs(sim_opposite + 1.0) < 0.001
            print_result(success_opposite, f"相反向量相似度 = {sim_opposite:.4f} (期望 -1.0)")
            
            self.results.append(("余弦相似度计算", success_same and success_orthogonal and success_opposite))
            return success_same and success_orthogonal and success_opposite
            
        except Exception as e:
            print(f"  ❌ 测试失败: {e}")
            self.results.append(("余弦相似度计算", False))
            return False
    
    async def test_threshold_configuration(self):
        """测试阈值配置"""
        print_header("测试 3: 阈值配置验证")
        
        try:
            from question_retriever import SIMILARITY_THRESHOLD, COSINE_SIMILARITY_THRESHOLD
            
            # 验证阈值已提高到 0.85
            success_sim = SIMILARITY_THRESHOLD >= 0.85
            print_result(success_sim, f"SIMILARITY_THRESHOLD = {SIMILARITY_THRESHOLD} (期望 >= 0.85)")
            
            success_cosine = COSINE_SIMILARITY_THRESHOLD >= 0.85
            print_result(success_cosine, f"COSINE_SIMILARITY_THRESHOLD = {COSINE_SIMILARITY_THRESHOLD} (期望 >= 0.85)")
            
            self.results.append(("阈值配置验证", success_sim and success_cosine))
            return success_sim and success_cosine
            
        except Exception as e:
            print(f"  ❌ 测试失败: {e}")
            self.results.append(("阈值配置验证", False))
            return False
    
    async def test_filter_function_signature(self):
        """测试筛选函数签名更新"""
        print_header("测试 4: 筛选函数签名验证")
        
        try:
            from question_retriever import filter_follow_up_questions
            import inspect
            
            sig = inspect.signature(filter_follow_up_questions)
            params = list(sig.parameters.keys())
            
            # 验证新增参数
            required_params = [
                "user_query_embedding",
                "question_embeddings",
                "cosine_threshold"
            ]
            
            all_present = True
            for param in required_params:
                present = param in params
                print_result(present, f"参数 '{param}' 存在")
                all_present = all_present and present
            
            self.results.append(("筛选函数签名验证", all_present))
            return all_present
            
        except Exception as e:
            print(f"  ❌ 测试失败: {e}")
            self.results.append(("筛选函数签名验证", False))
            return False
    
    async def test_retrieve_function_signature(self):
        """测试检索函数签名更新"""
        print_header("测试 5: 检索函数签名验证")
        
        try:
            from question_retriever import retrieve_similar_questions
            import inspect
            
            sig = inspect.signature(retrieve_similar_questions)
            params = list(sig.parameters.keys())
            
            # 验证新增参数
            present = "return_query_embedding" in params
            print_result(present, "参数 'return_query_embedding' 存在")
            
            self.results.append(("检索函数签名验证", present))
            return present
            
        except Exception as e:
            print(f"  ❌ 测试失败: {e}")
            self.results.append(("检索函数签名验证", False))
            return False
    
    async def test_integration_query_expansion(self):
        """集成测试：查询扩展 + 推荐问题检索"""
        print_header("测试 6: 集成测试 - 查询扩展流程")
        
        try:
            from question_retriever import get_recommended_questions, QUERY_EXPANSION_ENABLED
            
            print(f"  QUERY_EXPANSION_ENABLED = {QUERY_EXPANSION_ENABLED}")
            
            # 测试用查询
            test_query = "这个产品有什么功能？"
            test_collection = "test_collection_not_exist"  # 使用不存在的集合测试
            
            # 调用函数（应该不会报错，只是返回空结果）
            results = await get_recommended_questions(
                query=test_query,
                collection_name=test_collection,
                language="zh",
                limit=3
            )
            
            # 验证函数正常执行
            success = isinstance(results, list)
            print_result(success, f"函数执行成功，返回类型: {type(results).__name__}")
            print(f"  返回结果数量: {len(results)}")
            
            self.results.append(("集成测试 - 查询扩展流程", success))
            return success
            
        except Exception as e:
            print(f"  ❌ 测试失败: {e}")
            import traceback
            traceback.print_exc()
            self.results.append(("集成测试 - 查询扩展流程", False))
            return False
    
    def print_summary(self):
        """打印测试总结"""
        print_header("测试总结")
        
        passed = sum(1 for _, success in self.results if success)
        total = len(self.results)
        
        for name, success in self.results:
            status = "✅" if success else "❌"
            print(f"  {status} {name}")
        
        print(f"\n  总计: {passed}/{total} 通过")
        
        if passed == total:
            print("\n  🎉 所有测试通过！")
        else:
            print(f"\n  ⚠️ {total - passed} 个测试失败")
        
        return passed == total


async def main():
    """运行所有测试"""
    print("\n" + "=" * 60)
    print(" 1.3.10 Follow-up 推荐问题相关性优化测试")
    print("=" * 60)
    
    tester = TestFollowUpOptimization()
    
    # 运行所有测试
    await tester.test_cosine_similarity()
    await tester.test_threshold_configuration()
    await tester.test_filter_function_signature()
    await tester.test_retrieve_function_signature()
    await tester.test_query_expander()
    await tester.test_integration_query_expansion()
    
    # 打印总结
    success = tester.print_summary()
    
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
