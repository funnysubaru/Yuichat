# YUIChat 备份与恢复指南

> 版本: 1.3.24  
> 更新日期: 2026-01-28

## 📋 目录

- [快速开始](#快速开始)
- [手动备份](#手动备份)
- [自动备份设置](#自动备份设置)
- [备份内容](#备份内容)
- [恢复操作](#恢复操作)
- [最佳实践](#最佳实践)

---

## 🚀 快速开始

### 前置要求

```bash
# 1. 安装 gcloud CLI
https://cloud.google.com/sdk/docs/install

# 2. 安装 PostgreSQL 客户端（用于 pg_dump）
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt install postgresql-client

# 3. 设置环境变量
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="asia-east1"
export DATABASE_URL="postgresql://..."
```

### 执行备份

```bash
cd backend_py

# 添加执行权限（首次）
chmod +x backup-all.sh restore-backup.sh

# 执行完整备份
./backup-all.sh
```

---

## 📦 手动备份

### 完整备份

备份所有内容（推荐）：

```bash
cd backend_py
./backup-all.sh
```

备份内容包括：
- ✅ Cloud Run 服务配置
- ✅ Cloud Run 镜像信息
- ✅ Supabase 数据库（schema + data）
- ✅ Supabase migrations
- ✅ 配置文件（Dockerfile、cloudbuild.yaml等）

### 查看备份

```bash
# 备份保存在
ls -lh backend_py/backups/

# 查看最新备份
ls -lt backend_py/backups/ | head -n 2

# 查看备份信息
cat backend_py/backups/YYYYMMDD_HHMMSS/BACKUP_INFO.txt
```

---

## ⏰ 自动备份设置

### 方案 1：使用 Cloud Scheduler（推荐）

#### 1.1 创建备份脚本的 Cloud Function

创建 `backup-function/main.py`：

```python
import subprocess
import os
from datetime import datetime

def run_backup(request):
    """触发备份脚本"""
    try:
        # 执行备份
        result = subprocess.run(
            ['/workspace/backup-all.sh'],
            capture_output=True,
            text=True
        )
        
        return {
            'status': 'success',
            'timestamp': datetime.now().isoformat(),
            'output': result.stdout
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e)
        }, 500
```

#### 1.2 部署 Cloud Function

```bash
gcloud functions deploy backup-yuichat \
    --runtime python311 \
    --trigger-http \
    --allow-unauthenticated \
    --entry-point run_backup \
    --region asia-east1
```

#### 1.3 创建 Cloud Scheduler 任务

```bash
# 每天凌晨 2 点备份
gcloud scheduler jobs create http daily-backup \
    --location asia-east1 \
    --schedule "0 2 * * *" \
    --uri "https://asia-east1-PROJECT_ID.cloudfunctions.net/backup-yuichat" \
    --http-method POST
```

### 方案 2：使用 GitHub Actions

创建 `.github/workflows/backup.yml`：

```yaml
name: Daily Backup

on:
  schedule:
    # 每天 UTC 18:00 (北京时间 02:00)
    - cron: '0 18 * * *'
  workflow_dispatch:  # 手动触发

jobs:
  backup:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup gcloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT_ID }}
      
      - name: Install PostgreSQL client
        run: sudo apt-get install -y postgresql-client
      
      - name: Run backup
        env:
          GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          cd backend_py
          chmod +x backup-all.sh
          ./backup-all.sh
      
      - name: Upload to Cloud Storage
        run: |
          BACKUP_DIR=$(ls -t backend_py/backups/ | head -n1)
          gsutil -m cp -r "backend_py/backups/${BACKUP_DIR}" \
            "gs://yuichat-backups/"
```

### 方案 3：本地 Cron（开发环境）

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 2 点备份
0 2 * * * cd /path/to/Yuichat/backend_py && ./backup-all.sh >> backup.log 2>&1
```

---

## 📂 备份内容

### 目录结构

```
backups/YYYYMMDD_HHMMSS/
├── cloud_run/
│   ├── service-config.yaml      # 服务配置（用于恢复）
│   ├── service-details.yaml     # 详细信息
│   ├── current-image.txt        # 当前镜像
│   ├── revisions.yaml           # 所有版本
│   └── secrets-list.yaml        # Secrets 列表
├── supabase/
│   ├── full-backup.dump         # 完整备份（推荐用于恢复）
│   ├── schema.sql               # 仅结构
│   ├── data.sql                 # 仅数据
│   └── public-schema.sql        # Public schema
├── migrations/
│   └── migrations/              # 所有 migration 文件
├── configs/
│   ├── VERSION
│   ├── package.json
│   ├── requirements.txt
│   ├── cloudbuild.yaml
│   ├── Dockerfile
│   └── config.toml
└── BACKUP_INFO.txt              # 备份元信息
```

---

## 🔄 恢复操作

### 完整恢复

```bash
cd backend_py

# 查看可用备份
ls -lt backups/

# 恢复所有内容
./restore-backup.sh backups/20260128_120000
```

### 部分恢复

```bash
# 仅恢复 Cloud Run 配置
./restore-backup.sh backups/20260128_120000 --cloud-run

# 仅恢复 Supabase 数据库
./restore-backup.sh backups/20260128_120000 --supabase

# 仅恢复 Migrations
./restore-backup.sh backups/20260128_120000 --migrations
```

### 手动恢复

#### Cloud Run

```bash
# 方法 1: 使用配置文件
gcloud run services replace \
    backups/YYYYMMDD_HHMMSS/cloud_run/service-config.yaml \
    --region asia-east1

# 方法 2: 回滚到特定版本
gcloud run services update-traffic yuichat-backend \
    --region asia-east1 \
    --to-revisions=REVISION_NAME=100
```

#### Supabase 数据库

```bash
# 从 dump 文件恢复
pg_restore --dbname="$DATABASE_URL" \
    --clean \
    --if-exists \
    backups/YYYYMMDD_HHMMSS/supabase/full-backup.dump

# 或从 SQL 文件恢复
psql "$DATABASE_URL" < backups/YYYYMMDD_HHMMSS/supabase/schema.sql
psql "$DATABASE_URL" < backups/YYYYMMDD_HHMMSS/supabase/data.sql
```

---

## 📊 最佳实践

### 备份策略

| 类型 | 频率 | 保留期限 | 存储位置 |
|------|------|---------|---------|
| **生产数据库** | 每日 | 30 天 | Cloud Storage |
| **Cloud Run 配置** | 每次部署 | 10 个版本 | Git + Cloud Storage |
| **Migrations** | 实时 | 永久 | Git（版本控制） |
| **完整快照** | 每周 | 12 周 | Cloud Storage |

### 备份验证

定期验证备份可用性：

```bash
# 1. 检查备份完整性
ls -lh backups/LATEST/

# 2. 验证数据库备份
pg_restore --list backups/LATEST/supabase/full-backup.dump

# 3. 测试恢复（在测试环境）
./restore-backup.sh backups/LATEST --supabase
```

### 灾难恢复计划

1. **立即响应**（< 5 分钟）
   - 确认问题范围
   - 通知团队
   - 暂停自动部署

2. **评估损失**（5-15 分钟）
   - 检查最近备份
   - 确定恢复点（RPO）
   - 估计恢复时间（RTO）

3. **执行恢复**（15-60 分钟）
   - 恢复数据库
   - 恢复 Cloud Run 服务
   - 验证功能正常

4. **验证与监控**（60+ 分钟）
   - 功能测试
   - 数据一致性检查
   - 持续监控

### 存储到 Cloud Storage

```bash
# 创建 bucket（首次）
gsutil mb -l asia-east1 gs://yuichat-backups

# 上传备份
BACKUP_DIR=$(ls -t backend_py/backups/ | head -n1)
gsutil -m cp -r "backend_py/backups/${BACKUP_DIR}" \
    "gs://yuichat-backups/"

# 设置生命周期（30 天后自动删除）
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30}
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://yuichat-backups
```

---

## 🔐 安全注意事项

### 备份加密

```bash
# 加密备份
tar -czf - backups/LATEST | \
    openssl enc -aes-256-cbc -salt -out backup.tar.gz.enc

# 解密备份
openssl enc -d -aes-256-cbc -in backup.tar.gz.enc | \
    tar -xzf -
```

### 访问控制

```bash
# 限制 Cloud Storage bucket 访问
gsutil iam ch -d allUsers:objectViewer gs://yuichat-backups

# 仅允许服务账号访问
gsutil iam ch \
    serviceAccount:backup@PROJECT_ID.iam.gserviceaccount.com:objectAdmin \
    gs://yuichat-backups
```

---

## 📞 故障排除

### 常见问题

**Q: pg_dump 连接超时**
```bash
# 增加超时时间
export PGCONNECT_TIMEOUT=60
./backup-all.sh
```

**Q: Cloud Run 配置备份失败**
```bash
# 检查权限
gcloud projects get-iam-policy $GCP_PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:user:$(gcloud config get-value account)"
```

**Q: 备份文件太大**
```bash
# 仅备份必要的 schema
pg_dump "$DATABASE_URL" \
    --schema=public \
    --exclude-table-data='logs' \
    --file=backup.sql
```

---

## 📚 相关文档

- [GCP Cloud Storage 备份](https://cloud.google.com/storage/docs/best-practices)
- [PostgreSQL 备份与恢复](https://www.postgresql.org/docs/current/backup.html)
- [Supabase 备份指南](https://supabase.com/docs/guides/platform/backups)

---

**最后更新**: 2026-01-28  
**维护者**: YUIChat Team
