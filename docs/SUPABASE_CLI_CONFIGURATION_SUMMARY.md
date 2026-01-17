# Supabase CLI 配置完成总结

## ✅ 已完成的配置

### 1. Supabase CLI 初始化
- ✅ 执行 `supabase init` 初始化项目
- ✅ 生成标准的 `supabase/` 目录结构
- ✅ 创建 `config.toml` 配置文件

### 2. 目录结构整理
- ✅ 从 `backend/supabase/` 复制 migrations 到 `supabase/migrations/`
- ✅ 从 `backend/supabase/` 复制 functions 到 `supabase/functions/`
- ✅ 更新 `.gitignore` 忽略 `.supabase/` 目录

### 3. 配置文件优化
- ✅ 更新 `site_url` 为 `http://localhost:5179`
- ✅ 添加 `additional_redirect_urls` 为 `http://localhost:5179/auth`
- ✅ 启用邮箱确认 `enable_confirmations = true`

### 4. 文档和工具
- ✅ 创建 `docs/SUPABASE_CLI_SETUP.md` - 详细配置指南
- ✅ 创建 `supabase-link.sh` - 便捷链接脚本
- ✅ 创建 `SUPABASE_QUICK_REF.md` - 快速参考卡片
- ✅ 更新 `CHANGELOG.md` 版本 1.1.7
- ✅ 更新 `VERSION` 文件为 1.1.7
- ✅ 更新 `docs/PROJECT_STATUS.md`

---

## 📂 当前目录结构

```
Yuichat/
├── supabase/                    # ✅ 新：Supabase CLI 配置目录
│   ├── config.toml              # ✅ Supabase 配置文件
│   ├── migrations/              # ✅ 数据库迁移文件
│   │   ├── 20250101000000_add_knowledge_base_tables.sql
│   │   ├── 20260117000000_update_schema_for_langgraph.sql
│   │   └── 20260117000001_add_share_token.sql
│   └── functions/               # ✅ Edge Functions
│       ├── dify-proxy/
│       └── file-upload/
├── backend/                     # 保留：原有后端配置（可选择性清理）
│   ├── env.example
│   └── supabase/                # 原始位置（已复制到上层）
├── docs/
│   ├── SUPABASE_CLI_SETUP.md    # ✅ 新：详细配置指南
│   └── ...
├── supabase-link.sh             # ✅ 新：便捷链接脚本
├── SUPABASE_QUICK_REF.md        # ✅ 新：快速参考
└── ...
```

---

## 🎯 下一步操作

### 必需步骤

#### 1. 链接到远程 Supabase 项目

**方法一：使用便捷脚本（推荐）**
```bash
cd /Users/haya_ceo/Projects/Yuichat
./supabase-link.sh
```

**方法二：手动链接**
```bash
cd /Users/haya_ceo/Projects/Yuichat
supabase link --project-ref <your-project-ref>
```

> 💡 **获取 Project Reference ID**：
> 1. 登录 https://app.supabase.com
> 2. 选择您的项目
> 3. 进入 **Project Settings** > **General**
> 4. 复制 **Reference ID**

#### 2. 推送数据库迁移

链接成功后，推送本地迁移到远程数据库：

```bash
supabase db push
```

这会执行以下 3 个迁移文件：
- `20250101000000_add_knowledge_base_tables.sql` - 创建知识库表
- `20260117000000_update_schema_for_langgraph.sql` - LangGraph 架构升级
- `20260117000001_add_share_token.sql` - 添加分享令牌

#### 3. 部署 Edge Functions

```bash
# 部署所有 Functions
supabase functions deploy

# 或分别部署
supabase functions deploy dify-proxy
supabase functions deploy file-upload
```

#### 4. 配置 Edge Functions 环境变量

