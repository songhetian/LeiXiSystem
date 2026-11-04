# ADR-0019: 审批权限细化（新增 approval:process，处理与发起与查看分离）

- 状态：已接受（Accepted）
- 日期：2026-10-28
- 关联：ADR-0010（部门数据隔离）、REFACTOR_PLAN 11.6-3（RBAC）、`backend/prisma/seed.ts`、`backend/src/approval/approval.controller.ts`

## 背景

R5 全量权限矩阵审计（396 端点）发现审批模块写端点用查看类权限点守卫：

- `POST /instances/:id/approve|reject|transfer|add-sign` 挂 `approval:todo:view`；
- `POST /instances`（发起审批）挂 `approval:submitted:view`。

查看类权限点守卫写端点属于越权面（低权限用户可直调 API）。但直接升级为 `approval:manage` 会阻断 staff 角色中的审批人（待办处理是流程动作，靠待办分配而非管理权），`approval:apply` 又未被 STAFF 角色绑定（收紧即断普通员工发起审批）。

## 决策

1. **新增权限点 `approval:process`（审批处理）**：专用于待办处理动作（approve/reject/transfer/add-sign）；admin 全量自动绑定，STAFF 显式补绑（staff 含审批人场景）。
2. **发起审批改挂 `approval:apply`**，STAFF 补绑该点——语义与 seed 中「发起审批」定义一致。
3. **查看端点不变**：todos / my-approved / my-instance 保持 `approval:todo:view` / `approval:submitted:view`。
4. **前端不包流程动作按钮**：审批处理、发起审批按钮不加 PermissionGate（员工自助流程动作，全员可用，靠待办分配与后端 403 兜底）；前端已有的查看类 code 与本轮无冲突。

## 后果

- 正向：审批写端点不再可用查看权限点直调；权限语义「查看 / 发起 / 处理 / 管理」四级分离。
- 成本：需重跑 `prisma db seed`（幂等：upsert 权限点、重建 admin/staff 绑定、失效两者 Redis 权限缓存）；e2e 测试用户的权限绑定同步补点。
- 兼容：已登录用户在 seed 重跑后旧缓存被主动失效，无「按钮无反应」窗口。

## 修订（2026-10-31）

1. **`RequirePermission` 支持 `string[]`，语义为 OR。** 同一动作存在两种合法身份时（员工自助 vs HR 代录），单一权限点必然误伤一侧：只挂 `attendance:manage` 会让 staff 提交请假 403，只挂 `personal:leave:apply` 会让 HR 失去代录能力。
2. **请假/加班的创建端点 `POST /leave-records`（加班同）改挂 `['personal:leave:apply' | 'personal:overtime:apply', 'attendance:manage']`（OR）。** 归属约束由 service 层数据范围保证（staff 的 `selfEmployeeId` 只能为本人建单），不依赖权限点；HR 靠 `attendance:manage` 代录。
3. **提交端点 `/:id/submit` 只挂 `personal:*:apply`，不挂 `attendance:manage`。** `submitLeave/submitOvertime` 硬性要求 `employee.userId === 当前用户`，HR 即便有 `attendance:manage` 也必然 403——挂上它只会在权限矩阵里制造「看起来允许、实际拒绝」的死分支。代录的单由员工本人在「我的请假 / 我的加班」里提交。
4. 审批类写端点（approve/reject/transfer/add-sign → `approval:process`）与发起端点（`approval:apply`）的绑定不变。

