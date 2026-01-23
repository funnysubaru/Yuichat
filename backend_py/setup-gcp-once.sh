#!/bin/bash
# 1.2.40: GCP 一次性初始化脚本
# 此脚本只需运行一次，用于：
# 1. 启用必要的 GCP API
# 2. 创建 Artifact Registry 仓库（替代已弃用的 gcr.io）
# 3. 配置必要的权限

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     YUIChat GCP 一次性初始化脚本 (v1.2.40)                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 配置变量
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-asia-east1}"
AR_REPO_NAME="yuichat"

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

echo -e "${YELLOW}📋 配置信息：${NC}"
echo "  项目 ID: ${PROJECT_ID}"
echo "  区域: ${REGION}"
echo "  Artifact Registry 仓库: ${AR_REPO_NAME}"
echo ""

# 确认
read -p "确认继续初始化？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 设置项目
echo -e "${YELLOW}🔧 [1/4] 设置 GCP 项目...${NC}"
gcloud config set project "${PROJECT_ID}"

# 启用 API
echo -e "${YELLOW}🔧 [2/5] 启用必要的 GCP API（这可能需要几分钟）...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    cloudtasks.googleapis.com \
    --quiet

echo -e "${GREEN}  ✓ API 已启用${NC}"

# 创建 Artifact Registry 仓库
echo -e "${YELLOW}🔧 [3/4] 创建 Artifact Registry 仓库...${NC}"
if gcloud artifacts repositories describe ${AR_REPO_NAME} --location=${REGION} &> /dev/null; then
    echo -e "${GREEN}  ✓ 仓库 '${AR_REPO_NAME}' 已存在${NC}"
else
    gcloud artifacts repositories create ${AR_REPO_NAME} \
        --repository-format=docker \
        --location=${REGION} \
        --description="YUIChat Docker images" \
        --quiet
    echo -e "${GREEN}  ✓ 仓库 '${AR_REPO_NAME}' 创建成功${NC}"
fi

# 创建 Cloud Tasks 队列（用于异步问题生成）
echo -e "${YELLOW}🔧 [4/5] 创建 Cloud Tasks 队列...${NC}"
TASK_QUEUE_NAME="yuichat-tasks"
if gcloud tasks queues describe ${TASK_QUEUE_NAME} --location=${REGION} &> /dev/null; then
    echo -e "${GREEN}  ✓ 队列 '${TASK_QUEUE_NAME}' 已存在${NC}"
else
    gcloud tasks queues create ${TASK_QUEUE_NAME} \
        --location=${REGION} \
        --max-dispatches-per-second=10 \
        --max-concurrent-dispatches=5 \
        --max-attempts=3 \
        --min-backoff=10s \
        --max-backoff=300s \
        --quiet
    echo -e "${GREEN}  ✓ 队列 '${TASK_QUEUE_NAME}' 创建成功${NC}"
fi

# 配置 Docker 认证
echo -e "${YELLOW}🔧 [5/5] 配置 Docker 认证...${NC}"
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
echo -e "${GREEN}  ✓ Docker 认证已配置${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ 初始化完成！                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📝 下一步：${NC}"
echo "  1. 设置 Secret Manager 密钥（如果尚未设置）:"
echo "     ./setup-secrets.sh"
echo ""
echo "  2. 部署应用:"
echo "     ./deploy-gcp.sh"
echo ""
echo -e "${YELLOW}📍 Artifact Registry 镜像地址：${NC}"
echo "  ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO_NAME}/yuichat-backend"
echo ""
echo -e "${BLUE}ℹ️  注意: gcr.io (Container Registry) 将于 2025-03-18 停止写入${NC}"
echo -e "${BLUE}   本脚本已配置使用 Artifact Registry 替代${NC}"
