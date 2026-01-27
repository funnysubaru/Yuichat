#!/bin/bash
# 1.3.24: 备份恢复脚本
# 用于恢复 Cloud Run 和 Supabase 的备份

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# 使用说明
# ============================================================================
usage() {
    echo "用法: $0 <备份目录> [选项]"
    echo ""
    echo "选项:"
    echo "  --cloud-run     仅恢复 Cloud Run 配置"
    echo "  --supabase      仅恢复 Supabase 数据库"
    echo "  --migrations    仅恢复 Migrations"
    echo "  --all           恢复所有内容（默认）"
    echo ""
    echo "示例:"
    echo "  $0 ./backups/20260128_120000"
    echo "  $0 ./backups/20260128_120000 --cloud-run"
    echo "  $0 ./backups/20260128_120000 --supabase"
    exit 1
}

# ============================================================================
# 参数解析
# ============================================================================
if [ $# -lt 1 ]; then
    usage
fi

BACKUP_DIR="$1"
shift

# 默认恢复所有
RESTORE_CLOUD_RUN=false
RESTORE_SUPABASE=false
RESTORE_MIGRATIONS=false
RESTORE_ALL=true

# 解析选项
while [ $# -gt 0 ]; do
    case "$1" in
        --cloud-run)
            RESTORE_CLOUD_RUN=true
            RESTORE_ALL=false
            ;;
        --supabase)
            RESTORE_SUPABASE=true
            RESTORE_ALL=false
            ;;
        --migrations)
            RESTORE_MIGRATIONS=true
            RESTORE_ALL=false
            ;;
        --all)
            RESTORE_ALL=true
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            usage
            ;;
    esac
    shift
done

# 如果指定了 --all，恢复所有内容
if [ "$RESTORE_ALL" = true ]; then
    RESTORE_CLOUD_RUN=true
    RESTORE_SUPABASE=true
    RESTORE_MIGRATIONS=true
fi

# ============================================================================
# 前置检查
# ============================================================================
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              YUIChat 备份恢复脚本 v1.3.24                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查备份目录
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}❌ 错误: 备份目录不存在: ${BACKUP_DIR}${NC}"
    exit 1
fi

echo -e "${YELLOW}📁 备份目录: ${BACKUP_DIR}${NC}"
echo ""

# 显示备份信息
if [ -f "${BACKUP_DIR}/BACKUP_INFO.txt" ]; then
    echo -e "${CYAN}📋 备份信息:${NC}"
    cat "${BACKUP_DIR}/BACKUP_INFO.txt"
    echo ""
fi

# 确认操作
echo -e "${RED}⚠️  警告: 恢复操作将覆盖现有配置和数据！${NC}"
echo ""
echo -e "${YELLOW}将要恢复的内容:${NC}"
[ "$RESTORE_CLOUD_RUN" = true ] && echo "  ✓ Cloud Run 配置"
[ "$RESTORE_SUPABASE" = true ] && echo "  ✓ Supabase 数据库"
[ "$RESTORE_MIGRATIONS" = true ] && echo "  ✓ Migrations"
echo ""

read -p "确认继续? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "已取消"
    exit 0
fi
echo ""

# 配置变量
GCP_PROJECT_ID="${GCP_PROJECT_ID:-}"
GCP_REGION="${GCP_REGION:-asia-east1}"
SERVICE_NAME="yuichat-backend"
DATABASE_URL="${DATABASE_URL:-}"

# ============================================================================
# 1. 恢复 Cloud Run 配置
# ============================================================================
if [ "$RESTORE_CLOUD_RUN" = true ]; then
    echo -e "${CYAN}☁️  [1/3] 恢复 Cloud Run 配置...${NC}"
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        echo -e "${RED}  ❌ GCP_PROJECT_ID 未设置${NC}"
    elif [ ! -f "${BACKUP_DIR}/cloud_run/service-config.yaml" ]; then
        echo -e "${YELLOW}  ⚠️  未找到 Cloud Run 配置文件${NC}"
    else
        echo "  → 恢复服务配置..."
        gcloud run services replace "${BACKUP_DIR}/cloud_run/service-config.yaml" \
            --region "${GCP_REGION}" \
            --project "${GCP_PROJECT_ID}" || {
            echo -e "${RED}  ❌ 恢复失败${NC}"
        }
        echo -e "${GREEN}  ✓ Cloud Run 配置恢复完成${NC}"
    fi
