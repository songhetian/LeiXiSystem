# S06 · 请假 / 加班 / 休假额度

## What to build
请假与加班申请（已接入 S09 真实审批流）、休假额度余额与变动（调休 1:1 兑换、请假扣减、余额不可为负）。

## 五维清单
- **数据库**：leave_records/overtime_records/vacation_balances/vacation_types/vacation_balance_changes（已完成 Prisma 模型，新增 approval_instance_id、approving 状态）
- **后端接口**：
  - 休假额度：GET /vacation/balances（管理端）、GET /vacation/balances/mine、GET /vacation/balances/changes/mine、POST /vacation/convert（加班转调休）
  - 请假：GET/POST /leave-records、GET /leave-records/mine、POST /leave-records/:id/submit、POST /leave-records/:id/approve、POST /leave-records/:id/reject
  - 加班：GET/POST /overtime-records、GET /overtime-records/mine、POST /overtime-records/:id/submit、POST /overtime-records/:id/approve、POST /overtime-records/:id/reject
- **业务算法**：额度换算引擎：请假审批通过后扣减、调休 8h=1天、余额不可为负、变动记录留痕；事务保证一致性
- **前端页面**：请假申请页、加班申请页、我的休假额度页（余额卡片 + 变动记录）
- **单元测试**：API e2e 15 项（额度/兑换/变动/请假创建/提交/主管审批/HR审批/余额不足/驳回/列表/加班创建/提交/审批/驳回/列表）

## Acceptance criteria
- [x] 请假审批通过后扣减对应类型额度，余额为 0 时拒绝再请
- [x] 加班兑换调休 8h=1天，变动记录留痕
- [x] 请假/加班申请状态可跟踪（pending → approving → approved/rejected）
- [x] S09 审批流接入（增强项）
- [x] 员工自助提交请假/加班申请
- [x] 请假/加班的审批流程（同意/驳回）

## Blocked by
- S03 员工档案 ✅
- S09 审批工作流 ✅

---

## 进度 · TDD 后端实现（已完成）

### 完成项
- [x] **数据库**：5 张表（vacation_types / vacation_balances / vacation_balance_changes / leave_records / overtime_records）已在 Prisma schema 中
  - 新增 `approval_instance_id` 字段关联审批实例
  - 新增 `approving` 状态（pending → approving → approved/rejected）
- [x] **额度换算引擎**：`VacationService` 中实现
  - 请假扣减：审批通过后扣减，事务保证一致性，余额不足拒绝（错误码 2004）
  - 加班转调休：8 小时 = 1 天，自动创建额度（如不存在），记录变动
  - 变动记录：每次扣减/兑换都留痕（change_type / balance_before / balance_after / reason / reference）
- [x] **休假额度 API**：
  - `GET /vacation/balances/mine` — 我的额度列表
  - `GET /vacation/balances/changes/mine` — 我的变动记录
  - `GET /vacation/balances` — 管理端额度列表（数据隔离）
  - `POST /vacation/convert` — 加班兑换调休
- [x] **请假 API**（完整审批流）：
  - `GET /leave-records/mine` — 我的请假列表
  - `GET /leave-records` — 管理端请假列表（数据隔离）
  - `POST /leave-records` — 创建请假（pending 状态，预检查额度）
  - `POST /leave-records/:id/submit` — 提交审批（员工自助）
  - `POST /leave-records/:id/approve` — 审批通过（逐级审批，最终通过后扣减额度）
  - `POST /leave-records/:id/reject` — 审批驳回
- [x] **加班 API**（完整审批流）：
  - `GET /overtime-records/mine` — 我的加班列表
  - `GET /overtime-records` — 管理端加班列表（数据隔离）
  - `POST /overtime-records` — 创建加班（pending 状态，员工自助）
  - `POST /overtime-records/:id/submit` — 提交审批
  - `POST /overtime-records/:id/approve` — 审批通过
  - `POST /overtime-records/:id/reject` — 审批驳回
- [x] **权限控制**：attendance:view 可查看和提交申请，attendance:manage 可管理
- [x] **审批流集成**：与 S09 审批工作流模块深度集成
  - 请假审批流：部门主管 → HR（两级审批）
  - 加班审批流：部门主管（一级审批）
- [x] **e2e 测试**：15 项全部 PASS

### 测试数据
- e2e 测试：`tests/leave-vacation.e2e.test.ts`（15 e2e）
- 覆盖场景：我的额度、加班转调休、变动记录、请假创建、提交审批、主管审批、HR审批、余额不足拒绝、驳回请假、我的请假列表、加班创建、加班提交、加班审批通过、驳回加班、我的加班列表
- 错误码：2004（额度不足/不存在/记录不存在）、2005（状态异常/已兑换/已在审批中）
- 角色覆盖：员工（staff）、部门主管（dept_manager）、HR、管理员（admin）

### 未实现（后续切片）
- [ ] 前端页面（请假/加班申请页、我的额度页）
- [x] 调休兑换的员工端自助申请（当前仅管理员操作）

---

## 迭代二 · 调休兑换员工端自助申请（TDD 完成）

### 完成项
- [x] **员工端自助兑换接口** `POST /vacation/convert/mine`
  - 权限：attendance:view（普通员工即可）
  - 自动通过登录用户识别员工身份
  - 只能兑换自己的加班记录
- [x] **业务校验**：
  - 加班必须已审批通过（approved）
  - 加班未兑换过（isCompensated=false）
  - 兑换小时数不超过加班时长
  - 8 小时 = 1 天调休
- [x] **额度变动留痕**：changeType=conversion，记录变动原因

### 测试数据
- e2e 测试：`tests/compensatory-self-apply.e2e.test.ts`（9 e2e）
- 覆盖场景：自助兑换成功/额度增加/变动记录/不可兑换他人加班/未审批不可兑换/超时长不可兑换/重复兑换/不存在记录/权限验证
