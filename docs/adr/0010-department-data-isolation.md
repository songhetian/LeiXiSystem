# ADR-0010: 部门级数据隔离

- 状态：已接受（Accepted）
- 日期：2026-08-12
- 修订：2026-09-25 补充「适用范围」节（逐个模块明确隔离 or 全局可见）
- 修订：2026-09-27 更正绩效域过滤写法：`performance_goals` / `performance_reviews` 只存 `employeeId`、**没有 `employee` 关系字段**，不能写 `where.employee = { departmentId: { in: ids } }`（非法 Prisma 参数，触发 500）；须先经 `employee` 表把可见部门收敛为员工 id 集合，再 `where.employeeId = { in: [...] }`（显式入参 `employeeId` 与范围求交集，越界返回空集）

## 背景

旧系统通过 `checkPermission` 做了部门数据过滤（经理只看本部门数据），REFACTOR_PLAN 11.6 只定义了菜单级 + 按钮级权限，**行级（部门）数据权限未定义**。若丢失，部门经理将看到全公司考勤/薪资数据，不可接受。

## 决策

**保留并规范部门级数据隔离**，作为 RBAC 之外的"数据范围"维度：

- **可见部门范围**由"角色 → 部门范围"配置决定：超管/HR 角色 = 全部部门；部门经理 = 本部门（含子部门，树形向下）；普通员工 = 仅本人。
- 生效位置：列表、详情、报表、工资条管理（C8 全部生效）；算薪批次详情按员工所属部门过滤。
- 实现：后端统一在 Service 层按"当前用户可见部门 ID 集合"拼过滤条件（`WHERE department_id IN (...)` 或本人），**不在前端过滤**（防绕过）。统一入口为 `DataScopeService.visibleScope(userId)`，三档返回 `{all:true}` / `{all:false, ids:[...]}` / `{all:false, ids:[], selfEmployeeId}`，带 Redis 5 分钟缓存。
- 无权限访问他人数据返回 5003。

## 适用范围（2026-09-25 逐个模块明确）

**必须隔离**：

| 域 | 隔离维度 | 说明 |
| --- | --- | --- |
| 员工 / 考勤 / 排班 / 薪资 / 工资条 / 报表 | 员工所属部门 | 原始落地范围 |
| 财务 · 预算（`budgets`） | `departmentId in 可见部门` | 预算天然属部门；「仅本人」档无对应维度，直接返回空集（不查库），入参 `departmentId` 仍受范围约束 |
| 绩效 · 目标（`performance_goals`）/ 评估（`performance_reviews`） | 被评估员工所属部门 | 表无 `employee` 关系字段，须先查 `employee.findMany({ where: { departmentId: { in: ids } } })` 收敛为员工 id 集合，再 `where.employeeId = { in: [...] }`；「仅本人」档强制 `employeeId = 本人`，显式查询他人直接返回空集（不查库） |
| OKR · 目标（`okr_objectives`）/ 关键结果 | `departmentId in 可见部门`；「仅本人」档 `ownerId = 本人` | 关键结果随其目标归属：目标不在可见范围时按「不存在」处理，不泄露数据 |

**明确全局可见（不隔离）**，因其表结构本身无部门维度，强行隔离只能靠猜：

| 域 | 对象 | 理由 |
| --- | --- | --- |
| 财务 | 费用标准（`expense_standards`） | 表无 `department_id` 字段，是公司级统一标准 |
| 绩效 | 绩效周期（`performance_cycles`） | 公司级时间周期，无部门维度 |
| 服务台 | 工单（helpdesk） | 全员可提单/查看处理进度，属协作型数据 |
| 知识库 | 分类 / 文章（knowledge） | 知识共享是系统目的，隔离会破坏可用性 |
| 系统 | 公告（broadcast） | 面向全员的广播 |

**已知边界**：`DataScopeService` 的 manager 分支不返回 `selfEmployeeId`（若给管理者补该字段，会让 `payslip.listPayslips` 等既有消费者把管理者错误收窄为"仅本人"）。因此部门管理者看不到「自己名下、不挂部门」的个人 OKR —— 属可接受取舍，若后续需支持，应在 `DataScope` 中拆分「部门范围」与「本人维度」两个独立字段，而非改 manager 分支语义。

## 后果

- 正向：薪资/考勤敏感数据按组织边界收敛，满足合规预期；与旧系统行为一致，用户无感知迁移。
- 成本：所有列表/详情查询需注入数据范围条件（可用 NestJS 守卫 + 装饰器统一注入，减少遗漏）；部门树变更（移动员工）时可见范围随之联动。
- 约束：权限模型 = RBAC（菜单/按钮）+ 部门数据范围（行级）两个维度，`packages/shared` 需定义统一的"数据范围"枚举与判断工具。
- 约束：新增列表/详情接口时，必须在本节「必须隔离」表中明确归属，或在「全局可见」表中显式登记理由，不允许留空。
