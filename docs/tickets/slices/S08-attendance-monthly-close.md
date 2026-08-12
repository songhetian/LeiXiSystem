# S08 · 考勤月报 + 结账锁定（快照）

## What to build
日报聚合为月报（出勤天数/迟到次数/加班小时，入职离职折算），**月报确认 = 结账锁定**（status=confirmed，ADR-0011），锁定后不可再改；触发领域事件 AttendanceMonthlyConfirmed。

## 五维清单
- **数据库**：attendance_monthly（新表；uk(employee_id, month)；status draft/confirmed；字段见 docs/schema/new-tables.md）
- **后端接口**：GET /attendance/monthly（月份/部门筛选）、POST /attendance/monthly/:id/confirm（结账）、POST /attendance/monthly/generate（月结生成）
- **业务算法**：月报聚合引擎（domain 纯函数：日报→月报，含入职离职折算 C2）；结账锁定状态机；事件 AttendanceMonthlyConfirmed 发布
- **前端页面**：考勤月报页（按月展示、确认结账按钮 + 二次确认、锁定态展示）
- **单元测试**：聚合单测（折算/汇总/锁定后拒绝修改）+ API e2e

## Acceptance criteria
- [ ] 月报汇总正确（含月中入职离职折算）
- [ ] 确认后 status=confirmed，任何修改接口返回拒绝
- [ ] AttendanceMonthlyConfirmed 事件可被消费方收到（S10 用）

## Blocked by
- S07 考勤规则引擎 + 日报
