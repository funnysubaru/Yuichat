#!/bin/bash

# YUIChat 快速启动脚本
# 版本: 1.1.0

echo "🚀 YUIChat 启动脚本"
echo "===================="

# 检查并创建前端 .env.local
if [ ! -f .env.local ]; then
    echo "📝 创建前端环境变量文件..."
    cp .env.example .env.local
    echo "⚠️  请编辑 .env.local 并填入您的 Supabase 配置"
else
    echo "✅ 前端环境变量文件已存在"
fi

# 检查并创建 Python 后端 .env
if [ ! -f backend_py/.env ]; then
    echo "📝 创建 Python 后端环境变量文件..."
    cp backend_py/env.example backend_py/.env
    echo "⚠️  请编辑 backend_py/.env 并填入您的配置"
else
    echo "✅ Python 后端环境变量文件已存在"
fi

echo ""
echo "📦 安装依赖..."
echo "===================="

# 安装前端依赖
if [ ! -d node_modules ]; then
    echo "安装前端依赖..."
    npm install
else
    echo "✅ 前端依赖已安装"
fi

# 检查 Python 虚拟环境
if [ ! -d backend_py/venv ]; then
    echo "创建 Python 虚拟环境..."
    cd backend_py && python3 -m venv venv && cd ..
fi

echo ""
echo "✅ 配置完成！"
echo ""
echo "🎯 下一步操作："
echo "===================="
echo "1. 编辑配置文件："
echo "   - .env.local (前端配置)"
echo "   - backend_py/.env (Python 后端配置)"
echo ""
echo "2. 安装 Python 依赖："
echo "   cd backend_py && source venv/bin/activate && pip install -r requirements.txt"
echo ""
echo "3. 启动服务："
echo "   终端 1: cd backend_py && chainlit run app.py"
echo "   终端 2: npm run dev"
echo ""
echo "4. 访问应用："
echo "   管理端: http://localhost:5179"
echo "   Chainlit: http://localhost:8000"
