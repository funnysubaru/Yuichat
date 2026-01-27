#!/bin/bash
# 1.3.24: 完整备份脚本 - Cloud Run + Supabase
# 备份内容：
# - Cloud Run 服务配置
# - Supabase 数据库（schema + data）
# - Supabase migrations
# - 环境变量和 secrets 列表

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# 配置变量
# ============================================================================
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/${BACKUP_DATE}"
PROJECT_ROOT="$(cd .. && pwd)"

# Cloud Run 配置
GCP_PROJECT_ID="${GCP_PROJECT_ID:-}"
GCP_REGION="${GCP_REGION:-asia-east1}"
SERVICE_NAME="yuichat-backend"

# Supabase 配置
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
DATABASE_URL="${DATABASE_URL:-}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              YUIChat 完整备份脚本 v1.3.24                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📅 备份时间: ${BACKUP_DATE}${NC}"
echo -e "${YELLOW}📁 备份目录: ${BACKUP_DIR}${NC}"
echo ""

# ============================================================================
# 前置检查
# ============================================================================
echo -e "${CYAN}🔍 检查依赖...${NC}"

# 检查必要的命令
MISSING_DEPS=()

if ! command -v gcloud &> /dev/null; then
    MISSING_DEPS+=("gcloud")
fi

if ! command -v pg_dump &> /dev/null; then
    MISSING_DEPS+=("pg_dump (PostgreSQL客户端)")
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo -e "${RED}❌ 缺少以下依赖:${NC}"
    for dep in "${MISSING_DEPS[@]}"; do
        echo "  - $dep"
    done
    echo ""
    echo -e "${YELLOW}💡 安装提示:${NC}"
    echo "  gcloud: https://cloud.google.com/sdk/docs/install"
    echo "  pg_dump: brew install postgresql (macOS) 或 apt install postgresql-client (Linux)"
    exit 1
fi

# 检查环境变量
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  警告: GCP_PROJECT_ID 未设置，将跳过 Cloud Run 备份${NC}"
    SKIP_CLOUD_RUN=true
else
    SKIP_CLOUD_RUN=false
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  警告: DATABASE_URL 未设置，将跳过 Supabase 数据库备份${NC}"
    SKIP_SUPABASE_DB=true
else
    SKIP_SUPABASE_DB=false
fi

echo -e "${GREEN}✓ 依赖检查完成${NC}"
echo ""

# 创建备份目录
mkdir -p "${BACKUP_DIR}"/{cloud_run,supabase,migrations,configs}

# ============================================================================
# 1. 备份 Cloud Run 配置
# ============================================================================
if [ "$SKIP_CLOUD_RUN" = false ]; then
    echo -e "${CYAN}☁️  [1/5] 备份 Cloud Run 配置...${NC}"
    
    # 备份服务配置
    echo "  → 导出服务配置..."
    gcloud run services describe "${SERVICE_NAME}" \
        --region "${GCP_REGION}" \
        --project "${GCP_PROJECT_ID}" \
        --format=export > "${BACKUP_DIR}/cloud_run/service-config.yaml" 2>/dev/null || {
        echo -e "${YELLOW}  ⚠️  无法导出服务配置${NC}"
    }
    
    # 备份服务详细信息
    echo "  → 导出服务详情..."
    gcloud run services describe "${SERVICE_NAME}" \
        --region "${GCP_REGION}" \
        --project "${GCP_PROJECT_ID}" \
        --format=yaml > "${BACKUP_DIR}/cloud_run/service-details.yaml" 2>/dev/null || {
        echo -e "${YELLOW}  ⚠️  无法导出服务详情${NC}"
    }
    
    # 备份当前使用的镜像
    echo "  → 记录镜像信息..."
    gcloud run services describe "${SERVICE_NAME}" \
        --region "${GCP_REGION}" \
        --project "${GCP_PROJECT_ID}" \
        --format='value(spec.template.spec.containers[0].image)' > "${BACKUP_DIR}/cloud_run/current-image.txt" 2>/dev/null || {
        echo -e "${YELLOW}  ⚠️  无法获取镜像信息${NC}"
    }
    
    # 列出所有 revisions
    echo "  → 导出所有修订版本..."
    gcloud run revisions list \
        --service "${SERVICE_NAME}" \
        --region "${GCP_REGION}" \
        --project "${GCP_PROJECT_ID}" \
        --format=yaml > "${BACKUP_DIR}/cloud_run/revisions.yaml" 2>/dev/null || {
        echo -e "${YELLOW}  ⚠️  无法列出修订版本${NC}"
    }
    
    # 备份 Secret Manager 列表
    echo "  → 导出 Secret Manager 列表..."
    gcloud secrets list \
        --project "${GCP_PROJECT_ID}" \
        --format=yaml > "${BACKUP_DIR}/cloud_run/secrets-list.yaml" 2>/dev/null || {
        echo -e "${YELLOW}  ⚠️  无法列出 secrets${NC}"
    }
    
    echo -e "${GREEN}  ✓ Cloud Run 配置备份完成${NC}"
