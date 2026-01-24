"""
1.3.0: 推荐问题检索模块
基于向量相似度检索预生成的推荐问题，用于对话时返回 follow-up 问题

核心功能：
1. retrieve_similar_questions() - 从向量库检索相似问题
2. filter_follow_up_questions() - 筛选follow_up问题（排重、语言匹配）
3. get_recommended_questions() - 综合接口
4. get_initial_questions() - 获取初始推荐问题（用于首次打开对话）

1.3.10: 优化 follow-up 问题相关性
- 提高相似度阈值从 0.7 到 0.85
- 增加二次 cosine similarity 验证
- 集成查询扩展模块，提高检索召回率
- 参考 ChatMax 的实现方式
"""

import os
import asyncio
import traceback
import logging
from typing import List, Dict, Optional, Any, Tuple
from dotenv import load_dotenv
# 1.3.10: 导入 numpy 用于二次相似度计算
import numpy as np

# 加载环境变量
load_dotenv('.env.local')
load_dotenv()

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# LLM 和向量化
from langchain_openai import OpenAIEmbeddings

# Supabase 客户端
from supabase import create_client, Client

# 向量数据库
import vecs

# 环境配置
USE_PGVECTOR = os.getenv("USE_PGVECTOR", "false").lower() == "true"
DATABASE_URL = os.getenv("PGVECTOR_DATABASE_URL") or os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# 检索配置
DEFAULT_RETRIEVAL_LIMIT = int(os.getenv("QUESTION_RETRIEVAL_LIMIT", "10"))  # 检索的问题数量
DEFAULT_RETURN_LIMIT = int(os.getenv("QUESTION_RETURN_LIMIT", "3"))  # 返回的问题数量
# 1.3.10: 提高相似度阈值从 0.7 到 0.85，参考 ChatMax 的实现
# 1.3.9: SIMILARITY_THRESHOLD = float(os.getenv("QUESTION_SIMILARITY_THRESHOLD", "0.7"))  # 相似度阈值
SIMILARITY_THRESHOLD = float(os.getenv("QUESTION_SIMILARITY_THRESHOLD", "0.85"))  # 1.3.10: 提高阈值
# 1.3.10: 二次验证阈值（cosine similarity，值越高越相似）
COSINE_SIMILARITY_THRESHOLD = float(os.getenv("COSINE_SIMILARITY_THRESHOLD", "0.85"))
# 1.3.10: 查询扩展开关
QUERY_EXPANSION_ENABLED = os.getenv("QUERY_EXPANSION_ENABLED", "true").lower() == "true"

# 初始化 Supabase 客户端
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# 1.3.10: cosine similarity 计算函数（参考 ChatMax）
def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """
    1.3.10: 计算两个向量的余弦相似度
    
    Args:
        vec_a: 向量 A
        vec_b: 向量 B
    
    Returns:
        余弦相似度（-1 到 1 之间，1 表示完全相同）
    """
    a = np.array(vec_a)
    b = np.array(vec_b)
    
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
    
    return float(np.dot(a, b) / (norm_a * norm_b))


def get_collection_name_for_questions(kb_collection: str) -> str:
    """
    获取问题向量库的集合名称
    格式: {原collection}_questions
    """
    return f"{kb_collection}_questions"


