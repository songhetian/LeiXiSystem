# Ticket: S17 — 审批权限细化（approval:process / approval:apply）

> 来源：R5 权限矩阵审计（2026-10-28）待决策项，用户已确认方案。
> 关联：ADR-0019、REFACTOR_PLAN 11.6-3（RBAC 强制标准）、backend/prisma/seed.ts。

## 背景

R5 审计发现审批处理端点（approve/reject/transfer/add-sign）挂 `approval:todo:view`（查看类权限点守卫写端点，可越权直调）；`startInstance` 挂 `approval:submitted:view`。挂 `approval:manage` 会阻断普通员工（staff）中的审批人，故需新增专用权限点。

## 待办

- [x] seed.ts 新增权限点 `approval:process`（审批处理 · approval · api）；admin 自动全量绑定
- [x] seed.ts STAFF_PERMISSIONS 补绑 `approval:apply`（发起审批）、`approval:process`（处理待办——staff 含审批人场景）
- [x] approval.controller.ts：approve/reject/transfer/add-sign → `approval:process`；startInstance → `approval:apply`；todos/my-approved 保持 `approval:todo:view`
- [x] seed.spec.ts 权限点清单断言同步
- [x] 新增 approval.controller.spec.ts 权限矩阵断言（沿用 reimbursement.controller.spec.ts 范式）
- [x] 9 个 e2e 文件测试用户补绑 `approval:process` / `approval:apply`
- [x] 后端测试全绿（除本地无 Redis 的环境性既有失败）
- [ ] 部署时重跑 `prisma db seed`（幂等，重建角色绑定并失效 Redis 权限缓存）—— 运维项

## 明确不做

- 前端审批处理按钮不包 PermissionGate（审批人处理待办是流程动作，靠待办分配而非权限点；后端 403 兜底）
- approval:withdraw / vacation convert 等个人自助端点维持 JWT 归属校验豁免
