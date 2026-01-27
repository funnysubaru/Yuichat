#!/usr/bin/env python3
"""
1.3.16: RAG 回复精度评估脚本 - 使用 RAGAS 框架

评估维度:
- faithfulness (忠实度): 回答是否基于检索到的上下文
- answer_relevancy (回答相关性): 回答是否与问题相关
- context_precision (上下文精确度): 检索到的上下文是否相关
- context_recall (上下文召回率): 是否检索到所有必要信息
"""

import os
import sys
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
load_dotenv()

# 设置环境
os.environ["ENV"] = "development"

# 导入 RAG 相关模块
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# 使用 Supabase pgvector
import vecs
DATABASE_URL = os.getenv("PGVECTOR_DATABASE_URL") or os.getenv("DATABASE_URL")

# RAGAS 评估框架
try:
    from ragas import evaluate
    from ragas.metrics._faithfulness import Faithfulness
    from ragas.metrics._answer_relevance import AnswerRelevancy
    from ragas.metrics._context_precision import ContextPrecision
    from ragas.metrics._context_recall import ContextRecall
    from datasets import Dataset
    RAGAS_AVAILABLE = True
    
    # 初始化指标
    faithfulness = Faithfulness()
    answer_relevancy = AnswerRelevancy()
    context_precision = ContextPrecision()
    context_recall = ContextRecall()
except ImportError as e:
    print(f"⚠️ RAGAS 导入失败: {e}")
    print("请运行: pip install ragas datasets")
    RAGAS_AVAILABLE = False

# ==================== 配置 ====================

# 法人税法知识库配置
# 注：本地 Chroma 使用 share_token 作为集合名，pgvector 使用 vector_collection
KNOWLEDGE_BASE_CONFIG = {
    "name": "法人税法",
    "collection_name": "deb48327-150b-408d-8b0c-56ce7333a987",  # share_token (本地 Chroma)
    "vector_collection": "kb_1769060431971_13o0t",  # pgvector 集合名
    "kb_id": "f870ee08-86b7-4911-932e-7b28f2727276",
}

# 检索配置
RETRIEVE_K = 4  # 检索文档数量

# ==================== 测试数据集 ====================

# 法人税法评估测试集 (Golden Dataset)
# 格式: question, ground_truth (标准答案), 预期检索关键词
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


class RAGEvaluator:
    """RAG 评估器 - 支持本地 Chroma"""
    
    def __init__(self, collection_name: str):
        self.collection_name = collection_name
        self.embeddings = OpenAIEmbeddings()
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0)
        self.vectorstore = None
        self.retriever = None
        
    def initialize(self):
        """初始化向量数据库连接 (本地 Chroma)"""
        try:
            import chromadb
            from chromadb.config import Settings
            
            # 直接使用 chromadb 原生 API
            chroma_path = f"./chroma_db/{self.collection_name}"
            
            # 使用持久化 Chroma 客户端
            self.client = chromadb.PersistentClient(path=chroma_path)
            
            # 获取或创建集合
            collections = self.client.list_collections()
            if collections:
                self.collection = collections[0]
                print(f"✅ 连接本地 Chroma: {self.collection_name}")
                print(f"   文档数量: {self.collection.count()}")
                return True
            else:
                print(f"❌ 集合为空")
                return False
                
        except ImportError:
            print("❌ chromadb 未安装")
            # 使用 LLM 直接评估（无需向量检索）
            print("🔄 回退到 LLM-as-Judge 评估模式")
            return True
        except Exception as e:
            print(f"❌ 连接向量数据库失败: {e}")
            # 回退模式
            print("🔄 回退到 LLM-as-Judge 评估模式")
            return True
    
    def retrieve_context(self, question: str) -> List[str]:
        """检索相关上下文"""
        if not hasattr(self, 'collection') or not self.collection:
            # 无向量库时返回空（将使用纯 LLM 评估）
            return ["[无法检索上下文，将使用 LLM-as-Judge 进行评估]"]
        
        try:
            # 生成查询向量
            query_vector = self.embeddings.embed_query(question)
            
            # 使用 Chroma 进行相似度搜索
            results = self.collection.query(
                query_embeddings=[query_vector],
                n_results=RETRIEVE_K,
                include=["documents", "metadatas"]
            )
            
            # 提取上下文内容
            contexts = []
            if results and "documents" in results and results["documents"]:
                for doc in results["documents"][0]:
                    if doc:
                        contexts.append(doc)
            
            return contexts if contexts else ["[未检索到相关内容]"]
        except Exception as e:
            print(f"检索错误: {e}")
            return ["[检索出错]"]
    
    def generate_answer(self, question: str, contexts: List[str]) -> str:
        """基于上下文生成回答"""
        context_text = "\n\n".join(contexts)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个专业的法人税法知识库助手。请根据以下提供的上下文回答用户的问题。
