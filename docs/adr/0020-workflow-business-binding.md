# ADR-0020: 业务流程与审批流程的绑定（业务编码登记表）

- 状态：已接受（Accepted）
- 日期：2026-10-29
- 关联：ADR-0019（审批权限细化）、`backend/src/approval/workflow-codes.ts`、`frontend/src/lib/workflow-codes.ts`、`backend/prisma/seed.ts`

## 背景

审计发现「流程设置页配置的流程」与「业务流实际使用的流程」之间链路断裂：

1. 业务侧发起审批时硬编码 `workflowCode`（`leave` / `overtime` / `punch_makeup` / `reimbursement` / `onboarding` 等 11 个）；而设置页新建流程时「流程编码」是禁用字段且不随表单提交，后端自动生成 `WF...`，编辑也不允许改编码 —— 页面永远无法产出业务可用的流程。
2. 「适用模块」选项（报销/请假/加班/采购/通用）与实际业务分组不一致；seed 内置流程 module 为 `attendance`，与前端选项里的 `leave` 冲突。
3. `startInstance` 用角色职责授权（`role_workflow`）**无条件覆盖**入参 `workflowCode`，不校验业务类型 —— 某角色绑定请假流程后，该角色提交报销会被塞进请假审批链，随后按 `workflowCode` 分支的审批回调（考勤入账/员工异动）随之错位。
4. seed 只内置了一个 `leave` 流程，其余业务提交直接 404「审批流不存在」。

## 决策

1. **以业务编码（code）为绑定键**，建立业务流程登记表（13 条，含 `general` / `procurement`），`module` 降级为分组，仅用于列表筛选与职责授权兜底匹配。前后端各维护一份同构常量（`workflow-codes.ts`），并由后端单测反向扫描源码校验一致性。
2. **流程设置页新建流程必须选择业务编码**，`module` 由编码自动推导；编辑时编码只读（`updateWorkflow` 本就不接受 code）。这样页面上创建的流程才能被对应业务流使用。
3. **`startInstance` 解析顺序**：
   - 先按请求的业务编码查流程 → 命中即使用，**职责授权不得覆盖**；
   - 仅当该业务未配置流程时，才允许角色绑定流程兜底，且必须与请求业务同 `module`，跨分组一律不兜底（宁可报「审批流不存在」，也不串到别的业务链）。
4. **seed 为登记表内每个业务铺一条默认流程**（单节点「直属上级审批」，幂等 upsert），保证开箱即用；管理员可在设置页替换节点。

## 后果

- 正向：设置页配置立即生效；跨业务串流被根除；审批回调（考勤/员工异动/报表缓存）按业务编码分支不再错派。
- 兼容：历史 `WF...` 流程仍可被「发起审批-手动选流程」使用，不受影响；业务流不再引用它们。
- 未覆盖：~~`role_workflow` 仍是「角色 → 单个流程」粒度，无法按业务细分。若要支持「角色在不同业务走不同流程」，需扩展为 `(roleId, module)` 维度并迁移。~~ 已由 ADR-0024 部分解决：绑定方向翻转为「流程 → 适用角色」（主键 `(workflow_id, role_id)`），同一角色可在不同模块各绑一条。仍受 `approval_workflows.code` 唯一约束限制 —— 一个业务编码只有一条流程，绑定只在业务未配置流程时改变路由；「同一业务按角色分流」需另开变更。
- 部署：需重跑 `prisma db seed`（幂等）补齐默认流程；`approval:workflow:code:*` Redis 缓存会在写流程时失效。

## 修订（2026-10-31）

决策 3 的兜底路径此前只解决了一半：**实例的 `workflowCode` 被写成兜底流程的编码**，而审批回调（考勤入账 / 员工异动）与报表缓存失效都按 `workflowCode` 分派 —— 业务 A 被兜底到业务 B 的流程后，回调进的是 B 的处理函数，查不到 A 的业务记录后静默 `return`，单据永久停在 `approving`。

修订后的口径：

1. **`approval_instances.workflowCode` = 发起时的业务编码**（业务码，不随兜底改变）；`workflowId` 才是实际使用的流程定义。事件 `approval.approved / rejected / withdrawn` 一律以 `instance.workflowCode` 作为分派键。
2. **非登记编码不参与兜底**：`businessModuleOf` 返回 `undefined` 时直接 404「审批流不存在」。原实现在此短路 `module?` 限制，任意拼错的业务码都能拿到角色绑定的任意流程并静默建单。
3. **业务提交端点不再接受客户端 `workflowCode`**：`employee-tx` 系列的入职/离职/转正/申诉/奖惩/证明/调动提交一律由服务端写死各自业务码；「手动选流程」只保留在 `/approval/instances`。
4. **设置页新建流程时禁用已占用的业务编码**（seed 已为 13 个业务各铺一条，否则新建必撞唯一键 6301）；后端 `createWorkflow` 对「同编码但已软删」的记录按重建处理（恢复并覆盖节点），避免删除后该编码永久不可用。
5. **seed 只在流程无任何节点时铺默认节点**：原 `node.upsert(update:{})` 会把管理员改配置时删掉的 `manager` 节点复活成 `order=1`，与管理员节点撞序。
6. **存量实例一次性回填 `workflow_code`**：口径变更只对新建实例生效，修复前已建的实例记录的是兜底流程编码（例：加班单记成 `leave`）。在途单审批通过后会被错误监听器消费，故新增数据迁移 `20261031120000_backfill_approval_workflow_code`：按 11 张业务单表的 `approval_instance_id` 反查真实业务码回填，仅更新不一致行（幂等），只改 `workflow_code`、不触碰 `updated_at`（避免把 `ApprovalReconciler` 的「最近 1 小时终态单」扫描窗口撑大而重放陈年事件）。该迁移只含 DML，与 `schema.prisma` 无 diff；`procurement` / `general` 无业务单表、无反查来源，且这两类流程当前无回调监听器，故不回填（核对语句见迁移文件末尾注释）。

