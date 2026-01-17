#!/bin/bash

# Supabase CLI 链接脚本
# 版本: 1.0.0

echo "================================================"
echo "  YUIChat - Supabase CLI 链接工具"
echo "================================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    echo "   当前目录: $(pwd)"
    exit 1
fi

echo "📋 请按照以下步骤操作："
echo ""
echo "1. 登录 Supabase Dashboard: https://app.supabase.com"
echo "2. 选择您的项目"
echo "3. 进入 Project Settings > General"
echo "4. 复制 Reference ID"
echo ""

read -p "请输入您的 Project Reference ID: " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ 错误: Project Reference ID 不能为空"
    exit 1
fi

echo ""
echo "🔗 正在链接到项目: $PROJECT_REF"
echo ""

# 执行链接
supabase link --project-ref "$PROJECT_REF"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 链接成功！"
    echo ""
    echo "📤 接下来的步骤："
    echo ""
    echo "1. 推送数据库迁移:"
    echo "   supabase db push"
    echo ""
    echo "2. 部署 Edge Functions:"
    echo "   supabase functions deploy"
    echo ""
    echo "3. 设置 Function 环境变量:"
    echo "   supabase secrets set DIFY_API_KEY=your_key"
    echo "   supabase secrets set DIFY_API_URL=your_url"
    echo ""
    echo "4. 查看更多帮助:"
    echo "   cat docs/SUPABASE_CLI_SETUP.md"
    echo ""
else
    echo ""
    echo "❌ 链接失败！"
    echo ""
    echo "💡 常见问题："
    echo "1. Project Reference ID 是否正确？"
    echo "2. 数据库密码是否正确？（创建项目时设置的密码）"
    echo "3. 是否有网络连接？"
    echo ""
    echo "查看详细文档: docs/SUPABASE_CLI_SETUP.md"
    exit 1
fi
