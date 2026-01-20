# GCP gcloud CLI 安装和配置指南

版本: 1.2.35

## ✅ 安装状态

gcloud CLI 已成功安装！

**当前版本**: Google Cloud SDK 552.0.0

## 🔧 配置步骤

### 步骤 1: 登录 Google Cloud

```bash
gcloud auth login
```

这个命令会：
1. 打开浏览器窗口
2. 提示你登录 Google 账户
3. 授权 gcloud CLI 访问你的 Google Cloud 账户

### 步骤 2: 设置默认项目

如果你已经有 GCP 项目：

```bash
# 列出所有项目
gcloud projects list

# 设置默认项目
gcloud config set project YOUR_PROJECT_ID
```

如果你还没有项目，需要先创建：

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 点击项目选择器
3. 点击"新建项目"
4. 输入项目名称（如：yuichat-backend）
5. 点击"创建"

### 步骤 3: 初始化 gcloud（推荐）

或者使用交互式初始化：

```bash
gcloud init
```

这个命令会引导你完成：
- 登录 Google 账户
- 选择或创建项目
- 设置默认区域和可用区

### 步骤 4: 验证配置

```bash
# 查看当前配置
gcloud config list

# 查看当前项目
gcloud config get-value project

# 查看当前账户
gcloud config get-value account
```

### 步骤 5: 启用必要的 API

部署 Cloud Run 服务需要启用以下 API：

```bash
# 设置项目 ID（替换为你的项目 ID）
export GCP_PROJECT_ID=your-project-id
gcloud config set project ${GCP_PROJECT_ID}

# 启用必要的 API
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 步骤 6: 验证 API 已启用

```bash
gcloud services list --enabled
```

应该看到以下服务：
- Cloud Build API
- Cloud Run API
- Secret Manager API
- Artifact Registry API

## 📝 常用命令

### 查看配置
```bash
# 查看所有配置
gcloud config list

# 查看特定配置
gcloud config get-value project
gcloud config get-value compute/region
gcloud config get-value compute/zone
```

### 切换项目
```bash
gcloud config set project NEW_PROJECT_ID
```

### 切换账户
```bash
gcloud auth login
```

### 查看已认证的账户
```bash
gcloud auth list
```

### 设置默认区域
```bash
# 设置默认区域（推荐：asia-east1 或 us-central1）
gcloud config set compute/region asia-east1
gcloud config set compute/zone asia-east1-a
```

## 🔐 应用默认凭据（可选）

如果你需要在本地开发时使用 gcloud 凭据：

```bash
# 设置应用默认凭据
gcloud auth application-default login
```

## ⚠️ 注意事项

1. **计费账户**：确保你的 GCP 项目已关联计费账户
   - 访问 [GCP Console](https://console.cloud.google.com/billing)
   - 创建或关联计费账户

2. **配额限制**：某些服务可能有配额限制
   - 访问 [配额页面](https://console.cloud.google.com/iam-admin/quotas)
   - 根据需要申请增加配额

3. **权限**：确保你的账户有足够的权限
   - Owner 或 Editor 角色
   - Cloud Run Admin
   - Service Account User

## 🚀 下一步

配置完成后，你可以：

1. **设置 Secret Manager 密钥**：
   ```bash
   cd backend_py
   ./setup-secrets.sh
   ```

2. **部署到 Cloud Run**：
   ```bash
   cd backend_py
   ./deploy-gcp.sh
   ```

## 📚 相关文档

- [gcloud CLI 官方文档](https://cloud.google.com/sdk/docs)
- [gcloud 命令参考](https://cloud.google.com/sdk/gcloud/reference)
- [GCP 快速入门](https://cloud.google.com/docs/get-started)

## 🆘 故障排查

### 问题：gcloud 命令未找到

**解决方案**：
```bash
# 检查 PATH
echo $PATH

# 如果 gcloud 不在 PATH 中，添加到 ~/.zshrc 或 ~/.bash_profile
echo 'export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 问题：认证失败

**解决方案**：
```bash
# 重新登录
gcloud auth login

# 或使用服务账户
gcloud auth activate-service-account --key-file=path/to/key.json
```

### 问题：API 未启用

**解决方案**：
```bash
# 手动启用 API
gcloud services enable SERVICE_NAME.googleapis.com

# 查看 API 状态
gcloud services list --enabled
```
