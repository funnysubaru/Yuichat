-- 1.1.2: 增加分享令牌字段，用于生成外部访问链接

-- 为 knowledge_bases 表添加 share_token
ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();

-- 创建唯一索引以提高查询效率
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_bases_share_token ON knowledge_bases(share_token);

-- 注释：share_token 将作为访问 Chainlit 界面的参数 kb_id
