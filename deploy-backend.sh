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

# 5. 生成 Nginx 配置示例
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
echo "✅ 后端部署完成！"
echo "1. 后端服务已通过 PM2 启动在 3001 端口。"
echo "2. Nginx 配置文件已生成: leixi.conf"
echo ""
echo "👉 下一步操作 (如果需要更新 Nginx 配置)："
echo "   sudo cp leixi.conf /etc/nginx/conf.d/"
echo "   sudo nginx -t"
echo "   sudo systemctl restart nginx"
echo "------------------------------------------------"
