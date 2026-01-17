# Supabase 配置目录

本目录包含 YUIChat 项目的 Supabase CLI 配置、数据库迁移和 Edge Functions。

## 📂 目录结构

```
supabase/
├── config.toml              # Supabase CLI 配置文件
├── migrations/              # 数据库迁移文件
│   ├── 20250101000000_add_knowledge_base_tables.sql
│   ├── 20260117000000_update_schema_for_langgraph.sql
│   └── 20260117000001_add_share_token.sql
└── functions/               # Edge Functions
    ├── dify-proxy/          # Dify API 代理
    └── file-upload/         # 文件上传处理
```

## 🚀 快速开始

### 1. 链接到远程项目

```bash
# 返回项目根目录
cd ..

# 使用便捷脚本
./supabase-link.sh

# 或手动链接
supabase link --project-ref <your-project-ref>
```

### 2. 推送迁移

```bash
supabase db push
```

### 3. 部署 Functions

```bash
supabase functions deploy
```

## 📝 配置说明

### config.toml

主要配置项：
- **API 端口**: 54321
- **数据库端口**: 54322
- **Studio 端口**: 54323
- **认证 URL**: http://localhost:5179
- **邮箱确认**: 已启用

### 数据库迁移

1. **20250101000000_add_knowledge_base_tables.sql**
   - 创建 `knowledge_bases` 表
   - 创建 `documents` 表
   - 配置 RLS 策略

2. **20260117000000_update_schema_for_langgraph.sql**
   - 添加 `vector_collection` 字段
   - 添加 `storage_path` 字段
   - 添加处理元数据字段

3. **20260117000001_add_share_token.sql**
   - 添加 `share_token` 字段
   - 支持项目级分享功能

### Edge Functions

1. **dify-proxy**
   - 代理 Dify API 请求
   - 处理流式响应

2. **file-upload**
   - 处理文件上传
   - 触发文档索引

## 🔗 相关文档

- [Supabase CLI 配置指南](../docs/SUPABASE_CLI_SETUP.md)
- [配置总结](../docs/SUPABASE_CLI_CONFIGURATION_SUMMARY.md)
- [快速参考](../SUPABASE_QUICK_REF.md)

## ⚠️ 注意事项

1. `.supabase/` 目录由 CLI 自动生成，已在 `.gitignore` 中
2. 不要手动编辑 `.supabase/` 目录中的文件
3. 迁移文件一旦推送到生产环境，不应再修改
4. 新的数据库变更应创建新的迁移文件

## 📚 更多信息

查看项目根目录的文档：
- `docs/SUPABASE_CLI_SETUP.md` - 详细配置指南
- `SUPABASE_QUICK_REF.md` - 常用命令参考