async def retrieve_similar_questions(
    query: str,
    collection_name: str,
    language: str = "zh",
    limit: int = DEFAULT_RETRIEVAL_LIMIT,
    return_query_embedding: bool = False  # 1.3.10: 新增参数，是否返回查询向量
) -> Tuple[List[Dict[str, Any]], Optional[List[float]]]:
    """
    从向量库检索与用户查询相似的预生成问题
    
    Args:
        query: 用户查询
        collection_name: 知识库的向量集合名称
        language: 目标语言 (zh/en/ja)
        limit: 检索数量
        return_query_embedding: 1.3.10: 是否返回查询向量（用于二次验证）
    
    Returns:
        1.3.10: 返回元组 (相似问题列表, 查询向量)
        相似问题列表，每个元素包含 question, score, language
    """
    results = []
    query_vector = None  # 1.3.10: 保存查询向量
    
    if not USE_PGVECTOR or not DATABASE_URL:
        logger.warning("pgvector not configured, skipping vector retrieval")
        return (results, query_vector) if return_query_embedding else (results, None)
    
    questions_collection_name = get_collection_name_for_questions(collection_name)
    
    try:
        vx = vecs.create_client(DATABASE_URL)
        
        # 检查问题集合是否存在
        try:
            questions_collection = vx.get_collection(name=questions_collection_name)
        except Exception as e:
            logger.info(f"Questions collection {questions_collection_name} not found, returning empty results")
            return (results, query_vector) if return_query_embedding else (results, None)
        
        # 生成查询向量
        embeddings_model = OpenAIEmbeddings()
        query_vector = await asyncio.to_thread(
            embeddings_model.embed_query, query
        )
        
        # 执行相似度搜索
        search_results = questions_collection.query(
            data=query_vector,
            limit=limit,
            include_value=True,  # 包含相似度分数
            include_metadata=True
        )
        
        # 解析结果
        for record in search_results:
            if len(record) >= 3:
                record_id = record[0]
                similarity_score = record[1] if record[1] is not None else 0.0
                metadata = record[2] if len(record) > 2 else {}
                
                question_text = metadata.get("question", metadata.get("text", ""))
                question_lang = metadata.get("language", "zh")
                
                if question_text:
                    results.append({
                        "question": question_text,
                        "score": similarity_score,
                        "language": question_lang,
                        "id": record_id
                    })
        
        logger.info(f"Retrieved {len(results)} similar questions from {questions_collection_name}")
        
    except Exception as e:
        logger.error(f"Failed to retrieve similar questions: {e}")
        logger.error(traceback.format_exc())
    
    # 1.3.10: 返回结果和查询向量
    return (results, query_vector) if return_query_embedding else (results, None)


def filter_follow_up_questions(
    similar_questions: List[Dict[str, Any]],
    user_query: str,
    language: str = "zh",
    limit: int = DEFAULT_RETURN_LIMIT,
    similarity_threshold: float = SIMILARITY_THRESHOLD,
    # 1.3.10: 新增参数，用于二次验证
    user_query_embedding: Optional[List[float]] = None,
    question_embeddings: Optional[Dict[str, List[float]]] = None,
    cosine_threshold: float = COSINE_SIMILARITY_THRESHOLD
) -> List[str]:
    """
    筛选 follow-up 问题
    
    筛选规则（参考 ChatMax）：
    1. 排除与用户问题完全相同的问题
    2. 只保留目标语言的问题
    3. 确保问题以问号结尾
    4. 相似度必须高于阈值
    5. 去重
    6. 1.3.10: 二次 cosine similarity 验证
    
    Args:
        similar_questions: 相似问题列表
        user_query: 用户原始查询
        language: 目标语言
        limit: 返回数量限制
        similarity_threshold: 相似度阈值
        user_query_embedding: 1.3.10: 用户查询的 embedding（用于二次验证）
        question_embeddings: 1.3.10: 问题的 embeddings 字典（用于二次验证）
        cosine_threshold: 1.3.10: 二次验证的 cosine similarity 阈值
    
    Returns:
        筛选后的问题文本列表
    """
    filtered = []
    seen_questions = set()
    
    # 标准化用户查询用于比较
    user_query_normalized = user_query.strip().lower()
    
    # 1.3.10: 是否启用二次验证
    enable_cosine_verification = (
        user_query_embedding is not None and 
        question_embeddings is not None and 
        len(question_embeddings) > 0
    )
    
    for item in similar_questions:
        question = item.get("question", "").strip()
        score = item.get("score", 0.0)
        question_lang = item.get("language", "")
        
        # 标准化问题用于比较
        question_normalized = question.lower()
        
        # 筛选条件
        # 1. 排除与用户问题完全相同的问题
        if question_normalized == user_query_normalized:
            continue
        
        # 2. 语言匹配
        if question_lang != language:
            continue
        
        # 3. 确保问题以问号结尾
        if not (question.endswith('?') or question.endswith('？')):
            continue
        
        # 4. 相似度阈值（注意：vecs返回的是距离，越小越相似）
        # 但我们在检索时include_value=True返回的是相似度分数
        # 需要根据实际情况调整
        # 如果score是距离（越小越好），则用 score < threshold
        # 如果score是相似度（越大越好），则用 score > threshold
        # vecs默认使用余弦距离，值越小越相似
        if score > (1 - similarity_threshold):  # 转换为距离阈值
            continue
        
        # 5. 去重
        if question_normalized in seen_questions:
            continue
        
        # 6. 1.3.10: 二次 cosine similarity 验证（参考 ChatMax）
        if enable_cosine_verification:
            question_embedding = question_embeddings.get(question)
            if question_embedding is not None:
                verified_score = cosine_similarity(user_query_embedding, question_embedding)
                # 只保留验证分数高于阈值的问题
                if verified_score < cosine_threshold:
                    if os.getenv("ENV") == "development":
                        logger.debug(f"Question filtered by cosine verification: {question[:30]}... (score={verified_score:.3f})")
                    continue
                # 1.3.10: 更新分数为验证后的分数
                item["verified_score"] = verified_score
        
        seen_questions.add(question_normalized)
        filtered.append(question)
        
        # 达到数量限制
        if len(filtered) >= limit:
            break
    
    return filtered


