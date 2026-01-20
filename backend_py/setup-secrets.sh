#!/bin/bash
# 1.2.35: 设置 GCP Secret Manager 密钥

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 设置 GCP Secret Manager 密钥${NC}"

# 配置变量
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"

if [ "$PROJECT_ID" = "your-project-id" ]; then
    echo -e "${RED}❌ 请设置 GCP_PROJECT_ID 环境变量${NC}"
    exit 1
fi

# 设置项目
gcloud config set project ${PROJECT_ID}

# 启用 Secret Manager API
echo -e "${YELLOW}🔧 启用 Secret Manager API...${NC}"
gcloud services enable secretmanager.googleapis.com

# 提示用户输入密钥
echo -e "${YELLOW}📝 请准备以下密钥：${NC}"
echo ""
echo "1. Supabase URL"
echo "   示例: https://<YOUR_PROJECT_REF>.supabase.co"
echo "   位置: Supabase Dashboard -> Settings -> API -> Project URL"
echo ""
echo "2. Supabase Service Role Key"
echo "   位置: Supabase Dashboard -> Settings -> API -> service_role key"
echo "   注意: 这是 service_role key（不是 anon key）"
echo ""
echo "3. OpenAI API Key"
echo "   格式: sk-..."
echo "   位置: https://platform.openai.com/api-keys"
echo ""
echo "4. PGVector Database URL"
echo "   位置: Supabase Dashboard -> Settings -> Database -> Connection string"
echo "   格式: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
echo "   注意: 如果密码包含特殊字符，需要进行 URL 编码"
echo ""
echo -e "${YELLOW}按 Enter 继续，或 Ctrl+C 取消...${NC}"
read

read -p "Supabase URL: " SUPABASE_URL
read -sp "Supabase Service Role Key: " SUPABASE_KEY
echo ""
read -sp "OpenAI API Key: " OPENAI_KEY
echo ""
read -sp "PGVector Database URL: " PGVECTOR_URL
echo ""

# 创建密钥
echo -e "${YELLOW}🔐 创建密钥...${NC}"

echo -n "${SUPABASE_URL}" | gcloud secrets create supabase-url --data-file=- --replication-policy="automatic" 2>/dev/null || \
    echo -n "${SUPABASE_URL}" | gcloud secrets versions add supabase-url --data-file=-

echo -n "${SUPABASE_KEY}" | gcloud secrets create supabase-service-role-key --data-file=- --replication-policy="automatic" 2>/dev/null || \
    echo -n "${SUPABASE_KEY}" | gcloud secrets versions add supabase-service-role-key --data-file=-

echo -n "${OPENAI_KEY}" | gcloud secrets create openai-api-key --data-file=- --replication-policy="automatic" 2>/dev/null || \
    echo -n "${OPENAI_KEY}" | gcloud secrets versions add openai-api-key --data-file=-

echo -n "${PGVECTOR_URL}" | gcloud secrets create pgvector-database-url --data-file=- --replication-policy="automatic" 2>/dev/null || \
    echo -n "${PGVECTOR_URL}" | gcloud secrets versions add pgvector-database-url --data-file=-

echo ""
echo -e "${GREEN}✅ 密钥设置完成！${NC}"
echo ""
echo -e "${YELLOW}📝 已创建的密钥：${NC}"
echo "  - supabase-url"
echo "  - supabase-service-role-key"
echo "  - openai-api-key"
echo "  - pgvector-database-url"
