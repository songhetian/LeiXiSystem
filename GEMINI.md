# 雷犀客服管理系统 (LeiXi Customer Service Management System)

本项目是一个全栈式的客服管理系统，支持桌面版（Electron）和 Web 版。它集成了员工管理、质检系统、知识库、资产管理、考勤审批以及实时通讯等功能。

## 项目概览

- **核心目标**: 为客服团队提供一体化的管理与协作平台。
- **架构**: 采用前后端分离架构，前端使用 React + Vite，后端使用 Node.js (Fastify)，桌面端由 Electron 驱动。
- **主要技术栈**:
    - **前端**: React 18, Vite, Tailwind CSS, Ant Design, Recharts, Framer Motion, Zustand.
    - **后端**: Node.js, Fastify, MySQL (mysql2), Redis (ioredis), Socket.io.
    - **桌面端**: Electron, electron-builder.

## 核心功能模块

1.  **人事管理 (Personnel)**: 员工入职/离职流程、部门与职位配置、变动记录追踪。
2.  **质检系统 (Quality)**: 会话录音/记录质检、评分系统、申诉流程。
3.  **知识库 (Knowledge)**: 分类管理、文章编辑（Markdown 支持）、阅读统计。
4.  **资产管理 (Assets)**: 物理设备（电脑、外设）的领用与回收自动化。
5.  **考勤与审批 (Attendance & Workflow)**: 打卡记录、请假/加班审批流、假期余额计算。
6.  **即时通讯 (IM)**: 部门群组自动同步、系统消息推送、实时聊天。

## 开发指南

### 环境准备

- **Node.js**: 建议使用 v18 或更高版本。
- **数据库**: MySQL 8.0+, Redis.
- **配置文件**:
    - 根目录 `.env`: 包含 `JWT_SECRET`, `DB_HOST`, `REDIS_HOST` 等。
    - `config/db-config.json`: 数据库和 Redis 的详细连接配置（支持加密）。

### 常用命令

| 命令 | 说明 |
| :--- | :--- |
| `npm start` | 同时启动后端服务和 React 前端开发服务器 |
| `npm run dev:all` | 启动后端、前端并打开 Electron 客户端 |
| `npm run dev:server` | 仅启动后端服务 (带 nodemon 热重载) |
| `npm run dev:react` | 仅启动 React 开发服务器 (Vite) |
| `npm run db:migrate` | 运行数据库迁移脚本 |
| `npm run db:reset` | 重置数据库（慎用，会清空数据） |
| `npm run build` | 构建前端静态资源 |
| `npm run package` | 打包桌面应用 (electron-builder) |

### 开发规范

- **数据库规范**:
    - **必须执行**: 任何对数据库结构的修改（如 ALTER, CREATE, DROP 等 DDL 操作），必须立即将对应的 SQL 语句追加记录到 `database/migrations/update.sql` 文件中。
    - **自动记录**: 记录时需附带精确的时间戳和简要的功能描述注释。
    - **一致性保证**: 这是确保生产环境数据库能够顺利同步的唯一路径，严禁遗漏。
- **前端规范**:
    - 优先使用 React 函数式组件和 Hooks。
    - 使用 Tailwind CSS 进行样式开发，组件库使用 Ant Design。
    - API 请求统一通过 `src/utils/apiConfig` 获取基础路径。
- **后端规范**:
    - 路由应尽量模块化，存放在 `server/routes/` 下。
    - 使用 Fastify 钩子 (`onRequest`, `preHandler`) 处理权限校验和日志记录。
    - 数据库操作使用 `mysql2/promise` 进行原生 SQL 查询以保证性能。
    - 复杂的人事/资产逻辑封装在 `server/utils/` (如 `personnelClosure.js`)。
- **状态管理**:
    - 简单的 UI 状态使用 `useState` / `useContext`。
    - 复杂的全局状态（如用户信息、权限）使用 `Zustand`。

## 目录结构

- `src/`: 前端 React 源码。
- `server/`: 后端 Fastify 源码。
- `electron/`: Electron 主进程逻辑。
- `database/`: 数据库初始化脚本、迁移文件和测试数据。
- `config/`: 配置文件模板。
- `scripts/`: 运维相关的工具脚本。
- `public/`: 静态资源和图标。
