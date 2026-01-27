# 备份快速开始指南

## 🚀 5 分钟快速设置

### 1. 设置环境变量

创建或编辑 `.env.local` 文件：

```bash
# Cloud Run 配置
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="asia-east1"

# Supabase 配置
export DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
export SUPABASE_PROJECT_REF="your-project-ref"
```

加载环境变量：

```bash
source .env.local
```

### 2. 执行首次备份

```bash
cd backend_py
./backup-all.sh
```

### 3. 查看备份结果

```bash
# 列出所有备份
ls -lh backups/

# 查看最新备份详情
cat backups/$(ls -t backups/ | head -1)/BACKUP_INFO.txt
```

---

## 📅 设置自动备份（可选）

### 使用 Cron（本地/服务器）

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 2 点自动备份
0 2 * * * cd /Users/haya_ceo/Projects/Yuichat/backend_py && source ../.env.local && ./backup-all.sh >> backup.log 2>&1
```

### 上传到 Cloud Storage

```bash
# 创建存储桶（首次）
gsutil mb -l asia-east1 gs://yuichat-backups

# 上传最新备份
LATEST=$(ls -t backups/ | head -1)
gsutil -m cp -r "backups/${LATEST}" gs://yuichat-backups/
```

---

## 🔄 测试恢复

### 恢复到测试环境

```bash
# 1. 设置测试环境的数据库 URL
export DATABASE_URL="postgresql://test-database-url..."

# 2. 执行恢复
./restore-backup.sh backups/20260128_120000 --supabase

# 3. 验证恢复结果
psql "$DATABASE_URL" -c "\dt"
```

---

## 📊 备份策略建议

| 环境 | 频率 | 方式 | 保留期 |
|------|------|------|--------|
| **生产** | 每日 02:00 | Cron + Cloud Storage | 30 天 |
| **开发** | 每周一次 | 手动 | 4 周 |
| **部署前** | 每次部署前 | 手动 | 永久（Git 标签）|

---

## ⚠️ 重要提示

1. **首次使用前**请在测试环境验证备份和恢复流程
2. **定期测试**备份文件的可用性
3. **生产环境**备份应上传到 Cloud Storage
4. **敏感信息**：备份文件包含数据库内容，请妥善保管

---

## 🆘 常见问题

### Q: 如何只备份数据库不备份 Cloud Run？

```bash
# 临时取消 GCP_PROJECT_ID
unset GCP_PROJECT_ID
./backup-all.sh
```

### Q: 备份失败怎么办？

1. 检查环境变量是否正确设置
2. 检查网络连接
3. 查看详细错误信息
4. 参考 `docs/BACKUP_GUIDE.md` 故障排除部分

### Q: 如何恢复到指定日期？

```bash
# 列出所有备份及日期
ls -lh backups/

# 选择要恢复的备份
./restore-backup.sh backups/20260128_120000
```

---

## 📚 更多信息

完整文档请查看：[docs/BACKUP_GUIDE.md](../docs/BACKUP_GUIDE.md)
