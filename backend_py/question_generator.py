"""
1.3.0: 推荐问题生成模块
基于ChatMax的设计思路，实现文档上传时异步预生成推荐问题

核心功能：
1. generate_questions_from_docs() - 基于文档片段生成多语言问题
2. store_questions_to_db() - 存储到Supabase表
3. store_questions_to_vector() - 存储到pgvector向量库
4. async_generate_questions() - 异步任务入口
"""

import os
import json
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
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# Supabase 客户端
from supabase import create_client, Client

# 向量数据库
import vecs

# 环境配置
USE_PGVECTOR = os.getenv("USE_PGVECTOR", "false").lower() == "true"
DATABASE_URL = os.getenv("PGVECTOR_DATABASE_URL") or os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# 问题生成配置
QUESTIONS_PER_LANGUAGE = int(os.getenv("QUESTIONS_PER_LANGUAGE", "5"))  # 每种语言生成的问题数量
MAX_CONTEXT_TOKENS = int(os.getenv("MAX_CONTEXT_TOKENS", "2000"))  # 上下文最大token数
QUESTION_GENERATION_MODEL = os.getenv("QUESTION_GENERATION_MODEL", "gpt-4o-mini")  # 使用更快的模型

# 初始化 Supabase 客户端
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# 问题生成 Prompt 模板（参考 ChatMax）
QUESTION_GENERATION_PROMPT_ZH = """### 角色能力 ###
你是一个问题生成器，请根据下面给出的上下文分别用中文、英文和日文生成{num}个不同且简洁的问题。

要求：
1. 生成用户可能会问的问题，问题要简洁、真实、口语化
2. 确保问题能从文档中找到明确的答案
3. 问题应该以问号结尾（中文用？，英文用?，日文用？）
4. 避免生成过于宽泛的问题（如"介绍一下"、"说明一下"）

### 上下文 ###
{context}

### 返回格式 ###
请严格按照下面描述的JSON格式进行输出，不需要解释：
{{
    "questions": {{
        "zh": ["中文问题1？", "中文问题2？"],
        "en": ["English question 1?", "English question 2?"],
        "ja": ["日本語の質問1？", "日本語の質問2？"]
    }}
}}
确保输出的格式可以被Python的json.loads方法解析。"""


def get_collection_name_for_questions(kb_collection: str) -> str:
    """
    获取问题向量库的集合名称
    格式: {原collection}_questions
    """
    return f"{kb_collection}_questions"


async def get_document_chunks(
    collection_name: str,
    limit: int = 10
) -> List[str]:
    """
    从向量库获取文档片段用于生成问题
    
    Args:
        collection_name: 知识库的向量集合名称
        limit: 获取的文档片段数量
    
    Returns:
        文档片段文本列表
    """
    sample_docs = []
    
    if not USE_PGVECTOR or not DATABASE_URL:
        logger.warning("pgvector not configured, skipping document chunk retrieval")
        return sample_docs
    
    try:
        vx = vecs.create_client(DATABASE_URL)
        collection = vx.get_collection(name=collection_name)
        
        # 使用通用查询词检索文档
        query_words = ["介绍", "说明", "功能", "使用", "概述"]
        embeddings_model = OpenAIEmbeddings()
        
        all_results = []
        
        # 先尝试直接从数据库随机获取文档
        try:
            from sqlalchemy import text
            with vx.engine.connect() as conn:
                result = conn.execute(text(f'''
                    SELECT metadata->>'text' as text_content
                    FROM vecs."{collection_name}"
                    WHERE LENGTH(metadata->>'text') > 100
                    ORDER BY RANDOM()
                    LIMIT {limit}
                '''))
                for row in result:
                    text_content = row[0] if row[0] else ""
                    if text_content and len(text_content.strip()) > 50:
                        # 过滤错误文档
                        is_error = (
                            '爬取失败' in text_content or 
                            '解析失败' in text_content or
                            text_content.strip().startswith('爬取失败') or
                            text_content.strip().startswith('解析失败')
                        )
                        if not is_error:
                            all_results.append(text_content)
            
            logger.info(f"Direct SQL query returned {len(all_results)} documents")
        except Exception as sql_error:
            logger.warning(f"Direct SQL query failed: {sql_error}, using vector search")
        
        # 如果直接查询结果不足，使用向量搜索
        if len(all_results) < limit // 2:
            for query_word in query_words[:3]:
                try:
                    query_vector = await asyncio.to_thread(
                        embeddings_model.embed_query, query_word
                    )
                    results = collection.query(
                        data=query_vector,
                        limit=3,
                        include_value=False,
                        include_metadata=True
                    )
                    for record in results:
                        if len(record) > 1 and record[1]:
                            text = record[1].get("text", "")
                            if text and len(text.strip()) > 50:
                                is_error = (
                                    '爬取失败' in text or 
                                    '解析失败' in text
                                )
                                if not is_error:
                                    all_results.append(text)
                except Exception as e:
                    logger.warning(f"Vector search for '{query_word}' failed: {e}")
        
        # 去重并限制数量
        sample_docs = list(dict.fromkeys(all_results))[:limit]
        logger.info(f"Retrieved {len(sample_docs)} document chunks for question generation")
        
    except Exception as e:
        logger.error(f"Failed to retrieve document chunks: {e}")
        logger.error(traceback.format_exc())
    
    return sample_docs