async def get_recommended_questions(
    query: str,
    collection_name: str,
    language: str = "zh",
    limit: int = DEFAULT_RETURN_LIMIT
) -> List[str]:
    """
    获取推荐的 follow-up 问题（综合接口）
    
    1.3.10: 优化版本
    - 集成查询扩展，提高检索召回率
    - 二次 cosine similarity 验证，提高相关性
    - 参考 ChatMax 的实现方式
    
    Args:
        query: 用户查询
        collection_name: 知识库的向量集合名称
        language: 目标语言 (zh/en/ja)
        limit: 返回的问题数量
    
    Returns:
        推荐问题列表
    """
    try:
        # 1.3.10: 查询扩展
        expanded_queries = [query]  # 默认只使用原始查询
        if QUERY_EXPANSION_ENABLED:
            try:
                from query_expander import expand_query
                expanded_queries = await expand_query(query, language)
                if os.getenv("ENV") == "development":
                    logger.info(f"Query expansion: {query[:30]}... -> {len(expanded_queries)} queries")
            except ImportError:
                logger.warning("query_expander module not found, using original query only")
            except Exception as exp_error:
                logger.warning(f"Query expansion failed: {exp_error}, using original query only")
        
        # 1.3.10: 对每个扩展查询进行检索，合并结果
        all_similar_questions = []
        original_query_embedding = None  # 保存原始查询的 embedding
        
        for i, expanded_query in enumerate(expanded_queries):
            # 1.3.10: 只对第一个（原始）查询返回 embedding
            return_embedding = (i == 0)
            
            results, query_embedding = await retrieve_similar_questions(
                query=expanded_query,
                collection_name=collection_name,
                language=language,
                limit=limit * 2,  # 每个查询检索更多
                return_query_embedding=return_embedding
            )
            
            if return_embedding and query_embedding:
                original_query_embedding = query_embedding
            
            all_similar_questions.extend(results)
        
        if not all_similar_questions:
            logger.info(f"No similar questions found for collection {collection_name}")
            return []
        
        # 1.3.10: 去重（基于问题文本）
        seen_questions = set()
        unique_questions = []
        for item in all_similar_questions:
            question = item.get("question", "").strip().lower()
            if question and question not in seen_questions:
                seen_questions.add(question)
                unique_questions.append(item)
        
        if os.getenv("ENV") == "development":
            logger.info(f"Deduplicated: {len(all_similar_questions)} -> {len(unique_questions)} questions")
        
        # 1.3.10: 获取问题的 embeddings 用于二次验证
        question_embeddings = {}
        if original_query_embedding and len(unique_questions) > 0:
            try:
                embeddings_model = OpenAIEmbeddings()
                question_texts = [item.get("question", "") for item in unique_questions]
                
                # 批量生成 embeddings
                embeddings_list = await asyncio.to_thread(
                    embeddings_model.embed_documents,
                    question_texts
                )
                
                # 构建字典
                for q_text, q_embedding in zip(question_texts, embeddings_list):
                    question_embeddings[q_text] = q_embedding
                
                if os.getenv("ENV") == "development":
                    logger.info(f"Generated embeddings for {len(question_embeddings)} questions for verification")
            except Exception as emb_error:
                logger.warning(f"Failed to generate question embeddings: {emb_error}")
        
        # 2. 筛选 follow-up 问题（1.3.10: 使用二次验证）
        follow_up = filter_follow_up_questions(
            similar_questions=unique_questions,
            user_query=query,
            language=language,
            limit=limit,
            user_query_embedding=original_query_embedding,
            question_embeddings=question_embeddings,
            cosine_threshold=COSINE_SIMILARITY_THRESHOLD
        )
        
        logger.info(f"Returning {len(follow_up)} follow-up questions for query: {query[:50]}...")
        return follow_up
        
    except Exception as e:
        logger.error(f"Failed to get recommended questions: {e}")
        logger.error(traceback.format_exc())
        return []


