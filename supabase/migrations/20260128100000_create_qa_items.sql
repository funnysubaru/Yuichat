-- 1.3.30: QA问答表
-- 用于存储用户创建的问答对，支持相似问题和批量上传

-- 创建QA问答表
CREATE TABLE IF NOT EXISTS qa_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  question TEXT NOT NULL,                         -- 主问题
  answer TEXT NOT NULL,                           -- 答案
  similar_questions TEXT[] DEFAULT '{}',          -- 相似问题数组
  source TEXT NOT NULL DEFAULT 'custom' CHECK (source IN ('custom', 'batch')),  -- 来源：custom(自定义编辑), batch(批量上传)
  word_count INTEGER DEFAULT 0,                   -- 答案字数
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'learned', 'failed')),  -- 状态
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加表注释
COMMENT ON TABLE qa_items IS '1.3.30: QA问答表，存储用户自定义的问答对';
COMMENT ON COLUMN qa_items.question IS '主问题';
COMMENT ON COLUMN qa_items.answer IS '答案内容';
COMMENT ON COLUMN qa_items.similar_questions IS '相似问题数组，支持多个问题对应同一答案';
COMMENT ON COLUMN qa_items.source IS '来源：custom(自定义编辑), batch(批量上传)';
COMMENT ON COLUMN qa_items.word_count IS '答案字数';
COMMENT ON COLUMN qa_items.status IS '学习状态：pending(待学习), learned(学习成功), failed(学习失败)';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_qa_items_knowledge_base_id ON qa_items(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_qa_items_status ON qa_items(status);
CREATE INDEX IF NOT EXISTS idx_qa_items_source ON qa_items(source);
CREATE INDEX IF NOT EXISTS idx_qa_items_created_at ON qa_items(created_at DESC);

-- 启用 RLS
ALTER TABLE qa_items ENABLE ROW LEVEL SECURITY;

-- RLS策略：用户只能访问自己知识库下的QA问答
CREATE POLICY "Users can view their own qa_items"
  ON qa_items
  FOR SELECT
  USING (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own qa_items"
  ON qa_items
  FOR INSERT
  WITH CHECK (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own qa_items"
  ON qa_items
  FOR UPDATE
  USING (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own qa_items"
  ON qa_items
  FOR DELETE
  USING (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

-- 创建更新 updated_at 的触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS update_qa_items_updated_at ON qa_items;
CREATE TRIGGER update_qa_items_updated_at
  BEFORE UPDATE ON qa_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 创建QA上传记录表
CREATE TABLE IF NOT EXISTS qa_upload_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,                         -- 上传的文件名
  file_size BIGINT DEFAULT 0,                     -- 文件大小（字节）
  total_count INTEGER DEFAULT 0,                  -- 总条目数
  success_count INTEGER DEFAULT 0,                -- 成功导入数
  failed_count INTEGER DEFAULT 0,                 -- 失败数
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,                             -- 错误信息
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 添加表注释
COMMENT ON TABLE qa_upload_records IS '1.3.30: QA批量上传记录表';
COMMENT ON COLUMN qa_upload_records.filename IS '上传的文件名';
COMMENT ON COLUMN qa_upload_records.total_count IS '文件中的总条目数';
COMMENT ON COLUMN qa_upload_records.success_count IS '成功导入的条目数';
COMMENT ON COLUMN qa_upload_records.failed_count IS '导入失败的条目数';
COMMENT ON COLUMN qa_upload_records.status IS '处理状态';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_qa_upload_records_knowledge_base_id ON qa_upload_records(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_qa_upload_records_created_at ON qa_upload_records(created_at DESC);

-- 启用 RLS
ALTER TABLE qa_upload_records ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "Users can view their own qa_upload_records"
  ON qa_upload_records
  FOR SELECT
  USING (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own qa_upload_records"
  ON qa_upload_records
  FOR INSERT
  WITH CHECK (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own qa_upload_records"
  ON qa_upload_records
  FOR UPDATE
  USING (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
    )
  );
