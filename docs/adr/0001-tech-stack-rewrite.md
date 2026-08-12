# ADR-0001: 技术栈全量换血（Arco + Next.js + NestJS + Prisma）

- 状态：已接受（Accepted）
- 日期：2026-08-12

## 背景

旧项目（antd + Vite + 裸 Fastify + mysql2 裸 SQL）组件混乱、UI 三库混用、双主题并存、90+ 页面 / 91 路由 / 150+ 表严重超载。继续渐进修补难以根治。

## 决策

采用全新技术栈从零搭建，旧代码归档 `legacy/`：

- 前端：Next.js (App Router) + TypeScript + **Arco Design Pro** + Refine（内置 React Query）+ bizcharts + zustand
- 后端：**NestJS**（@nestjs/platform-fastify 适配器）+ **Prisma** + MySQL + **Zod** + JWT/RBAC + Socket.IO + @nestjs/schedule
- 共享：packages/shared 存放 Zod schemas 前后端共用

## 后果

- 正向：组件混乱、样式双轨、重复代码一次性清零；工程结构强制规范（Nest 模块化 + Prisma schema 即文档 + Refine 数据层统一）。
- 成本：这是**重写**而非重构，工作量约为渐进重构的 2~3 倍；NestJS 学习曲线较陡（DI/装饰器/模块）。
- 约束：Arco 对 React 19 兼容未跟进，Next.js 固定 React 18；图表跟 Arco Pro 模板走 bizcharts，不再混 recharts。
