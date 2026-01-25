"""
1.3.15: 问答语义缓存模块
实现基于语义相似度的问答缓存，对相似问题直接返回缓存答案

核心功能：
1. check_cache() - 检查问题是否有缓存的答案
2. save_to_cache() - 保存问答对到缓存
3. clear_cache_by_kb() - 清除指定知识库的缓存
4. cleanup_expired_cache() - 清理过期缓存

性能目标：
- 缓存命中时响应时间 < 500ms
- 相似度阈值 0.95（非常相似才命中）
"""

import os
import asyncio
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
load_dotenv()

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Supabase 客户端
from supabase import create_client, Client

# LangChain Embeddings
from langchain_openai import OpenAIEmbeddings

# 环境配置
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# 缓存配置
QA_CACHE_ENABLED = os.getenv("QA_CACHE_ENABLED", "true").lower() == "true"
QA_CACHE_SIMILARITY_THRESHOLD = float(os.getenv("QA_CACHE_SIMILARITY_THRESHOLD", "0.95"))
QA_CACHE_TTL_HOURS = int(os.getenv("QA_CACHE_TTL_HOURS", "24"))

# 初始化 Supabase 客户端
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Embeddings 模型（复用实例以提高性能）
_embeddings_model: Optional[OpenAIEmbeddings] = None

def get_embeddings_model() -> OpenAIEmbeddings:
    """获取或创建 Embeddings 模型实例（单例模式）"""
    global _embeddings_model
    if _embeddings_model is None:
        _embeddings_model = OpenAIEmbeddings()
    return _embeddings_model


async def check_cache(
    question: str,
    knowledge_base_id: str,
    language: str = "zh",
    similarity_threshold: float = None
) -> Optional[Dict[str, Any]]:
    """
    1.3.15: 检查问题是否命中缓存
    
    使用 pgvector 进行语义相似度匹配，如果找到相似度超过阈值的缓存问题，
    直接返回缓存的答案。
    
    Args:
        question: 用户问题
        knowledge_base_id: 知识库 ID
        language: 语言 (zh/en/ja)
        similarity_threshold: 相似度阈值（默认使用配置值）
    
    Returns:
        缓存结果字典，包含 answer, context, citations, follow_up
        如果未命中返回 None
    
    性能目标: < 500ms（包括 embedding 生成 ~300ms + 数据库查询 ~100ms）
    """
    if not QA_CACHE_ENABLED:
        if os.getenv("ENV") == "development":
            logger.debug("QA cache is disabled")
        return None
    
    if not supabase:
        logger.warning("Supabase client not initialized, cache disabled")
        return None
    
    if similarity_threshold is None:
        similarity_threshold = QA_CACHE_SIMILARITY_THRESHOLD
    
    try:
        # 1. 生成问题的 embedding（~300ms）
        embeddings_model = get_embeddings_model()
        question_embedding = await asyncio.to_thread(
            embeddings_model.embed_query, question
        )
        
        # 2. 使用 pgvector 进行相似度搜索
        # 使用 RPC 调用执行向量相似度查询
        # 注意：cosine distance = 1 - cosine similarity
        # 所以相似度阈值 0.95 对应距离阈值 0.05
        distance_threshold = 1 - similarity_threshold
        
        # 构建向量字符串格式
        embedding_str = f"[{','.join(map(str, question_embedding))}]"
        
        # 使用原生 SQL 查询（通过 RPC 或直接查询）
        # 查询未过期的、同知识库同语言的最相似问题
        result = supabase.rpc(
            'match_qa_cache',
            {
                'query_embedding': embedding_str,
                'match_kb_id': knowledge_base_id,
                'match_language': language,
                'match_threshold': distance_threshold,
                'match_count': 1
            }
        ).execute()
        
        if result.data and len(result.data) > 0:
            cached = result.data[0]
            cache_id = cached.get('id')
            
            # 3. 更新命中计数（异步，不阻塞响应）
            asyncio.create_task(_update_hit_count(cache_id))
            
            logger.info(f"QA cache hit for question: {question[:50]}... (similarity: {1 - cached.get('distance', 0):.3f})")
            
            return {
                "answer": cached.get("answer", ""),
                "context": cached.get("context", ""),
                "citations": cached.get("citations", []),
                "follow_up": cached.get("follow_up", []),
                "cached": True,
                "cache_id": cache_id
            }
        
        if os.getenv("ENV") == "development":
            logger.debug(f"QA cache miss for question: {question[:50]}...")
        
        return None
        
    except Exception as e:
        # 缓存查询失败不应阻塞主流程
        logger.error(f"QA cache check failed: {e}")
        if os.getenv("ENV") == "development":
            import traceback
            logger.error(traceback.format_exc())
        return None


async def _update_hit_count(cache_id: str) -> None:
    """异步更新缓存命中计数"""
    try:
        if supabase:
            supabase.rpc('update_qa_cache_hit', {'cache_id': cache_id}).execute()
    except Exception as e:
        logger.warning(f"Failed to update cache hit count: {e}")


