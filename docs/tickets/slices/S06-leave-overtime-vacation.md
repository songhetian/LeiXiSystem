# S06 · 请假 / 加班 / 休假额度

## What to build
请假与加班申请（含审批——S09 完成前先直通/单级简化，S09 后接入真实审批流）、休假额度余额与变动（调休 1:1 兑换、请假扣减、余额不可为负）。

## 五维清单
- **数据库**：leave_records/overtime_records/compensatory_leave_requests/vacation_balances/vacation_types/vacation_balance_changes（保留表迁移）
- **后端接口**：GET/POST /leave-records、GET/POST /overtime-records、GET /vacation/balances、POST /vacation/convert（加班兑换调休）
- **业务算法**：额度换算引擎（domain 纯函数）：请假扣减、调休 1:1、余额不可为负；加班时长 min(申请,实际)（S07 联调用）
- **前端页面**：请假申请页、加班申请页、我的休假额度页（余额卡片 + 变动记录）
- **单元测试**：额度换算单测（余额/兑换/负数拒绝）+ API e2e

## Acceptance criteria
- [ ] 请假成功扣减对应类型额度，余额为 0 时拒绝再请
- [ ] 加班兑换调休 1:1，变动记录留痕
- [ ] 请假/加班申请状态可跟踪（S09 后接入审批）

## Blocked by
- S03 员工档案
- （S09 完成后：接入真实审批流，属增强项）