async def get_initial_questions(
    collection_name: str,
    kb_id: Optional[str] = None,
    language: str = "zh",
    limit: int = 3
) -> List[str]:
    """
    获取初始推荐问题（用于首次打开对话时显示）
    
    优先从数据库获取，如果没有则返回空列表
    
    Args:
        collection_name: 知识库的向量集合名称
        kb_id: 知识库 ID（可选，用于数据库查询）
        language: 目标语言
        limit: 返回数量
    
    Returns:
        初始问题列表
    """
    if not supabase:
        logger.warning("Supabase not configured, cannot get initial questions")
        return []
    
    try:
        # 如果没有 kb_id，通过 collection_name 查询
        if not kb_id:
            kb_result = supabase.table("knowledge_bases")\
                .select("id")\
                .eq("vector_collection", collection_name)\
                .single()\
                .execute()
            
            if kb_result.data:
                kb_id = kb_result.data.get("id")
            else:
                logger.warning(f"Knowledge base not found for collection {collection_name}")
                return []
        
        # 从数据库获取推荐问题
        questions_result = supabase.table("recommended_questions")\
            .select("question")\
            .eq("knowledge_base_id", kb_id)\
            .eq("language", language)\
            .eq("is_active", True)\
            .limit(limit)\
            .execute()
        
        if questions_result.data:
            questions = [item["question"] for item in questions_result.data]
            logger.info(f"Retrieved {len(questions)} initial questions for kb_id={kb_id}")
            return questions
        else:
            logger.info(f"No initial questions found for kb_id={kb_id}")
            return []
            
    except Exception as e:
        logger.error(f"Failed to get initial questions: {e}")
        logger.error(traceback.format_exc())
        return []


async def get_questions_by_language(
    kb_id: str,
    language: str = "zh",
    limit: int = 5
) -> List[str]:
    """
    按语言获取知识库的推荐问题
    
    Args:
        kb_id: 知识库 ID
        language: 目标语言
        limit: 返回数量
    
    Returns:
        问题列表
    """
    if not supabase:
        return []
    
    try:
        result = supabase.table("recommended_questions")\
            .select("question")\
            .eq("knowledge_base_id", kb_id)\
            .eq("language", language)\
            .eq("is_active", True)\
            .limit(limit)\
            .execute()
        
        if result.data:
            return [item["question"] for item in result.data]
        return []
        
    except Exception as e:
        logger.error(f"Failed to get questions by language: {e}")
        return []


async def check_questions_exist(collection_name: str) -> bool:
    """
    检查指定知识库是否已生成推荐问题
    
    Args:
        collection_name: 知识库的向量集合名称
    
    Returns:
        是否存在推荐问题
    """
    if not supabase:
        return False
    
    try:
        # 通过 collection_name 查询 kb_id
        kb_result = supabase.table("knowledge_bases")\
            .select("id")\
            .eq("vector_collection", collection_name)\
            .single()\
            .execute()
        
        if not kb_result.data:
            return False
        
        kb_id = kb_result.data.get("id")
        
        # 检查是否有推荐问题
        count_result = supabase.table("recommended_questions")\
            .select("id", count="exact")\
            .eq("knowledge_base_id", kb_id)\
            .eq("is_active", True)\
            .limit(1)\
            .execute()
        
        return count_result.count > 0 if count_result.count else False
        
    except Exception as e:
        logger.error(f"Failed to check questions existence: {e}")
        return False


# 用于测试的同步包装器
def get_recommended_questions_sync(
    query: str,
    collection_name: str,
    language: str = "zh",
    limit: int = 3
) -> List[str]:
    """同步版本，用于测试"""
    return asyncio.run(get_recommended_questions(query, collection_name, language, limit))


if __name__ == "__main__":
    # 测试代码
    import sys
    
    if len(sys.argv) >= 3:
        test_query = sys.argv[1]
        test_collection = sys.argv[2]
        test_language = sys.argv[3] if len(sys.argv) > 3 else "zh"
        
        print(f"Testing question retrieval:")
        print(f"  Query: {test_query}")
        print(f"  Collection: {test_collection}")
        print(f"  Language: {test_language}")
        
        questions = get_recommended_questions_sync(test_query, test_collection, test_language)
        print(f"\nRecommended questions:")
        for i, q in enumerate(questions, 1):
            print(f"  {i}. {q}")
    else:
        print("Usage: python question_retriever.py <query> <collection_name> [language]")
