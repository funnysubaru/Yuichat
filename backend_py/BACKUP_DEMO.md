# 🎬 备份系统演示

## 场景 1：日常备份（2 分钟）

### 步骤

```bash
# 1. 进入 backend_py 目录
cd backend_py

# 2. 设置环境变量（如果未设置）
export GCP_PROJECT_ID="yuichat-project"
export DATABASE_URL="postgresql://..."

# 3. 执行备份
./backup-all.sh
```

### 预期输出

```
╔════════════════════════════════════════════════════════════╗
║              YUIChat 完整备份脚本 v1.3.24                  ║
╚════════════════════════════════════════════════════════════╝

📅 备份时间: 20260128_140530
📁 备份目录: ./backups/20260128_140530

🔍 检查依赖...
✓ 依赖检查完成

☁️  [1/5] 备份 Cloud Run 配置...
  → 导出服务配置...
  → 导出服务详情...
  → 记录镜像信息...
  ✓ Cloud Run 配置备份完成

🗄️  [2/5] 备份 Supabase 数据库...
  → 完整备份（包含数据和结构）...
  → 备份数据库结构...
  → 备份数据...
  ✓ Supabase 数据库备份完成

📜 [3/5] 备份 Supabase Migrations...
  ✓ 已备份 12 个 migration 文件

⚙️  [4/5] 备份配置文件...
  ✓ 配置文件备份完成

📋 [5/5] 创建备份清单...
  ✓ 备份清单已创建

╔════════════════════════════════════════════════════════════╗
║                  ✅ 备份完成！                             ║
╚════════════════════════════════════════════════════════════╝

📊 备份统计：
- Cloud Run: 5 个文件
- Supabase 数据库: 4 个文件
- Migrations: 12 个文件
- 配置文件: 6 个文件
备份大小: 45M

📁 备份位置：
  ./backups/20260128_140530
```

---

## 场景 2：部署前备份（1 分钟）

```bash
# 部署前快速备份
./backup-all.sh && ./deploy-gcp.sh
```

如果备份失败，部署不会执行（`&&` 逻辑）。

---

## 场景 3：灾难恢复（5 分钟）

### 问题：生产数据库被误删除

```bash
# 1. 查看最近的备份
ls -lt backups/ | head -5

# 2. 确认备份时间
cat backups/20260128_020000/BACKUP_INFO.txt

# 3. 执行恢复
./restore-backup.sh backups/20260128_020000 --supabase

# 4. 验证数据
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM knowledge_bases;"
```

---

## 场景 4：回滚 Cloud Run 配置（3 分钟）

### 问题：新部署导致服务异常

```bash
# 1. 找到上一个正常的备份
ls -lt backups/ | grep "20260127"

# 2. 恢复 Cloud Run 配置
./restore-backup.sh backups/20260127_235900 --cloud-run

# 3. 验证服务
gcloud run services describe yuichat-backend \
    --region asia-east1 \
    --format="value(status.url)"

# 4. 测试健康检查
curl https://your-service-url/health
```

---

## 场景 5：迁移到新环境（10 分钟）

### 步骤：从开发环境迁移到生产环境

```bash
# === 源环境（开发） ===

# 1. 创建完整备份
export GCP_PROJECT_ID="dev-project"
export DATABASE_URL="postgresql://dev-db..."
./backup-all.sh

# 2. 下载备份
BACKUP_DIR=$(ls -t backups/ | head -1)
tar -czf ~/yuichat-backup.tar.gz "backups/${BACKUP_DIR}"


# === 目标环境（生产） ===

# 3. 上传并解压备份
scp ~/yuichat-backup.tar.gz prod-server:/tmp/
ssh prod-server "cd /path/to/yuichat/backend_py && tar -xzf /tmp/yuichat-backup.tar.gz"

# 4. 设置生产环境变量
export GCP_PROJECT_ID="prod-project"
export DATABASE_URL="postgresql://prod-db..."

# 5. 恢复数据（仅数据库，不恢复 Cloud Run）
./restore-backup.sh backups/YYYYMMDD_HHMMSS --supabase --migrations

# 6. 验证迁移
psql "$DATABASE_URL" -c "\dt"
```

---

## 场景 6：自动化每日备份（GitHub Actions）

### 配置文件：`.github/workflows/daily-backup.yml`

```yaml
name: Daily Backup

on:
  schedule:
    - cron: '0 18 * * *'  # UTC 18:00 = 北京时间 02:00
  workflow_dispatch:

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
      
      - name: Install PostgreSQL
        run: sudo apt-get install -y postgresql-client
      
      - name: Run Backup
        env:
          GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          cd backend_py
          ./backup-all.sh
      
      - name: Upload to Cloud Storage
        run: |
          BACKUP=$(ls -t backend_py/backups/ | head -1)
          gsutil -m cp -r "backend_py/backups/${BACKUP}" \
            "gs://yuichat-backups/"
      
      - name: Cleanup Old Local Backups
        run: |
          cd backend_py/backups
          ls -t | tail -n +4 | xargs rm -rf
```

### 设置 Secrets

在 GitHub 仓库设置中添加：
- `GCP_SA_KEY`: Service Account JSON key
- `GCP_PROJECT_ID`: GCP 项目 ID
- `DATABASE_URL`: Supabase 连接字符串

---

## 🎯 最佳实践总结

1. **部署前必备份**：降低回滚风险
2. **每日自动备份**：防止数据丢失
3. **异地存储**：上传到 Cloud Storage
4. **定期测试恢复**：确保备份可用
5. **保留策略**：30 天内的备份

---

## 📊 备份时间参考

| 数据量 | 备份时间 | 恢复时间 |
|--------|---------|---------|
| 小型（< 1GB） | 1-2 分钟 | 2-3 分钟 |
| 中型（1-10GB） | 3-5 分钟 | 5-10 分钟 |
| 大型（> 10GB） | 10+ 分钟 | 15+ 分钟 |

---

## 💡 提示

- 使用 `--supabase` 可以只恢复数据库，速度更快
- 备份文件存储在 `backups/` 目录，不会提交到 Git
- 可以安全删除 30 天前的旧备份
- 生产环境建议配置自动上传到 Cloud Storage