async def save_to_cache(
    question: str,
    knowledge_base_id: str,
    answer: str,
    context: str = "",
    citations: List[Dict] = None,
    follow_up: List[Dict] = None,
    language: str = "zh",
    ttl_hours: int = None
) -> Optional[str]:
    """
    1.3.15: 保存问答对到缓存
    
    Args:
        question: 用户问题
        knowledge_base_id: 知识库 ID
        answer: AI 回答
        context: 上下文（可选）
        citations: 引用来源（可选）
        follow_up: 推荐问题（可选）
        language: 语言
        ttl_hours: 缓存有效期（小时）
    
    Returns:
        缓存记录 ID，失败返回 None
    """
    if not QA_CACHE_ENABLED:
        return None
    
    if not supabase:
        logger.warning("Supabase client not initialized, cannot save cache")
        return None
    
    if ttl_hours is None:
        ttl_hours = QA_CACHE_TTL_HOURS
    
    try:
        # 1. 生成问题的 embedding
        embeddings_model = get_embeddings_model()
        question_embedding = await asyncio.to_thread(
            embeddings_model.embed_query, question
        )
        
        # 2. 计算过期时间
        expires_at = (datetime.utcnow() + timedelta(hours=ttl_hours)).isoformat()
        
        # 3. 构建缓存记录
        cache_record = {
            "knowledge_base_id": knowledge_base_id,
            "question": question,
            "question_embedding": question_embedding,
            "answer": answer,
            "context": context if context else None,
            "citations": citations if citations else [],
            "follow_up": follow_up if follow_up else [],
            "language": language,
            "expires_at": expires_at,
            "hit_count": 0
        }
        
        # 4. 插入数据库
        result = supabase.table("qa_cache").insert(cache_record).execute()
        
        if result.data and len(result.data) > 0:
            cache_id = result.data[0].get("id")
            logger.info(f"Saved QA cache: {question[:50]}... (id: {cache_id})")
            return cache_id
        
        return None
        
    except Exception as e:
        # 缓存保存失败不应影响主流程
        logger.error(f"Failed to save QA cache: {e}")
        if os.getenv("ENV") == "development":
            import traceback
            logger.error(traceback.format_exc())
        return None


async def clear_cache_by_kb(knowledge_base_id: str) -> int:
    """
    1.3.15: 清除指定知识库的所有缓存
    
    当知识库内容更新时（文档上传/删除）调用此函数
    
    Args:
        knowledge_base_id: 知识库 ID
    
    Returns:
        删除的缓存记录数量
    """
    if not supabase:
        logger.warning("Supabase client not initialized")
        return 0
    
    try:
        result = supabase.rpc(
            'clear_qa_cache_by_kb',
            {'kb_id': knowledge_base_id}
        ).execute()
        
        deleted_count = result.data if result.data else 0
        logger.info(f"Cleared {deleted_count} cache entries for kb_id: {knowledge_base_id}")
        return deleted_count
        
    except Exception as e:
        logger.error(f"Failed to clear cache by KB: {e}")
        return 0


async def cleanup_expired_cache() -> int:
    """
    1.3.15: 清理所有过期的缓存
    
    建议通过定时任务（如 Supabase Edge Function）定期调用
    
    Returns:
        删除的缓存记录数量
    """
    if not supabase:
        logger.warning("Supabase client not initialized")
        return 0
    
    try:
        result = supabase.rpc('cleanup_expired_qa_cache').execute()
        deleted_count = result.data if result.data else 0
        logger.info(f"Cleaned up {deleted_count} expired cache entries")
        return deleted_count
        
    except Exception as e:
        logger.error(f"Failed to cleanup expired cache: {e}")
        return 0


async def get_cache_stats(knowledge_base_id: str = None) -> Dict[str, Any]:
    """
    1.3.15: 获取缓存统计信息
    
    Args:
        knowledge_base_id: 知识库 ID（可选，不传则返回全局统计）
    
    Returns:
        统计信息字典
    """
    if not supabase:
        return {"error": "Supabase not initialized"}
    
    try:
        query = supabase.table("qa_cache").select("id, hit_count, created_at", count="exact")
        
        if knowledge_base_id:
            query = query.eq("knowledge_base_id", knowledge_base_id)
        
        result = query.execute()
        
        total_entries = result.count if result.count else 0
        total_hits = sum(item.get("hit_count", 0) for item in (result.data or []))
        
        return {
            "total_entries": total_entries,
            "total_hits": total_hits,
            "knowledge_base_id": knowledge_base_id
        }
        
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        return {"error": str(e)}


# 同步版本（用于测试）
def check_cache_sync(
    question: str,
    knowledge_base_id: str,
    language: str = "zh"
) -> Optional[Dict[str, Any]]:
    """同步版本的缓存检查"""
    return asyncio.run(check_cache(question, knowledge_base_id, language))


def save_to_cache_sync(
    question: str,
    knowledge_base_id: str,
    answer: str,
    context: str = "",
    citations: List[Dict] = None,
    follow_up: List[Dict] = None,
    language: str = "zh"
) -> Optional[str]:
    """同步版本的缓存保存"""
    return asyncio.run(save_to_cache(
        question, knowledge_base_id, answer, context, citations, follow_up, language
    ))


if __name__ == "__main__":
    # 测试代码
    import sys
    
    print("QA Cache Module")
    print(f"  Enabled: {QA_CACHE_ENABLED}")
    print(f"  Similarity Threshold: {QA_CACHE_SIMILARITY_THRESHOLD}")
    print(f"  TTL Hours: {QA_CACHE_TTL_HOURS}")
    print(f"  Supabase: {'Connected' if supabase else 'Not connected'}")
