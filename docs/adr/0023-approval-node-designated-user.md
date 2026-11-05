# ADR-0023: 审批节点支持「指定人员」

- 状态：已接受（Accepted）
- 日期：2026-11-05
- 关联：ADR-0019（审批权限细化）、ADR-0020（业务编码绑定）、ADR-0022（节点级通知策略）
- 代码：`backend/prisma/schema.prisma`、`backend/src/approval/approval.service.ts`、`backend/src/approval/engine/routing-engine.ts`、`frontend/src/features/approval/pages/settings.tsx`

## 背景

审批节点原先只有三种「谁审批」的表达方式：`role`（角色）、`group`（审批组）、`department_manager` / `initiator`（按组织关系动态解析）。

`role` 与 `group` 都是**集合**语义，无法表达「这个节点就由张三审」。实际业务里大量存在点名审批的场景（公章保管人、特定财务复核人、某部门固定经办人），管理员只能为此新建一个只含一人的审批组，或用「某某角色」凑——前者污染审批组列表、后者随角色成员变动而漂移。

更关键的是链路只做了一半：引擎 `routing-engine.ts` 早已实现 `case 'user'`（候选人与审批人列表都会读 `node.userId`），但 `approval_workflow_nodes` 表没有 `user_id` 列、DTO 没有该字段、写入映射不落库、前端也没有入口。也就是说该能力**看起来存在**，实际配置不出来，`type='user'` 的节点会因 `userId` 恒为 `undefined` 而静默消失（`resolveApproverList` 返回空数组）。

## 决策

1. **新增列 `approval_workflow_nodes.user_id`（INT NULL，无外键）**，只在 `type='user'` 时有意义；其余类型该列为 `NULL`。
2. **不加外键**：`users` 存在软删除与停用账号，节点配置需要在账号停用后仍可读出并提示「账号已不存在」；加 FK 会让保存历史配置直接失败。
3. **审批人解析口径统一为「节点 + 类型」**，四处必须同时支持：
   - `notifyApproversForNode`（建实例 / 重提时的待办通知）
   - `canUserApprove`（审批、转交、加签的鉴权；`false` 即 403）
   - `buildTodoWhere`（待办中心查询）
   - `ApprovalReminderService#getApproverIdsForNode`（超时催办）
4. **`buildTodoWhere` 把 `type='user'` 当作「与实例无关」的节点整体下推**（`{ type:'user', userId }`），并沿用「实例当前节点 = 本节点」的收敛条件——否则后置节点的指定人会提前看到不属于自己的待办。
5. **fail-closed**：`type='user'` 但 `user_id` 为空时，既不产生待办也不产生通知，`canUserApprove` 一律返回 `false`；`resolveApproverList` 返回空数组。不允许退化成「所有人可审」。
6. **`buildApprovalChain` 的 `engineNodes` 同时补上 `approvalGroupId`**：此前 `type='group'` 也只传了 `roleCode`，引擎读 `node.approvalGroupId || node.groupId` 两者皆空，导致审批组节点在链上的 `approvers` 恒为空。属于同一类「表里有列、引擎没拿到」的缺陷。
7. **前端配置体验**：
   - 审批类型顺序调整为「指定人员 / 角色审批 / 审批组 / 部门主管 / 申请人」，前三种是点名到人，后两种按组织关系解析；
   - 「指定人员」用**可搜索下拉**（姓名 + 登录名 + 角色名，匹配串放 `option.extra`，因为 Arco 用 `options` 数组渲染时只透传 `value/disabled/extra`）；
   - 选中后渲染**人员卡片**（首字头像 + 姓名 + 登录名/角色 + 停用标记），左栏节点卡与流程预览统一展示「类型徽章 + 审批人姓名」，未配置时用警示色区分；
   - 切换审批类型时清空其它类型的审批人字段，避免库里残留 `role_code` 与 `user_id` 并存造成语义漂移。

## 后果

- 正向：点名审批无需再借道审批组；`role`/`group`/`user` 三种集合粒度语义清晰；切换类型不再留下脏字段。
- 数据：需执行迁移 `20261105200000_approval_node_user_id`（仅 `ADD COLUMN`，无回填、无 `updated_at` 触碰）。
- 兼容：既有节点 `user_id` 为 `NULL`，行为不变；`type='group'` 节点在补上 `approvalGroupId` 后会**开始产生 `approvers` 列表**（此前为空），签名口径（`signType` 缺省 required=true）因此真正生效。
- 未覆盖：审批人停用 / 离职后节点不会自动改派，仍指向该账号（待办无人可办）。后续可加「节点审批人失效告警」，在流程列表上标出。
- 权限：节点配置仍需 `approval:workflow:manage`；人员下拉的数据源是 `GET /system/users`（需 `system:user:view`），缺权限时下拉给出说明并退化为空集，不发请求以免触发全局 403 Toast。
