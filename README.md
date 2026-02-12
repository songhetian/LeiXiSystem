# 客服管理系统 (Customer Service Management System)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

## 📋 项目简介

客服管理系统是一套专为客服团队设计的综合性管理平台，采用现代化的前后端分离架构，结合桌面应用的便捷性，提供完整的员工管理、考勤管理、排班调度、请假审批、加班申请等功能。

本系统基于 Electron 构建桌面应用程序，前端使用 React + Vite + Tailwind CSS，后端采用 Fastify 框架，数据库使用 MySQL，支持跨平台运行（Windows、macOS、Linux）。

## 🌟 主要功能

### 👥 员工管理
- 员工信息维护
- 部门组织架构管理
- 角色权限分配
- 员工备忘录管理

### ⏰ 考勤管理
- 打卡记录管理
- 考勤异常处理
- 考勤统计报表
- 部门考勤分析

### 📅 排班管理
- 智能排班系统
- 班次类型配置
- 排班调整审批
- 排班统计分析

### 📝 请假管理
- 多种请假类型申请
- 在线审批流程
- 请假记录查询
- 请假统计分析

### 💼 加班管理
- 加班申请审批
- 加班时长统计
- 调休管理
- 加班费结算

### 🔐 权限管理
- 基于角色的访问控制(RBAC)
- 细粒度权限配置
- 部门数据权限
- 用户角色分配

### 📊 数据统计
- 个人工作统计
- 部门绩效分析
- 考勤数据报表
- 工作量统计图表

## 🛠 技术架构

### 前端技术栈
- **React 18** - JavaScript UI 库
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Ant Design** - UI 组件库
- **Zustand** - 状态管理
- **Socket.IO Client** - 实时通信

### 后端技术栈
- **Fastify** - Node.js Web 框架
- **MySQL 8.0** - 关系型数据库
- **Redis** - 高性能键值缓存
- **Socket.IO** - 实时通信
- **JSON Web Token (JWT)** - 身份认证

### 桌面应用
- **Electron** - 跨平台桌面应用框架

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- MySQL >= 8.0
- Redis >= 6.0
- npm >= 8.0.0

### 安装步骤

1. 克隆项目代码：
```bash
git clone <repository-url>
cd customer-service-desktop
```

2. 安装依赖：
```bash
npm install
```

3. 配置数据库：
```bash
# 复制配置文件模板
cp .envexample .env
# 编辑 .env 文件，配置数据库连接信息
```

4. 初始化数据库：
```bash
npm run db:migrate
npm run db:seed
```

5. 启动开发环境：
```bash
npm start
```

### 构建打包

Windows:
```bash
npm run package:win
```

macOS:
```bash
npm run package:mac
```

Linux:
```bash
npm run package:linux
```

## 📁 项目结构

```
customer-service-desktop/
├── src/                    # 前端源码
│   ├── components/         # 公共组件
│   ├── pages/              # 页面组件
│   ├── utils/              # 工具函数
│   └── services/           # API服务
├── server/                 # 后端服务
│   ├── routes/             # API路由
│   ├── middleware/         # 中间件
│   └── utils/              # 后端工具
├── database/               # 数据库脚本
│   ├── migrations/         # 数据库迁移
│   └── seeds/              # 初始化数据
├── scripts/                # 脚本工具
├── config/                 # 配置文件
└── electron/               # Electron主进程
```

## 📖 文档资源

- [操作手册](./操作手册.md) - 详细的系统操作指南
- [部署文档](./部署.md) - 系统部署和配置说明

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进本项目。

## 📄 许可证

本项目采用 MIT 许可证，详见 [LICENSE](./LICENSE) 文件。

## 📞 联系方式

如有问题，请联系项目维护团队。
