# 雷犀系统 双轴代码审查（v2 · 增强版）

- **分支**：`refactor-v2`
- **基准点**：`c7b779a`（refactor-v2 起点）→ `8df006c`（HEAD，结构重构）+ 未提交工作区（S04–S15 WIP）
- **审查日期**：2026-08-13
- **方法**：Standards 轴与 Spec 轴由并行子代理独立产出，互不污染上下文，下方不合并、不重排。
- **范围说明**：提交的 S01–S03 + 结构重构，外加工作区中未跟踪的 9 个业务模块（approval / attendance / common / knowledge / notification / payroll / reimbursement / reports / system）及其 31 个 e2e/unit 测试、前端 features、以及 4+ 个新迁移目录。

---

## Standards（代码规范与坏味道）

> 不评估 spec/文档合规性，只看代码质量与项目约定。参考基线 = 已提交的 S01–S03（`backend/src/auth`、`backend/src/employees`）。

### 1. 跨模块 Service 直接调用 —— HARD（违反 ADR-0013）⚠️ 最严重
ADR-0013 明确「禁止跨模块调用对方 Service（跨模块只读经 Prisma 弱引用）」。以下三处直接注入 `ApprovalService` 并调用其**写方法** `startInstance/approve/reject`：
- `backend/src/attendance/vacation.service.ts:5,133,171,213,353,391,432`
- `backend/src/attendance/punch-makeup.service.ts:8,182,220,254`
- `backend/src/reimbursement/reimbursement.service.ts:8,224`

**修复**：审批触发应走「本模块发领域事件 → 审批模块消费」，或仅以只读方式回读审批结果；不得跨模块调对方写方法。

### 2. 中央错误码表死代码 + 100+ 处硬编码字面量 —— HARD ⚠️
- `backend/src/common/error-codes.ts` 仅被 `vacation.service.ts` 引用，其余 `throw { code: NNNN }` 全为硬编码字面量（含基线 `employees.service.ts:16/51/74/76`、`auth.service.ts:26/40`）。
- **码段冲突**：`knowledge.service.ts:28,39,79` 用 `5001/5002`（与 auth 冲突，且表内 `KNOWLEDGE_*` 与 `AUTH_*` 已自重复定义 `5001/5002`）；`shifts.service.ts:33,63,67` 用 `2001` 表「班次不存在」（语义错位）；`punch-device.service.ts` 用 `2007` 同时表「不存在/编号重复」；`payslip.service.ts:18,78` 用 `4001/4004`（属报销域）。
- **未定义域码**：`system-user.service.ts:61,90,98,127,135` 用 `6101/6102/6201/6202`、`approval.service.ts` 用 `6301–6309`，表中均未定义。
- **语义错误**：`employees/punch-logs/schedules/punch-device` 控制器用 `code: 422`（HTTP 状态码，非 4 位业务码）。

**修复**：全量改用 `ERROR_CODES.*`；补全 `61xx/62xx/63xx/70xx` 段并消重；删表内 `KNOWLEDGE_*` 重复键。

### 3. 控制器 `@Body()/@Req() body: any` 缺 DTO —— HARD-ish（违反 ADR-0006「禁止 any」）
`body: any` + `req: any` 遍布控制器（`system/system.controller.ts:84,103,150`、`reports/reports.controller.ts`、`reimbursement/reimbursement.controller.ts`、`approval/approval.controller.ts`、`attendance/*`）。参考基线 `employees.controller.ts` 已用 zod 解析 DTO，风格不一致。

**修复**：补 zod/DTO 类；`req.user` 用 `@User()` 装饰器或 `CurrentUser` 类型替代 `(req as any).user`。

### 4. 审批编排在三个模块重复 —— HARD/judgement
`vacation / punch-makeup / reimbursement` 各自注入 `ApprovalService` 并以相同结构调 `startInstance→approve/reject`。建议抽公共薄封装 `ApprovalClient`（仅读审批状态）。

### 5. 魔法状态字符串 —— HARD-ish
`status: 'pending'/'approved'/'confirmed'/'draft'/'resigned'` 散落于 service 写路径（`employees.service.ts:67`、`attendance-monthly.service.ts:31,82,148`、`approval.service.ts:137,236,257,298`）。Domain 引擎层已用 union type（好），但 service 层仍裸字符串。

**修复**：抽 `*.status.ts` 常量/enum。

### 6. e2e 测试脚手架重复 —— HARD
31 个 `*.e2e.test.ts` 各自重复 `beforeAll/afterAll` 启动与清理，无共享 helper（`backend/src/test-utils` 不存在）。**修复**：抽 `setupE2EApp()` 返回 app + teardown 复用。

### 7. 过长类 —— judgement
`vacation.service.ts`（585 行）、`reports.service.ts`（418）、`approval.service.ts`（369）、`payroll.service.ts`（307）单文件过大。建议按子域拆分 service。

### 8. 前端 —— 轻微
交叉 feature import **未发现**（ADR-0014 遵守良好）。`any` 集中在泛型表格 `ProTable`/`ModalForm`（`data: any[]`、`render:(_:any,…)`）与 `catch(e:any)`，属可接受 idiom，非阻塞。

**Standards 轴小结**：2 项硬伤（#1 跨模块调写方法、#2 错误码死代码+硬编码）必须修；#3/#6 为规模化重复/类型缺失；#4/#5 一致性；#7/#8 judgement，可后续。

---

## Spec（实现合规性校验）

