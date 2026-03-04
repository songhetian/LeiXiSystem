#!/bin/bash
# 雷犀系统 - 一键部署/更新脚本
# 位置: 项目根目录

BASE_DIR=$(cd "$(dirname "$0")"; pwd)
cd "$BASE_DIR"

echo "📥 正在获取最新代码..."
git pull origin main

# 1. 自动配置 .env (如果不存在)
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "⚠️ .env 文件已创建，请务必填写正确的 RDS 和 OSS 密钥！"
fi

# 2. 安装前端依赖并构建 (Node.js 18)
echo "🛠️ 正在构建前端静态资源 (Vite)..."
npm install vite @vitejs/plugin-react cross-env --no-save
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# 3. 规范目录名 (确保 dist 文件夹存在)
if [ -d "dist-react" ]; then
    rm -rf dist || true
    mv dist-react dist
fi

# 4. 安装后端依赖
echo "📦 安装后端依赖..."
npm install --production

# 5. 重启后端 (PM2)
echo "🔄 重启后端服务..."
pm2 restart leixi-system || pm2 start server/index.js --name "leixi-system"

# 6. 重启 Nginx (确保配置生效)
echo "🌐 重启 Nginx 服务..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅ 部署已完成！你可以通过 80 端口直接访问。"