async def generate_questions_from_docs(
    docs: List[str],
    num_per_language: int = 5
) -> Dict[str, List[str]]:
    """
    使用 LLM 基于文档片段生成多语言问题
    
    Args:
        docs: 文档片段列表
        num_per_language: 每种语言生成的问题数量
    
    Returns:
        多语言问题字典 {"zh": [...], "en": [...], "ja": [...]}
    """
    if not docs:
        logger.warning("No documents provided for question generation")
        return {"zh": [], "en": [], "ja": []}
    
    # 构建上下文
    context = "\n\n---\n\n".join(docs[:5])  # 最多使用5个文档片段
    
    # 限制上下文长度（粗略估计，4字符约等于1 token）
    max_chars = MAX_CONTEXT_TOKENS * 4
    if len(context) > max_chars:
        context = context[:max_chars] + "..."
    
    # 使用 LLM 生成问题
    llm = ChatOpenAI(model=QUESTION_GENERATION_MODEL, temperature=0.7)
    prompt = ChatPromptTemplate.from_template(QUESTION_GENERATION_PROMPT_ZH)
    
    try:
        response = await asyncio.to_thread(
            llm.invoke,
            prompt.format(context=context, num=num_per_language)
        )
        generated_text = response.content.strip()
        
        # 解析 JSON 响应
        # 尝试提取 JSON 部分（处理可能的 markdown 代码块）
        if "```json" in generated_text:
            json_start = generated_text.find("```json") + 7
            json_end = generated_text.find("```", json_start)
            generated_text = generated_text[json_start:json_end].strip()
        elif "```" in generated_text:
            json_start = generated_text.find("```") + 3
            json_end = generated_text.find("```", json_start)
            generated_text = generated_text[json_start:json_end].strip()
        
        result = json.loads(generated_text)
        questions = result.get("questions", {})
        
        # 验证和清理问题
        cleaned_questions = {"zh": [], "en": [], "ja": []}
        for lang in ["zh", "en", "ja"]:
            lang_questions = questions.get(lang, [])
            for q in lang_questions:
                q = q.strip()
                # 确保问题以问号结尾
                if q and (q.endswith('?') or q.endswith('？')):
                    cleaned_questions[lang].append(q)
                elif q and len(q) > 5:
                    # 添加问号
                    if lang == "en":
                        cleaned_questions[lang].append(q + "?")
                    else:
                        cleaned_questions[lang].append(q + "？")
        
        logger.info(f"Generated questions - zh: {len(cleaned_questions['zh'])}, "
                   f"en: {len(cleaned_questions['en'])}, ja: {len(cleaned_questions['ja'])}")
        
        return cleaned_questions
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        logger.error(f"Response was: {generated_text[:500]}...")
        return {"zh": [], "en": [], "ja": []}
    except Exception as e:
        logger.error(f"Failed to generate questions with LLM: {e}")
        logger.error(traceback.format_exc())
        return {"zh": [], "en": [], "ja": []}


