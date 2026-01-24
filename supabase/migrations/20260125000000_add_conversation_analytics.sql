-- 1.3.14: 添加对话分析功能的数据库迁移
-- 支持区分测试对话与公开用户对话
-- 支持高频问题统计、日期筛选、关键词搜索
-- 支持数据保存周期管理

-- ============================================
-- 1. 扩展 conversations 表
-- ============================================

-- 添加来源类型字段：'test' 为测试对话（内部），'public' 为公开用户对话（外部分享）
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'test';

-- 添加约束确保 source_type 只能是 'test' 或 'public'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'conversations_source_type_check'
    ) THEN
        ALTER TABLE conversations ADD CONSTRAINT conversations_source_type_check 
            CHECK (source_type IN ('test', 'public'));
    END IF;
END $$;

-- 添加 session_id 字段：用于标识公开用户（通过 localStorage 生成的唯一ID）
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS session_id TEXT;

-- 添加 expires_at 字段：用于数据保存周期管理
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_conversations_source_type ON conversations(source_type);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_expires_at ON conversations(expires_at);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);

-- ============================================
-- 2. 创建对话设置表（保存周期配置）
-- ============================================

CREATE TABLE IF NOT EXISTS conversation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE NOT NULL UNIQUE,
    retention_period TEXT DEFAULT 'permanent' CHECK (retention_period IN ('permanent', '3_months', '6_months', '1_year')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_conversation_settings_kb_id ON conversation_settings(knowledge_base_id);

-- 启用 RLS
ALTER TABLE conversation_settings ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己知识库的设置
CREATE POLICY "Users can view own conversation settings"
    ON conversation_settings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM knowledge_bases
            WHERE knowledge_bases.id = conversation_settings.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own conversation settings"
    ON conversation_settings FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM knowledge_bases
            WHERE knowledge_bases.id = conversation_settings.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own conversation settings"
    ON conversation_settings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM knowledge_bases
            WHERE knowledge_bases.id = conversation_settings.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own conversation settings"
    ON conversation_settings FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM knowledge_bases
            WHERE knowledge_bases.id = conversation_settings.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

-- ============================================
-- 3. 更新 conversations 表的 RLS 策略
-- ============================================

-- 添加策略：允许匿名用户（公开模式）插入对话记录
-- 注意：公开模式下 user_id 可以为空，使用 session_id 标识用户
DO $$
BEGIN
    -- 先尝试删除现有策略（如果存在）
    DROP POLICY IF EXISTS "Public users can insert conversations" ON conversations;
    DROP POLICY IF EXISTS "Public users can view own conversations" ON conversations;
    DROP POLICY IF EXISTS "Public users can insert conversation messages" ON conversation_messages;
    DROP POLICY IF EXISTS "Public users can view own conversation messages" ON conversation_messages;
END $$;

-- 修改 conversations 表：允许 user_id 为空（公开模式）
ALTER TABLE conversations ALTER COLUMN user_id DROP NOT NULL;

-- 创建公开用户的 RLS 策略
CREATE POLICY "Public users can insert conversations"
    ON conversations FOR INSERT
    WITH CHECK (
        source_type = 'public' AND session_id IS NOT NULL
    );

CREATE POLICY "Public users can view own conversations"
    ON conversations FOR SELECT
    USING (
        (auth.uid() = user_id) OR
        (source_type = 'public' AND session_id IS NOT NULL)
    );

-- 更新 conversation_messages 表的 RLS 策略，支持公开对话
CREATE POLICY "Public users can insert conversation messages"
    ON conversation_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = conversation_messages.conversation_id
            AND (
                conversations.user_id = auth.uid() OR
                (conversations.source_type = 'public' AND conversations.session_id IS NOT NULL)
            )
        )
    );

CREATE POLICY "Public users can view own conversation messages"
    ON conversation_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = conversation_messages.conversation_id
            AND (
                conversations.user_id = auth.uid() OR
                (conversations.source_type = 'public' AND conversations.session_id IS NOT NULL)
            )
        )
    );

-- ============================================
-- 4. 创建高频问题统计视图（用于查询优化）
-- ============================================

-- 创建或替换高频问题统计的函数
CREATE OR REPLACE FUNCTION get_frequent_questions(
    p_knowledge_base_id UUID,
    p_limit INT DEFAULT 10,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    question TEXT,
    frequency BIGINT,
    last_asked TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.content AS question,
        COUNT(*) AS frequency,
        MAX(cm.created_at) AS last_asked
    FROM conversation_messages cm
    INNER JOIN conversations c ON c.id = cm.conversation_id
    WHERE c.knowledge_base_id = p_knowledge_base_id
        AND cm.role = 'user'
        AND (p_start_date IS NULL OR cm.created_at >= p_start_date)
        AND (p_end_date IS NULL OR cm.created_at <= p_end_date)
    GROUP BY cm.content
    ORDER BY frequency DESC, last_asked DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建对话统计函数
CREATE OR REPLACE FUNCTION get_conversation_stats(
    p_knowledge_base_id UUID
)
RETURNS TABLE (
    total_conversations BIGINT,
    test_conversations BIGINT,
    public_conversations BIGINT,
    total_messages BIGINT,
    today_conversations BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT c.id)::BIGINT AS total_conversations,
        COUNT(DISTINCT CASE WHEN c.source_type = 'test' THEN c.id END)::BIGINT AS test_conversations,
        COUNT(DISTINCT CASE WHEN c.source_type = 'public' THEN c.id END)::BIGINT AS public_conversations,
        (SELECT COUNT(*)::BIGINT FROM conversation_messages cm 
         INNER JOIN conversations conv ON conv.id = cm.conversation_id 
         WHERE conv.knowledge_base_id = p_knowledge_base_id) AS total_messages,
        COUNT(DISTINCT CASE WHEN c.created_at::DATE = CURRENT_DATE THEN c.id END)::BIGINT AS today_conversations
    FROM conversations c
    WHERE c.knowledge_base_id = p_knowledge_base_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. 添加注释
-- ============================================

COMMENT ON COLUMN conversations.source_type IS '对话来源类型：test=测试对话（内部），public=公开用户对话（外部分享）';
COMMENT ON COLUMN conversations.session_id IS '公开用户的会话标识，通过 localStorage 生成的唯一ID';
COMMENT ON COLUMN conversations.expires_at IS '对话过期时间，用于数据保存周期管理';
COMMENT ON TABLE conversation_settings IS '对话设置表，存储每个知识库的对话保存周期配置';
COMMENT ON COLUMN conversation_settings.retention_period IS '数据保存周期：permanent=永久，3_months=3个月，6_months=6个月，1_year=1年';
