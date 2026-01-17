# YUIChat 快速启动指南

## 前置条件

1. Node.js 18+ 已安装
2. 已创建新的 Supabase 项目
3. 已在 VPS 上部署 Dify 服务（或准备部署）

## 快速开始

### 方式一：UI 预览模式（推荐先体验）

如果你想先预览 UI 设计，**无需配置任何环境变量**，直接启动：

```bash
cd /Users/haya_ceo/Projects/YUIChat
npm install
npm run dev
```

访问 http://127.0.0.1:5179

**UI 预览模式特点**：
- ✅ 可以查看所有界面（导航栏、知识库页面、聊天界面等）
- ✅ 可以查看文档列表（显示模拟数据）
- ✅ 可以测试 UI 交互
- ⚠️ 无法实际发送消息（会显示模拟响应）
- ⚠️ 无法上传文件（会显示提示信息）

### 方式二：完整功能模式

### 1. 安装依赖

```bash
cd /Users/haya_ceo/Projects/YUIChat
npm install
```

### 2. 配置环境变量（可选）

如果你想使用完整功能，创建 `.env.local` 文件：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的 Supabase 配置：

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_SUPABASE_PROJECT_REF=<your-project-ref>
```

**注意**：如果不创建 `.env.local`，应用会自动进入 UI 预览模式。

### 3. 运行数据库迁移

```bash
cd backend
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. 配置 Supabase Edge Functions

在 Supabase Dashboard 中配置 Edge Functions 环境变量：

- `DIFY_API_KEY`: 你的 Dify API Key
- `DIFY_API_URL`: Dify 服务地址
- `DIFY_DEFAULT_DATASET_ID`: 默认知识库 ID

### 5. 部署 Edge Functions

```bash
cd backend
supabase functions deploy dify-proxy
supabase functions deploy file-upload
```

### 6. 启动开发服务器

```bash
npm run dev
```

访问 http://127.0.0.1:5179

## 下一步

- 部署 Dify 服务（参考 `docs/DIFY_DEPLOYMENT.md`）
- 配置 Vercel 部署（参考 `docs/DEPLOYMENT.md`）
- 查看项目状态（参考 `docs/PROJECT_STATUS.md`）