else
    echo -e "${YELLOW}⊘ [1/5] 跳过 Cloud Run 备份${NC}"
fi
echo ""

# ============================================================================
# 2. 备份 Supabase 数据库
# ============================================================================
if [ "$SKIP_SUPABASE_DB" = false ]; then
    echo -e "${CYAN}🗄️  [2/5] 备份 Supabase 数据库...${NC}"
    
    # 完整备份（schema + data）
    echo "  → 完整备份（包含数据和结构）..."
    pg_dump "${DATABASE_URL}" \
        --format=custom \
        --file="${BACKUP_DIR}/supabase/full-backup.dump" 2>/dev/null || {
        echo -e "${RED}  ❌ 完整备份失败${NC}"
    }
    
    # 仅备份 schema
    echo "  → 备份数据库结构..."
    pg_dump "${DATABASE_URL}" \
        --schema-only \
        --file="${BACKUP_DIR}/supabase/schema.sql" 2>/dev/null || {
        echo -e "${YELLOW}  ⚠️  Schema 备份失败${NC}"
    }
    
    # 仅备份 data
    echo "  → 备份数据..."
    pg_dump "${DATABASE_URL}" \
        --data-only \
        --file="${BACKUP_DIR}/supabase/data.sql" 2>/dev/null || {
        echo -e "${YELLOW}  ⚠️  Data 备份失败${NC}"
    }
    
    # 备份 public schema 的表结构
    echo "  → 备份 public schema..."
    pg_dump "${DATABASE_URL}" \
        --schema=public \
        --schema-only \
        --file="${BACKUP_DIR}/supabase/public-schema.sql" 2>/dev/null || {
        echo -e "${YELLOW}  ⚠️  Public schema 备份失败${NC}"
    }
    
    echo -e "${GREEN}  ✓ Supabase 数据库备份完成${NC}"
else
    echo -e "${YELLOW}⊘ [2/5] 跳过 Supabase 数据库备份${NC}"
fi
echo ""

# ============================================================================
# 3. 备份 Supabase Migrations
# ============================================================================
echo -e "${CYAN}📜 [3/5] 备份 Supabase Migrations...${NC}"

if [ -d "${PROJECT_ROOT}/supabase/migrations" ]; then
    echo "  → 复制 migrations 文件..."
    cp -r "${PROJECT_ROOT}/supabase/migrations" "${BACKUP_DIR}/migrations/"
    
    # 统计文件数量
    MIGRATION_COUNT=$(ls -1 "${BACKUP_DIR}/migrations/migrations" | wc -l)
    echo -e "${GREEN}  ✓ 已备份 ${MIGRATION_COUNT} 个 migration 文件${NC}"
else
    echo -e "${YELLOW}  ⚠️  未找到 migrations 目录${NC}"
fi
echo ""

# ============================================================================
# 4. 备份配置文件
# ============================================================================
echo -e "${CYAN}⚙️  [4/5] 备份配置文件...${NC}"

# 备份 VERSION
if [ -f "${PROJECT_ROOT}/VERSION" ]; then
    cp "${PROJECT_ROOT}/VERSION" "${BACKUP_DIR}/configs/"
    echo "  ✓ VERSION"
fi

# 备份 package.json
if [ -f "${PROJECT_ROOT}/package.json" ]; then
    cp "${PROJECT_ROOT}/package.json" "${BACKUP_DIR}/configs/"
    echo "  ✓ package.json"
fi

