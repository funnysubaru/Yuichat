"""
1.3.30: QA问答服务模块
提供QA问答的创建、批量上传、查询、更新、删除等功能
1.3.31: 添加QA向量存储和匹配功能
"""

import os
import io
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import openpyxl
from supabase import Client
from langchain_openai import OpenAIEmbeddings
from dotenv import load_dotenv
from pathlib import Path

# 1.3.36: 导入Embedding缓存模块
from embedding_cache import embed_query_with_cache

# 1.3.31: 确保环境变量已加载（解决导入顺序问题）
# 获取当前文件所在目录
_current_dir = Path(__file__).parent
load_dotenv(_current_dir / '.env.local')
load_dotenv(_current_dir / '.env')

# 1.3.31: 向量数据库配置
USE_PGVECTOR = os.getenv("USE_PGVECTOR", "false").lower() == "true"
DATABASE_URL = os.getenv("PGVECTOR_DATABASE_URL") or os.getenv("DATABASE_URL")

# 1.3.31: QA向量匹配阈值（余弦相似度）
QA_MATCH_THRESHOLD = float(os.getenv("QA_MATCH_THRESHOLD", "0.85"))

# 1.3.31: 条件导入vecs
vecs = None
if USE_PGVECTOR and DATABASE_URL:
    try:
        import vecs as vecs_module
        vecs = vecs_module
    except ImportError:
        pass

# 1.3.30: 配置日志记录器
logger = logging.getLogger(__name__)


def get_qa_collection_name(collection_name: str) -> str:
    """
    1.3.31: 获取QA向量集合名称
    在原知识库集合名称后添加_qa后缀
    """
    return f"{collection_name}_qa"


