-- 1.3.0: 推荐问题离线预计算功能
-- 存储文档上传时预生成的推荐问题

-- 推荐问题表
CREATE TABLE IF NOT EXISTS recommended_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('zh', 'en', 'ja')),
    source_type TEXT DEFAULT 'section' CHECK (source_type IN ('section', 'summary')),
    source_ids TEXT,  -- 生成问题的文档片段ID列表，用下划线分隔
    embedding_id TEXT,  -- pgvector中的向量ID，用于检索
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_rq_kb_id ON recommended_questions(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_rq_doc_id ON recommended_questions(document_id);
CREATE INDEX IF NOT EXISTS idx_rq_language ON recommended_questions(language);
CREATE INDEX IF NOT EXISTS idx_rq_active ON recommended_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_rq_source_type ON recommended_questions(source_type);
CREATE INDEX IF NOT EXISTS idx_rq_embedding_id ON recommended_questions(embedding_id);

-- 启用 RLS
ALTER TABLE recommended_questions ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己知识库的推荐问题
CREATE POLICY "Users can view own recommended questions"
    ON recommended_questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM knowledge_bases
            WHERE knowledge_bases.id = recommended_questions.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

-- RLS 策略：允许通过 share_token 公开访问（用于分享链接）
CREATE POLICY "Public can view shared recommended questions"
    ON recommended_questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM knowledge_bases
            WHERE knowledge_bases.id = recommended_questions.knowledge_base_id
            AND knowledge_bases.share_token IS NOT NULL
        )
    );

-- RLS 策略：用户可以插入自己知识库的推荐问题
CREATE POLICY "Users can insert own recommended questions"
    ON recommended_questions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM knowledge_bases
            WHERE knowledge_bases.id = recommended_questions.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

-- RLS 策略：用户可以更新自己知识库的推荐问题
CREATE POLICY "Users can update own recommended questions"
    ON recommended_questions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM knowledge_bases
            WHERE knowledge_bases.id = recommended_questions.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

-- RLS 策略：用户可以删除自己知识库的推荐问题
CREATE POLICY "Users can delete own recommended questions"
    ON recommended_questions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM knowledge_bases
            WHERE knowledge_bases.id = recommended_questions.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

-- 允许服务端角色（service_role）完全访问（用于后端异步任务）
CREATE POLICY "Service role has full access to recommended questions"
    ON recommended_questions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_recommended_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_recommended_questions_updated_at
    BEFORE UPDATE ON recommended_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_recommended_questions_updated_at();

-- 添加注释
COMMENT ON TABLE recommended_questions IS '预生成的推荐问题表，用于对话时快速返回follow-up问题';
COMMENT ON COLUMN recommended_questions.question IS '预生成的问题文本';
COMMENT ON COLUMN recommended_questions.language IS '问题语言: zh(中文), en(英文), ja(日文)';
COMMENT ON COLUMN recommended_questions.source_type IS '问题来源类型: section(文档片段), summary(摘要)';
COMMENT ON COLUMN recommended_questions.source_ids IS '生成问题的文档片段ID列表';
COMMENT ON COLUMN recommended_questions.embedding_id IS 'pgvector中的向量ID，格式: {collection_name}_{index}';
COMMENT ON COLUMN recommended_questions.is_active IS '是否启用，用于软删除';
