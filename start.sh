#!/bin/bash

echo "========================================"
echo "  客服管理系统 - 桌面版"
echo "========================================"
echo ""

echo "[1/3] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "首次运行，正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "依赖安装失败！"
        exit 1
    fi
fi

echo "[2/3] 检查配置..."
if [ ! -f ".env" ]; then
    echo "未找到配置文件，正在创建..."
    cp .env.example .env
    echo ""
    echo "⚠️  请编辑 .env 文件，配置数据库密码！"
    echo "📖 详细说明请查看 docs/INSTALL.md"
    echo ""
    read -p "按回车键继续..."
fi

echo "[3/3] 启动应用..."
echo ""
echo "正在启动服务..."
echo "- Fastify API 服务器: http://localhost:3001"
echo "- Vite 开发服务器: http://localhost:5173"
echo "- Electron 桌面应用"
echo ""

# 使用 concurrently 同时启动所有服务
npm run dev

echo ""
echo "✅ 应用已关闭"