如果上下文中没有相关信息，请诚实地说你不知道。
请使用日语回答。

上下文:
{context}"""),
            ("human", "{question}")
        ])
        
        chain = prompt | self.llm
        response = chain.invoke({"context": context_text, "question": question})
        return response.content
    
    def run_rag_pipeline(self, test_cases: List[Dict]) -> Dict[str, List]:
        """运行 RAG 管道，生成评估数据"""
        results = {
            "question": [],
            "answer": [],
            "contexts": [],
            "ground_truth": []
        }
        
        print("\n" + "=" * 60)
        print("🔄 运行 RAG 管道")
        print("=" * 60)
        
        for i, case in enumerate(test_cases):
            print(f"\n[{i+1}/{len(test_cases)}] 处理问题: {case['question'][:50]}...")
            
            # 1. 检索上下文
            contexts = self.retrieve_context(case["question"])
            print(f"  ✓ 检索到 {len(contexts)} 个文档片段")
            
            # 2. 生成回答
            answer = self.generate_answer(case["question"], contexts)
            print(f"  ✓ 生成回答: {answer[:50]}...")
            
            # 3. 收集结果
            results["question"].append(case["question"])
            results["answer"].append(answer)
            results["contexts"].append(contexts)
            results["ground_truth"].append(case["ground_truth"])
        
        return results
    
    def evaluate_with_ragas(self, eval_data: Dict[str, List]) -> Dict:
        """使用 RAGAS 进行评估"""
        if not RAGAS_AVAILABLE:
            print("❌ RAGAS 未安装，无法进行评估")
            return {}
        
        print("\n" + "=" * 60)
        print("📊 RAGAS 评估")
        print("=" * 60)
        
        try:
            # 创建 Dataset
            dataset = Dataset.from_dict(eval_data)
            
            # 运行评估
            result = evaluate(
                dataset,
                metrics=[
                    faithfulness,
                    answer_relevancy,
                    context_precision,
                    context_recall,
                ]
            )
            
            # 将 EvaluationResult 转换为字典
            if hasattr(result, 'to_pandas'):
                df = result.to_pandas()
                scores = {}
                for col in ['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall']:
                    if col in df.columns:
                        scores[col] = df[col].mean()
                return scores
            elif hasattr(result, '__dict__'):
                return {k: v for k, v in result.__dict__.items() if isinstance(v, (int, float))}
            else:
                return dict(result) if hasattr(result, '__iter__') else {}
        except Exception as e:
            print(f"RAGAS 评估出错: {e}")
            return {}
    
    def evaluate_retrieval_quality(self, test_cases: List[Dict]) -> Dict:
        """评估检索质量"""
        print("\n" + "=" * 60)
        print("🔍 检索质量评估")
        print("=" * 60)
        
        total_cases = len(test_cases)
        keyword_hits = 0
        retrieved_lengths = []
        
        for case in test_cases:
            contexts = self.retrieve_context(case["question"])
            retrieved_lengths.append(len(contexts))
            
            # 检查关键词命中
            combined_context = " ".join(contexts)
            expected = case.get("expected_keywords", [])
            hits = sum(1 for kw in expected if kw in combined_context)
            
            if expected:
                keyword_hit_rate = hits / len(expected)
                if keyword_hit_rate > 0.5:
                    keyword_hits += 1
        
        return {
            "total_cases": total_cases,
            "keyword_hit_rate": keyword_hits / total_cases if total_cases > 0 else 0,
            "avg_retrieved_docs": sum(retrieved_lengths) / len(retrieved_lengths) if retrieved_lengths else 0
        }
    
    def generate_report(self, ragas_result: Dict, retrieval_result: Dict) -> str:
        """生成评估报告"""
        report = []
        report.append("=" * 60)
        report.append("📋 RAG 回复精度评估报告")
        report.append("=" * 60)
        report.append(f"评估时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"知识库: {KNOWLEDGE_BASE_CONFIG['name']}")
        report.append(f"向量集合: {KNOWLEDGE_BASE_CONFIG['collection_name']}")
        report.append("")
        
        # RAGAS 评估结果
        if ragas_result:
            report.append("📊 RAGAS 评估指标")
            report.append("-" * 40)
            for metric, score in ragas_result.items():
                if isinstance(score, (int, float)):
                    grade = self._score_to_grade(score)
                    report.append(f"  {metric}: {score:.4f} {grade}")
            report.append("")
        
        # 检索质量
        report.append("🔍 检索质量指标")
        report.append("-" * 40)
        report.append(f"  测试用例数: {retrieval_result['total_cases']}")
        report.append(f"  关键词命中率: {retrieval_result['keyword_hit_rate']:.2%}")
        report.append(f"  平均检索文档数: {retrieval_result['avg_retrieved_docs']:.1f}")
        report.append("")
        
        # 总结
        report.append("📝 评估总结")
        report.append("-" * 40)
        if ragas_result:
            avg_score = sum(v for v in ragas_result.values() if isinstance(v, (int, float))) / 4
            overall_grade = self._score_to_grade(avg_score)
            report.append(f"  综合评分: {avg_score:.4f} {overall_grade}")
            
            # 建议
            if avg_score < 0.7:
                report.append("\n  ⚠️ 建议改进:")
                report.append("  - 优化文档分割策略，确保语义完整")
                report.append("  - 增加相关训练数据")
                report.append("  - 调整检索参数 (RETRIEVE_K)")
            elif avg_score < 0.85:
                report.append("\n  💡 可选优化:")
                report.append("  - 考虑使用更好的 embedding 模型")
                report.append("  - 添加查询扩展/重写")
            else:
                report.append("\n  ✅ 系统表现良好!")
        
        report.append("")
        report.append("=" * 60)
        
        return "\n".join(report)
    
    @staticmethod
    def _score_to_grade(score: float) -> str:
        """将分数转换为等级"""
        if score >= 0.9:
            return "✅ 优秀"
        elif score >= 0.8:
            return "🟢 良好"
        elif score >= 0.7:
            return "🟡 及格"
        elif score >= 0.5:
            return "🟠 需改进"
        else:
            return "🔴 较差"


def run_llm_judge_evaluation(evaluator: RAGEvaluator, test_cases: List[Dict]) -> Dict:
    """使用 LLM 作为评判者进行评估"""
    print("\n" + "=" * 60)
    print("🤖 LLM-as-Judge 评估")
    print("=" * 60)
    
    judge_llm = ChatOpenAI(model="gpt-4o", temperature=0)
    
    scores = {
        "accuracy": [],
        "completeness": [],
        "relevance": [],
        "faithfulness": [],
        "readability": []
    }
    
    judge_prompt = """请评价以下 RAG 问答系统的回答质量（1-5分）:

