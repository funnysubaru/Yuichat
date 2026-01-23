"""
1.3.1: GCP Cloud Tasks 工具模块
用于创建异步任务，解决 Cloud Run 中 asyncio.create_task() 不可靠的问题

使用方法：
1. 在 GCP 控制台创建 Cloud Tasks 队列
2. 设置环境变量：
   - GCP_PROJECT_ID: GCP 项目 ID
   - GCP_LOCATION: Cloud Tasks 队列所在地区（如 asia-northeast1）
   - GCP_TASK_QUEUE: 队列名称（如 yuichat-tasks）
   - CLOUD_RUN_SERVICE_URL: Cloud Run 服务 URL（如 https://yuichat-xxx.run.app）
"""

import os
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 环境变量
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_LOCATION = os.getenv("GCP_LOCATION", "asia-northeast1")
GCP_TASK_QUEUE = os.getenv("GCP_TASK_QUEUE", "yuichat-tasks")
CLOUD_RUN_SERVICE_URL = os.getenv("CLOUD_RUN_SERVICE_URL")

# Cloud Tasks 客户端（延迟导入，避免本地开发时报错）
tasks_client = None


def get_tasks_client():
    """
    获取 Cloud Tasks 客户端（延迟初始化）
    """
    global tasks_client
    if tasks_client is None:
        try:
            from google.cloud import tasks_v2
            tasks_client = tasks_v2.CloudTasksClient()
            logger.info("Cloud Tasks client initialized")
        except ImportError:
            logger.warning("google-cloud-tasks not installed, Cloud Tasks disabled")
        except Exception as e:
            logger.error(f"Failed to initialize Cloud Tasks client: {e}")
    return tasks_client


def is_cloud_tasks_enabled() -> bool:
    """
    检查 Cloud Tasks 是否已配置并可用
    """
    if not GCP_PROJECT_ID:
        logger.debug("GCP_PROJECT_ID not set, Cloud Tasks disabled")
        return False
    if not CLOUD_RUN_SERVICE_URL:
        logger.debug("CLOUD_RUN_SERVICE_URL not set, Cloud Tasks disabled")
        return False
    if get_tasks_client() is None:
        return False
    return True


def create_task(
    endpoint: str,
    payload: Dict[str, Any],
    delay_seconds: int = 0,
    task_id: Optional[str] = None
) -> Optional[str]:
    """
    创建 Cloud Tasks 任务
    
    Args:
        endpoint: API 端点路径（如 /api/generate-questions）
        payload: 请求体 JSON 数据
        delay_seconds: 延迟执行秒数（默认立即执行）
        task_id: 可选的任务 ID（用于去重）
    
    Returns:
        任务名称（成功）或 None（失败）
    """
    client = get_tasks_client()
    if client is None:
        logger.warning("Cloud Tasks client not available")
        return None
    
    if not GCP_PROJECT_ID or not CLOUD_RUN_SERVICE_URL:
        logger.warning("Cloud Tasks not configured (missing GCP_PROJECT_ID or CLOUD_RUN_SERVICE_URL)")
        return None
    
    try:
        # 构建队列路径
        parent = client.queue_path(GCP_PROJECT_ID, GCP_LOCATION, GCP_TASK_QUEUE)
        
        # 构建目标 URL
        url = f"{CLOUD_RUN_SERVICE_URL.rstrip('/')}{endpoint}"
        
        # 构建任务
        task = {
            "http_request": {
                "http_method": "POST",
                "url": url,
                "headers": {
                    "Content-Type": "application/json",
                },
                "body": json.dumps(payload).encode(),
            }
        }
        
        # 如果指定了任务 ID
        if task_id:
            task["name"] = f"{parent}/tasks/{task_id}"
        
        # 如果需要延迟执行
        if delay_seconds > 0:
            from google.protobuf import timestamp_pb2
            d = datetime.utcnow() + timedelta(seconds=delay_seconds)
            timestamp = timestamp_pb2.Timestamp()
            timestamp.FromDatetime(d)
            task["schedule_time"] = timestamp
        
        # 创建任务
        response = client.create_task(parent=parent, task=task)
        
        logger.info(f"Created Cloud Task: {response.name}")
        return response.name
        
    except Exception as e:
        logger.error(f"Failed to create Cloud Task: {e}")
        return None


def create_question_generation_task(
    kb_id: str,
    collection_name: str,
    doc_id: Optional[str] = None,
    delay_seconds: int = 5
) -> Optional[str]:
    """
    创建问题生成任务（便捷方法）
    
    Args:
        kb_id: 知识库 ID
        collection_name: 向量集合名称
        doc_id: 文档 ID（可选）
        delay_seconds: 延迟秒数（默认 5 秒，让文档索引完成）
    
    Returns:
        任务名称或 None
    """
    payload = {
        "kb_id": kb_id,
        "collection_name": collection_name,
        "doc_id": doc_id
    }
    
    # 使用 kb_id 和时间戳作为任务 ID，避免重复创建
    # 注意：Cloud Tasks 的任务 ID 有格式限制
    import re
    safe_kb_id = re.sub(r'[^a-zA-Z0-9_-]', '_', kb_id)
    task_id = f"qgen_{safe_kb_id}_{int(datetime.utcnow().timestamp())}"
    
    return create_task(
        endpoint="/api/generate-questions",
        payload=payload,
        delay_seconds=delay_seconds,
        task_id=task_id
    )


# 用于本地开发的回退方案
async def fallback_generate_questions(
    kb_id: str,
    collection_name: str,
    doc_id: Optional[str] = None
):
    """
    本地开发环境的回退方案：直接异步执行
    注意：这在 Cloud Run 中不可靠，仅用于本地测试
    """
    from question_generator import async_generate_questions
    import asyncio
    
    try:
        result = await async_generate_questions(
            kb_id=kb_id,
            collection_name=collection_name,
            doc_id=doc_id
        )
        logger.info(f"Fallback question generation completed: {result}")
        return result
    except Exception as e:
        logger.error(f"Fallback question generation failed: {e}")
        return None


def trigger_question_generation(
    kb_id: str,
    collection_name: str,
    doc_id: Optional[str] = None
) -> bool:
    """
    触发问题生成（自动选择 Cloud Tasks 或回退方案）
    
    返回：是否使用了 Cloud Tasks（True）或需要回退到本地执行（False）
    """
    if is_cloud_tasks_enabled():
        task_name = create_question_generation_task(
            kb_id=kb_id,
            collection_name=collection_name,
            doc_id=doc_id
        )
        if task_name:
            logger.info(f"Question generation scheduled via Cloud Tasks: {task_name}")
            return True
        else:
            logger.warning("Failed to create Cloud Task, will use fallback")
            return False
    else:
        logger.info("Cloud Tasks not enabled, using fallback (sync or local async)")
        return False
