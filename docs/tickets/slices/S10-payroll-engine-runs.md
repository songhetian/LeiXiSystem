# S10 · 算薪引擎 + 批次（核心曳光弹）

## What to build
**核心算法切片**：薪资项目配置 + 算薪批次（试算→抽检确认→发布→撤回 + 调整项）。算薪引擎为 domain 纯函数（原型已验证 3 人对账样例），生产化实现；输入 = 已确认月报快照（S08）+ 请假/加班（S06）+ 员工工资档案（S03）。发布生成工资条（复用 payslips），触发事件 PayrollRunPublished。

## 五维清单
- **数据库**：salary_items/payroll_runs/payroll_details/payroll_adjustments（新表 4 张；字段见 docs/schema/new-tables.md）
- **后端接口**：GET/POST /payroll/items（+PATCH）、POST /payroll/runs、GET /payroll/runs、GET /payroll/runs/:id/details（试算明细）、POST /payroll/runs/:id/adjust、POST /payroll/runs/:id/confirm|publish|recall；错误码 3001-3005
- **业务算法**：**算薪引擎**（domain 纯函数，spec 2.3 + 原型确认项：21.75 基数/请假计缺勤）：加班 1.5/2/3 倍、缺勤扣款、全勤判定、补贴、社保代扣；批次状态机 草稿→确认→发布/撤回（C7 撤回限未查看）；调整项（C6，不覆盖明细）
- **前端页面**：薪资项目配置页、**算薪试算页**（原型交互：逐员工行/展开明细/差异高亮/抽检 3 人/确认/发布/撤回）
- **单元测试**：**引擎单测 = 原型 12 项断言回归基线**（3 人对账样例）+ 状态机单测 + API e2e

## Acceptance criteria
- [ ] 引擎生产实现，原型 12 项断言全部 PASS
- [ ] 试算→抽检 3 人→确认→发布 全流程可用；撤回仅限未查看
- [ ] 调整项记录独立存表，工资条展示 = 计算值 + 调整值
- [ ] 月份唯一（3001），已发布不可改（3003）

## Blocked by
- S08 考勤月报结账（已确认快照）
- S06 请假/加班（扣款/加班数据）
- S03 员工档案（工资档案）