class QAService:
    """
    1.3.30: QA问答服务类
    处理QA问答的CRUD操作和批量上传
    1.3.31: 添加向量存储和匹配功能
    """
    
    def __init__(self, supabase: Client):
        """初始化QA服务"""
        self.supabase = supabase
        self.embeddings = OpenAIEmbeddings()
    
    def _get_vector_collection(self, collection_name: str):
        """
        1.3.31: 获取或创建QA向量集合
        1.3.32: 清理调试日志
        """
        if not USE_PGVECTOR or not vecs or not DATABASE_URL:
            return None
        
        try:
            vx = vecs.create_client(DATABASE_URL)
            qa_collection_name = get_qa_collection_name(collection_name)
            
            try:
                collection = vx.get_collection(name=qa_collection_name)
            except Exception:
                # 创建新集合
                collection = vx.create_collection(
                    name=qa_collection_name,
                    dimension=1536  # OpenAI embeddings 维度
                )
                logger.info(f"Created QA collection: {qa_collection_name}")
            
            return collection
        except Exception as e:
            logger.error(f"Error getting QA collection: {e}")
            return None
    
    def store_qa_to_vector(
        self,
        qa_id: str,
        collection_name: str,
        question: str,
        answer: str,
        similar_questions: List[str] = None
    ) -> bool:
        """
        1.3.31: 将QA存入向量数据库
        
        Args:
            qa_id: QA记录ID
            collection_name: 知识库向量集合名称
            question: 主问题
            answer: 答案
            similar_questions: 相似问题列表
        
        Returns:
            是否存储成功
        """
        logger.debug(f"store_qa_to_vector called: qa_id={qa_id}, collection={collection_name}")
        
        if not USE_PGVECTOR or not vecs or not DATABASE_URL:
            logger.warning("pgvector not configured, skipping QA vector storage")
            return False
        
        try:
            collection = self._get_vector_collection(collection_name)
            # 1.3.32: 使用 is None 检查，因为 vecs.Collection 的 __bool__ 返回 False
            if collection is None:
                logger.error("Failed to get vector collection")
                return False
            
            # 准备所有要向量化的问题
            all_questions = [question]
            if similar_questions:
                all_questions.extend(similar_questions)
            
            # 生成向量
            vectors = self.embeddings.embed_documents(all_questions)
            logger.debug(f"Generated {len(vectors)} vectors for QA")
            
            # 准备记录
            records = []
            qa_collection_name = get_qa_collection_name(collection_name)
            
            for i, (q, vec) in enumerate(zip(all_questions, vectors)):
                record_id = f"{qa_collection_name}_{qa_id}_{i}"
                metadata = {
                    "qa_id": qa_id,
                    "question": q,
                    "answer": answer,
                    "is_main": i == 0,  # 是否是主问题
                    "text": q  # 用于检索时返回
                }
                records.append((record_id, vec, metadata))
            
            # 批量插入
            collection.upsert(records=records)
            
            logger.info(f"Stored {len(records)} QA vectors for qa_id: {qa_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing QA to vector: {e}")
            return False
    
    def delete_qa_from_vector(self, qa_id: str, collection_name: str) -> bool:
        """
        1.3.31: 从向量数据库删除QA
        1.3.32: 修复 is None 检查
        """
        if not USE_PGVECTOR or not vecs or not DATABASE_URL:
            return False
        
        try:
            collection = self._get_vector_collection(collection_name)
            if collection is None:
                return False
            
            qa_collection_name = get_qa_collection_name(collection_name)
            # 删除该QA的所有向量记录（主问题和相似问题）
            # vecs不支持直接删除，需要用空记录覆盖或使用SQL
            # 这里我们通过Supabase直接操作
            try:
                # 使用Supabase SQL删除
                self.supabase.rpc(
                    'delete_qa_vectors',
                    {'qa_id_prefix': f"{qa_collection_name}_{qa_id}_"}
                ).execute()
            except:
                # 如果RPC不存在，忽略（向量会在下次更新时被覆盖）
                pass
            
            return True
        except Exception as e:
            logger.error(f"Error deleting QA from vector: {e}")
            return False
    
    def match_qa(
        self,
        collection_name: str,
        query: str,
        threshold: float = None
    ) -> Optional[Dict[str, Any]]:
        """
        1.3.31: 在QA向量库中匹配问题
        
        Args:
            collection_name: 知识库向量集合名称
            query: 用户问题
            threshold: 匹配阈值（默认使用QA_MATCH_THRESHOLD）
        
        Returns:
            匹配到的QA记录，包含answer和score，如果没有匹配返回None
        """
        if not USE_PGVECTOR or not vecs or not DATABASE_URL:
            return None
        
        if threshold is None:
            threshold = QA_MATCH_THRESHOLD
        
        try:
            collection = self._get_vector_collection(collection_name)
            # 1.3.33: 使用 is None 检查，因为 vecs.Collection 的 __bool__ 返回 False
            if collection is None:
                if os.getenv("ENV") == "development":
                    print(f"⚠️ QA collection not found for: {collection_name}")
                return None
            
            if os.getenv("ENV") == "development":
                print(f"🔍 Matching QA in collection: {get_qa_collection_name(collection_name)}")
            
            # 1.3.36: 使用缓存版本的embed_query，避免重复调用OpenAI API
            query_vector = embed_query_with_cache(query)
            
            # 查询最相似的QA
            results = collection.query(
                data=query_vector,
                limit=1,
                include_value=True,
                include_metadata=True
            )
            
            if os.getenv("ENV") == "development":
                print(f"🔍 QA query results: {results}")
            
            if not results:
                if os.getenv("ENV") == "development":
                    print(f"⚠️ No QA results found")
                return None
            
            # 解析结果
            record = results[0]
            if len(record) >= 3:
                record_id = record[0]
                score = record[1]
                metadata = record[2] if record[2] else {}
            else:
                return None
            
            # vecs使用内积距离，需要转换为相似度
            # 对于归一化向量，内积距离 = 1 - 余弦相似度
            # 所以相似度 = 1 - distance
            similarity = 1 - score if score is not None else 0
            
            if os.getenv("ENV") == "development":
                logger.info(f"QA match score: {similarity:.4f}, threshold: {threshold}")
            
            # 检查是否超过阈值
            if similarity >= threshold:
                return {
                    "qa_id": metadata.get("qa_id"),
                    "question": metadata.get("question"),
                    "answer": metadata.get("answer"),
                    "score": similarity,
                    "matched": True
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error matching QA: {e}")
            return None
    
    def create_qa_item(
        self,
        knowledge_base_id: str,
        question: str,
        answer: str,
        similar_questions: List[str] = None,
        source: str = 'custom'
    ) -> Dict[str, Any]:
        """
        创建单个QA问答
        1.3.31: 创建后自动存入向量库
        
        Args:
            knowledge_base_id: 知识库ID
            question: 主问题
            answer: 答案
            similar_questions: 相似问题列表
            source: 来源 (custom/batch)
        
        Returns:
            创建的QA记录
        """
        try:
            # 计算答案字数
            word_count = len(answer)
            
            data = {
                'knowledge_base_id': knowledge_base_id,
                'question': question.strip(),
                'answer': answer.strip(),
                'similar_questions': similar_questions or [],
                'source': source,
                'word_count': word_count,
                'status': 'pending'  # 初始状态为待学习
            }
            
            result = self.supabase.table('qa_items').insert(data).execute()
            
            if result.data:
                qa_item = result.data[0]
                qa_id = qa_item['id']
                logger.info(f"Created QA item: {qa_id}")
                
                # 1.3.31: 获取知识库的vector_collection并存入向量库
                try:
                    kb_result = self.supabase.table('knowledge_bases')\
                        .select('vector_collection')\
                        .eq('id', knowledge_base_id)\
                        .single()\
                        .execute()
                    
                    if kb_result.data and kb_result.data.get('vector_collection'):
                        collection_name = kb_result.data['vector_collection']
                        
                        # 存入向量库
                        vector_success = self.store_qa_to_vector(
                            qa_id=qa_id,
                            collection_name=collection_name,
                            question=question.strip(),
                            answer=answer.strip(),
                            similar_questions=similar_questions
                        )
                        
                        # 更新状态
                        new_status = 'learned' if vector_success else 'failed'
                        self.supabase.table('qa_items')\
                            .update({'status': new_status})\
                            .eq('id', qa_id)\
                            .execute()
                        
                        qa_item['status'] = new_status
                        logger.info(f"QA item {qa_id} status updated to: {new_status}")
                    else:
                        logger.warning(f"Knowledge base {knowledge_base_id} has no vector_collection")
                        
                except Exception as e:
                    logger.error(f"Error storing QA to vector: {e}")
                    # 更新状态为失败
                    self.supabase.table('qa_items')\
                        .update({'status': 'failed'})\
                        .eq('id', qa_id)\
                        .execute()
                    qa_item['status'] = 'failed'
                
                return {'success': True, 'data': qa_item}
            else:
                return {'success': False, 'error': 'Failed to create QA item'}
                
        except Exception as e:
            logger.error(f"Error creating QA item: {e}")
            return {'success': False, 'error': str(e)}
    
    def list_qa_items(
        self,
        knowledge_base_id: str,
        status: str = None,
        source: str = None,
        search: str = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        获取QA问答列表
        
        Args:
            knowledge_base_id: 知识库ID
            status: 筛选状态
            source: 筛选来源
            search: 搜索关键词
            page: 页码
            page_size: 每页数量
        
        Returns:
            QA列表和分页信息
        """
        try:
            query = self.supabase.table('qa_items').select('*', count='exact')
            query = query.eq('knowledge_base_id', knowledge_base_id)
            
            if status:
                query = query.eq('status', status)
            
            if source:
                query = query.eq('source', source)
            
            if search:
                # 搜索问题内容
                query = query.ilike('question', f'%{search}%')
            
            # 排序和分页
            offset = (page - 1) * page_size
            query = query.order('created_at', desc=True)
            query = query.range(offset, offset + page_size - 1)
            
            result = query.execute()
            
            total = result.count if result.count else 0
            total_pages = (total + page_size - 1) // page_size
            
            return {
                'success': True,
                'data': result.data or [],
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total': total,
                    'total_pages': total_pages
                }
            }
            
        except Exception as e:
            logger.error(f"Error listing QA items: {e}")
            return {'success': False, 'error': str(e), 'data': [], 'pagination': {}}
    
    def get_qa_item(self, qa_id: str) -> Dict[str, Any]:
        """
        获取单个QA问答详情
        
        Args:
            qa_id: QA ID
        
        Returns:
            QA详情
        """
        try:
            result = self.supabase.table('qa_items').select('*').eq('id', qa_id).single().execute()
            
            if result.data:
                return {'success': True, 'data': result.data}
            else:
                return {'success': False, 'error': 'QA item not found'}
                
        except Exception as e:
            logger.error(f"Error getting QA item: {e}")
            return {'success': False, 'error': str(e)}
    
    def update_qa_item(
        self,
        qa_id: str,
        question: str = None,
        answer: str = None,
        similar_questions: List[str] = None,
        status: str = None
    ) -> Dict[str, Any]:
        """
        更新QA问答
        1.3.33: 当问题或相似问题变更时，重新存储向量
        
        Args:
            qa_id: QA ID
            question: 新问题（可选）
            answer: 新答案（可选）
            similar_questions: 新相似问题列表（可选）
            status: 新状态（可选）
        
        Returns:
            更新后的QA记录
        """
        try:
            data = {}
            need_reindex = False  # 1.3.33: 是否需要重新索引向量
            
            if question is not None:
                data['question'] = question.strip()
                need_reindex = True  # 问题变更需要重新索引
            
            if answer is not None:
                data['answer'] = answer.strip()
                data['word_count'] = len(answer)
                need_reindex = True  # 答案变更需要重新索引（因为metadata包含answer）
            
            if similar_questions is not None:
                data['similar_questions'] = similar_questions
                need_reindex = True  # 相似问题变更需要重新索引
            
            if status is not None:
                data['status'] = status
            
            if not data:
                return {'success': False, 'error': 'No data to update'}
            
            result = self.supabase.table('qa_items').update(data).eq('id', qa_id).execute()
            
            if result.data:
                updated_item = result.data[0]
                logger.info(f"Updated QA item: {qa_id}")
                
                # 1.3.33: 如果需要重新索引向量
                if need_reindex:
                    try:
                        # 获取知识库的vector_collection
                        kb_id = updated_item.get('knowledge_base_id')
                        kb_result = self.supabase.table('knowledge_bases')\
                            .select('vector_collection')\
                            .eq('id', kb_id)\
                            .limit(1)\
                            .execute()
                        
                        if kb_result.data and len(kb_result.data) > 0:
                            collection_name = kb_result.data[0].get('vector_collection')
                            if collection_name:
                                # 获取完整的QA数据
                                final_question = updated_item.get('question')
                                final_answer = updated_item.get('answer')
                                final_similar = updated_item.get('similar_questions') or []
                                
                                if os.getenv("ENV") == "development":
                                    print(f"🔄 重新索引QA向量: qa_id={qa_id}, question={final_question}, similar={final_similar}")
                                
                                # 重新存储向量
                                vector_success = self.store_qa_to_vector(
                                    qa_id=qa_id,
                                    collection_name=collection_name,
                                    question=final_question,
                                    answer=final_answer,
                                    similar_questions=final_similar
                                )
                                
                                # 更新状态
                                new_status = 'learned' if vector_success else 'failed'
                                self.supabase.table('qa_items').update({'status': new_status}).eq('id', qa_id).execute()
                                updated_item['status'] = new_status
                                
                                if os.getenv("ENV") == "development":
                                    print(f"{'✅' if vector_success else '❌'} 向量重新索引{'成功' if vector_success else '失败'}")
                    except Exception as ve:
                        logger.error(f"Error re-indexing QA vector: {ve}")
                        if os.getenv("ENV") == "development":
                            print(f"⚠️ 向量重新索引失败: {ve}")
                
                return {'success': True, 'data': updated_item}
            else:
                return {'success': False, 'error': 'Failed to update QA item'}
                
        except Exception as e:
            logger.error(f"Error updating QA item: {e}")
            return {'success': False, 'error': str(e)}
    
    def delete_qa_item(self, qa_id: str) -> Dict[str, Any]:
        """
        删除QA问答
        1.3.33: 同时删除向量数据库中的对应数据和qa_cache缓存
        
        Args:
            qa_id: QA ID
        
        Returns:
            删除结果
        """
        try:
            # 1.3.33: 先获取QA记录完整信息
            qa_result = self.supabase.table('qa_items')\
                .select('knowledge_base_id, question, similar_questions, answer')\
                .eq('id', qa_id)\
                .limit(1)\
                .execute()
            
            if qa_result.data and len(qa_result.data) > 0:
                qa_data = qa_result.data[0]
                kb_id = qa_data.get('knowledge_base_id')
                question = qa_data.get('question')
                similar_questions = qa_data.get('similar_questions') or []
                answer = qa_data.get('answer')
                
                # 获取知识库的vector_collection
                if kb_id:
                    kb_result = self.supabase.table('knowledge_bases')\
                        .select('vector_collection')\
                        .eq('id', kb_id)\
                        .limit(1)\
                        .execute()
                    
                    if kb_result.data and len(kb_result.data) > 0:
                        collection_name = kb_result.data[0].get('vector_collection')
                        if collection_name:
                            # 删除向量数据库中的数据
                            self._delete_qa_vectors(qa_id, collection_name)
                    
                    # 1.3.33: 删除qa_cache中相关的缓存
                    self._delete_qa_cache(kb_id, question, similar_questions, answer)
            
            # 删除数据库记录
            result = self.supabase.table('qa_items').delete().eq('id', qa_id).execute()
            
            logger.info(f"Deleted QA item: {qa_id}")
            return {'success': True, 'message': 'QA item deleted'}
            
        except Exception as e:
            logger.error(f"Error deleting QA item: {e}")
            return {'success': False, 'error': str(e)}
    
    def _delete_qa_cache(self, kb_id: str, question: str, similar_questions: List[str], answer: str) -> None:
        """
        1.3.33: 删除qa_cache中与该QA相关的缓存记录
        
        删除策略：
        1. 删除该知识库中answer完全匹配的缓存
        2. 这样可以清除主问题和所有相似问题的缓存
        
        Args:
            kb_id: 知识库ID
            question: 主问题
            similar_questions: 相似问题列表
            answer: 答案
        """
        try:
            # 删除该知识库中answer完全匹配的缓存
            # 因为主问题和相似问题的answer都是相同的
            result = self.supabase.table('qa_cache')\
                .delete()\
                .eq('knowledge_base_id', kb_id)\
                .eq('answer', answer)\
                .execute()
            
            if os.getenv("ENV") == "development":
                print(f"🗑️ 已清除QA相关缓存 (kb_id={kb_id}, answer={answer[:20]}...)")
            logger.info(f"Deleted QA cache for kb_id: {kb_id}")
            
        except Exception as e:
            logger.error(f"Error deleting QA cache: {e}")
            if os.getenv("ENV") == "development":
                print(f"⚠️ 清除QA缓存失败: {e}")
    
    def _delete_qa_vectors(self, qa_id: str, collection_name: str) -> bool:
        """
        1.3.33: 从向量数据库中删除指定QA的所有向量（包括主问题和相似问题）
        
        Args:
            qa_id: QA ID
            collection_name: 知识库向量集合名称
        
        Returns:
            是否删除成功
        """
        if not USE_PGVECTOR or not vecs or not DATABASE_URL:
            return False
        
        try:
            qa_collection_name = get_qa_collection_name(collection_name)
            
            # 使用SQL直接删除，避免影响其他数据
            # 向量记录ID格式: {qa_collection_name}_{qa_id}_{index}
            id_prefix = f"{qa_collection_name}_{qa_id}_"
            
            from sqlalchemy import text
            vx = vecs.create_client(DATABASE_URL)
            
            with vx.engine.connect() as conn:
                # 先查询要删除的记录数量
                count_result = conn.execute(text(f'''
                    SELECT COUNT(*) FROM vecs."{qa_collection_name}"
                    WHERE id LIKE :id_pattern
                '''), {"id_pattern": f"{id_prefix}%"})
                count = count_result.scalar()
                
                if count > 0:
                    # 删除匹配的记录
                    conn.execute(text(f'''
                        DELETE FROM vecs."{qa_collection_name}"
                        WHERE id LIKE :id_pattern
                    '''), {"id_pattern": f"{id_prefix}%"})
                    conn.commit()
                    
                    if os.getenv("ENV") == "development":
                        print(f"🗑️ 已删除 {count} 条QA向量记录 (qa_id={qa_id})")
                    logger.info(f"Deleted {count} QA vectors for qa_id: {qa_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting QA vectors: {e}")
            if os.getenv("ENV") == "development":
                print(f"⚠️ 删除QA向量失败: {e}")
            return False
    
    def delete_qa_items_batch(self, qa_ids: List[str]) -> Dict[str, Any]:
        """
        批量删除QA问答
        1.3.33: 同时删除向量数据库中的对应数据和qa_cache缓存
        
        Args:
            qa_ids: QA ID列表
        
        Returns:
            删除结果
        """
        try:
            # 1.3.33: 先获取所有QA的完整信息
            qa_result = self.supabase.table('qa_items')\
                .select('id, knowledge_base_id, question, similar_questions, answer')\
                .in_('id', qa_ids)\
                .execute()
            
            if qa_result.data:
                # 按knowledge_base_id分组
                kb_qa_map = {}
                for qa in qa_result.data:
                    kb_id = qa.get('knowledge_base_id')
                    if kb_id:
                        if kb_id not in kb_qa_map:
                            kb_qa_map[kb_id] = {'qa_ids': [], 'qa_data': []}
                        kb_qa_map[kb_id]['qa_ids'].append(qa.get('id'))
                        kb_qa_map[kb_id]['qa_data'].append(qa)
                
                # 获取每个知识库的vector_collection并删除向量和缓存
                for kb_id, data in kb_qa_map.items():
                    kb_result = self.supabase.table('knowledge_bases')\
                        .select('vector_collection')\
                        .eq('id', kb_id)\
                        .limit(1)\
                        .execute()
                    
                    if kb_result.data and len(kb_result.data) > 0:
                        collection_name = kb_result.data[0].get('vector_collection')
                        if collection_name:
                            for qa_id in data['qa_ids']:
                                self._delete_qa_vectors(qa_id, collection_name)
                    
                    # 1.3.33: 删除每个QA的缓存
                    for qa in data['qa_data']:
                        self._delete_qa_cache(
                            kb_id,
                            qa.get('question', ''),
                            qa.get('similar_questions') or [],
                            qa.get('answer', '')
                        )
            
            # 删除数据库记录
            result = self.supabase.table('qa_items').delete().in_('id', qa_ids).execute()
            
            logger.info(f"Deleted {len(qa_ids)} QA items")
            return {'success': True, 'message': f'Deleted {len(qa_ids)} QA items'}
            
        except Exception as e:
            logger.error(f"Error batch deleting QA items: {e}")
            return {'success': False, 'error': str(e)}
    
    def parse_xlsx(self, file_content: bytes) -> Dict[str, Any]:
        """
        解析xlsx文件内容
        
        Args:
            file_content: xlsx文件二进制内容
        
        Returns:
            解析结果，包含问答列表
        """
        try:
            # 使用openpyxl读取xlsx
            wb = openpyxl.load_workbook(io.BytesIO(file_content))
            ws = wb.active
            
            qa_list = []
            errors = []
            
            # 跳过标题行（第1行是说明，第2行是列名）
            for row_idx, row in enumerate(ws.iter_rows(min_row=3, values_only=True), start=3):
                if not row or all(cell is None for cell in row):
                    continue
                
                question_cell = row[0] if len(row) > 0 else None
                answer_cell = row[1] if len(row) > 1 else None
                
                if not question_cell or not answer_cell:
                    errors.append(f"第{row_idx}行: 问题或答案为空")
                    continue
                
                question_str = str(question_cell).strip()
                answer_str = str(answer_cell).strip()
                
                if not question_str or not answer_str:
                    errors.append(f"第{row_idx}行: 问题或答案为空")
                    continue
                
                # 解析问题，支持使用|分隔多个问题
                questions = [q.strip() for q in question_str.split('|') if q.strip()]
                
                if not questions:
                    errors.append(f"第{row_idx}行: 没有有效的问题")
                    continue
                
                # 第一个作为主问题，其余作为相似问题
                main_question = questions[0]
                similar_questions = questions[1:] if len(questions) > 1 else []
                
                qa_list.append({
                    'question': main_question,
                    'answer': answer_str,
                    'similar_questions': similar_questions,
                    'row': row_idx
                })
            
            return {
                'success': True,
                'data': qa_list,
                'total': len(qa_list),
                'errors': errors
            }
            
        except Exception as e:
            logger.error(f"Error parsing xlsx: {e}")
            return {'success': False, 'error': str(e), 'data': [], 'total': 0, 'errors': []}
    
    def batch_upload(
        self,
        knowledge_base_id: str,
        file_content: bytes,
        filename: str,
        file_size: int
    ) -> Dict[str, Any]:
        """
        批量上传QA问答
        
        Args:
            knowledge_base_id: 知识库ID
            file_content: xlsx文件二进制内容
            filename: 文件名
            file_size: 文件大小
        
        Returns:
            上传结果
        """
        try:
            # 创建上传记录
            upload_record = self.supabase.table('qa_upload_records').insert({
                'knowledge_base_id': knowledge_base_id,
                'filename': filename,
                'file_size': file_size,
                'status': 'processing'
            }).execute()
            
            if not upload_record.data:
                return {'success': False, 'error': 'Failed to create upload record'}
            
            record_id = upload_record.data[0]['id']
            
            # 解析xlsx
            parse_result = self.parse_xlsx(file_content)
            
            if not parse_result['success']:
                # 更新上传记录为失败
                self.supabase.table('qa_upload_records').update({
                    'status': 'failed',
                    'error_message': parse_result.get('error', 'Parse failed'),
                    'completed_at': datetime.utcnow().isoformat()
                }).eq('id', record_id).execute()
                
                return parse_result
            
            qa_list = parse_result['data']
            total_count = len(qa_list)
            success_count = 0
            failed_count = 0
            
            # 批量插入QA
            for qa_data in qa_list:
                try:
                    result = self.create_qa_item(
                        knowledge_base_id=knowledge_base_id,
                        question=qa_data['question'],
                        answer=qa_data['answer'],
                        similar_questions=qa_data['similar_questions'],
                        source='batch'
                    )
                    
                    if result['success']:
                        success_count += 1
                    else:
                        failed_count += 1
                        
                except Exception as e:
                    logger.error(f"Error inserting QA: {e}")
                    failed_count += 1
            
            # 更新上传记录
            self.supabase.table('qa_upload_records').update({
                'total_count': total_count,
                'success_count': success_count,
                'failed_count': failed_count,
                'status': 'completed' if failed_count == 0 else ('failed' if success_count == 0 else 'completed'),
                'error_message': f"部分失败: {failed_count}条" if failed_count > 0 and success_count > 0 else None,
                'completed_at': datetime.utcnow().isoformat()
            }).eq('id', record_id).execute()
            
            logger.info(f"Batch upload completed: {success_count} success, {failed_count} failed")
            
            return {
                'success': True,
                'record_id': record_id,
                'total': total_count,
                'success_count': success_count,
                'failed_count': failed_count,
                'parse_errors': parse_result.get('errors', [])
            }
            
        except Exception as e:
            logger.error(f"Error in batch upload: {e}")
            return {'success': False, 'error': str(e)}
    
    def list_upload_records(
        self,
        knowledge_base_id: str,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        获取上传记录列表
        
        Args:
            knowledge_base_id: 知识库ID
            page: 页码
            page_size: 每页数量
        
        Returns:
            上传记录列表
        """
        try:
            query = self.supabase.table('qa_upload_records').select('*', count='exact')
            query = query.eq('knowledge_base_id', knowledge_base_id)
            
            offset = (page - 1) * page_size
            query = query.order('created_at', desc=True)
            query = query.range(offset, offset + page_size - 1)
            
            result = query.execute()
            
            total = result.count if result.count else 0
            total_pages = (total + page_size - 1) // page_size
            
            return {
                'success': True,
                'data': result.data or [],
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total': total,
                    'total_pages': total_pages
                }
            }
            
        except Exception as e:
            logger.error(f"Error listing upload records: {e}")
            return {'success': False, 'error': str(e), 'data': [], 'pagination': {}}
    
    def update_qa_status(self, qa_id: str, status: str) -> Dict[str, Any]:
        """
        更新QA学习状态
        
        Args:
            qa_id: QA ID
            status: 新状态 (pending/learned/failed)
        
        Returns:
            更新结果
        """
        return self.update_qa_item(qa_id, status=status)
    
    def update_qa_status_batch(self, qa_ids: List[str], status: str) -> Dict[str, Any]:
        """
        批量更新QA学习状态
        
        Args:
            qa_ids: QA ID列表
            status: 新状态
        
        Returns:
            更新结果
        """
        try:
            result = self.supabase.table('qa_items').update({'status': status}).in_('id', qa_ids).execute()
            
            logger.info(f"Updated {len(qa_ids)} QA items to status: {status}")
            return {'success': True, 'message': f'Updated {len(qa_ids)} QA items'}
            
        except Exception as e:
            logger.error(f"Error batch updating QA status: {e}")
            return {'success': False, 'error': str(e)}