> 不评估代码风格，只核对是否严格遵从 `docs/spec/technical-spec.md`、`CONTEXT.md`、`REFACTOR_PLAN.md`、`docs/schema/new-tables.md`、`docs/api/core-contracts.md`、各 ticket slice 与 ADR。每项均引出原文。

### 1. 数据库表结构（对照 `docs/schema/new-tables.md`）
- **`punch_logs.punch_type` 类型漂移**：docs 规定 `ENUM('in','out') NULL`；`schema.prisma:189` 实为 `String?`。
- **`salary_items.type` 类型漂移**：docs 规定 `ENUM('fixed','per_day','per_hour','formula','deduction')`；`schema.prisma:493` 实为 `String @db.VarChar(20)`。
- **`salary_items.sort` 改名**：docs 列名 `sort`；`schema.prisma:498` 为 `sortOrder`。
- **`attendance_daily.status` 枚举越权**：docs 枚举 `normal/late/early/absent/half_absent/makeup/holiday/leave/weekend`；`schema.prisma:391-403` 多出未授权的 `late_early`、`abnormal`。
- **`attendance_daily` 多出未授权列**：docs 未要求 `punchCount`、`leaveDays`，`schema.prisma:416,420` 新增。
- **Schema 与 migration 严重脱节（最大问题）**：migration 仅到 `20260813012633_add_leave_days_to_daily`（S02–S08）。`schema.prisma` 中的 S09–S15 表（`approval_*`、`reimbursement_*`、`knowledge_*`、`payroll_runs`/`salary_items`/`payroll_details`/`payroll_adjustments`、`export_tasks`、`notifications` 等）**无任何 migration**。`prisma migrate deploy` 与 schema 不一致，DB 真实缺这些表。

### 2. 接口定义（对照 `docs/api/core-contracts.md`）
- **全局统一响应缺失**：`main.ts`、`app.module.ts` 未注册全局异常过滤器/响应拦截器（仅 `OperationLogInterceptor`）。成功响应各 controller 手动包 `{code,message,data}`，但**抛错未归一化**，Nest 默认返回 `{statusCode,message,error}`，违反 §1「统一响应」与 §2 错误码结构。
- **HTTP 422 语义未落实（S04 旧伤）**：契约 §2「`422` 校验失败」。`shifts.controller:29/48` 用 `BadRequestException`(400)+业务码 `2001`；`schedules.controller:29,41,77` 与 `schedules.service:25,51,106` 却把 **HTTP 422 误当业务码**（`{code:422}`）。S04 未把校验失败降为 HTTP 422，且 `shifts`(2001) 与 `schedules`(422) 业务码不一致，`422` 不是契约授权的 4 位业务码。
- **薪资域权限挂错域**：`payroll.controller` 用 `attendance:view`/`attendance:manage` 守护薪资项与批次；契约/ADR 将薪资归 HR/超管（C8）。
- **错误码错用/越权**：`payroll.service:34` 用 `3002`（契约=项目编码重复）表「月报未确认」；`createSalaryItem:228` 用未授权码 `3006`（应 `3002`）；`updateSalaryItem:253` 用 `3007`；`recallRun:198` 用 `3005`（契约=员工无工资配置）表「已查看工资条」；`publishRun:175`/`confirmRun:161` 对前置状态用 `3003`（批次已发布），而发布未确认批次应报 `3004`（批次未确认，契约 confirm 标注「3004 前置校验」）。

### 3. 业务逻辑（对照 ticket / ADR）
- **ADR-0010 行级越权返回错码**：`employees.service.ts:52-54` 对越权详情抛 `{code:1002,员工不存在}`，但 ADR-0010 明文「无权限访问他人数据返回 **5003**」，契约「5003 无权限访问该数据（行级）」。应改 5003。
- **数据范围未注入薪资批次**：`payroll.service.ts:99-153` `getRunDetails`/`listRuns` 未调 `DataScopeService`，违反 ADR-0010「算薪批次详情按员工所属部门过滤」。
- **行级 5003 传输层不一致**：`schedules.service:128` 用 `BadRequestException`(400) 抛 5003，而 `permission.guard.ts:32` 用 `ForbiddenException`(403)。同一业务码 5003 传输状态矛盾。
- **ADR-0011 快照守则需肯定**：`payroll.service:28-31` 仅消费 `status:'confirmed'` 月报；`attendance-monthly.service:36-38` 已确认月报拒绝重算——快照锁定正确 ✅。
- **「抽检 3 人」未强制**：spec §2.3 与契约 confirm 标注「D1 抽检 3 人」，`payroll.service:155-167` `confirmRun` 无任何抽检校验，疑似缺失验收项。
- **S04 班次删除守卫正确**：`shifts.service:65-68` 被排班占用不可删并报 2001，符合契约 ✅。

**Spec 轴小结**：最高优先级 = (a) 补 S09–S15 migrations 消除 schema/migration 脱节；(b) 加全局异常过滤器统一 `{code,message,data}` 并落实 HTTP 422；(c) 修正 `employees.service` 行级 5003 与薪资域数据隔离。

---

## 汇总
- **Standards 轴**：8 类发现，最严重 = #1 跨模块调写方法（违反 ADR-0013）+ #2 错误码中央表死代码/硬编码冲突。
- **Spec 轴**：3 类发现，最严重 = schema 与 migration 脱节（S09–S15 无迁移，DB 缺表）+ 全局响应/HTTP 422 未落实 + 行级越权错码（1002 应 5003）。
- 两轴均提示**不要合并单一 winner**：Standards 的架构硬伤与 Spec 的契约/数据一致性硬伤相互独立、需分别修。
