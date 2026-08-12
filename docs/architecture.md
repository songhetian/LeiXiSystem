# 雷犀客服管理系统 · 整体架构设计 v1.0

> 生成：2026-08-12 ｜ 依据：CONTEXT.md 领域模型 + REFACTOR_PLAN + docs/schema + docs/api + ADR×13
> 术语约定（codebase-design）：**Module**=有接口与实现的单元；**Interface**=调用方必须知道的全部（签名+不变量+错误模式）；**Seam**=接口所在的位置；**Adapter**=在缝处满足接口的实体；**Depth**=接口小、行为多。

---

## 1. 分层架构总览

### 1.1 后端（apps/server · NestJS + Fastify）—— 模块内 4 层，依赖单向

```
┌─────────────────────────────────────────────────────┐
│ Presentation 层（薄）                                │
│   Controller：路由 + Zod 校验（shared 契约）+ 响应格式化 │
├─────────────────────────────────────────────────────┤
│ Application 层（深）                                 │
│   Service：业务用例编排、状态机、权限/数据隔离注入       │
├─────────────────────────────────────────────────────┤
│ Domain 层（纯函数 · 最深的模块）                      │
│   考勤规则引擎、算薪引擎、额度换算、审批路由            │
│   无 IO、无框架依赖 → 单测即接口                       │
├─────────────────────────────────────────────────────┤
│ Infrastructure 层（Adapter）                         │
│   Prisma Repository（数据访问）、punch HTTP/CSV        │
│   Adapter、OSS Adapter、KKFileView 调用、Socket 网关   │
└─────────────────────────────────────────────────────┘
        依赖方向：上 → 下，禁止反向
```

- 每个业务 Module 的内部结构：`module.ts`（装配）+ `controller.ts`（薄）+ `service.ts`（深）+ `domain/`（引擎纯函数）+ `dto`（从 packages/shared 引入，不重定义）。
- **接口即测试面**：Domain 引擎（考勤/算薪）是最高 seam（spec 第 7 章），测试跨同一接口进行。

### 1.2 前端（apps/web · Next.js + Arco + Refine）—— 3 层，feature 隔离

```
┌───────────────────────────────────────────┐
│ app/     App Router 路由 + 布局 + Providers │
│          （AuthProvider/Refine/Arco 主题）  │
├───────────────────────────────────────────┤
│ features/  业务模块（与后端 Module 一一对应）│
│          每 feature：pages/ components/    │
│          hooks/ api.ts                    │
├───────────────────────────────────────────┤
│ shared/   公共组件库 + lib（api client/     │
│           date/error）+ stores(zustand)    │
└───────────────────────────────────────────┘
        依赖方向：app → features → shared；feature 间禁止互引
```

### 1.3 共享包（packages/shared）—— 唯一跨端契约源

只放：Zod schemas（DTO）、枚举/常量、纯类型、金额与日期工具（无业务逻辑）。禁止：业务逻辑、数据库访问、React 代码。前后端经 `workspace:*` 引用，schema 单源。

---

## 2. 后端模块拆分（Deep Module 设计）

| Module | 接口（小） | 实现（深） | 依赖 |
|---|---|---|---|
| **auth** | `login/refresh/me/logout` + RBAC Guard | JWT + 黑名单（落库）+ 权限点解析 + 部门范围计算 | shared、system 数据表（只读） |
| **employees** | 档案 CRUD、离职、导入导出 | 员工聚合根（工号唯一、状态机：在职→离职）、数据隔离注入 | shared |
| **attendance** | 班次/排班/请假/加班/补卡/额度 + 规则引擎 | **考勤规则引擎**（流水×排班→日报→月报，深模块）、额度换算、结账锁定 | shared、employees（只读：员工/部门范围） |
| **punch** | `syncPunchLogs()` / `importCsv()`（**接口仅 2 个方法**） | XFace600 HTTP Adapter + CSV Adapter（隐藏设备差异）、LastSyncTime 游标、定时任务 | shared |
| **payroll** | 项目配置 + `runs.create/confirm/publish/recall/adjust` | **算薪引擎**（快照计算、状态机、调整项）、工资条生成 | shared、attendance 月报（**只读已确认快照**）、employees（只读工资档案） |
| **expense** | 报销申请/审批/列表 | 报销聚合 + 金额校验 | shared、approval（事件） |
| **approval** | 发起/审批/查询 + 路由 | 审批流/审批组路由（深）、状态机、待办生成 | shared |
| **training** | 知识库文章/分类/附件 + 预览 | 文档存储（OSS）+ **KKFileView 预览签名 URL** | shared、OSS |
| **notifications** | 通知/公告/待办推送 | Socket.IO 网关 + 触达策略 | shared |
| **system** | 用户/角色/权限点/审批流配置/操作日志 | RBAC 元数据管理、审计 | shared |

