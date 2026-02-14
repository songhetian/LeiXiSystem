# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 常用命令

### 开发环境
- `npm start` - 同时启动后端服务器和前端开发服务器
- `npm run dev:server` - 仅启动后端开发服务器 (Fastify，端口通常为 3000)
- `npm run dev:react` - 仅启动前端开发服务器 (Vite，端口为 5173)
- `npm run dev:all` - 启动后端、前端和 Electron 桌面应用

### 数据库操作
- `npm run db:reset` - 重置数据库（执行脚本清空并重新初始化）
- `npm run db:migrate` - 运行数据库迁移脚本
- `npm run db:encrypt` - 加密数据库配置文件
- `npm run db:decrypt` - 解密数据库配置文件

### 构建与打包
- `npm run build` - 构建前端代码到 `dist-react` 目录
- `npm run serve` - 以生产模式启动后端服务器
- `npm run package:win` - 为 Windows 打包桌面应用
- `npm run package:mac` - 为 macOS 打包桌面应用
- `npm run package:linux` - 为 Linux 打包桌面应用

### 测试
- `node tests/test-date.js` - 运行日期工具测试
- `node tests/test-knowledge-reading.js` - 运行知识库阅读测试
- `node tests/test-knowledge-stats.js` - 运行知识库统计测试

## 项目架构

这是一个基于 Electron 的桌面版客服管理系统，采用前后端分离架构。

### 技术栈
- **前端**: React 18 + Vite + Tailwind CSS + Ant Design + Zustand（状态管理）
- **后端**: Fastify（Node.js Web 框架）+ MySQL 8.0 + Redis + Socket.IO
- **桌面应用**: Electron

### 目录结构
- `src/` - 前端代码
  - `pages/` - 页面组件，按功能模块划分（Admin、Attendance、Employee、Finance 等）
  - `components/` - 可复用组件
  - `api/` 和 `services/` - API 服务层
  - `hooks/` - 自定义 React Hooks
  - `utils/` - 工具函数
  - `contexts/` - React Context（PermissionContext 用于权限管理）
- `server/` - 后端代码
  - `routes/` - API 路由，按业务模块划分
  - `middleware/` - 中间件（权限检查等）
  - `utils/` - 后端工具函数
  - `websocket.js` - WebSocket 服务（Socket.IO）
  - `index.js` - 后端主入口文件
- `database/` - 数据库脚本（migrations 和 seeds）
- `config/` - 配置文件

### 核心架构设计

**权限系统**: 采用 RBAC（基于角色的访问控制），前端使用 `PermissionContext` 管理权限状态，后端通过 `middleware/checkPermission` 进行权限验证和部门数据过滤。

**WebSocket 实时通信**: `server/websocket.js` 提供 Socket.IO 服务，用于聊天、通知等实时功能。

**API 设计**: Fastify 路由按业务模块组织在 `server/routes/` 目录下，每个文件对应一个业务模块（如 `attendance.js`、`leave.js`、`overtime.js` 等）。

**数据库配置**: 数据库配置文件在 `config/db-config.json`，加密存储于生产环境，通过 `npm run db:encrypt/decrypt` 操作。

**Electron 集成**: 主进程代码在 `electron/` 目录，后端和前端打包后通过 Electron Builder 生成桌面安装包。

### 环境配置
项目使用 `.env` 文件配置环境变量（复制自 `.envexample`），包含数据库连接、JWT 密钥等敏感信息。后端通过 `dotenv` 加载配置，路径为项目根目录的 `.env`。