```bash
# 设置 Dify API Key（如果使用 Dify）
supabase secrets set DIFY_API_KEY=your_dify_api_key

# 设置 Dify API URL
supabase secrets set DIFY_API_URL=http://your-vps-ip:5001

# 查看已设置的环境变量
supabase secrets list
```

#### 5. 更新前端环境变量

编辑 `.env.local` 文件：

```env
# Supabase 配置
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Python 后端 URL
VITE_PY_BACKEND_URL=http://localhost:8000
```

> 💡 **获取 Supabase Keys**：
> 1. Supabase Dashboard
> 2. **Project Settings** > **API**
> 3. 复制 **Project URL** 和 **anon/public key**

---

## 🧪 可选：本地开发环境

如果需要在本地运行完整的 Supabase 服务（数据库、API、Studio）：

### 启动本地服务
```bash
cd /Users/haya_ceo/Projects/Yuichat
supabase start
```

### 访问本地服务
- **Supabase Studio**: http://localhost:54323
- **API Gateway**: http://localhost:54321
- **PostgreSQL**: localhost:54322
- **Inbucket (邮件测试)**: http://localhost:54324

### 停止本地服务
```bash
supabase stop
```

### 查看服务状态
```bash
supabase status
```

---

## 📚 参考文档

### 项目文档
- **详细配置指南**: `docs/SUPABASE_CLI_SETUP.md`
- **快速参考**: `SUPABASE_QUICK_REF.md`
- **认证配置**: `docs/AUTH_CONFIGURATION.md`
- **项目状态**: `docs/PROJECT_STATUS.md`

### 官方文档
- [Supabase CLI 官方文档](https://supabase.com/docs/guides/cli)
- [数据库迁移](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Edge Functions](https://supabase.com/docs/guides/functions)

---

## 🔍 故障排除

### 问题 1: "Cannot find project ref"

**原因**: 未链接到远程项目

**解决方案**:
```bash
cd /Users/haya_ceo/Projects/Yuichat
supabase link --project-ref <your-project-ref>
```

### 问题 2: 数据库密码错误

**解决方案**:
1. 前往 Supabase Dashboard
2. **Project Settings** > **Database**
3. 点击 **Reset Database Password**
4. 保存新密码并重新链接

### 问题 3: 迁移冲突

**解决方案**:
```bash
# 查看差异
supabase db diff

# 生成解决冲突的迁移
supabase db diff -f resolve_conflict

# 手动编辑解决冲突后
supabase db push
```

### 问题 4: Functions 部署失败

**解决方案**:
```bash
# 查看详细错误
supabase functions deploy function-name --debug

# 本地测试
supabase functions serve function-name
```

---

## ✅ 配置检查清单

完成以下步骤以确保 Supabase CLI 配置完整：

- [x] 1. 安装 Supabase CLI
- [x] 2. 初始化项目 (`supabase init`)
- [x] 3. 复制 migrations 和 functions
- [x] 4. 更新 config.toml
- [x] 5. 创建配置文档和脚本
- [ ] 6. 链接到远程项目 (`supabase link`)
- [ ] 7. 推送迁移 (`supabase db push`)
- [ ] 8. 部署 Edge Functions (`supabase functions deploy`)
- [ ] 9. 配置 Function 环境变量 (`supabase secrets set`)
- [ ] 10. 更新前端 `.env.local`
- [ ] 11. 测试应用功能

---

## 💡 提示

1. **保留 `backend/supabase/` 目录**：作为备份，暂时不要删除
2. **使用便捷脚本**：`./supabase-link.sh` 提供交互式链接体验
3. **查看快速参考**：`SUPABASE_QUICK_REF.md` 包含最常用的命令
4. **本地测试**：使用 `supabase start` 在本地测试迁移和 Functions
5. **版本控制**：`.supabase/` 目录已在 `.gitignore` 中，不会提交到 Git

---

**配置完成时间**: 2026-01-17  
**版本**: 1.1.7  
**状态**: ✅ CLI 配置完成，等待链接到远程项目
