# Ticket: S18 — 业务流程与流程设置页打通

> 来源：用户审计「流程设置页面功能是否正常 / 设置的流程是否运用到对应流程下」。
> 关联：ADR-0020。TDD 实施，接缝在 `ApprovalService.startInstance`、`RoleWorkflowService.resolveWorkflowForUser`、流程设置页。

## 缺陷

- [x] 设置页「流程编码」为禁用死字段、不随表单提交 → 新建流程编码自动生成 `WF...`，业务永远用不到
- [x] 「适用模块」选项与实际业务分组不符（含 seed 流程 module=attendance 与前端 leave 冲突）
- [x] `startInstance` 中角色职责授权无条件覆盖入参 workflowCode → 跨业务串流
- [x] seed 仅内置 `leave` 流程，其余业务提交 404

## 待办

- [x] 新增业务编码登记表（后端 `src/approval/workflow-codes.ts`、前端 `src/lib/workflow-codes.ts`，13 条）
- [x] `startInstance`：业务配置优先；职责授权仅兜底且必须同 module
- [x] `resolveWorkflowForUser(userId, { module })` 增加 module 过滤
- [x] 流程设置页：业务编码必选下拉 + module 自动推导；编辑态编码只读；列表展示中文业务名与分组
- [x] seed：按登记表为每个业务幂等铺默认流程
- [x] 测试：`approval-workflow-binding.unit.test.ts`(3)、`role-workflow.service.spec.ts`(+2)、`workflow-codes.spec.ts`(3)、`settings.test.tsx`(3)
- [x] 部署：重跑 `prisma db seed`（本地已执行，13 条流程全部 active）
- [x] 部署：新增 `SEED_DEMO` 开关（`SEED_DEMO=false` 时只写基础数据 + 13 条默认流程），入口 README 与 `.env*.example` 已补说明（ADR-0017 增补节）

## 明确不做

- `role_workflow` 升级为 `(roleId, module)` 维度（需迁移，另立 ticket）
- 历史 `WF...` 孤立流程的自动清理
