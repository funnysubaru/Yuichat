"""
1.3.36: Embedding请求级缓存模块
使用contextvars实现请求级别的Embedding缓存，避免同一请求中重复调用OpenAI Embedding API

优化效果:
- 单次请求从4次Embedding API调用减少到1次
- 预计节省 ~1.5秒 响应时间
- 节省 75% Embedding API费用
"""

import os
import time
import logging
from contextvars import ContextVar
from typing import List, Dict, Optional, Callable
from functools import wraps

logger = logging.getLogger(__name__)

# 请求级别的Embedding缓存
# 每个请求有独立的缓存空间，请求结束后自动清理
_embedding_cache: ContextVar[Dict[str, List[float]]] = ContextVar(
    'embedding_cache', 
    default=None
)

# 缓存统计（用于调试）
_cache_stats: ContextVar[Dict[str, int]] = ContextVar(
    'cache_stats',
    default=None
)


def init_request_cache():
    """
    1.3.36: 初始化请求级缓存
    应该在每个请求开始时调用
    """
    _embedding_cache.set({})
    _cache_stats.set({'hits': 0, 'misses': 0})


def clear_request_cache():
    """
    1.3.36: 清理请求级缓存
    应该在每个请求结束时调用（可选，contextvars会自动隔离）
    """
    cache = _embedding_cache.get()
    if cache:
        cache.clear()
    _embedding_cache.set(None)
    _cache_stats.set(None)


def get_cache_stats() -> Dict[str, int]:
    """
    1.3.36: 获取缓存统计信息
    """
    stats = _cache_stats.get()
    return stats if stats else {'hits': 0, 'misses': 0}


def cached_embed_query(
    query: str,
    embed_func: Callable[[str], List[float]],
    cache_key: str = None
) -> List[float]:
    """
    1.3.36: 带缓存的Embedding查询
    
    Args:
        query: 要嵌入的文本
        embed_func: 实际的embedding函数（如 embeddings.embed_query）
        cache_key: 可选的缓存键（默认使用query本身）
    
    Returns:
        Embedding向量 (List[float])
    """
    key = cache_key or query
    
    # 获取当前请求的缓存
    cache = _embedding_cache.get()
    stats = _cache_stats.get()
    
    # 如果缓存未初始化，直接调用原函数
    if cache is None:
        if os.getenv("ENV") == "development":
            logger.debug(f"⚠️ Embedding cache not initialized, calling embed_func directly")
        return embed_func(query)
    
    # 检查缓存
    if key in cache:
        if stats:
            stats['hits'] += 1
        if os.getenv("ENV") == "development":
            logger.info(f"✅ Embedding cache HIT for: {query[:50]}... (total hits: {stats.get('hits', 0)})")
        return cache[key]
    
    # 缓存未命中，调用原函数
    if stats:
        stats['misses'] += 1
    
    start_time = time.time()
    embedding = embed_func(query)
    elapsed = time.time() - start_time
    
    # 存入缓存
    cache[key] = embedding
    
    if os.getenv("ENV") == "development":
        logger.info(f"📥 Embedding generated in {elapsed:.3f}s for: {query[:50]}... (cached for reuse)")
    
    return embedding


class EmbeddingCacheMiddleware:
    """
    1.3.36: FastAPI中间件，自动管理请求级Embedding缓存
    """
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # 初始化请求级缓存
            init_request_cache()
            try:
                await self.app(scope, receive, send)
            finally:
                # 请求结束后清理缓存（可选）
                if os.getenv("ENV") == "development":
                    stats = get_cache_stats()
                    if stats['hits'] > 0 or stats['misses'] > 0:
                        logger.info(f"📊 Request embedding stats: {stats['hits']} hits, {stats['misses']} misses")
                clear_request_cache()
        else:
            await self.app(scope, receive, send)


# 1.3.36: 全局OpenAI Embeddings实例（避免重复创建）
_global_embeddings = None


def get_cached_embeddings():
    """
    1.3.36: 获取全局的OpenAI Embeddings实例
    避免每次请求都创建新实例
    """
    global _global_embeddings
    if _global_embeddings is None:
        from langchain_openai import OpenAIEmbeddings
        _global_embeddings = OpenAIEmbeddings()
        if os.getenv("ENV") == "development":
            logger.info("🔧 Created global OpenAI Embeddings instance")
    return _global_embeddings


def embed_query_with_cache(query: str) -> List[float]:
    """
    1.3.36: 便捷函数：使用缓存的Embedding查询
    这是最常用的接口
    
    Args:
        query: 要嵌入的文本
    
    Returns:
        Embedding向量 (List[float])
    """
    embeddings = get_cached_embeddings()
    return cached_embed_query(query, embeddings.embed_query)
