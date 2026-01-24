#!/bin/bash
# 1.3.10: GCP Cloud Run 部署脚本 (优化版)
# 优化内容：
# - 使用 Artifact Registry 替代已弃用的 gcr.io
# - 1.2.46: 使用 Kaniko 构建器 + 层缓存加速构建
# - 移除每次部署都执行的 API 启用（改为一次性初始化）
# - 支持版本标签管理
# - 1.3.10: 修复双 revision 问题 - 一次部署完成所有配置
# - 1.3.10: 修复 SHORT_SHA substitution (改用 _SHORT_SHA)

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         YUIChat 后端部署到 GCP Cloud Run (v1.3.10)         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# 配置变量
# ============================================================================
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-asia-east1}"
SERVICE_NAME="yuichat-backend"
AR_REPO_NAME="yuichat"

# 镜像地址 (Artifact Registry)
IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO_NAME}/${SERVICE_NAME}"

# 获取版本号
if [ -f "../VERSION" ]; then
    VERSION=$(cat ../VERSION | tr -d '[:space:]')
else
    VERSION="latest"
fi

# 获取 Git 短 SHA（如果在 git 仓库中）
SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# ============================================================================
# 前置检查
# ============================================================================

# 检查 PROJECT_ID
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ 错误: 请设置 GCP_PROJECT_ID 环境变量${NC}"
    echo "  示例: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

# 检查 gcloud
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI 未安装。请访问 https://cloud.google.com/sdk/docs/install${NC}"
    exit 1
fi

# 检查 cloudbuild.yaml
if [ ! -f "cloudbuild.yaml" ]; then
    echo -e "${RED}❌ 找不到 cloudbuild.yaml 文件${NC}"
    exit 1
fi

# ============================================================================
# 显示配置
# ============================================================================
echo -e "${YELLOW}📋 配置信息：${NC}"
echo "  项目 ID:    ${PROJECT_ID}"
echo "  区域:       ${REGION}"
echo "  服务名:     ${SERVICE_NAME}"
echo "  版本:       ${VERSION}"
echo "  Git SHA:    ${SHORT_SHA}"
echo "  镜像:       ${IMAGE_BASE}"
echo ""

# 设置项目
gcloud config set project "${PROJECT_ID}" > /dev/null 2>&1

# ============================================================================
# 构建阶段 (使用 Cloud Build + 缓存)
# ============================================================================
echo -e "${CYAN}🏗️  [1/2] 构建 Docker 镜像 (使用缓存加速)...${NC}"
BUILD_START=$(date +%s)

# 1.3.10: 使用 _SHORT_SHA 替代 SHORT_SHA（Cloud Build 自定义变量必须以 _ 开头）
gcloud builds submit \
    --config=cloudbuild.yaml \
    --substitutions="_IMAGE=${IMAGE_BASE},_VERSION=${VERSION},_SHORT_SHA=${SHORT_SHA}" \
    --quiet

BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))
echo -e "${GREEN}  ✓ 构建完成 (耗时: ${BUILD_TIME}秒)${NC}"
echo ""

# ============================================================================
# 部署阶段
# ============================================================================
echo -e "${CYAN}🚀 [2/2] 部署到 Cloud Run...${NC}"
DEPLOY_START=$(date +%s)

# 1.3.10: 获取已有服务 URL（用于避免第二次 revision）
EXISTING_SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)' 2>/dev/null || echo "")

# 1.3.10: 构建环境变量 - 非首次部署时直接包含 CLOUD_RUN_SERVICE_URL
ENV_VARS="ENV=production,USE_PGVECTOR=true,MAX_CHUNKS=4,RETRIEVE_K=8,CRAWL_TIMEOUT=30000,CRAWL_MAX_RETRIES=3,CRAWL_MAX_CONCURRENT=3,WAIT_NETWORK_IDLE=2000,GCP_PROJECT_ID=${PROJECT_ID},GCP_LOCATION=${REGION},GCP_TASK_QUEUE=yuichat-tasks"

# 如果已存在 URL，在同一次 deploy 中设置（避免第二个 revision）
if [[ -n "${EXISTING_SERVICE_URL}" ]]; then
    ENV_VARS="${ENV_VARS},CLOUD_RUN_SERVICE_URL=${EXISTING_SERVICE_URL}"
    echo -e "${YELLOW}  📍 检测到已有服务 URL: ${EXISTING_SERVICE_URL}${NC}"
fi

gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE_BASE}:${SHORT_SHA}" \
    --platform managed \
    --region "${REGION}" \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 2 \
    --timeout 3600 \
    --max-instances 10 \
    --min-instances 0 \
    --set-env-vars "${ENV_VARS}" \
    --set-secrets "SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,OPENAI_API_KEY=openai-api-key:latest,PGVECTOR_DATABASE_URL=pgvector-database-url:latest" \
    --quiet

DEPLOY_END=$(date +%s)
DEPLOY_TIME=$((DEPLOY_END - DEPLOY_START))
echo -e "${GREEN}  ✓ 部署完成 (耗时: ${DEPLOY_TIME}秒)${NC}"
echo ""

# ============================================================================
# 获取服务信息
# ============================================================================
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')

# 1.3.10: 仅首次部署时需要补一次更新（之后每次都能在 deploy 时带上已有 URL）
if [[ -z "${EXISTING_SERVICE_URL}" ]]; then
    echo -e "${CYAN}🔧 首次部署: 更新 Cloud Tasks 回调 URL...${NC}"
    gcloud run services update "${SERVICE_NAME}" \
        --region "${REGION}" \
        --update-env-vars "CLOUD_RUN_SERVICE_URL=${SERVICE_URL}" \
        --quiet
    echo -e "${GREEN}  ✓ Cloud Tasks 回调 URL 已配置${NC}"
else
    echo -e "${GREEN}  ✓ Cloud Tasks 回调 URL 已在部署时配置（单次 revision）${NC}"
fi

TOTAL_TIME=$((BUILD_TIME + DEPLOY_TIME))

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ 部署完成！                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 部署统计：${NC}"
echo "  构建时间:   ${BUILD_TIME}秒"
echo "  部署时间:   ${DEPLOY_TIME}秒"
echo "  总计:       ${TOTAL_TIME}秒"
echo ""
echo -e "${YELLOW}📍 服务信息：${NC}"
echo "  URL:        ${SERVICE_URL}"
echo "  镜像:       ${IMAGE_BASE}:${SHORT_SHA}"
echo "  版本:       ${VERSION}"
echo ""
echo -e "${YELLOW}📝 常用命令：${NC}"
echo "  健康检查:   curl ${SERVICE_URL}/health"
echo "  查看日志:   gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
echo "  回滚版本:   gcloud run services update-traffic ${SERVICE_NAME} --region ${REGION} --to-revisions=REVISION_NAME=100"
echo ""
echo -e "${BLUE}💡 提示: 首次部署请先运行 ./setup-gcp-once.sh 进行初始化${NC}"