async def store_questions_to_db(
    kb_id: str,
    doc_id: Optional[str],
    questions: Dict[str, List[str]],
    source_type: str = "section",
    source_ids: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    将生成的问题存储到 Supabase 数据库
    
    Args:
        kb_id: 知识库 ID
        doc_id: 文档 ID（可选）
        questions: 多语言问题字典
        source_type: 来源类型 (section/summary)
        source_ids: 来源文档片段 ID
    
    Returns:
        插入的记录列表
    """
    if not supabase:
        logger.error("Supabase client not initialized")
        return []
    
    inserted_records = []
    
    try:
        for lang, lang_questions in questions.items():
            for question in lang_questions:
                record = {
                    "knowledge_base_id": kb_id,
                    "document_id": doc_id,
                    "question": question,
                    "language": lang,
                    "source_type": source_type,
                    "source_ids": source_ids,
                    "is_active": True
                }
                
                result = supabase.table("recommended_questions")\
                    .insert(record)\
                    .execute()
                
                if result.data:
                    inserted_records.extend(result.data)
        
        logger.info(f"Stored {len(inserted_records)} questions to database")
        return inserted_records
        
    except Exception as e:
        logger.error(f"Failed to store questions to database: {e}")
        logger.error(traceback.format_exc())
        return []


async def store_questions_to_vector(
    collection_name: str,
    kb_id: str,
    questions: Dict[str, List[str]],
    db_records: List[Dict[str, Any]]
) -> int:
    """
    将问题向量化并存储到 pgvector
    
    Args:
        collection_name: 原知识库集合名称
        kb_id: 知识库 ID
        questions: 多语言问题字典
        db_records: 数据库记录（用于关联 embedding_id）
    
    Returns:
        存储的向量数量
    """
    if not USE_PGVECTOR or not DATABASE_URL:
        logger.warning("pgvector not configured, skipping vector storage")
        return 0
    
    try:
        vx = vecs.create_client(DATABASE_URL)
        questions_collection_name = get_collection_name_for_questions(collection_name)
        
        # 获取或创建问题向量集合
        try:
            questions_collection = vx.get_collection(name=questions_collection_name)
        except:
            questions_collection = vx.create_collection(
                name=questions_collection_name,
                dimension=1536  # OpenAI embeddings 维度
            )
            logger.info(f"Created questions collection: {questions_collection_name}")
        
        # 准备所有问题的文本
        all_questions = []
        question_metadata = []
        
        for lang, lang_questions in questions.items():
            for i, question in enumerate(lang_questions):
                all_questions.append(question)
                question_metadata.append({
                    "question": question,
                    "language": lang,
                    "kb_id": kb_id,
                    "text": question  # 用于检索时返回
                })
        
        if not all_questions:
            logger.warning("No questions to vectorize")
            return 0
        
        # 批量生成向量
        embeddings_model = OpenAIEmbeddings()
        vectors = await asyncio.to_thread(
            embeddings_model.embed_documents,
            all_questions
        )
        
        # 清理文本中的空字符
        def clean_null_chars(obj):
            if isinstance(obj, str):
                return obj.replace('\x00', '').replace('\u0000', '')
            elif isinstance(obj, dict):
                return {k: clean_null_chars(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [clean_null_chars(item) for item in obj]
            return obj
        
        question_metadata = [clean_null_chars(m) for m in question_metadata]
        
        # 准备记录并插入
        records = []
        for i, (vector, metadata) in enumerate(zip(vectors, question_metadata)):
            record_id = f"{questions_collection_name}_{kb_id}_{i}"
            records.append((record_id, vector, metadata))
        
        # 批量插入
        questions_collection.upsert(records=records)
        
        # 更新数据库记录的 embedding_id
        if supabase and db_records:
            record_idx = 0
            for lang, lang_questions in questions.items():
                for i, question in enumerate(lang_questions):
                    if record_idx < len(db_records) and record_idx < len(records):
                        try:
                            db_record = db_records[record_idx]
                            embedding_id = records[record_idx][0]
                            supabase.table("recommended_questions")\
                                .update({"embedding_id": embedding_id})\
                                .eq("id", db_record["id"])\
                                .execute()
                        except Exception as e:
                            logger.warning(f"Failed to update embedding_id: {e}")
                    record_idx += 1
        
        logger.info(f"Stored {len(records)} question vectors to {questions_collection_name}")
        return len(records)
        
    except Exception as e:
        logger.error(f"Failed to store questions to vector database: {e}")
        logger.error(traceback.format_exc())
        return 0


async def async_generate_questions(
    kb_id: str,
    collection_name: str,
    doc_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    异步任务入口：生成并存储推荐问题
    
    Args:
        kb_id: 知识库 ID（UUID）
        collection_name: 向量集合名称
        doc_id: 文档 ID（可选）
    
    Returns:
        生成结果统计
    """
    logger.info(f"Starting question generation for kb_id={kb_id}, collection={collection_name}")
    
    result = {
        "kb_id": kb_id,
        "collection_name": collection_name,
        "doc_id": doc_id,
        "questions_generated": 0,
        "questions_stored_db": 0,
        "questions_stored_vector": 0,
        "success": False,
        "error": None
    }
    
    try:
        # 1. 获取文档片段
        docs = await get_document_chunks(collection_name, limit=10)
        
        if not docs:
            logger.warning(f"No documents found in collection {collection_name}")
            result["error"] = "No documents found"
            return result
        
        # 2. 生成问题
        questions = await generate_questions_from_docs(docs, QUESTIONS_PER_LANGUAGE)
        
        total_questions = sum(len(q) for q in questions.values())
        result["questions_generated"] = total_questions
        
        if total_questions == 0:
            logger.warning("No questions generated")
            result["error"] = "No questions generated"
            return result
        
        # 3. 存储到数据库
        db_records = await store_questions_to_db(
            kb_id=kb_id,
            doc_id=doc_id,
            questions=questions,
            source_type="section"
        )
        result["questions_stored_db"] = len(db_records)
        
        # 4. 存储到向量库
        vector_count = await store_questions_to_vector(
            collection_name=collection_name,
            kb_id=kb_id,
            questions=questions,
            db_records=db_records
        )
        result["questions_stored_vector"] = vector_count
        
        result["success"] = True
        logger.info(f"Question generation completed: {result}")
        
    except Exception as e:
        logger.error(f"Question generation failed: {e}")
        logger.error(traceback.format_exc())
        result["error"] = str(e)
    
    return result


async def regenerate_questions_for_kb(kb_id: str) -> Dict[str, Any]:
    """
    为指定知识库重新生成所有推荐问题
    （清除旧问题后重新生成）
    
    Args:
        kb_id: 知识库 ID
    
    Returns:
        生成结果
    """
    if not supabase:
        return {"success": False, "error": "Supabase not configured"}
    
    try:
        # 获取知识库信息
        kb_result = supabase.table("knowledge_bases")\
            .select("vector_collection")\
            .eq("id", kb_id)\
            .single()\
            .execute()
        
        if not kb_result.data:
            return {"success": False, "error": "Knowledge base not found"}
        
        collection_name = kb_result.data.get("vector_collection")
        
        if not collection_name:
            return {"success": False, "error": "No vector collection found"}
        
        # 删除旧的推荐问题
        supabase.table("recommended_questions")\
            .delete()\
            .eq("knowledge_base_id", kb_id)\
            .execute()
        
        logger.info(f"Deleted old questions for kb_id={kb_id}")
        
        # 重新生成
        return await async_generate_questions(kb_id, collection_name)
        
    except Exception as e:
        logger.error(f"Failed to regenerate questions: {e}")
        return {"success": False, "error": str(e)}


# 用于测试的同步包装器
def generate_questions_sync(kb_id: str, collection_name: str, doc_id: Optional[str] = None):
    """同步版本，用于测试"""
    return asyncio.run(async_generate_questions(kb_id, collection_name, doc_id))


if __name__ == "__main__":
    # 测试代码
    import sys
    
    if len(sys.argv) >= 3:
        test_kb_id = sys.argv[1]
        test_collection = sys.argv[2]
        test_doc_id = sys.argv[3] if len(sys.argv) > 3 else None
        
        print(f"Testing question generation for kb_id={test_kb_id}, collection={test_collection}")
        result = generate_questions_sync(test_kb_id, test_collection, test_doc_id)
        print(f"Result: {json.dumps(result, indent=2, ensure_ascii=False)}")
    else:
        print("Usage: python question_generator.py <kb_id> <collection_name> [doc_id]")
