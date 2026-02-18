#!/bin/bash

# 雷犀客服管理系统 - 仅后端部署脚本 (适用于本地已构建前端的情况)
set -e

echo "🚀 开始部署后端服务..."

PROJECT_PATH="/var/www/LeiXiSystem"

# 1. 检查环境变量
if [ ! -f ".env" ]; then
    echo "⚠️ 未找到 .env 文件，正在从 .envexample 复制..."
    cp .envexample .env
fi

# 2. 安装后端依赖
echo "📦 安装后端生产依赖..."
npm install --production

# 3. 确保 dist 目录存在 (应由您手动上传)
if [ ! -d "dist" ] && [ -d "dist-react" ]; then
    mv dist-react dist
fi

if [ ! -d "dist" ]; then
    echo "❌ 错误: 未找到 dist 目录。请先将本地构建的文件夹上传并重命名为 dist。"
    exit 1
fi

# 4. 启动/重启后端服务
echo "🔄 重启 PM2 服务..."
npx pm2 delete leixi-system || true
npx pm2 start server/index.js --name "leixi-system" --env production -- PORT=3001

echo "✅ 后端部署完成！"
echo "请确保 Nginx 配置已指向 $PROJECT_PATH/dist"
