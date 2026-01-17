# YUIChat 部署指南

## 前置要求

1. **Supabase 项目**：已创建新的 Supabase 项目
2. **Vercel 账户**：已创建新的 Vercel 项目
3. **Dify 服务**：已在 VPS 上部署 Dify（参考 Dify 官方文档）

## 步骤 1: 安装依赖

```bash
cd /Users/haya_ceo/Projects/YUIChat
npm install
```

## 步骤 2: 配置环境变量

### 本地开发环境

创建 `.env.local` 文件：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的配置：

```bash
# Supabase 配置（新项目）
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_SUPABASE_PROJECT_REF=<your-project-ref>
```

### Supabase Edge Functions 环境变量

在 Supabase Dashboard 中配置 Edge Functions 环境变量：

1. 进入 Supabase Dashboard
2. 选择你的项目
3. 进入 Settings > Edge Functions
4. 添加以下环境变量：
   - `DIFY_API_KEY`: 你的 Dify API Key
   - `DIFY_API_URL`: Dify 服务地址（如 `http://your-vps-ip:5001`）
   - `DIFY_DEFAULT_DATASET_ID`: 默认知识库 ID

### Vercel 环境变量

在 Vercel 项目设置中添加所有 `.env.local` 中的变量。

## 步骤 3: 运行数据库迁移

```bash
# 链接 Supabase 项目
cd backend
supabase link --project-ref <your-project-ref>

# 运行迁移
supabase db push
```

## 步骤 4: 部署 Edge Functions

```bash
cd backend
supabase functions deploy dify-proxy
supabase functions deploy file-upload
```

## 步骤 5: 启动开发服务器

```bash
npm run dev
```

访问 http://127.0.0.1:5179

## 步骤 6: 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署

## Dify 部署说明

Dify 需要独立部署在 VPS 上，不能部署在 Vercel。

### 快速部署 Dify

```bash
# 克隆 Dify 仓库
git clone https://github.com/langgenius/dify.git
cd dify/docker

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动服务
docker compose up -d
```

详细部署指南请参考：https://docs.dify.ai/getting-started/install-self-hosted

## 故障排查

### 常见问题

1. **依赖未安装**：运行 `npm install`
2. **环境变量缺失**：检查 `.env.local` 文件
3. **Supabase 连接失败**：检查 Supabase URL 和 API Key
4. **Dify API 调用失败**：检查 Dify 服务是否运行，API Key 是否正确

