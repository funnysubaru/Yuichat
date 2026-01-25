"""
1.3.15: 问答语义缓存功能测试
测试内容：
1. 缓存保存功能测试
2. 缓存命中功能测试（语义相似度匹配）
3. 缓存未命中场景测试
4. 缓存清除功能测试
5. 性能测试（验证缓存命中时的响应时间 <500ms）
"""

import os
import sys
import asyncio
import time
import json
from typing import List, Dict, Any, Optional
from datetime import datetime

# 添加 backend_py 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend_py'))

# 设置环境变量
os.environ.setdefault("ENV", "development")

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend_py', '.env.local'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend_py', '.env'))


def print_header(title: str):
    """打印测试标题"""
    print("\n" + "=" * 70)
    print(f" {title}")
    print("=" * 70)


def print_subheader(title: str):
    """打印子标题"""
    print(f"\n  --- {title} ---")


def print_result(success: bool, message: str, details: str = None):
    """打印测试结果"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"  {status}: {message}")
    if details:
        print(f"       {details}")


def print_timing(label: str, elapsed_ms: float, target_ms: float = None):
    """打印耗时信息"""
    if target_ms:
        status = "✅" if elapsed_ms < target_ms else "⚠️"
        print(f"  {status} {label}: {elapsed_ms:.2f}ms (目标: <{target_ms}ms)")
    else:
        print(f"  ⏱️ {label}: {elapsed_ms:.2f}ms")


class TestQACache:
    """问答语义缓存测试类"""
    
    def __init__(self):
        self.results = []
        self.test_kb_id = None
        self.test_cache_ids = []
    
    async def setup(self):
        """测试前准备：获取一个测试用的知识库 ID"""
        print_subheader("测试环境准备")
        
        try:
            from supabase import create_client
            
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            
            if not supabase_url or not supabase_key:
                print("  ⚠️ Supabase 环境变量未配置")
                return False
            
            supabase = create_client(supabase_url, supabase_key)
            
            # 获取第一个知识库作为测试用
            result = supabase.table("knowledge_bases").select("id, name").limit(1).execute()
            
            if result.data and len(result.data) > 0:
                self.test_kb_id = result.data[0]["id"]
                kb_name = result.data[0]["name"]
                print(f"  ✅ 使用测试知识库: {kb_name} (ID: {self.test_kb_id[:8]}...)")
                return True
            else:
                print("  ⚠️ 没有找到可用的知识库")
                return False
                
        except Exception as e:
            print(f"  ❌ 测试环境准备失败: {e}")
            return False
    
    async def cleanup(self):
        """测试后清理：删除测试创建的缓存"""
        print_subheader("测试清理")
        
        if not self.test_cache_ids:
            print("  ℹ️ 无需清理")
            return
        
        try:
            from supabase import create_client
            
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            supabase = create_client(supabase_url, supabase_key)
            
            for cache_id in self.test_cache_ids:
                try:
                    supabase.table("qa_cache").delete().eq("id", cache_id).execute()
                except:
                    pass
            
            print(f"  ✅ 已清理 {len(self.test_cache_ids)} 条测试缓存")
            
        except Exception as e:
            print(f"  ⚠️ 清理失败: {e}")
    
    async def test_cache_save(self) -> bool:
        """测试 1: 缓存保存功能"""
        print_header("测试 1: 缓存保存功能")
        
        if not self.test_kb_id:
            print_result(False, "无法测试：没有可用的知识库")
            return False
        
        try:
            from qa_cache import save_to_cache
            
            # 测试数据
            test_question = f"测试问题_{datetime.now().strftime('%H%M%S')}_这是一个测试缓存的问题？"
            test_answer = "这是测试答案，用于验证缓存保存功能是否正常工作。"
            test_context = "测试上下文内容"
            test_citations = [{"source": "test.txt", "content": "测试引用"}]
            test_follow_up = [{"content": "后续问题1？"}, {"content": "后续问题2？"}]
            
            # 记录开始时间
            start_time = time.time()
            
            # 保存到缓存
            cache_id = await save_to_cache(
                question=test_question,
                knowledge_base_id=self.test_kb_id,
                answer=test_answer,
                context=test_context,
                citations=test_citations,
                follow_up=test_follow_up,
                language="zh"
            )
            
            elapsed_ms = (time.time() - start_time) * 1000
            
            if cache_id:
                self.test_cache_ids.append(cache_id)
                print_result(True, f"缓存保存成功", f"Cache ID: {cache_id[:8]}...")
                print_timing("保存耗时", elapsed_ms)
                return True
            else:
                print_result(False, "缓存保存返回 None")
                return False
                
        except Exception as e:
            print_result(False, f"缓存保存异常: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def test_cache_hit(self) -> bool:
        """测试 2: 缓存命中功能（相同问题）"""
        print_header("测试 2: 缓存命中功能（相同问题）")
        
        if not self.test_kb_id:
            print_result(False, "无法测试：没有可用的知识库")
            return False
        
        try:
            from qa_cache import save_to_cache, check_cache
            
            # 先保存一个测试问题
            test_question = f"缓存命中测试问题_{datetime.now().strftime('%H%M%S')}？"
            test_answer = "这是缓存命中测试的答案。"
            
            cache_id = await save_to_cache(
                question=test_question,
                knowledge_base_id=self.test_kb_id,
                answer=test_answer,
                language="zh"
            )
            
            if cache_id:
                self.test_cache_ids.append(cache_id)
            
            # 等待一小段时间确保数据已写入
            await asyncio.sleep(0.5)
            
            # 使用完全相同的问题查询缓存
            start_time = time.time()
            cached_result = await check_cache(
                question=test_question,
                knowledge_base_id=self.test_kb_id,
                language="zh"
            )
            elapsed_ms = (time.time() - start_time) * 1000
            
            if cached_result:
                print_result(True, "缓存命中成功")
                print_timing("查询耗时", elapsed_ms, target_ms=500)
                
                # 验证返回内容
                if cached_result.get("answer") == test_answer:
                    print_result(True, "答案内容匹配")
                else:
                    print_result(False, f"答案内容不匹配: 期望 '{test_answer}', 实际 '{cached_result.get('answer')}'")
                
                return True
            else:
                print_result(False, "缓存未命中（应该命中）")
                return False
                
        except Exception as e:
            print_result(False, f"缓存命中测试异常: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def test_cache_semantic_match(self) -> bool:
        """测试 3: 语义相似度匹配"""
        print_header("测试 3: 语义相似度匹配")
        
        if not self.test_kb_id:
            print_result(False, "无法测试：没有可用的知识库")
            return False
        
        try:
            from qa_cache import save_to_cache, check_cache
            
            # 保存原始问题
            original_question = "如何使用这个系统进行文档管理？"
            test_answer = "您可以通过上传PDF、Word等文档来使用本系统进行文档管理。"
            
            cache_id = await save_to_cache(
                question=original_question,
                knowledge_base_id=self.test_kb_id,
                answer=test_answer,
                language="zh"
            )
            
            if cache_id:
                self.test_cache_ids.append(cache_id)
            
            await asyncio.sleep(0.5)
            
            # 使用语义相似的问题查询
            similar_questions = [
                "怎么用这个系统管理文档？",  # 相似问题1
                "这个系统的文档管理功能怎么使用？",  # 相似问题2
            ]
            
            hit_count = 0
            for similar_q in similar_questions:
                start_time = time.time()
                cached_result = await check_cache(
                    question=similar_q,
                    knowledge_base_id=self.test_kb_id,
                    language="zh",
                    similarity_threshold=0.90  # 稍微降低阈值以测试语义匹配
                )
                elapsed_ms = (time.time() - start_time) * 1000
                
                if cached_result:
                    print_result(True, f"语义匹配成功: '{similar_q[:20]}...'")
                    print_timing("查询耗时", elapsed_ms, target_ms=500)
                    hit_count += 1
                else:
                    print_result(False, f"语义匹配失败: '{similar_q[:20]}...'")
            
            # 至少一个相似问题应该命中
            return hit_count > 0
                
        except Exception as e:
            print_result(False, f"语义匹配测试异常: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def test_cache_miss(self) -> bool:
        """测试 4: 缓存未命中场景"""
        print_header("测试 4: 缓存未命中场景")
        
        if not self.test_kb_id:
            print_result(False, "无法测试：没有可用的知识库")
            return False
        
        try:
            from qa_cache import check_cache
            
            # 使用一个完全不相关的问题
            unrelated_question = f"完全不相关的问题_{datetime.now().strftime('%H%M%S%f')}_随机字符串ABC123？"
            
            start_time = time.time()
            cached_result = await check_cache(
                question=unrelated_question,
                knowledge_base_id=self.test_kb_id,
                language="zh"
            )
            elapsed_ms = (time.time() - start_time) * 1000
            
            if cached_result is None:
                print_result(True, "缓存正确未命中")
                print_timing("查询耗时", elapsed_ms)
                return True
            else:
                print_result(False, f"缓存错误命中：不相关的问题不应该命中缓存")
                return False
                
        except Exception as e:
            print_result(False, f"缓存未命中测试异常: {e}")
            return False
    
    async def test_cache_clear(self) -> bool:
        """测试 5: 缓存清除功能"""
        print_header("测试 5: 缓存清除功能")
        
        if not self.test_kb_id:
            print_result(False, "无法测试：没有可用的知识库")
            return False
        
        try:
            from qa_cache import save_to_cache, check_cache, clear_cache_by_kb
            
            # 先保存一个测试问题
            test_question = f"缓存清除测试问题_{datetime.now().strftime('%H%M%S')}？"
            test_answer = "这是缓存清除测试的答案。"
            
            cache_id = await save_to_cache(
                question=test_question,
                knowledge_base_id=self.test_kb_id,
                answer=test_answer,
                language="zh"
            )
            
            await asyncio.sleep(0.5)
            
            # 确认缓存存在
            cached = await check_cache(test_question, self.test_kb_id, "zh")
            if not cached:
                print_result(False, "缓存保存后无法查询到")
                return False
            
            print_result(True, "缓存已保存并可查询")
            
            # 清除该知识库的所有缓存
            cleared_count = await clear_cache_by_kb(self.test_kb_id)
            print(f"  ℹ️ 清除了 {cleared_count} 条缓存")
            
            # 确认缓存已被清除
            cached_after = await check_cache(test_question, self.test_kb_id, "zh")
            if cached_after is None:
                print_result(True, "缓存已成功清除")
                # 清除成功后，不需要在 cleanup 中再清除
                if cache_id in self.test_cache_ids:
                    self.test_cache_ids.remove(cache_id)
                return True
            else:
                print_result(False, "缓存清除后仍能查询到")
                return False
                
        except Exception as e:
            print_result(False, f"缓存清除测试异常: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def test_performance(self) -> bool:
        """测试 6: 性能测试（目标 <500ms）"""
        print_header("测试 6: 性能测试（目标 <500ms）")
        
        if not self.test_kb_id:
            print_result(False, "无法测试：没有可用的知识库")
            return False
        
        try:
            from qa_cache import save_to_cache, check_cache
            
            # 保存一个测试问题
            test_question = f"性能测试问题_{datetime.now().strftime('%H%M%S')}？"
            test_answer = "这是性能测试的答案，内容较长以模拟真实场景。" * 10
            
            cache_id = await save_to_cache(
                question=test_question,
                knowledge_base_id=self.test_kb_id,
                answer=test_answer,
                language="zh"
            )
            
            if cache_id:
                self.test_cache_ids.append(cache_id)
            
            await asyncio.sleep(0.5)
            
            # 多次查询测试性能
            times = []
            num_tests = 5
            
            for i in range(num_tests):
                start_time = time.time()
                cached_result = await check_cache(
                    question=test_question,
                    knowledge_base_id=self.test_kb_id,
                    language="zh"
                )
                elapsed_ms = (time.time() - start_time) * 1000
                times.append(elapsed_ms)
            
            avg_time = sum(times) / len(times)
            min_time = min(times)
            max_time = max(times)
            
            print(f"\n  📊 性能统计 ({num_tests} 次查询):")
            print(f"     平均耗时: {avg_time:.2f}ms")
            print(f"     最小耗时: {min_time:.2f}ms")
            print(f"     最大耗时: {max_time:.2f}ms")
            
            # 目标：平均耗时 <500ms
            target_ms = 500
            if avg_time < target_ms:
                print_result(True, f"性能达标：平均 {avg_time:.2f}ms < {target_ms}ms")
                return True
            else:
                print_result(False, f"性能未达标：平均 {avg_time:.2f}ms >= {target_ms}ms")
                return False
                
        except Exception as e:
            print_result(False, f"性能测试异常: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "=" * 70)
        print(" 1.3.15: 问答语义缓存功能测试")
        print(" 测试时间:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        print("=" * 70)
        
        # 环境准备
        if not await self.setup():
            print("\n❌ 测试环境准备失败，无法继续测试")
            return
        
        # 运行测试
        tests = [
            ("缓存保存功能", self.test_cache_save),
            ("缓存命中功能", self.test_cache_hit),
            ("语义相似度匹配", self.test_cache_semantic_match),
            ("缓存未命中场景", self.test_cache_miss),
            ("缓存清除功能", self.test_cache_clear),
            ("性能测试", self.test_performance),
        ]
        
        passed = 0
        failed = 0
        
        for name, test_func in tests:
            try:
                result = await test_func()
                if result:
                    passed += 1
                else:
                    failed += 1
                self.results.append((name, result))
            except Exception as e:
                print(f"\n❌ 测试 '{name}' 发生异常: {e}")
                failed += 1
                self.results.append((name, False))
        
        # 清理
        await self.cleanup()
        
        # 打印总结
        print("\n" + "=" * 70)
        print(" 测试结果总结")
        print("=" * 70)
        
        for name, result in self.results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {status}: {name}")
        
        print("\n" + "-" * 70)
        total = passed + failed
        print(f"  总计: {total} 个测试")
        print(f"  通过: {passed} 个")
        print(f"  失败: {failed} 个")
        print(f"  通过率: {(passed/total*100):.1f}%")
        print("=" * 70 + "\n")
        
        return failed == 0


async def main():
    """主函数"""
    tester = TestQACache()
    success = await tester.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
