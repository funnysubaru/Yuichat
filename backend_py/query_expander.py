"""
1.3.10: 查询扩展模块
参考 ChatMax 的 query_expand.py 实现，通过同义词扩展和 LLM 语义扩展
生成多个相关查询，提高 follow-up 问题检索的召回率和相关性

核心功能：
1. expand_query() - 综合查询扩展入口
2. generate_synonyms() - 同义词/同义表达生成
3. generate_related_queries() - LLM 语义相关问题生成
"""

import os
import json
import asyncio
import logging
from typing import List, Optional
from dotenv import load_dotenv

# 加载环境变量
load_dotenv('.env.local')
load_dotenv()

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# LLM
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# 配置
QUERY_EXPANSION_ENABLED = os.getenv("QUERY_EXPANSION_ENABLED", "true").lower() == "true"
QUERY_EXPANSION_LLM_MODEL = os.getenv("QUERY_EXPANSION_LLM_MODEL", "gpt-4o-mini")
MAX_EXPANDED_QUERIES = int(os.getenv("MAX_EXPANDED_QUERIES", "5"))

# 同义词/语义扩展 Prompt 模板
SYNONYM_EXPANSION_PROMPT = """你是一个专业的语义分析助手。请为以下用户问题生成2-3个同义表达或相似问法。

要求：
1. 保持原意不变，只改变表达方式
2. 使用与原问题相同的语言
3. 每个表达应该简洁明了
4. 不要添加新的信息或改变问题范围

用户问题: {query}

请以JSON格式返回，格式如下：
{{"synonyms": ["同义表达1", "同义表达2"]}}

只返回JSON，不要其他解释。"""

# 相关问题扩展 Prompt 模板
RELATED_QUERIES_PROMPT = """你是一个专业的问题分析助手。基于用户的问题，生成2个语义相关但角度不同的问题。

要求：
1. 生成的问题应该与原问题主题相关
2. 从不同角度或更具体的方面提问
3. 使用与原问题相同的语言
4. 问题应该以问号结尾

用户问题: {query}

请以JSON格式返回，格式如下：
{{"related": ["相关问题1？", "相关问题2？"]}}

只返回JSON，不要其他解释。"""


async def generate_synonyms(
    query: str,
    language: str = "zh"
) -> List[str]:
    """
    1.3.10: 生成同义词/同义表达
    
    Args:
        query: 用户查询
        language: 目标语言
    
    Returns:
        同义表达列表
    """
    if not QUERY_EXPANSION_ENABLED:
        return []
    
    try:
        llm = ChatOpenAI(model=QUERY_EXPANSION_LLM_MODEL, temperature=0.3)
        prompt = ChatPromptTemplate.from_template(SYNONYM_EXPANSION_PROMPT)
        
        response = await asyncio.to_thread(
            llm.invoke,
            prompt.format(query=query)
        )
        
        # 解析 JSON 响应
        result_text = response.content.strip()
        
        # 处理可能的 markdown 代码块
        if "```json" in result_text:
            json_start = result_text.find("```json") + 7
            json_end = result_text.find("```", json_start)
            result_text = result_text[json_start:json_end].strip()
        elif "```" in result_text:
            json_start = result_text.find("```") + 3
            json_end = result_text.find("```", json_start)
            result_text = result_text[json_start:json_end].strip()
        
        result = json.loads(result_text)
        synonyms = result.get("synonyms", [])
        
        if os.getenv("ENV") == "development":
            logger.info(f"Generated {len(synonyms)} synonyms for query: {query[:50]}...")
        
        return synonyms[:3]  # 最多返回3个
        
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse synonyms response: {e}")
        return []
    except Exception as e:
        logger.warning(f"Failed to generate synonyms: {e}")
        return []


async def generate_related_queries(
    query: str,
    language: str = "zh"
) -> List[str]:
    """
    1.3.10: 生成语义相关的问题
    
    Args:
        query: 用户查询
        language: 目标语言
    
    Returns:
        相关问题列表
    """
    if not QUERY_EXPANSION_ENABLED:
        return []
    
    try:
        llm = ChatOpenAI(model=QUERY_EXPANSION_LLM_MODEL, temperature=0.5)
        prompt = ChatPromptTemplate.from_template(RELATED_QUERIES_PROMPT)
        
        response = await asyncio.to_thread(
            llm.invoke,
            prompt.format(query=query)
        )
        
        # 解析 JSON 响应
        result_text = response.content.strip()
        
        # 处理可能的 markdown 代码块
        if "```json" in result_text:
            json_start = result_text.find("```json") + 7
            json_end = result_text.find("```", json_start)
            result_text = result_text[json_start:json_end].strip()
        elif "```" in result_text:
            json_start = result_text.find("```") + 3
            json_end = result_text.find("```", json_start)
            result_text = result_text[json_start:json_end].strip()
        
        result = json.loads(result_text)
        related = result.get("related", [])
        
        if os.getenv("ENV") == "development":
            logger.info(f"Generated {len(related)} related queries for: {query[:50]}...")
        
        return related[:2]  # 最多返回2个
        
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse related queries response: {e}")
        return []
    except Exception as e:
        logger.warning(f"Failed to generate related queries: {e}")
        return []


async def expand_query(
    query: str,
    language: str = "zh",
    use_synonyms: bool = True,
    use_related: bool = True
) -> List[str]:
    """
    1.3.10: 综合查询扩展入口
    扩展用户查询，生成多个相关查询用于提高检索召回率
    
    Args:
        query: 用户查询
        language: 目标语言 (zh/en/ja)
        use_synonyms: 是否使用同义词扩展
        use_related: 是否使用 LLM 语义扩展
    
    Returns:
        扩展后的查询列表（包含原始查询）
    """
    if not QUERY_EXPANSION_ENABLED:
        return [query]
    
    expanded_queries = [query]  # 原始查询始终包含
    
    try:
        # 并行执行扩展任务
        tasks = []
        
        if use_synonyms:
            tasks.append(generate_synonyms(query, language))
        
        if use_related:
            tasks.append(generate_related_queries(query, language))
        
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, list):
                    expanded_queries.extend(result)
                elif isinstance(result, Exception):
                    logger.warning(f"Query expansion task failed: {result}")
        
        # 去重并限制数量
        unique_queries = []
        seen = set()
        for q in expanded_queries:
            q_normalized = q.strip().lower()
            if q_normalized not in seen:
                seen.add(q_normalized)
                unique_queries.append(q.strip())
        
        final_queries = unique_queries[:MAX_EXPANDED_QUERIES]
        
        if os.getenv("ENV") == "development":
            logger.info(f"Query expansion: {query[:30]}... -> {len(final_queries)} queries")
        
        return final_queries
        
    except Exception as e:
        logger.error(f"Query expansion failed: {e}")
        return [query]  # 失败时返回原始查询


# 用于测试的同步包装器
def expand_query_sync(
    query: str,
    language: str = "zh"
) -> List[str]:
    """同步版本，用于测试"""
    return asyncio.run(expand_query(query, language))


if __name__ == "__main__":
    # 测试代码
    import sys
    
    if len(sys.argv) >= 2:
        test_query = sys.argv[1]
        test_language = sys.argv[2] if len(sys.argv) > 2 else "zh"
        
        print(f"Testing query expansion:")
        print(f"  Query: {test_query}")
        print(f"  Language: {test_language}")
        
        expanded = expand_query_sync(test_query, test_language)
        print(f"\nExpanded queries ({len(expanded)}):")
        for i, q in enumerate(expanded, 1):
            print(f"  {i}. {q}")
    else:
        print("Usage: python query_expander.py <query> [language]")
