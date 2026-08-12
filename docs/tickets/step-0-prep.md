# Ticket: step-0 — 准备与脚手架

> 对应 REFACTOR_PLAN.md 第 9 章 Step 0

## 已拍板决策（无需再讨论）

- [x] 部署形态：纯 Web，放弃 Electron（ADR-0002）@ 2026-08-12
- [x] 生产环境：阿里云 RDS + OSS（ADR-0003）@ 2026-08-12
- [x] 技术栈：Arco + Next.js + Refine + NestJS + Prisma + Zod（ADR-0001）@ 2026-08-12
- [x] 包管理：pnpm workspace（ADR-0004）@ 2026-08-12
- [x] 功能删除边界（ADR-0005）@ 2026-08-12
- [x] UI 规范强制 Arco Pro 标准（ADR-0006）@ 2026-08-12

## 待办

- [ ] 旧项目归档：已复制到 `legacy/`，git 分支 `refactor-v2` 尚未创建
- [ ] `git checkout -b refactor-v2`，打 tag 存档当前可运行版本
- [ ] mysqldump 全量备份当前数据库
- [ ] 安装 pnpm（`npm i -g pnpm` 或 corepack enable）
- [ ] 初始化 pnpm workspace：根 `pnpm-workspace.yaml` + 目录骨架（apps/web、apps/server、packages/shared）
- [ ] 用 arco-cli 生成 Next 版 Pro 模板（交互式，需手动操作）体验并确认布局
- [ ] NestJS CLI 起最小骨架，跑通 @nestjs/platform-fastify adapter
- [ ] Prisma 初始化（datasource + client），确认能连本地 MySQL

## 完成标准

- [ ] 新架构目录骨架存在且 pnpm install 无报错
- [ ] Next.js 开发服务器可启动（localhost:3000 出 Pro 布局）
- [ ] NestJS 健康检查接口可访问
- [ ] 数据库有完整备份
