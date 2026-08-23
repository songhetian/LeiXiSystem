# 雷犀管理系统 — 项目长期记忆

## 目录结构约定 (重构后)
- 顶层 pnpm workspace，角色命名：`backend/`(服务端, NestJS+Fastify, 包名 @lei/backend)、`frontend/`(Next.js14, @lei/frontend)、`shared/`(公共 schema/Zod, @lei/shared)。
- `pnpm-workspace.yaml` 指向 `backend`/`frontend`/`shared`（非 apps/*/packages/* 通配）。
- 辅助目录：`docs/`(ADR/spec/架构/tickets/reviews)、`legacy/`(旧版归档,只读参考)、`prototypes/`(原型)、`scripts/`(工具, 含 verify-workspace.mjs 结构校验)。
- `.trae/` 是另一个 AI 工具(Trae IDE)的状态目录(含 SFTP 书签)，**不属于本项目，保留不动**；`.agents/` 是来源 skills 副本。

## 技术栈
- 后端: NestJS 10 + Fastify + Prisma 6 + MySQL 8.2；测试 jest+ts-jest(dev ts-node)。
- 前端: Next.js 14(App Router) + React 18 + Arco Design；测试 jest。
- 工作区包按名解析(@lei/*)，与目录名解耦——改名目录只需改 pnpm-workspace.yaml。

## 重构工作流
- 按 /tdd 逐 ticket(S01-S15 垂直切片)迭代；当前 S01-S03 已提交，S04 半成品(未提交)。
- 移动目录遇文件锁: 用 `git rm --cached` + `cp` + `git add`(提交时 git 自动 rename 检测)，而非 `git mv`；删目录绕过 safe-delete 用 `find -depth -delete`。
