# 快速部署指南

项目 ID: 581747554307  
项目名称: YUIChat

## 🚀 部署步骤

### 步骤 1: 设置环境变量

```bash
export GCP_PROJECT_ID=581747554307
export GCP_REGION=asia-east1
```

### 步骤 2: 设置 Secret Manager 密钥

运行脚本并输入以下信息：

```bash
cd backend_py
./setup-secrets.sh
```

**需要准备的密钥：**

1. **Supabase URL**: 
   ```
   https://ppodcyocqhzrjqujdxqr.supabase.co
   ```

2. **Supabase Service Role Key**: 
   - 在 Supabase Dashboard -> Settings -> API 中获取
   - 这是 `service_role` key（不是 `anon` key）

3. **OpenAI API Key**: 
   - 你的 OpenAI API Key（格式：`sk-...`）

4. **PGVector Database URL**: 
   - Supabase PostgreSQL 连接字符串
   - 格式：`postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
   - 在 Supabase Dashboard -> Settings -> Database -> Connection string 中获取
   - 注意：如果密码包含特殊字符，需要进行 URL 编码

### 步骤 3: 部署到 Cloud Run

设置完密钥后，运行部署脚本：

```bash
cd backend_py
./deploy-gcp.sh
```

部署过程包括：
1. 构建 Docker 镜像（约 5-10 分钟）
2. 推送到 Google Container Registry
3. 部署到 Cloud Run

### 步骤 4: 获取服务 URL

部署完成后，获取服务 URL：

```bash
gcloud run services describe yuichat-backend \
    --region asia-east1 \
    --format 'value(status.url)'
```

### 步骤 5: 更新前端配置

更新 `import.env` 文件：

```env
VITE_PY_BACKEND_URL=https://yuichat-backend-xxx-xx.a.run.app
```

## 📝 验证部署

### 检查健康状态

```bash
# 获取服务 URL
SERVICE_URL=$(gcloud run services describe yuichat-backend --region asia-east1 --format 'value(status.url)')

# 测试健康检查
curl ${SERVICE_URL}/health
```

应该返回：
```json
{
  "status": "healthy",
  "service": "YUIChat API",
  "version": "1.2.35"
}
```

### 查看日志

```bash
gcloud run services logs read yuichat-backend --region asia-east1 --limit 50
```

## 🔍 故障排查

### 如果部署失败

1. **检查构建日志**：
   ```bash
   gcloud builds list --limit 5
   gcloud builds log BUILD_ID
   ```

2. **检查服务状态**：
   ```bash
   gcloud run services describe yuichat-backend --region asia-east1
   ```

3. **检查密钥是否正确设置**：
   ```bash
   gcloud secrets list
   gcloud secrets versions access latest --secret="supabase-url"
   ```

### 常见问题

1. **构建超时**：增加构建超时时间
2. **内存不足**：增加内存限制（`--memory 8Gi`）
3. **密钥未找到**：确保所有密钥都已创建

## 📚 相关文档

- [GCP 部署文档](./GCP_DEPLOYMENT.md)
- [GCP CLI 配置](./GCP_CLI_SETUP.md)
