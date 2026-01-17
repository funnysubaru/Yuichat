# Supabase CLI 快速参考

## 🚀 快速开始

### 链接到远程项目
```bash
# 使用便捷脚本（推荐）
./supabase-link.sh

# 或手动链接
supabase link --project-ref <your-project-ref>
```

### 推送数据库迁移
```bash
supabase db push
```

### 部署 Edge Functions
```bash
# 部署所有
supabase functions deploy

# 部署单个
supabase functions deploy dify-proxy
supabase functions deploy file-upload
```

### 设置环境变量
```bash
supabase secrets set DIFY_API_KEY=your_key
supabase secrets set DIFY_API_URL=your_url
```

---

## 📋 常用命令

### 数据库
```bash
supabase db push              # 推送迁移
supabase db pull              # 拉取远程schema
supabase db diff              # 查看差异
supabase db reset             # 重置本地数据库
supabase migration new name   # 创建新迁移
```

### Edge Functions
```bash
supabase functions deploy [name]    # 部署
supabase functions serve             # 本地测试
supabase functions logs [name]       # 查看日志
supabase secrets list                # 查看环境变量
```

### 本地开发
```bash
supabase start     # 启动本地服务
supabase stop      # 停止本地服务
supabase status    # 查看状态
```

### 本地服务端口
- PostgreSQL: `54322`
- API Gateway: `54321`
- Studio: `54323` (http://localhost:54323)
- Inbucket (邮件): `54324`

---

## 🔗 获取 Project Reference ID

1. 登录 https://app.supabase.com
2. 选择项目
3. **Project Settings** > **General**
4. 复制 **Reference ID**

---

## 📝 环境变量位置

### 前端 (`.env.local`)
```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_PY_BACKEND_URL=http://localhost:8000
```

### Edge Functions (Supabase Secrets)
```bash
supabase secrets set KEY=value
```

---

## 🔍 故障排除

### 链接失败
```bash
# 确保在项目根目录
cd /Users/haya_ceo/Projects/Yuichat
supabase link --project-ref <ref>
```

### 迁移冲突
```bash
supabase db diff -f resolve_conflict
# 手动解决冲突后
supabase db push
```

### 查看详细错误
```bash
supabase [command] --debug
```

---

## 📚 完整文档

查看详细配置指南：`docs/SUPABASE_CLI_SETUP.md`
