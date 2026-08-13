# S08 · 考勤月报 + 结账锁定（快照）

## What to build
日报聚合为月报（出勤天数/迟到次数/加班小时，入职离职折算），**月报确认 = 结账锁定**（status=confirmed，ADR-0011），锁定后不可再改；触发领域事件 AttendanceMonthlyConfirmed。

## 进度（2026-08-12 后端完成 ✅）
- [x] Prisma：attendance_monthly 表（uk(employee_id, month)，status draft/confirmed，confirmed_by/confirmed_at）
- [x] **TDD 15 用例全绿**：聚合引擎单测10个（正常/迟到/早退/缺勤/加班/请假/月中入职/异常/空列表）+ e2e 5个（生成/列表/确认结账/锁定拒绝重生成/无权限）
- [x] AttendanceMonthlyService：generate 聚合 + list 查询 + confirm 结账锁定（状态机）
- [x] 错误码：2004（月报已确认，不可重新生成）
- [x] 领域事件 AttendanceMonthlyConfirmed（@nestjs/event-emitter）
- [ ] 前端月报页（待 Step 3 公共组件就绪）

---

## 迭代二 · 领域事件（TDD 完成）

### 完成项
- [x] **事件总线**：`@nestjs/event-emitter` 集成到 AppModule
- [x] **月报确认领域事件**：`attendance.monthly.confirmed`
  - 发布时机：月报 confirm 成功后
  - 事件载荷：monthlyId/month/confirmedBy/confirmedAt/employeeCount/totalWorkDays/records
  - 重复 confirm 不发布事件（状态校验）
- [x] **e2e 测试**：`tests/attendance-monthly-event.e2e.test.ts` — 3 项全部 PASS
  - confirm 时发布事件、事件包含汇总数据、重复 confirm 不发事件

### 测试数据
- 聚合单测：`tests/attendance-monthly.unit.test.ts`（10 单测）
- e2e 测试：`tests/attendance-monthly.e2e.test.ts`（5 e2e）
- 领域事件 e2e：`tests/attendance-monthly-event.e2e.test.ts`（3 e2e）
- **总计：18 项测试全部通过**

## 五维清单
- **数据库**：✅ attendance_monthly（新表；uk(employee_id, month)；status draft/confirmed）
- **后端接口**：✅ GET /attendance/monthly（月份/部门筛选）、POST /attendance/monthly/generate（月结生成）、POST /attendance/monthly/:id/confirm（结账）
- **业务算法**：✅ 月报聚合引擎（domain 纯函数：日报→月报）；结账锁定状态机
- **前端页面**：attendance feature 月报页（按月展示、确认结账按钮 + 二次确认、锁定态展示）
- **单元测试**：✅ 聚合单测（10 用例）+ API e2e（5 用例）

## Acceptance criteria
- [x] 月报汇总正确（含月中入职离职折算）
- [x] 确认后 status=confirmed，重新生成被拒绝（2004）
- [x] AttendanceMonthlyConfirmed 事件可被消费方收到（S10 用）

## Blocked by
- S07 考勤规则引擎 + 日报
