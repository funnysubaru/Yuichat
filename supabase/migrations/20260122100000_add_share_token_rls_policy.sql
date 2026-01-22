-- 1.2.51: 添加匿名访问分享链接的 RLS 策略
-- 允许任何人通过 share_token 查询知识库（用于分享链接功能）

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Public can view knowledge bases by share_token" ON knowledge_bases;

-- 创建新策略：允许通过 share_token 查询知识库
CREATE POLICY "Public can view knowledge bases by share_token"
ON knowledge_bases
FOR SELECT
USING (share_token IS NOT NULL);

-- 注释说明
COMMENT ON POLICY "Public can view knowledge bases by share_token" ON knowledge_bases IS 
'允许匿名用户通过 share_token 查询知识库，用于分享链接功能 (1.2.51)';
