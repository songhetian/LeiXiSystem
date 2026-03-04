#!/bin/bash
# 雷犀系统 - 服务管理脚本 (智能路径增强版)
# 脚本位置: 项目根目录

# 获取脚本所在的绝对路径
BASE_DIR=$(cd "$(dirname "$0")"; pwd)
PM2_NAME="leixi-system"
SERVICE=$1
ACTION=$2

# 如果只传了一个参数，视为管理全部
if [[ "$SERVICE" =~ ^(start|stop|restart|status)$ ]]; then
    ACTION=$SERVICE
    SERVICE="all"
fi

do_nginx() {
    echo "🌐 [Nginx] 执行 $1..."
    case "$1" in
        start) sudo systemctl start nginx ;;
        stop) sudo systemctl stop nginx ;;
        restart) sudo nginx -t && sudo systemctl restart nginx ;;
        status) systemctl status nginx ;;
    esac
}

do_redis() {
    echo "🔑 [Redis] 执行 $1..."
    case "$1" in
        start) sudo systemctl start redis ;;
        stop) sudo systemctl stop redis ;;
        restart) sudo systemctl restart redis ;;
        status) systemctl status redis ;;
    esac
}

do_pm2() {
    echo "⚙️ [PM2 后端] 执行 $1..."
    cd "$BASE_DIR" # 关键：切换到项目根目录执行 PM2
    case "$1" in
        start) pm2 start server/index.js --name "$PM2_NAME" || pm2 restart "$PM2_NAME" ;;
        stop) pm2 stop "$PM2_NAME" ;;
        restart) pm2 restart "$PM2_NAME" ;;
        status) pm2 status "$PM2_NAME" ;;
    esac
}

case "$SERVICE" in
    nginx) do_nginx "$ACTION" ;;
    redis) do_redis "$ACTION" ;;
    pm2)   do_pm2 "$ACTION" ;;
    all)
        case "$ACTION" in
            start) do_redis start; do_nginx start; do_pm2 start ;;
            stop)  do_pm2 stop; do_nginx stop ;;
            restart) do_redis restart; do_nginx restart; do_pm2 restart ;;
            status)
                echo "📊 服务状态概览:"
                pm2 status "$PM2_NAME"
                echo "--- Nginx ---" && systemctl is-active nginx
                echo "--- Redis ---" && systemctl is-active redis
                ;;
        esac
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status} 或 $0 {nginx|redis|pm2} {start|stop|restart|status}"
        exit 1
esac
