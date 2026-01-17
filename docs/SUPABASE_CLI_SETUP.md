# Supabase CLI 配置指南

## 版本: 1.0.0

本文档介绍如何配置和链接 Supabase CLI 到您的项目。

---

## 📋 前提条件

1. ✅ Supabase CLI 已安装（当前版本：2.58.5）
2. ✅ Supabase 项目已初始化
3. ✅ migrations 和 functions 已复制到正确位置
4. ✅ config.toml 已配置

---

## 🔗 链接到远程 Supabase 项目

### 步骤 1: 获取 Project Reference ID

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择您的项目
3. 进入 **Project Settings** > **General**
4. 复制 **Reference ID**（格式类似：`abcdefghijklmnop`）

### 步骤 2: 链接项目

在项目根目录运行以下命令：

```bash
cd /Users/haya_ceo/Projects/Yuichat
supabase link --project-ref <your-project-ref>
```

系统会提示您输入数据库密码（Database Password），这是您创建 Supabase 项目时设置的密码。

**示例**：
```bash
supabase link --project-ref abcdefghijklmnop
```

### 步骤 3: 验证链接

链接成功后，会在项目根目录生成 `.supabase/` 目录（包含在 .gitignore 中）。

验证链接状态：

```bash
supabase status
```

---

## 📤 推送数据库迁移

链接成功后，将本地 migrations 推送到远程数据库：

```bash
cd /Users/haya_ceo/Projects/Yuichat
supabase db push
```

这会执行以下迁移：
- `20250101000000_add_knowledge_base_tables.sql`
- `20260117000000_update_schema_for_langgraph.sql`
- `20260117000001_add_share_token.sql`

---

## 🚀 部署 Edge Functions

推送本地 Edge Functions 到 Supabase：

### 部署所有 Functions

```bash
supabase functions deploy
```

### 部署单个 Function

```bash
# 部署 dify-proxy
supabase functions deploy dify-proxy

# 部署 file-upload
supabase functions deploy file-upload
```

### 设置 Function 环境变量

```bash
# 设置 Dify API Key
supabase secrets set DIFY_API_KEY=your_dify_api_key

# 设置 Dify API URL
supabase secrets set DIFY_API_URL=http://your-vps-ip:5001

# 查看已设置的 secrets
supabase secrets list
```

---

## 🔄 同步远程数据库 Schema

如果远程数据库已有 schema，可以拉取到本地：

```bash
# 生成新的迁移文件（基于远程数据库的变更）
supabase db diff -f new_migration_name

# 从远程拉取现有的 migrations
supabase db pull
```

---

## 🧪 本地开发环境

### 启动本地 Supabase 服务

```bash
supabase start
```

这会启动：
- PostgreSQL 数据库 (端口: 54322)
- Supabase Studio (端口: 54323)
- API Gateway (端口: 54321)
- Inbucket 邮件测试服务 (端口: 54324)

### 访问本地 Supabase Studio

```
http://localhost:54323
```

### 查看本地服务状态

```bash
supabase status
```

### 停止本地服务

```bash
supabase stop
```

### 重置本地数据库

```bash
supabase db reset
```

---

## 📝 环境变量配置

### 前端环境变量 (`.env.local`)

更新前端环境变量以连接到 Supabase：

```env
# 远程 Supabase 配置（生产/测试环境）
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# 或使用本地开发环境
# VITE_SUPABASE_URL=http://localhost:54321
# VITE_SUPABASE_ANON_KEY=<local-anon-key>

# Python 后端 URL
VITE_PY_BACKEND_URL=http://localhost:8000
```

获取 Supabase Keys：
1. 登录 Supabase Dashboard
2. 进入 **Project Settings** > **API**
3. 复制：
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

### 后端环境变量 (`backend/env.example`)

```env
# ============================================
# Supabase 配置
# ============================================
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# ============================================
# Dify 配置（如果使用）
# ============================================
DIFY_API_KEY=your_dify_api_key
DIFY_API_URL=http://your-vps-ip:5001
DIFY_DEFAULT_DATASET_ID=your_default_dataset_id
```

---

## 🔍 常用命令

### 数据库操作

```bash
# 创建新的迁移文件
supabase migration new migration_name

# 查看数据库差异
supabase db diff

# 应用迁移
supabase db push

# 重置数据库（本地）
supabase db reset

# 执行 SQL 查询
supabase db query "SELECT * FROM projects LIMIT 10;"
```

### Edge Functions 操作

```bash
# 创建新的 function
supabase functions new function-name

# 本地测试 function
supabase functions serve

# 部署 function
supabase functions deploy function-name

# 查看 function 日志
supabase functions logs function-name

# 删除 function
supabase functions delete function-name
```

### 项目管理

```bash
# 查看项目信息
supabase projects list

# 查看当前链接的项目
supabase status

# 取消链接
supabase unlink
```

---

## 🔧 故障排除

### 链接失败

**问题**: `Cannot find project ref`

**解决方案**:
```bash
# 确保在项目根目录
cd /Users/haya_ceo/Projects/Yuichat

# 重新链接
supabase link --project-ref <your-project-ref>
```

### 数据库密码错误

**问题**: 链接时提示密码错误

**解决方案**:
1. 前往 Supabase Dashboard
2. 进入 **Project Settings** > **Database**
3. 点击 **Reset Database Password**
4. 保存新密码并重新链接

### 迁移冲突

**问题**: `supabase db push` 时出现冲突

**解决方案**:
```bash
# 查看远程数据库状态
supabase db remote ls

# 生成差异迁移
supabase db diff -f resolve_conflict

# 手动解决冲突后重新推送
supabase db push
```

### Functions 部署失败

**问题**: Edge Functions 部署时出错

**解决方案**:
```bash
# 查看详细错误日志
supabase functions deploy function-name --debug

# 检查函数代码
supabase functions serve function-name

# 确保环境变量已设置
supabase secrets list
```

---

## 📚 相关文档

- [Supabase CLI 官方文档](https://supabase.com/docs/guides/cli)
- [Edge Functions 文档](https://supabase.com/docs/guides/functions)
- [数据库迁移文档](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [认证配置](./AUTH_CONFIGURATION.md)
- [项目状态](./PROJECT_STATUS.md)

---

## 🎯 快速开始检查清单

完成以下步骤以配置 Supabase CLI：

- [ ] 1. 安装 Supabase CLI
- [x] 2. 初始化项目 (`supabase init`)
- [x] 3. 复制 migrations 和 functions
- [x] 4. 更新 config.toml
- [ ] 5. 链接到远程项目 (`supabase link`)
- [ ] 6. 推送迁移 (`supabase db push`)
- [ ] 7. 部署 Edge Functions (`supabase functions deploy`)
- [ ] 8. 配置环境变量
- [ ] 9. 测试本地开发环境 (`supabase start`)

---

**最后更新**: 2026-01-17 (v1.0.0)
