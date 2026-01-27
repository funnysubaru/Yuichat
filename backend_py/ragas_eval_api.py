#!/usr/bin/env python3
"""
1.3.16: RAG 回复精度评估脚本 - 通过 API 调用后端

使用方式:
1. 确保后端服务运行中（本地或生产环境）
2. 运行: python ragas_eval_api.py

评估维度:
- LLM-as-Judge 评分（准确性、完整性、相关性、忠实度、可读性）
- 检索质量（关键词命中率）
- 回答质量（与标准答案对比）
"""

import os
import sys
import json
import asyncio
import aiohttp
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
load_dotenv()

# 导入 LLM
from langchain_openai import ChatOpenAI

# ==================== 配置 ====================

# API 配置
# 本地开发环境
LOCAL_API_URL = "http://localhost:8000/api/chat"
# 生产环境 (GCP Cloud Run)
PROD_API_URL = os.getenv("BACKEND_API_URL", "https://yuichat-backend-xxxxx.a.run.app/api/chat")

# 使用的 API (默认本地)
API_URL = LOCAL_API_URL

# 知识库配置 - 可通过命令行参数切换
# 注意: 本地开发环境和生产环境的 share_token/vector_collection 可能不同
KNOWLEDGE_BASE_CONFIGS = {
    # 本地环境配置
    "法人税法_local": {
        "name": "法人税法",
        "share_token": "85d248a2-14fc-421f-b434-20f1f4ec4617",  # 本地 Supabase
        "vector_collection": "kb_1769244387425_4x3ivr",  # 本地 pgvector
        "kb_id": "2721e73f-81e1-4b61-8b04-739952866d76",
    },
    # 生产环境配置
    "法人税法_prod": {
        "name": "法人税法",
        "share_token": "deb48327-150b-408d-8b0c-56ce7333a987",  # 生产 Supabase
        "vector_collection": "kb_1769060431971_13o0t",  # 生产 pgvector
        "kb_id": "f870ee08-86b7-4911-932e-7b28f2727276",
    },
    "資料概要しらべ": {
        "name": "資料概要しらべ",
        "share_token": "06e922e5-519c-4083-a386-7bb23a6cf3aa",
        "vector_collection": "kb_1769417934844_vwfiu3",
        "kb_id": "3a405ec7-488a-4855-848f-e30473966ea9",
    }
}

# 默认使用本地法人税法配置
KNOWLEDGE_BASE_CONFIG = KNOWLEDGE_BASE_CONFIGS["法人税法_local"]

# ==================== 测试数据集 ====================

# 法人税法评估测试集 (Golden Dataset)
TEST_CASES = [
    {
        "id": "001",
        "question": "特定支配関係とは何ですか？",
        "ground_truth": "特定支配関係とは、一方の法人が他方の法人の発行済株式等の50%を超える数の株式等を直接又は間接に保有する関係などをいいます。",
        "expected_keywords": ["特定支配関係", "50%", "株式", "法人"],
        "language": "ja",
        "difficulty": "medium"
    },
    {
        "id": "002",
        "question": "連結欠損金の適用条件は何ですか？",
        "ground_truth": "連結欠損金を繰越控除するためには、連結法人が継続して連結確定申告書を提出し、欠損金の繰越控除を適用する事業年度の確定申告書等にも欠損金の明細を記載する必要があります。",
        "expected_keywords": ["連結欠損金", "繰越控除", "確定申告"],
        "language": "ja",
        "difficulty": "hard"
    },
    {
        "id": "003",
        "question": "合併後の未処理欠損金はどのように計算されますか？",
        "ground_truth": "合併後の未処理欠損金は、被合併法人の適格合併等前の欠損金額と合併法人の欠損金額を一定の計算式に基づいて算定します。",
        "expected_keywords": ["合併", "欠損金", "被合併法人", "計算"],
        "language": "ja",
        "difficulty": "hard"
    },
    {
        "id": "004",
        "question": "法人税の申告期限はいつですか？",
        "ground_truth": "法人税の申告は、各事業年度終了の日の翌日から2月以内に確定申告書を提出する必要があります。",
        "expected_keywords": ["申告", "期限", "2月", "事業年度"],
        "language": "ja",
        "difficulty": "easy"
    },
    {
        "id": "005",
        "question": "税務署長はどのような決定を下すことができますか？",
        "ground_truth": "税務署長は、納税義務者が申告書を提出しない場合や記載内容に誤りがある場合に、更正・決定を行うことができます。また、青色申告の承認取消しなどの決定も行うことができます。",
        "expected_keywords": ["税務署長", "決定", "更正", "申告"],
        "language": "ja",
        "difficulty": "medium"
    }
]


