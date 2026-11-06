# ADR-0024: 职责授权的方向 —— 流程的适用角色（`role_workflows` 反向）

- 状态：已接受（Accepted）
- 日期：2026-11-06
- 关联：ADR-0020（业务流程绑定与兜底顺序）、ADR-0023（审批节点的指定人员）、`backend/src/approval/role-workflow.service.ts`、`frontend/src/features/approval/pages/role-workflow.tsx`

## 背景

「职责授权」页原先是「每个角色 → 选一条流程」的一张表，与业务事实相反：

1. 主键是 `role_workflows(role_id)`，**一个角色全局只能绑一条流程**。请假绑了流程，同一个角色的报销就没得绑 —— 页面看起来就是「每种角色只有一个流程」。
2. 实际要回答的问题是「**这条流程适用于哪些角色**」：请假审批适用于员工与主管，报销审批适用于员工 —— 主语是流程，角色是集合，天然是多对多。
3. 旧模型还带来一个隐性歧义：角色在模块维度只能表达一条偏好，而同模块下还有请假/加班/补卡/申诉多个业务，绑定一旦越界就会把报销塞进请假审批链（ADR-0020 记录过的事故）。

## 决策

1. **`role_workflows` 主键改为 `(workflow_id, role_id)`**，一行 = 某流程适用某角色。角色维度保留 `(role_id, workflow_id)` 唯一索引供反查。
   - 存量数据不需要转换：旧行本就是 `(role_id, workflow_id)`、且 `role_id` 唯一，换主键顺序后仍是合法的绑定关系。
   - 删除随主键前缀失去意义的 `role_workflows_workflow_id_idx`（`workflow_id` 已是复合主键前缀）。
2. **同一 module 内，一个角色只允许绑定一条启用流程**。否则发起审批时两条绑定都「匹配」，走哪条取决于查询顺序 —— 配置看似生效，实际随机。冲突由服务层拦截，错误码 `6317`，文案点名冲突的角色与流程（「普通员工」已绑定「请假审批」），让管理员知道该改哪一行。
   - 冲突检查只看 `status='active'` 的同模块流程：停用流程本就不参与解析，阻止保存只会让历史绑定无法清理。
   - **⚠️ 本条已由 [ADR-0025](./0025-role-binding-bulk-and-relaxed-uniqueness.md) 推翻（2026-11-06，同一天）**：该约束让「一键把同一组角色套用到全部流程」永远失败（考勤 4 条、员工事务 6 条流程同属一个 module），而它想防的「随机解析」已由下方第 4 条的 `orderBy workflowId + take 1` 固化为确定性规则。现不再拦截同模块重复绑定，`6317` 一并移除。
3. **页面以流程为行**：流程名 + 业务编码 + 业务模块 + 状态 + 「适用角色」多选 + 生效说明。保存为**覆盖式**（`PUT /approval/role-bindings/:workflowId`，body `{ roleIds }`），空数组 = 解除全部角色，不删除流程本身。
   - 可分配角色全集随列表一起下发（`GET /approval/role-bindings` 的 `roles`），页面不必再要一套 `system:role:view` 权限。
   - 停用流程显式标注「流程未启用，绑定暂不生效」，不让人以为配置已经生效。
4. **解析口径不变**（ADR-0020 优先）：业务编码已配置流程 → 用业务配置的那条；业务未配置流程 → 按申请人角色在**同 module** 内找绑定的启用流程兜底；都没有 → 报「审批流不存在」。解析改为单条查询（`role.users.some` + 关系过滤条件下推数据库），并按 `workflowId` 升序取首条，保证结果稳定。

## 后果

- 正向：配置语言与业务事实一致；一个角色可以在请假、报销等不同模块各绑一条流程；同模块歧义被前置拦截。
- 兼容：旧接口 `GET /approval/roles/workflows`、`PUT /approval/roles/:roleId/workflow` 移除，改为 `GET /approval/role-bindings`、`PUT /approval/role-bindings/:workflowId`；流程设置页的角色下拉改用 `GET /approval/role-options`（同一权限点）。
- **未覆盖（重要）**：`approval_workflows.code` 仍然唯一 —— 一个业务编码只有一条流程，因此角色绑定只在「该业务未配置流程」时才真正改变路由。若要支持「同一业务按角色走不同流程」（如请假：员工版/主管版），需要放开 code 唯一约束并在解析处按角色择一，属于独立变更。
