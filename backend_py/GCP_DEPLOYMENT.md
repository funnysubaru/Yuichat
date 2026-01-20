# GCP Cloud Run 部署指南

版本: 1.2.35

本文档介绍如何将 YUIChat Python 后端部署到 Google Cloud Platform (GCP) Cloud Run。

## 📋 前置要求

1. **GCP 账户**：已创建 Google Cloud Platform 账户
2. **GCP 项目**：已创建 GCP 项目并启用计费
3. **gcloud CLI**：已安装并配置 gcloud CLI
4. **Docker**：已安装 Docker（用于本地测试）
5. **Supabase 项目**：已配置 Supabase 数据库和 pgvector

## 🚀 快速开始

### 步骤 1: 安装和配置 gcloud CLI

```bash
# 安装 gcloud CLI（如果未安装）
# macOS
brew install google-cloud-sdk

# 或访问 https://cloud.google.com/sdk/docs/install

# 登录
gcloud auth login

# 设置项目
export GCP_PROJECT_ID=your-project-id
gcloud config set project ${GCP_PROJECT_ID}
```

### 步骤 2: 启用必要的 GCP API

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 步骤 3: 设置 Secret Manager 密钥

使用提供的脚本设置密钥：

```bash
cd backend_py
chmod +x setup-secrets.sh
export GCP_PROJECT_ID=your-project-id
./setup-secrets.sh
```

脚本会提示你输入以下密钥：
- `SUPABASE_URL`: Supabase 项目 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key
- `OPENAI_API_KEY`: OpenAI API Key
- `PGVECTOR_DATABASE_URL`: Supabase PostgreSQL 连接字符串

**手动设置密钥（可选）：**

```bash
# 创建密钥
echo -n "your-value" | gcloud secrets create secret-name --data-file=-

# 更新密钥
echo -n "new-value" | gcloud secrets versions add secret-name --data-file=-
```

### 步骤 4: 部署到 Cloud Run

使用提供的部署脚本：

```bash
cd backend_py
chmod +x deploy-gcp.sh
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=asia-east1  # 可选，默认 asia-east1
./deploy-gcp.sh
```

**手动部署（可选）：**

```bash
# 构建镜像
gcloud builds submit --tag gcr.io/${GCP_PROJECT_ID}/yuichat-backend

# 部署服务
gcloud run deploy yuichat-backend \
    --image gcr.io/${GCP_PROJECT_ID}/yuichat-backend \
    --platform managed \
    --region asia-east1 \
    --allow-unauthenticated \
    --memory 4Gi \
    --cpu 2 \
    --timeout 3600 \
    --max-instances 10 \
    --min-instances 0 \
    --set-env-vars "ENV=production,USE_PGVECTOR=true" \
    --set-secrets "SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,OPENAI_API_KEY=openai-api-key:latest,PGVECTOR_DATABASE_URL=pgvector-database-url:latest"
```

### 步骤 5: 获取服务 URL

部署完成后，获取服务 URL：

```bash
gcloud run services describe yuichat-backend \
    --region asia-east1 \
    --format 'value(status.url)'
```

### 步骤 6: 更新前端配置

更新 `import.env` 文件中的后端 URL：

```env
VITE_PY_BACKEND_URL=https://yuichat-backend-xxx-xx.a.run.app
```

## 📝 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 来源 |
|--------|------|--------|------|
| `SUPABASE_URL` | Supabase 项目 URL | - | Secret Manager |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | - | Secret Manager |
| `OPENAI_API_KEY` | OpenAI API Key | - | Secret Manager |
| `PGVECTOR_DATABASE_URL` | PostgreSQL 连接字符串 | - | Secret Manager |
| `ENV` | 环境类型 | `production` | 环境变量 |
| `USE_PGVECTOR` | 使用 pgvector | `true` | 环境变量 |
| `MAX_CHUNKS` | 文档片段数量 | `4` | 环境变量 |
| `RETRIEVE_K` | 检索文档数量 | `8` | 环境变量 |

### 资源配置

- **内存**: 4Gi（文档处理需要较多内存）
- **CPU**: 2 核
- **超时**: 3600 秒（60 分钟）
- **最大实例数**: 10
- **最小实例数**: 0（节省成本）

### 健康检查

服务包含健康检查端点：`GET /health`

```bash
# 测试健康检查
curl https://your-service-url.run.app/health
```

## 🔧 故障排查

### 查看日志

```bash
# 查看实时日志
gcloud run services logs read yuichat-backend --region asia-east1 --follow

# 查看最近的日志
gcloud run services logs read yuichat-backend --region asia-east1 --limit 50
```

### 常见问题

1. **构建失败**
   - 检查 Dockerfile 是否正确
   - 查看构建日志：`gcloud builds list`

2. **服务启动失败**
   - 检查环境变量和密钥是否正确设置
   - 查看服务日志

3. **内存不足**
   - 增加内存限制：`--memory 8Gi`

4. **超时错误**
   - 增加超时时间：`--timeout 3600`

5. **Selenium/Playwright 无法运行**
   - 确保 Dockerfile 中安装了所有浏览器依赖
   - 检查 `CHROME_BIN` 环境变量

## 💰 成本估算

Cloud Run 按使用量计费：

- **CPU**: $0.00002400/vCPU-秒
- **内存**: $0.00000250/GiB-秒
- **请求**: 前 200 万次免费

**示例（每月 100 万请求，平均 2GB 内存，2 CPU）：**
- 约 $20-50/月（取决于实际使用）

**节省成本建议：**
- 设置 `min-instances=0`（无请求时不运行）
- 使用合理的 `max-instances` 限制
- 监控实际使用情况并调整资源配置

## 🔄 更新部署

### 更新代码

```bash
# 重新构建和部署
./deploy-gcp.sh
```

### 更新环境变量

```bash
gcloud run services update yuichat-backend \
    --region asia-east1 \
    --update-env-vars "MAX_CHUNKS=6"
```

### 更新密钥

```bash
# 更新 Secret Manager 中的密钥
echo -n "new-value" | gcloud secrets versions add secret-name --data-file=-

# 重启服务以加载新密钥
gcloud run services update yuichat-backend \
    --region asia-east1
```

## 📚 相关文档

- [Cloud Run 文档](https://cloud.google.com/run/docs)
- [Secret Manager 文档](https://cloud.google.com/secret-manager/docs)
- [Dockerfile 最佳实践](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)

## ⚠️ 注意事项

1. **生产环境配置**：
   - 确保 `ENV=production`（减少日志输出）
   - 使用 `USE_PGVECTOR=true`（使用 Supabase pgvector）
   - 不要将密钥硬编码在代码中

2. **安全**：
   - 所有敏感信息存储在 Secret Manager
   - 限制 CORS 来源（生产环境）
   - 考虑启用身份验证

3. **性能**：
   - 文档处理可能需要较长时间，确保超时设置足够
   - 考虑使用 Cloud Tasks 处理长时间任务

4. **监控**：
   - 设置 Cloud Monitoring 告警
   - 监控错误率和响应时间