class APIEvaluator:
    """通过 API 调用的 RAG 评估器"""
    
    def __init__(self, api_url: str, kb_token: str):
        self.api_url = api_url
        self.kb_token = kb_token
        self.judge_llm = ChatOpenAI(model="gpt-4o", temperature=0)
        self.results = []
        
    async def call_rag_api(self, question: str, language: str = "ja") -> Dict:
        """调用 RAG API 获取回答"""
        payload = {
            "query": question,
            "kb_id": self.kb_token,
            "language": language,
            "conversation_history": []
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.api_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "success": True,
                            "answer": data.get("answer", ""),
                            "context": data.get("context", ""),
                            "citations": data.get("citations", []),
                            "follow_up": data.get("follow_up", [])
                        }
                    else:
                        error_text = await response.text()
                        return {
                            "success": False,
                            "error": f"API 错误 {response.status}: {error_text}"
                        }
        except asyncio.TimeoutError:
            return {"success": False, "error": "API 请求超时"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def evaluate_with_llm_judge(
        self, 
        question: str, 
        answer: str, 
        context: str, 
        ground_truth: str
    ) -> Dict:
        """使用 LLM 作为评判者进行评估"""
        
        judge_prompt = f"""你是一位专业的 RAG 系统评估专家。请评价以下问答系统的回答质量。

## 用户问题
{question}

## 系统回答
{answer}

## 检索到的上下文（部分）
{context[:1500] if context else "（无上下文）"}

## 标准答案（参考）
{ground_truth}

## 评分要求
请从以下 5 个维度进行评分（每项 1-5 分）：

1. **准确性 (Accuracy)**: 回答的事实是否正确
   - 5分：完全正确
   - 4分：基本正确，有小误差
   - 3分：部分正确
   - 2分：多处错误
   - 1分：完全错误

2. **完整性 (Completeness)**: 是否回答了问题的所有方面
   - 5分：非常完整
   - 4分：较完整
   - 3分：基本完整
   - 2分：不够完整
   - 1分：非常不完整

3. **相关性 (Relevance)**: 回答是否紧扣问题
   - 5分：高度相关
   - 4分：较相关
   - 3分：部分相关
   - 2分：相关性低
   - 1分：完全不相关

4. **忠实度 (Faithfulness)**: 回答是否基于检索内容，有无幻觉
   - 5分：完全基于上下文，无幻觉
   - 4分：基本基于上下文
   - 3分：部分信息来自上下文
   - 2分：较多幻觉
   - 1分：完全是幻觉

5. **可读性 (Readability)**: 回答是否清晰易懂
   - 5分：非常清晰
   - 4分：较清晰
   - 3分：基本清晰
   - 2分：不够清晰
   - 1分：难以理解

请严格以 JSON 格式返回评分结果：
{{"accuracy": 分数, "completeness": 分数, "relevance": 分数, "faithfulness": 分数, "readability": 分数, "overall_comment": "一句话总结"}}"""

        try:
            response = self.judge_llm.invoke(judge_prompt)
            result_text = response.content
            
            # 提取 JSON
            json_match = re.search(r'\{[^{}]+\}', result_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return {"error": "无法解析评分结果"}
        except Exception as e:
            return {"error": str(e)}
    
    def check_keyword_hits(self, answer: str, context: str, expected_keywords: List[str]) -> Dict:
        """检查关键词命中率"""
        combined = answer + " " + context
        hits = sum(1 for kw in expected_keywords if kw in combined)
        
        return {
            "total_keywords": len(expected_keywords),
            "hits": hits,
            "hit_rate": hits / len(expected_keywords) if expected_keywords else 0,
            "missed_keywords": [kw for kw in expected_keywords if kw not in combined]
        }
    
    async def run_evaluation(self, test_cases: List[Dict]) -> Dict:
        """运行完整评估"""
        print("\n" + "=" * 60)
        print("🔄 开始 RAG 评估")
        print(f"   API: {self.api_url}")
        print(f"   知识库: {KNOWLEDGE_BASE_CONFIG['name']}")
        print(f"   测试用例数: {len(test_cases)}")
        print("=" * 60)
        
        all_scores = {
            "accuracy": [],
            "completeness": [],
            "relevance": [],
            "faithfulness": [],
            "readability": []
        }
        
        keyword_hits = []
        api_success_count = 0
        
        for i, case in enumerate(test_cases):
            print(f"\n[{i+1}/{len(test_cases)}] 评估问题: {case['question'][:40]}...")
            
            # 1. 调用 API
            api_result = await self.call_rag_api(case["question"], case.get("language", "ja"))
            
            if not api_result.get("success"):
                print(f"  ❌ API 调用失败: {api_result.get('error')}")
                continue
            
            api_success_count += 1
            answer = api_result["answer"]
            context = api_result["context"]
            citations = api_result.get("citations", [])
            
            print(f"  ✓ 获取回答: {answer[:50]}...")
            print(f"  ✓ 引用来源: {len(citations)} 个")
            
            # 2. 关键词检查
            kw_result = self.check_keyword_hits(
                answer, context, case.get("expected_keywords", [])
            )
            keyword_hits.append(kw_result["hit_rate"])
            print(f"  ✓ 关键词命中: {kw_result['hits']}/{kw_result['total_keywords']}")
            
            # 3. LLM-as-Judge 评分
            scores = self.evaluate_with_llm_judge(
                question=case["question"],
                answer=answer,
                context=context,
                ground_truth=case["ground_truth"]
            )
            
            if "error" not in scores:
                for key in all_scores.keys():
                    if key in scores:
                        all_scores[key].append(scores[key])
                print(f"  ✓ 评分: 准确性={scores.get('accuracy')}, 忠实度={scores.get('faithfulness')}")
            else:
                print(f"  ⚠️ 评分失败: {scores.get('error')}")
            
            # 保存详细结果
            self.results.append({
                "case_id": case["id"],
                "question": case["question"],
                "answer": answer,
                "context_length": len(context),
                "citations_count": len(citations),
                "keyword_hit_rate": kw_result["hit_rate"],
                "scores": scores
            })
        
        # 计算平均分
        avg_scores = {}
        for key, values in all_scores.items():
            if values:
                avg_scores[key] = sum(values) / len(values)
        
        avg_keyword_hit = sum(keyword_hits) / len(keyword_hits) if keyword_hits else 0
        
        return {
            "avg_scores": avg_scores,
            "avg_keyword_hit_rate": avg_keyword_hit,
            "api_success_rate": api_success_count / len(test_cases),
            "total_cases": len(test_cases),
            "successful_cases": api_success_count
        }
    
    def generate_report(self, eval_result: Dict) -> str:
        """生成评估报告"""
        report = []
        report.append("=" * 60)
        report.append("📋 RAG 回复精度评估报告")
        report.append("=" * 60)
        report.append(f"评估时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"知识库: {KNOWLEDGE_BASE_CONFIG['name']}")
        report.append(f"API: {self.api_url}")
        report.append("")
        
        # API 调用统计
        report.append("📡 API 调用统计")
        report.append("-" * 40)
        report.append(f"  总测试用例: {eval_result['total_cases']}")
        report.append(f"  成功调用: {eval_result['successful_cases']}")
        report.append(f"  成功率: {eval_result['api_success_rate']:.2%}")
        report.append("")
        
        # LLM-as-Judge 评分
        report.append("🤖 LLM-as-Judge 评分 (满分5分)")
        report.append("-" * 40)
        avg_scores = eval_result.get("avg_scores", {})
        for metric, score in avg_scores.items():
            metric_zh = {
                "accuracy": "准确性",
                "completeness": "完整性",
                "relevance": "相关性",
                "faithfulness": "忠实度",
                "readability": "可读性"
            }.get(metric, metric)
            grade = self._score_to_grade_5(score)
            report.append(f"  {metric_zh}: {score:.2f} {grade}")
        
        if avg_scores:
            overall = sum(avg_scores.values()) / len(avg_scores)
            report.append(f"\n  综合评分: {overall:.2f}/5.0 {self._score_to_grade_5(overall)}")
        report.append("")
        
        # 检索质量
        report.append("🔍 检索质量")
        report.append("-" * 40)
        report.append(f"  关键词命中率: {eval_result['avg_keyword_hit_rate']:.2%}")
        report.append("")
        
        # 详细结果
        report.append("📝 各测试用例详情")
        report.append("-" * 40)
        for result in self.results:
            scores = result.get("scores", {})
            if "error" not in scores:
                avg = sum(scores.get(k, 0) for k in ["accuracy", "completeness", "relevance", "faithfulness", "readability"]) / 5
                report.append(f"  [{result['case_id']}] 综合: {avg:.1f}/5 | 关键词: {result['keyword_hit_rate']:.0%}")
            else:
                report.append(f"  [{result['case_id']}] 评分失败")
        report.append("")
        
        # 优化建议
        report.append("💡 优化建议")
        report.append("-" * 40)
        if avg_scores:
            overall = sum(avg_scores.values()) / len(avg_scores)
            if overall < 3:
                report.append("  ⚠️ 系统表现需要改进:")
                report.append("  - 检查知识库文档的内容完整性")
                report.append("  - 优化文档分割策略")
                report.append("  - 调整检索参数")
            elif overall < 4:
                report.append("  💡 可考虑的优化:")
                report.append("  - 增加更多相关文档")
                report.append("  - 优化 Prompt 模板")
            else:
                report.append("  ✅ 系统表现良好!")
        
        report.append("")
        report.append("=" * 60)
        
        return "\n".join(report)
    
    @staticmethod
    def _score_to_grade_5(score: float) -> str:
        """将5分制分数转换为等级"""
        if score >= 4.5:
            return "✅ 优秀"
        elif score >= 4.0:
            return "🟢 良好"
        elif score >= 3.0:
            return "🟡 及格"
        elif score >= 2.0:
            return "🟠 需改进"
        else:
            return "🔴 较差"


async def main():
    """主函数"""
    print("=" * 60)
    print("🎯 法人税法知识库 RAG 精度评估 (API 模式)")
    print("=" * 60)
    
    # 检查 API 是否可用
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--prod", action="store_true", help="使用生产环境 API")
    parser.add_argument("--url", type=str, help="自定义 API URL")
    args = parser.parse_args()
    
    if args.url:
        api_url = args.url
    elif args.prod:
        api_url = PROD_API_URL
    else:
        api_url = LOCAL_API_URL
    
    print(f"使用 API: {api_url}")
    print(f"知识库: {KNOWLEDGE_BASE_CONFIG['name']}")
    print(f"测试用例数: {len(TEST_CASES)}")
    
    # 初始化评估器
    # 使用 share_token，后端会通过它查询对应的 vector_collection
    kb_token = KNOWLEDGE_BASE_CONFIG["share_token"]
    print(f"使用 share_token: {kb_token}")
    print(f"对应 vector_collection: {KNOWLEDGE_BASE_CONFIG.get('vector_collection', 'N/A')}")
    
    evaluator = APIEvaluator(
        api_url=api_url,
        kb_token=kb_token
    )
    
    # 运行评估
    eval_result = await evaluator.run_evaluation(TEST_CASES)
    
    # 生成报告
    report = evaluator.generate_report(eval_result)
    print(report)
    
    # 保存报告
    report_file = f"ragas_api_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"\n📄 报告已保存: {report_file}")
    
    # 保存详细结果为 JSON
    json_file = f"ragas_api_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump({
            "config": KNOWLEDGE_BASE_CONFIG,
            "summary": eval_result,
            "details": evaluator.results
        }, f, ensure_ascii=False, indent=2)
    print(f"📄 详细结果: {json_file}")


if __name__ == "__main__":
    asyncio.run(main())