# 备份 requirements.txt
if [ -f "${PROJECT_ROOT}/backend_py/requirements.txt" ]; then
    cp "${PROJECT_ROOT}/backend_py/requirements.txt" "${BACKUP_DIR}/configs/"
    echo "  ✓ requirements.txt"
fi

# 备份 cloudbuild.yaml
if [ -f "${PROJECT_ROOT}/backend_py/cloudbuild.yaml" ]; then
    cp "${PROJECT_ROOT}/backend_py/cloudbuild.yaml" "${BACKUP_DIR}/configs/"
    echo "  ✓ cloudbuild.yaml"
fi

# 备份 Dockerfile
if [ -f "${PROJECT_ROOT}/backend_py/Dockerfile" ]; then
    cp "${PROJECT_ROOT}/backend_py/Dockerfile" "${BACKUP_DIR}/configs/"
    echo "  ✓ Dockerfile"
fi

# 备份 supabase config
if [ -f "${PROJECT_ROOT}/supabase/config.toml" ]; then
    cp "${PROJECT_ROOT}/supabase/config.toml" "${BACKUP_DIR}/configs/"
    echo "  ✓ config.toml"
fi

echo -e "${GREEN}  ✓ 配置文件备份完成${NC}"
echo ""

# ============================================================================
# 5. 创建备份清单
# ============================================================================
echo -e "${CYAN}📋 [5/5] 创建备份清单...${NC}"

cat > "${BACKUP_DIR}/BACKUP_INFO.txt" << EOF
YUIChat 备份信息
=====================================
备份时间: ${BACKUP_DATE}
备份版本: $(cat ${PROJECT_ROOT}/VERSION 2>/dev/null || echo "未知")

Cloud Run 信息:
- 项目 ID: ${GCP_PROJECT_ID:-未设置}
- 区域: ${GCP_REGION}
- 服务名: ${SERVICE_NAME}

Supabase 信息:
- 项目引用: ${SUPABASE_PROJECT_REF:-未设置}

备份内容:
EOF

# 统计备份文件
if [ -d "${BACKUP_DIR}/cloud_run" ]; then
    echo "- Cloud Run: $(ls -1 ${BACKUP_DIR}/cloud_run | wc -l) 个文件" >> "${BACKUP_DIR}/BACKUP_INFO.txt"
fi

if [ -d "${BACKUP_DIR}/supabase" ]; then
    echo "- Supabase 数据库: $(ls -1 ${BACKUP_DIR}/supabase | wc -l) 个文件" >> "${BACKUP_DIR}/BACKUP_INFO.txt"
fi

if [ -d "${BACKUP_DIR}/migrations/migrations" ]; then
    echo "- Migrations: $(ls -1 ${BACKUP_DIR}/migrations/migrations | wc -l) 个文件" >> "${BACKUP_DIR}/BACKUP_INFO.txt"
fi

if [ -d "${BACKUP_DIR}/configs" ]; then
    echo "- 配置文件: $(ls -1 ${BACKUP_DIR}/configs | wc -l) 个文件" >> "${BACKUP_DIR}/BACKUP_INFO.txt"
fi

# 计算备份大小
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
echo "" >> "${BACKUP_DIR}/BACKUP_INFO.txt"
echo "备份大小: ${BACKUP_SIZE}" >> "${BACKUP_DIR}/BACKUP_INFO.txt"

echo -e "${GREEN}  ✓ 备份清单已创建${NC}"
echo ""

# ============================================================================
# 完成
# ============================================================================
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ✅ 备份完成！                             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 备份统计：${NC}"
cat "${BACKUP_DIR}/BACKUP_INFO.txt" | grep -E "^-|备份大小"
echo ""
echo -e "${YELLOW}📁 备份位置：${NC}"
echo "  ${BACKUP_DIR}"
echo ""
echo -e "${YELLOW}💡 恢复提示：${NC}"
echo "  Cloud Run:  gcloud run services replace ${BACKUP_DIR}/cloud_run/service-config.yaml"
echo "  Supabase:   pg_restore --dbname=\$DATABASE_URL ${BACKUP_DIR}/supabase/full-backup.dump"
echo ""
echo -e "${BLUE}📦 可选：上传到 Cloud Storage${NC}"
echo "  gsutil -m cp -r ${BACKUP_DIR} gs://your-backup-bucket/"
echo ""
