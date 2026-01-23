"""
1.3.0: 推荐问题检索模块
基于向量相似度检索预生成的推荐问题，用于对话时返回 follow-up 问题

核心功能：
1. retrieve_similar_questions() - 从向量库检索相似问题
2. filter_follow_up_questions() - 筛选follow_up问题（排重、语言匹配）
3. get_recommended_questions() - 综合接口
4. get_initial_questions() - 获取初始推荐问题（用于首次打开对话）
"""

import os
import asyncio
import traceback
import logging
from typing import List, Dict, Optional, Any
from dotenv import load_dotenv

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
SIMILARITY_THRESHOLD = float(os.getenv("QUESTION_SIMILARITY_THRESHOLD", "0.7"))  # 相似度阈值

# 初始化 Supabase 客户端
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


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
    limit: int = DEFAULT_RETRIEVAL_LIMIT
) -> List[Dict[str, Any]]:
    """
    从向量库检索与用户查询相似的预生成问题
    
    Args:
        query: 用户查询
        collection_name: 知识库的向量集合名称
        language: 目标语言 (zh/en/ja)
        limit: 检索数量
    
    Returns:
        相似问题列表，每个元素包含 question, score, language
    """
    results = []
    
    if not USE_PGVECTOR or not DATABASE_URL:
        logger.warning("pgvector not configured, skipping vector retrieval")
        return results
    
    questions_collection_name = get_collection_name_for_questions(collection_name)
    
    try:
        vx = vecs.create_client(DATABASE_URL)
        
        # 检查问题集合是否存在
        try:
            questions_collection = vx.get_collection(name=questions_collection_name)
        except Exception as e:
            logger.info(f"Questions collection {questions_collection_name} not found, returning empty results")
            return results
        
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
    
    return results


def filter_follow_up_questions(
    similar_questions: List[Dict[str, Any]],
    user_query: str,
    language: str = "zh",
    limit: int = DEFAULT_RETURN_LIMIT,
    similarity_threshold: float = SIMILARITY_THRESHOLD
) -> List[str]:
    """
    筛选 follow-up 问题
    
    筛选规则（参考 ChatMax）：
    1. 排除与用户问题完全相同的问题
    2. 只保留目标语言的问题
    3. 确保问题以问号结尾
    4. 相似度必须高于阈值
    5. 去重
    
    Args:
        similar_questions: 相似问题列表
        user_query: 用户原始查询
        language: 目标语言
        limit: 返回数量限制
        similarity_threshold: 相似度阈值
    
    Returns:
        筛选后的问题文本列表
    """
    filtered = []
    seen_questions = set()
    
    # 标准化用户查询用于比较
    user_query_normalized = user_query.strip().lower()
    
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
    
    Args:
        query: 用户查询
        collection_name: 知识库的向量集合名称
        language: 目标语言 (zh/en/ja)
        limit: 返回的问题数量
    
    Returns:
        推荐问题列表
    """
    try:
        # 1. 从向量库检索相似问题
        similar_questions = await retrieve_similar_questions(
            query=query,
            collection_name=collection_name,
            language=language,
            limit=limit * 3  # 检索更多用于筛选
        )
        
        if not similar_questions:
            logger.info(f"No similar questions found for collection {collection_name}")
            return []
        
        # 2. 筛选 follow-up 问题
        follow_up = filter_follow_up_questions(
            similar_questions=similar_questions,
            user_query=query,
            language=language,
            limit=limit
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
