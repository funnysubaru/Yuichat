-- 1.3.15: 问答语义缓存表
-- 用于缓存问答对，实现相似问题快速响应（<500ms）
-- 核心原理：使用 pgvector 进行语义相似度匹配

-- 启用 pgvector 扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建问答缓存表
CREATE TABLE IF NOT EXISTS qa_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_embedding vector(1536),  -- OpenAI text-embedding-ada-002 维度
    answer TEXT NOT NULL,
    context TEXT,  -- 保存用于生成答案的上下文（可选）
    citations JSONB DEFAULT '[]',  -- 引用来源
    follow_up JSONB DEFAULT '[]',  -- 1.3.15: 缓存 follow-up 推荐问题
    language VARCHAR(10) DEFAULT 'zh',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    hit_count INTEGER DEFAULT 0,  -- 缓存命中次数（用于统计和缓存优化）
    last_hit_at TIMESTAMPTZ,  -- 最后命中时间
    CONSTRAINT qa_cache_language_check CHECK (language IN ('zh', 'en', 'ja'))
);

-- 创建向量索引（使用 IVFFlat 加速相似度查询）
-- lists 参数根据数据量调整，一般为 sqrt(row_count)，初始设置为 100
CREATE INDEX IF NOT EXISTS qa_cache_embedding_idx ON qa_cache 
USING ivfflat (question_embedding vector_cosine_ops) WITH (lists = 100);

-- 复合索引：知识库 + 语言（用于快速过滤）
CREATE INDEX IF NOT EXISTS qa_cache_kb_lang_idx ON qa_cache (knowledge_base_id, language);

-- 过期时间索引（用于定期清理过期缓存）
CREATE INDEX IF NOT EXISTS qa_cache_expires_idx ON qa_cache (expires_at);

-- 命中次数索引（用于统计热门问题）
CREATE INDEX IF NOT EXISTS qa_cache_hit_count_idx ON qa_cache (hit_count DESC);

-- 添加注释
COMMENT ON TABLE qa_cache IS '1.3.15: 问答语义缓存表，用于缓存问答对实现快速响应';
COMMENT ON COLUMN qa_cache.question_embedding IS '问题的向量表示，用于语义相似度匹配';
COMMENT ON COLUMN qa_cache.hit_count IS '缓存命中次数，用于统计和优化';
COMMENT ON COLUMN qa_cache.expires_at IS '缓存过期时间，默认24小时';
COMMENT ON COLUMN qa_cache.follow_up IS '缓存的 follow-up 推荐问题列表';

-- 创建自动清理过期缓存的函数
CREATE OR REPLACE FUNCTION cleanup_expired_qa_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM qa_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_qa_cache IS '1.3.15: 清理过期的问答缓存';

-- 创建更新命中计数的函数
CREATE OR REPLACE FUNCTION update_qa_cache_hit(cache_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE qa_cache 
    SET hit_count = hit_count + 1, 
        last_hit_at = NOW()
    WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_qa_cache_hit IS '1.3.15: 更新问答缓存的命中计数';

-- 创建根据知识库ID清除缓存的函数（知识库更新时调用）
CREATE OR REPLACE FUNCTION clear_qa_cache_by_kb(kb_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM qa_cache WHERE knowledge_base_id = kb_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION clear_qa_cache_by_kb IS '1.3.15: 清除指定知识库的所有问答缓存';

-- RLS 策略（允许服务端访问）
ALTER TABLE qa_cache ENABLE ROW LEVEL SECURITY;

-- 服务端可以完全访问（使用 service_role key）
CREATE POLICY "Service role has full access to qa_cache" ON qa_cache
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 允许匿名用户读取缓存（用于公开分享的知识库）
CREATE POLICY "Allow read access to qa_cache" ON qa_cache
    FOR SELECT
    USING (true);

-- 创建语义相似度匹配函数（核心功能）
-- 使用 pgvector 的 cosine distance 进行相似度搜索
CREATE OR REPLACE FUNCTION match_qa_cache(
    query_embedding vector(1536),
    match_kb_id UUID,
    match_language VARCHAR(10),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE (
    id UUID,
    question TEXT,
    answer TEXT,
    context TEXT,
    citations JSONB,
    follow_up JSONB,
    distance FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qa.id,
        qa.question,
        qa.answer,
        qa.context,
        qa.citations,
        qa.follow_up,
        (qa.question_embedding <=> query_embedding)::FLOAT as distance
    FROM qa_cache qa
    WHERE qa.knowledge_base_id = match_kb_id
      AND qa.language = match_language
      AND qa.expires_at > NOW()
      AND (qa.question_embedding <=> query_embedding) < match_threshold
    ORDER BY qa.question_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_qa_cache IS '1.3.15: 使用 pgvector 进行语义相似度匹配，查找缓存的问答对';
