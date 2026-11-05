# ADR-0022：通知策略按审批流程节点配置（替代「事件 × 多选角色」）

- 状态：已采纳
- 日期：2026-11-05
- 相关：ADR-0013（跨模块边界）、ADR-0017（迁移基线）、ADR-0020（流程业务编码）

## 背景

「系统设置 → 通知设置」原先按 **事件类型 × 多选角色** 配置：请假申请触发、请假审批通过等 14 个事件，各自从一个包含伪角色与系统全部角色的下拉里多选收件人，结果写入 `notification_settings.target_roles`。

三个问题：

1. **配置未生效**。全仓检索确认 `targetRoles` 只被配置页自身读写，`NotificationService.create / createMany` 的收件人全部由调用方直接传 `userId`，没有任何业务路径读取该表。页面保存成功，实际通知行为零变化。
2. **语义错位**。请假/加班/补卡/报销本质是审批流，收件人由流程节点的处理方决定（角色、审批组、部门主管、申请人）。让管理员从「管理员、普通员工、HR…」里自由勾选，既可能与流程冲突，也无法表达「只通知进入财务环节时」这类诉求。
3. **多选本身不合理**。一个审批节点的处理方是确定的，多选只会产生「同一节点既通知 A 又通知 B」的歧义。

## 决策

### 1. 配置主体改为流程节点

- `notification_settings` 新增 `target_nodes`（JSON，可空），元素为 `approval_workflow_nodes.node_key`。
- 每个业务事件对应一个流程编码（见 `WORKFLOW_NOTIFY_EVENTS`）：`leave → leave_apply`、`overtime → overtime_apply`、`punch_makeup → makeup_apply`、`reimbursement → reimbursement_progress`。
- 页面按流程渲染节点链，每个节点一个开关（`Switch`），不提供多选。

### 2. 三态语义（null / [] / 数组）

| 值 | 含义 |
| --- | --- |
| `NULL` | 从未配置 → **默认策略**（流程所有节点都通知、终态通知申请人） |
| `[]` | 显式关闭（该流程一个节点都不通知 / 终态不通知申请人） |
| `['node_key', ...]` | 只通知列出的节点 |

`NULL` 与 `[]` 必须区分：流程后续新增节点时，只有 `NULL` 能让新节点自动继承通知，避免「流程改了但通知悄悄失效」。

### 3. 发送侧接入点

`ApprovalService` 通过只读边界 `NOTIFICATION_POLICY`（`NotificationSettingService`）读取策略：

- `notifyApproversForNode()` 前调 `shouldNotifyNode(workflowId, nodeKey)`；
- `notifyApplicant()` 前调 `shouldNotifyApplicant(instanceId, result)`，读 `target_roles` 是否包含 `applicant`。

策略读取失败由 `NotificationSettingService` 内部降级为「未配置」，**绝不因配置读不到而漏发业务通知**。

### 4. 非流程事件保留角色语义，但改为单选

迟到/早退/缺勤/资产领用没有审批流可挂靠，继续写 `target_roles`，页面用单选 `Select`（`applicant` / `dept_manager` / 角色名），不允许多选。

### 5. 缓存

`getPolicy` 走 60s 进程内缓存（审批流转每次节点切换都会读一次）；`setTargets` 保存后立即失效该事件缓存。

## 后果

- 新增迁移 `20261105130000_notification_setting_target_nodes`；`target_roles` 列保留，语义收敛为「非流程收件方 / 终态开关」。
- 现有 `target_roles` 数据无需迁移：旧值若不包含 `applicant`，终态通知会被判为关闭。上线前应确认存量行（可通过一次 `UPDATE ... WHERE target_roles <> '[]'` 回填 `["applicant"]`，或直接在页面上重存）。
- 通知设置页依赖 `GET /approval/workflows`；只有 `system:notification:settings` 而无流程查看权限的账号会看到告警条并禁用节点保存，终态与非流程部分仍可用。
- 未登记通知事件的流程（入职/转正/离职等）保持默认全通知，不受本策略影响。
