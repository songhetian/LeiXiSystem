#!/bin/bash

echo "========================================"
echo "  客服管理系统 - 一键安装"
echo "========================================"
echo ""

echo "[1/3] 初始化数据库..."
node scripts/init-database.js
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 数据库初始化失败"
    exit 1
fi

echo ""
echo "[2/3] 导入测试数据..."
node scripts/import-test-data.js
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 测试数据导入失败"
    exit 1
fi

echo ""
echo "[3/3] 完成！"
echo ""
echo "========================================"
echo "  ✅ 安装完成！"
echo "========================================"
echo ""
echo "测试账号："
echo ""
echo "【管理员】"
echo "  用户名: admin"
echo "  密码: admin123"
echo ""
echo "【普通用户】（密码：123456）"
echo "  zhangsan, lisi, wangwu"
echo "  cs001, cs002, cs003"
echo "  等等..."
echo ""
echo "下一步："
echo "  运行 ./start.sh 启动应用"
echo ""