> 深模块示范：**punch** 对外只有 2 个方法（同步/导入），设备差异、协议细节、去重逻辑全部藏在内部——调用方（前端/定时任务）无需知道 XFace600 的存在。

---

## 3. 依赖规则（允许 / 禁止）

**允许**
- Controller → 本模块 Service；Service → 本模块 Domain / Infrastructure
- 任何模块 → `packages/shared`（类型/枚举/schema）
- **跨模块只读数据**：经 Prisma 直读对方数据表（如 payroll 读 `attendance_monthly`（status=confirmed）与 `employees.salary`）——数据表共享，**模块边界是"谁负责写"，不是"谁能读"**
- 业务模块 → auth 提供的 Guard（装饰器注入，非业务耦合）

**禁止**
- ❌ 跨模块 Service 直接调用（如 payroll 调 attendanceService）
- ❌ 反向依赖（Infrastructure → Domain/Application）
- ❌ 循环依赖（NestJS 层用 forwardRef 也视为坏味道，从设计上避免）
- ❌ packages/shared 依赖任何业务模块
- ❌ 前端 feature 之间互引组件/状态

**后果收益**：依赖方向单一 → 删除测试（Deletion Test）可执行（删任何模块，复杂度不会泄漏到别处）；跨模块边界清晰 → 单测只需 mock 本模块的 Infrastructure，不用拉起整个系统。

---

## 4. 数据库（Prisma）组织

- **单 schema.prisma + 单 Prisma Client**（不按上下文拆分 schema——避免多 client 事务与关系断裂；模块边界靠"谁写谁读"约定 + repository 收口）
- model 按领域分组组织（注释分区）：`// ==== organization ====`、`// ==== attendance ====`、`// ==== payroll ====`…
- **表归属（写权限）**：employees 系列→employees；shifts/schedules/attendance_*/leave/overtime/vacation_*→attendance；punch_logs→punch；salary_items/payroll_*/payslips→payroll；users/roles/permissions/approval_*/operation_logs→system；reimbursements→expense；knowledge_*→training；notifications/broadcasts→notifications
- 外键与关系：同模块内完整 FK；跨模块只保留"弱引用"（如 payroll_details.employee_id 仅存 ID，不建 FK 到 employees——**跨模块数据留快照，防级联耦合**）
- 索引纪律：唯一约束 + 高频查询索引在 schema 中显式声明（uk_employee_date 等）

---

## 5. 前端页面模块划分（features）

| feature | 页面（App Router 路由） | 说明 |
|---|---|---|
| `dashboard` | `/` 工作台 | Statistic + bizcharts |
| `employee` | `/employees/*` | 列表/详情/编辑/导入导出 |
| `attendance` | `/attendance/*`（班次/排班/打卡流水/请假/加班/补卡/额度） | 大 feature，内部再分子路由 |
| `payroll` | `/payroll/*`（项目/批次/试算/工资条） | 算薪试算页为核心交互 |
| `expense` | `/expense/*` | 报销申请/审批 |
| `training` | `/training/knowledge/*` | 知识库 + KKFileView 预览 |
| `system` | `/system/*`（用户/角色/权限/审批流/日志/公告/通知） | |
| `auth`（特殊） | `/login` | 不进侧边栏 |

- 每个 feature 内：`page.tsx`（路由页）+ `components/`（业务组件）+ `hooks/` + `api.ts`（仅对接本模块后端接口）
- 菜单：由路由表 + 权限动态生成（Refine resources），feature 不自行注册菜单
- **公共组件库 shared/components 优先于 feature 内组件**：先查共享再建私有（REFACTOR_PLAN 11.1-4）

---

## 6. 关键架构决策（已落 ADR）

| 决策 | ADR |
|---|---|
| 后端模块内 4 层（Presentation/Application/Domain/Infrastructure）+ 依赖单向 | **ADR-0013** |
| 跨模块只读数据 + 单 Prisma schema + 跨模块弱引用（快照不建 FK） | **ADR-0013** |
| 前端 features 与后端模块一一对应 + feature 间禁止互引 | **ADR-0014** |
| 算薪消费已确认月报快照（payroll→attendance 只读） | ADR-0011 |
| 部门数据隔离在 Service 层注入 | ADR-0010 |
| ProTable 内部 Refine→Arco 适配层 | ADR-0007 |

---

## 7. 架构验收标准

- [ ] 依赖方向无反向/循环（可脚本检查 import 方向）
- [ ] 任一业务模块删除后，其余模块可独立编译运行（删除测试）
- [ ] 引擎（考勤/算薪）不 import 任何框架/IO，单测零 mock 外部依赖
- [ ] 前端 feature 目录间无互相 import
- [ ] shared 包无业务逻辑、无数据库/React 依赖
