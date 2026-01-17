-- 1.1.0: 适配 LangGraph + Chainlit 架构，解耦 Dify

-- 修改 knowledge_bases 表
-- 1.1.0: 将 dify_dataset_id 设置为可空
ALTER TABLE knowledge_bases ALTER COLUMN dify_dataset_id DROP NOT NULL;

-- 1.1.1: 添加 vector_collection 字段用于存储向量库集合名称
-- 1.1.2: 每个项目（knowledge_base）对应一个向量集合，项目下所有文档共享此集合
ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS vector_collection TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT;

-- 修改 documents 表
-- 1.1.0: 将 dify_document_id 设置为可空
ALTER TABLE documents ALTER COLUMN dify_document_id DROP NOT NULL;

-- 1.1.1: 添加 storage_path 字段用于存储文件在 Supabase Storage 中的路径
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- 1.1.1: 添加 processing_metadata 字段用于存储处理过程中的元数据（如 chunk 数量等）
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{}';

-- 1.1.2: 注释说明
-- knowledge_bases 实际上就是"项目"（Project）
-- 每个项目有唯一的 vector_collection，项目下所有文档都索引到此集合
-- share_token 是项目级别的公开访问令牌，外部用户可访问项目下所有文档