用户问题: {question}
检索到的上下文: {context}
AI回答: {answer}
标准答案（参考）: {ground_truth}

请从以下5个维度评分：
1. 准确性 (Accuracy): 回答是否正确 (1-5分)
2. 完整性 (Completeness): 是否回答了问题的所有方面 (1-5分)
3. 相关性 (Relevance): 回答是否紧扣问题 (1-5分)
4. 忠实度 (Faithfulness): 是否基于检索内容，无幻觉 (1-5分)
5. 可读性 (Readability): 回答是否清晰易懂 (1-5分)

请以 JSON 格式返回评分结果：
{{"accuracy": 分数, "completeness": 分数, "relevance": 分数, "faithfulness": 分数, "readability": 分数, "comments": "简短评语"}}"""

    for i, case in enumerate(test_cases):
        print(f"\n[{i+1}/{len(test_cases)}] 评估问题: {case['question'][:40]}...")
        
        # 获取上下文和回答
        contexts = evaluator.retrieve_context(case["question"])
        answer = evaluator.generate_answer(case["question"], contexts)
        context_text = "\n".join(contexts[:2])  # 只取前2个避免太长
        
        # LLM 评分
        try:
            response = judge_llm.invoke(
                judge_prompt.format(
                    question=case["question"],
                    context=context_text[:1000],
                    answer=answer,
                    ground_truth=case["ground_truth"]
                )
            )
            
            # 解析 JSON 结果
            result_text = response.content
            # 提取 JSON
            import re
            json_match = re.search(r'\{[^{}]+\}', result_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                for key in scores.keys():
                    if key in result:
                        scores[key].append(result[key])
                print(f"  评分: 准确性={result.get('accuracy', 'N/A')}, 忠实度={result.get('faithfulness', 'N/A')}")
            else:
                print(f"  ⚠️ 无法解析评分结果")
        except Exception as e:
            print(f"  ❌ 评估出错: {e}")
    
    # 计算平均分
    avg_scores = {}
    for key, values in scores.items():
        if values:
            avg_scores[key] = sum(values) / len(values)
    
    return avg_scores


def main():
    """主函数"""
    print("=" * 60)
    print("🎯 法人税法知识库 RAG 精度评估")
    print("=" * 60)
    print(f"知识库: {KNOWLEDGE_BASE_CONFIG['name']}")
    print(f"测试用例数: {len(TEST_CASES)}")
    print(f"评估框架: RAGAS" if RAGAS_AVAILABLE else "评估框架: LLM-as-Judge (RAGAS未安装)")
    
    # 初始化评估器
    evaluator = RAGEvaluator(KNOWLEDGE_BASE_CONFIG["collection_name"])
    if not evaluator.initialize():
        print("❌ 初始化失败，请检查向量数据库")
        sys.exit(1)
    
    # 1. 检索质量评估
    retrieval_result = evaluator.evaluate_retrieval_quality(TEST_CASES)
    
    # 2. RAGAS 评估 或 LLM-as-Judge
    ragas_result = {}
    if RAGAS_AVAILABLE:
        eval_data = evaluator.run_rag_pipeline(TEST_CASES)
        ragas_result = evaluator.evaluate_with_ragas(eval_data)
    else:
        # 使用 LLM-as-Judge 作为备选
        llm_scores = run_llm_judge_evaluation(evaluator, TEST_CASES)
        ragas_result = {
            "accuracy": llm_scores.get("accuracy", 0) / 5,
            "faithfulness": llm_scores.get("faithfulness", 0) / 5,
            "relevance": llm_scores.get("relevance", 0) / 5,
            "completeness": llm_scores.get("completeness", 0) / 5,
        }
    
    # 3. 生成报告
    report = evaluator.generate_report(ragas_result, retrieval_result)
    print(report)
    
    # 4. 保存报告
    report_file = f"ragas_eval_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"\n📄 报告已保存: {report_file}")


if __name__ == "__main__":
    main()
