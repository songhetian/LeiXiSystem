# Ticket: step-0 — 准备与脚手架

> 对应 REFACTOR_PLAN.md 第 9 章 Step 0
> 状态核对：2026-09-29。逐条按仓库实际证据核对，不是计划口径。
> 标记约定：`[x]` 已达成 ｜ `[ ]` 未达成或无法从仓库核实（行尾注明原因）。

## 已拍板决策（无需再讨论）

- [x] 部署形态：纯 Web，放弃 Electron（ADR-0002）@ 2026-08-12
- [x] 生产环境：阿里云 RDS + OSS（ADR-0003）@ 2026-08-12
- [x] 技术栈：Arco + Next.js + NestJS + Prisma + Zod（ADR-0001）@ 2026-08-12
      ⚠️ 原决策含 **Refine**，实际未采用（未安装该依赖，ProTable 自实现搜索/分页/导出）。
      详见 step-3 的「与计划不一致」。
- [x] 包管理：pnpm workspace（ADR-0004）@ 2026-08-12
- [x] 功能删除边界（ADR-0005）@ 2026-08-12
- [x] UI 规范强制 Arco Pro 标准（ADR-0006）@ 2026-08-12

## 待办

- [x] 旧项目归档 —— **实际归档在 `LeiXiSystem-main/`（397 个文件）**，且 `.gitignore` 第 65 行
      显式排除（有意不入库）。`legacy/` 是空目录，本行旧措辞「已复制到 legacy/」与现状不符。
- [x] `git checkout -b refactor-v2` —— 当前工作分支即 `refactor-v2`
- [ ] 打 tag 存档当前可运行版本 —— `git tag` 为空；且分支已领先 `origin/refactor-v2` 39 个提交未推送
- [ ] mysqldump 全量备份 —— 属运维动作，无法从仓库核实，需人工确认
- [x] 安装 pnpm —— 实际使用 pnpm 11.10.0
- [x] 初始化 pnpm workspace + 目录骨架 —— 落地目录为 `backend/`、`frontend/`、`shared/`
      （原计划 `apps/web`、`apps/server`、`packages/shared` 三个名字在落地时改名）
- [x] 生成 Next 版 Pro 风格模板（App Router + Arco）—— 结果达成，模板来源已不可考
- [x] NestJS 最小骨架跑通 @nestjs/platform-fastify adapter
- [x] Prisma 初始化（datasource + client），能连本地 MySQL

## 完成标准

- [x] 新架构目录骨架存在且 `pnpm install` 无报错
- [x] Next.js 开发服务器可启动 —— 端口为 **4000**（非本文原写的 3000），后端为 **4001**；
      `next build` 36 条路由全部编译通过
- [x] NestJS 健康检查接口可访问（`backend/src/health/health.controller.ts`）
- [ ] 数据库有完整备份 —— 无法从仓库核实

## 与计划不一致 / 遗留

1. **未打 tag**：`refactor-v2` 已领先 `origin/refactor-v2` 39 个提交且未推送。
   上线前应至少打一个可回退的 tag，并确定推送策略。
2. **旧项目归档位置与文档不符**：文档写 `legacy/`，实际在 `LeiXiSystem-main/`（已 gitignore）。
   `legacy/` 空目录建议删除，或把文档措辞改成实际位置——现状是两边都容易误导。
3. **目录命名**：`apps/* + packages/*` → `backend/ + frontend/ + shared/`；
   包名仍按 `@lei/backend` / `@lei/frontend` / `@lei/shared` 解析，与目录名解耦。
4. **端口**：前端 4000 / 后端 4001 为现约定，nginx 反代、容器健康检查、CORS 均按此对齐。
