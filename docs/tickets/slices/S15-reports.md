# S15 · 报表中心

## What to build
报表与导出：考勤月报报表（部门×员工）、人力成本报表（工资构成）；<1 万行同步导出 Excel，>1 万行异步任务 + 完成通知（D3）；部门数据隔离生效。

## 五维清单
- **数据库**：无新表（读 attendance_monthly/payroll_details/payroll_adjustments）
- **后端接口**：GET /reports/attendance-monthly、GET /reports/labor-cost、POST /reports/export（异步任务，>1 万行）、GET /reports/export/:id/status
- **业务算法**：报表聚合（只读，不修改领域数据——spec 领域模型约束）；人力成本 = 工资明细+调整项按部门汇总
- **前端页面**：报表中心页（查询条件 + bizcharts 图表 + 导出按钮/异步进度）
- **单元测试**：聚合单测（金额汇总/部门隔离）+ API e2e（导出任务）

## Acceptance criteria
- [ ] 考勤月报/人力成本报表数据与明细对账一致
- [ ] 导出：小数据即时下载，大数据异步任务 + 通知
- [ ] 报表同样受部门数据隔离约束（经理只见本部门）

## Blocked by
- S08 考勤月报结账
- S10 算薪引擎 + 批次
