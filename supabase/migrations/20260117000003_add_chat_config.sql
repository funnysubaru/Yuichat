-- 1.2.0: 添加聊天配置字段到 knowledge_bases 表
-- 支持配置AI头像、欢迎语和推荐问题

-- 添加 chat_config JSONB 字段
ALTER TABLE knowledge_bases 
ADD COLUMN IF NOT EXISTS chat_config JSONB DEFAULT '{}'::jsonb;

-- 添加注释说明
COMMENT ON COLUMN knowledge_bases.chat_config IS '聊天配置，包含avatar_url（头像URL）、welcome_message（多语言欢迎语）和recommended_questions（多语言推荐问题）';
