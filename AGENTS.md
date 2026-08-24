# AGENTS.md

本文件为 AI 代理（Agent）在本仓库工作的约定。任何 agent 会话开始前先读本文件与本仓库的领域上下文（见下文 `## Agent skills` → `### Domain docs`）。

## 通用约定

- 沟通语言为**中文**（终端输出、文档、提交信息中文注释）。
- 环境变量统一在根目录 `.env`（开发）与 `.env.production`（生产）维护。
- 前端端口 `4000`、后端端口 `4001`。
- 测试遵循 **TDD**，改动涉及后端 `src/**/xxx.service.ts` 时应先写对应 `*.spec.ts`。
- 金额一律用 `decimal` 类型，禁止浮点。
- 删除功能必须连根删：前端页面 + 后端路由 + 数据表 + 依赖。
- UI 必须遵守 Arco Design Pro 企业级标准（见 `docs/adr/` 与旧代码归档 `legacy/` 对比例证）。
- 业务规则以 `CONTEXT.md`「业务规则」节 + `docs/adr/` 为准，变更需先更文档再改代码。

## Agent skills

### Issue tracker

本地 Markdown：任务存于 `docs/tickets/`，按阶段拆分，每个文件内含 `- [ ] 描述` 清单；新需求/缺陷建议先写 PRD 再拆 ticket。See `docs/agents/issue-tracker.md`.

### Domain docs

single-context：仓库根 `CONTEXT.md` + `docs/adr/`，决策记录持续追加编号。See `docs/agents/domain.md`.