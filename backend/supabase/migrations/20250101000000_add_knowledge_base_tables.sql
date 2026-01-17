-- 1.0.0: YUIChat 项目 - 知识库相关表结构

-- 知识库表
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dify_dataset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文档表（存储文件元数据）
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE NOT NULL,
  dify_document_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_knowledge_base_id ON documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- 启用 RLS
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的知识库
CREATE POLICY "Users can view own knowledge bases"
  ON knowledge_bases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own knowledge bases"
  ON knowledge_bases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own knowledge bases"
  ON knowledge_bases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own knowledge bases"
  ON knowledge_bases FOR DELETE
  USING (auth.uid() = user_id);

-- RLS 策略：用户只能访问自己知识库的文档
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = documents.knowledge_base_id
      AND knowledge_bases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = documents.knowledge_base_id
      AND knowledge_bases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = documents.knowledge_base_id
      AND knowledge_bases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = documents.knowledge_base_id
      AND knowledge_bases.user_id = auth.uid()
    )
  );

