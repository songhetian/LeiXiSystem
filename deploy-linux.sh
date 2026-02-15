#!/bin/bash

# 雷犀客服管理系统 - Linux 自动部署脚本 (OpenCloudOS 9 / RHEL 9)
# 适用环境: 腾讯云 OpenCloudOS 9, Node.js 18+, Nginx, MySQL 8.0, Redis

set -e

echo "🚀 开始部署雷犀客服管理系统..."

# 1. 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚠️ 未找到 .env 文件，正在从 .envexample 复制..."
    cp .envexample .env
    echo "❗ 请记得编辑 .env 文件以设置正确的数据库和 Redis 连接信息。"
fi

# 2. 安装 Node.js 依赖 (排除开发环境包如 Electron)
echo "📦 安装 Node.js 依赖..."
npm install --production

# 3. 安装前端构建依赖并构建
# 注意：前端构建需要 vite，它在 devDependencies 中
echo "🛠️ 构建前端静态资源..."
npm install vite @vitejs/plugin-react cross-env --no-save
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# 4. 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "📥 正在安装 PM2 进程管理器..."
    npm install pm2 -g
fi

# 5. 启动/重启后端服务
echo "🔄 启动后端服务 (端口 3001)..."
PROJECT_PATH="/var/www/LeiXiSystem"
cd $PROJECT_PATH
pm2 delete leixi-system || true
pm2 start server/index.js --name "leixi-system" --node-args="--max-old-space-size=2048" --env production -- PORT=3001

# 6. 生成 Nginx 配置示例
echo "📝 生成 Nginx 配置文件: leixi.conf"
cat <<EOF > leixi.conf
server {
    listen 80;
    server_name localhost; # 请修改为您的域名或公网IP

    # 前端静态资源
    root $PROJECT_PATH/dist;
    index index.html;

    # 开启 Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # 处理前端路由 (React Router)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API 转发
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Socket.io 转发
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # 上传文件路径直接映射
    location /uploads/ {
        alias $PROJECT_PATH/server/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }
}
EOF

echo "------------------------------------------------"
echo "✅ 部署基本完成！"
echo "1. 后端服务已通过 PM2 启动在 3001 端口。"
echo "2. 前端已打包至 dist/ 目录。"
echo "3. Nginx 配置文件已生成在当前目录: leixi.conf"
echo ""
echo "👉 下一步操作："
echo "   sudo cp leixi.conf /etc/nginx/conf.d/"
echo "   sudo nginx -t"
echo "   sudo systemctl restart nginx"
echo "------------------------------------------------"