else
    echo -e "${YELLOW}⊘ [1/3] 跳过 Cloud Run 恢复${NC}"
fi
echo ""

# ============================================================================
# 2. 恢复 Supabase 数据库
# ============================================================================
if [ "$RESTORE_SUPABASE" = true ]; then
    echo -e "${CYAN}🗄️  [2/3] 恢复 Supabase 数据库...${NC}"
    
    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}  ❌ DATABASE_URL 未设置${NC}"
    elif [ ! -f "${BACKUP_DIR}/supabase/full-backup.dump" ]; then
        echo -e "${YELLOW}  ⚠️  未找到数据库备份文件${NC}"
    else
        echo -e "${RED}  ⚠️  这将清空并恢复整个数据库！${NC}"
        read -p "  确认恢复数据库? (yes/no): " DB_CONFIRM
        
        if [ "$DB_CONFIRM" = "yes" ]; then
            echo "  → 恢复数据库..."
            pg_restore --dbname="${DATABASE_URL}" \
                --clean \
                --if-exists \
                "${BACKUP_DIR}/supabase/full-backup.dump" || {
                echo -e "${RED}  ❌ 恢复失败${NC}"
            }
            echo -e "${GREEN}  ✓ Supabase 数据库恢复完成${NC}"
        else
            echo "  已跳过数据库恢复"
        fi
    fi
else
    echo -e "${YELLOW}⊘ [2/3] 跳过 Supabase 恢复${NC}"
fi
echo ""

# ============================================================================
# 3. 恢复 Migrations
# ============================================================================
if [ "$RESTORE_MIGRATIONS" = true ]; then
    echo -e "${CYAN}📜 [3/3] 恢复 Migrations...${NC}"
    
    PROJECT_ROOT="$(cd .. && pwd)"
    
    if [ ! -d "${BACKUP_DIR}/migrations/migrations" ]; then
        echo -e "${YELLOW}  ⚠️  未找到 migrations 备份${NC}"
    else
        echo "  → 复制 migrations 文件..."
        
        # 备份现有 migrations
        if [ -d "${PROJECT_ROOT}/supabase/migrations" ]; then
            CURRENT_DATE=$(date +%Y%m%d_%H%M%S)
            mv "${PROJECT_ROOT}/supabase/migrations" \
               "${PROJECT_ROOT}/supabase/migrations.backup.${CURRENT_DATE}"
            echo "  ℹ️  现有 migrations 已备份"
        fi
        
        # 恢复 migrations
        cp -r "${BACKUP_DIR}/migrations/migrations" "${PROJECT_ROOT}/supabase/"
        
        MIGRATION_COUNT=$(ls -1 "${PROJECT_ROOT}/supabase/migrations" | wc -l)
        echo -e "${GREEN}  ✓ 已恢复 ${MIGRATION_COUNT} 个 migration 文件${NC}"
    fi
else
    echo -e "${YELLOW}⊘ [3/3] 跳过 Migrations 恢复${NC}"
fi
echo ""

# ============================================================================
# 完成
# ============================================================================
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ✅ 恢复完成！                             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}💡 后续操作：${NC}"
echo "  1. 验证 Cloud Run 服务: gcloud run services describe ${SERVICE_NAME} --region ${GCP_REGION}"
echo "  2. 验证数据库连接: psql \${DATABASE_URL} -c '\\dt'"
echo "  3. 查看服务日志: gcloud run services logs read ${SERVICE_NAME} --region ${GCP_REGION}"
echo ""
