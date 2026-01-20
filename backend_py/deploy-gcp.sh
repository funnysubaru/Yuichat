#!/bin/bash
# 1.2.35: GCP Cloud Run 部署脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 开始部署 YUIChat 后端到 GCP Cloud Run${NC}"

# 检查必要的工具
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI 未安装。请访问 https://cloud.google.com/sdk/docs/install${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装。请访问 https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

# 配置变量（请根据实际情况修改）
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-asia-east1}"
SERVICE_NAME="yuichat-backend"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "${YELLOW}📋 配置信息：${NC}"
echo "  项目 ID: ${PROJECT_ID}"
echo "  区域: ${REGION}"
echo "  服务名: ${SERVICE_NAME}"
echo "  镜像: ${IMAGE_NAME}"
echo ""

# 检查是否设置了项目 ID
if [ "$PROJECT_ID" = "your-project-id" ]; then
    echo -e "${RED}❌ 请设置 GCP_PROJECT_ID 环境变量或修改脚本中的 PROJECT_ID${NC}"
    echo "  例如: export GCP_PROJECT_ID=your-actual-project-id"
    exit 1
fi

# 设置 GCP 项目
echo -e "${YELLOW}🔧 设置 GCP 项目...${NC}"
gcloud config set project ${PROJECT_ID}

# 启用必要的 API
echo -e "${YELLOW}🔧 启用必要的 GCP API...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# 构建 Docker 镜像
echo -e "${YELLOW}🏗️  构建 Docker 镜像...${NC}"
gcloud builds submit --tag ${IMAGE_NAME} --timeout=20m

# 部署到 Cloud Run
echo -e "${YELLOW}🚀 部署到 Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 2 \
    --timeout 3600 \
    --max-instances 10 \
    --min-instances 0 \
    --set-env-vars "ENV=production,USE_PGVECTOR=true,MAX_CHUNKS=4,RETRIEVE_K=8,CRAWL_TIMEOUT=30000,CRAWL_MAX_RETRIES=3,CRAWL_MAX_CONCURRENT=3,WAIT_NETWORK_IDLE=2000" \
    --set-secrets "SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,OPENAI_API_KEY=openai-api-key:latest,PGVECTOR_DATABASE_URL=pgvector-database-url:latest"

# 获取服务 URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo ""
echo -e "${GREEN}✅ 部署完成！${NC}"
echo -e "${GREEN}📍 服务 URL: ${SERVICE_URL}${NC}"
echo ""
echo -e "${YELLOW}📝 下一步：${NC}"
echo "  1. 更新前端环境变量 VITE_PY_BACKEND_URL=${SERVICE_URL}"
echo "  2. 测试健康检查: curl ${SERVICE_URL}/health"
echo "  3. 查看日志: gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
