# S01 · 基础设施骨架

## What to build
搭好 pnpm workspace（apps/web + apps/server + packages/shared），前后端最小可启动、连通（健康检查 + 一个示例接口 + 一个示例页），为所有切片提供地基。

## 进度（2026-08-12 起）
- [x] `refactor-v2` 分支创建（原"重置版"分支）@ 2026-08-12
- [x] workspace 根：package.json（workspaces）+ pnpm-workspace.yaml + .gitignore
- [x] **TDD 循环 1（shared）**：employeeNoSchema（A7 规则）测试先行 → 实现 → **11/11 PASS**（正常2/边界4/异常5）
- [x] **TDD 循环 2（server）**：GET /health 测试先行 → NestJS+Fastify 骨架 → **2/2 PASS**（200 {code:0} + 404）
- [ ] 前端：Next.js 14 + Arco 布局骨架 + 依赖安装 + 启动验证
- [ ] 全量验收：pnpm install 无报错、前后端可启动、shared 被前后端引用

## 五维清单
- **数据库**：Prisma init + 连接本地 MySQL；建基线（保留表结构从 legacy/database 导入后 prisma db pull）
- **后端接口**：NestJS(Fastify) 骨架 + GET /health；ZodValidationPipe；pino 日志；@nestjs/config
- **业务算法**：无（纯骨架）
- **前端页面**：Next.js(App Router) + Arco Pro 布局骨架（侧边栏/顶栏/主题 token）；Refine provider 接入；占位登录页
- **单元测试**：后端 health e2e；前端骨架 smoke 测试

## Acceptance criteria
- [ ] `pnpm install` 无报错，`pnpm dev` 前后端可启动
- [ ] GET /health 返回 200（{code:0}）✅
- [ ] 浏览器打开 web 显示 Arco Pro 布局骨架
- [ ] packages/shared 有首个 Zod schema 并被前后端引用编译通过

## Blocked by
None — 可立即开始（先建 `refactor-v2` 分支 + mysqldump 备份）
