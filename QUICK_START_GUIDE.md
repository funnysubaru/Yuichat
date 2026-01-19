# YUIChat 快速启动指南

## 📋 前置要求

- Node.js 18+
- Python 3.9+
- OpenAI API Key
- Supabase 账户（可选，用于完整功能）

## 🚀 快速开始

### 方式一：使用自动化脚本（推荐）

```bash
# 1. 运行配置脚本
./setup.sh

# 2. 编辑环境变量
# 前端配置
nano .env.local

# Python 后端配置
nano backend_py/.env

# 3. 安装 Python 依赖
cd backend_py
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# 4. 启动服务（需要两个终端）
# 终端 1: Python 后端 (FastAPI)
cd backend_py && python app.py

# 终端 2: React 管理端
npm run dev
```

### 方式二：手动配置

#### 1. 配置前端环境变量

创建 `.env.local` 文件：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
# Supabase 配置（如果使用完整功能）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Python 后端 URL
VITE_PY_BACKEND_URL=http://localhost:8000
```

#### 2. 配置 Python 后端环境变量

创建 `backend_py/.env` 文件：

```bash
cp backend_py/env.example backend_py/.env
```

编辑 `backend_py/.env`：

```env
# OpenAI API Key (必填)
OPENAI_API_KEY=sk-your-openai-api-key

# Supabase 配置（用于查询项目的 vector_collection）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 3. 安装依赖

**前端依赖：**
```bash
npm install
```

**Python 依赖：**
```bash
cd backend_py
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 4. 启动服务

**终端 1 - Python 后端（FastAPI）：**
```bash
cd backend_py
source venv/bin/activate  # 如果还没激活
python app.py
```

**终端 2 - React 管理端：**
```bash
npm run dev
```

## 🌐 访问应用

- **管理后台**：http://localhost:5179
  - 用于上传文档、管理项目、生成分享链接
  
- **Chainlit 对话界面**：http://localhost:8000
  - 面向最终用户的智能对话界面

## 📚 使用流程

### 1. 创建项目并上传文档

1. 访问管理后台：http://localhost:5179
2. 登录/注册（如果配置了 Supabase）
3. 进入"知识库"页面
4. 点击"立即创建"上传文档（PDF、Word、Excel）
5. 等待文档处理完成

### 2. 生成外部分享链接

1. 进入"外部分享"页面
2. 复制生成的公开访问链接
3. 该链接包含项目下所有文档的知识

### 3. 外部用户访问

用户访问分享链接后，可以：
- 直接在 Chainlit 界面进行对话
- 询问项目内任何文档的相关问题
- 无需登录即可使用

## 🔧 高级配置

### 使用 Supabase Storage

如果要使用 Supabase 存储文件：

1. 在 Supabase 项目中创建 `knowledge-base-files` bucket
2. 设置为公开访问（或配置适当的 RLS 策略）
3. 运行数据库迁移：

```bash
# 需要 Supabase CLI
supabase db push
```

### 切换向量数据库

默认使用本地 Chroma，如需切换至 Supabase pgvector：

1. 修改 `backend_py/workflow.py` 中的向量存储配置
2. 更新 `DATABASE_URL` 环境变量

## 🐛 故障排查

### Python 后端启动失败

```bash
# 确保激活了虚拟环境
source backend_py/venv/bin/activate

# 重新安装依赖
pip install -r requirements.txt --upgrade
```

### 前端无法连接后端

检查 `.env.local` 中的配置：
```env
VITE_PY_BACKEND_URL=http://localhost:8000
VITE_CHAINLIT_URL=http://localhost:8000
```

### Chainlit 无法查询项目

确保 `backend_py/.env` 中配置了正确的 Supabase 凭证：
```env
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
```

## 📖 更多文档

- [项目级分享说明](docs/PROJECT_LEVEL_SHARING.md)
- [项目状态](docs/PROJECT_STATUS.md)
- [更新日志](CHANGELOG.md)

## 💡 提示

- 首次启动 Chainlit 时，它会自动创建配置文件
- 上传大文件时，处理时间较长，请耐心等待
- 外部分享链接可以随时重置以保障安全
- Excel 文件建议转换为结构化数据后再上传
