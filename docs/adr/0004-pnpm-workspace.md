# ADR-0004: pnpm workspace 单仓库

- 状态：已接受（Accepted）
- 日期：2026-08-12

## 背景

新架构分为前端（Next.js）、后端（NestJS）、共享包（Zod schemas/常量/工具）三部分，需要统一管理依赖与跨包引用。曾考虑 npm workspaces，最终用户决策改用 pnpm。

## 决策

采用 **pnpm workspace 单仓库**：

```
lei-system/
  apps/web/        # Next.js + Arco + Refine
  apps/server/     # NestJS + Fastify + Prisma
  packages/shared/ # Zod schemas、常量、工具
  pnpm-workspace.yaml
```

## 后果

- 正向：pnpm 严格依赖隔离，避免幽灵依赖；软链共享，安装快、省磁盘；packages/shared 被前后端直接引用，类型/校验 schema 单源维护。
- 成本：pnpm 需单独安装（corepack 或 npm i -g pnpm）；个别原生模块（如 Prisma）需在 workspace 根统一管理版本。
