# S15 · 报表中心

## What to build
报表与导出：考勤月报报表（部门×员工）、人力成本报表（工资构成）；<1 万行同步导出 Excel，>1 万行异步任务 + 完成通知（D3）；部门数据隔离生效。

## 五维清单
- **数据库**：无新表（读 attendance_monthly/payroll_details/payroll_adjustments）
- **后端接口**：
  - `GET /reports/attendance-monthly` — 考勤月报（按部门汇总 + 总计）
  - `GET /reports/labor-cost` — 人力成本（按部门汇总：基本工资/加班费/扣款/合计）
  - `GET /reports/attendance-monthly/export` — 考勤月报导出（CSV）
  - `GET /reports/labor-cost/export` — 人力成本导出（CSV）
  - POST /reports/export（异步任务，>1 万行）— 待实现
  - GET /reports/export/:id/status — 待实现
- **业务算法**：报表聚合（只读，不修改领域数据——spec 领域模型约束）；人力成本 = 工资明细按部门汇总（base_salary/overtime_pay/负数为扣款）
- **前端页面**：报表中心页（查询条件 + bizcharts 图表 + 导出按钮/异步进度）
- **单元测试**：API e2e 11 项（考勤月报汇总/部门维度/数据隔离/权限/人力成本汇总/部门成本/成本数据隔离/考勤导出/成本导出/导出数据隔离/导出权限）

## Acceptance criteria
- [x] 考勤月报/人力成本报表数据与明细对账一致
- [x] 导出：CSV 同步导出（小数据）
- [ ] 导出：大数据异步任务 + 通知
- [x] 报表同样受部门数据隔离约束（经理只见本部门）

## Blocked by
- S08 考勤月报结账 ✅
- S10 算薪引擎 + 批次 ✅

---

## 进度 · TDD 后端实现（第二阶段完成）

### 完成项
- [x] **考勤月报报表** `GET /reports/attendance-monthly`
  - 按部门维度汇总：员工数 / 出勤天数 / 迟到次数 / 早退次数 / 旷工天数 / 加班时长
  - 全局 summary 总计
  - 部门数据隔离：admin/hr 全量，其他人按所属部门范围
- [x] **人力成本报表** `GET /reports/labor-cost`
  - 按部门维度汇总：员工数 / 基本工资 / 加班费 / 扣款合计 / 总金额
  - 全局 summary 总计
  - 部门数据隔离：admin/hr 全量，其他人按所属部门范围
- [x] **考勤月报导出** `GET /reports/attendance-monthly/export`
  - CSV 格式，UTF-8 编码
  - 响应头：Content-Type: text/csv + Content-Disposition: attachment
  - 文件名：attendance-monthly-{month}.csv
  - 数据隔离生效
- [x] **人力成本导出** `GET /reports/labor-cost/export`
  - CSV 格式，UTF-8 编码
  - 响应头：Content-Type: text/csv + Content-Disposition: attachment
  - 文件名：labor-cost-{month}.csv
  - 数据隔离生效
- [x] **权限控制**：`reports:view` 权限，普通员工 403 拒绝
- [x] **e2e 测试**：11 项全部 PASS

### 测试数据
- e2e 测试：`tests/reports.e2e.test.ts`（11 e2e）
- 覆盖场景：全部门汇总、部门维度数据、主管数据隔离、员工无权限、人力成本全量、部门成本明细、主管成本隔离、考勤导出CSV、成本导出CSV、主管导出隔离、员工导出无权限

### 未实现（后续切片）
- [ ] Excel 格式导出（xlsx）
- [ ] 大数据异步导出任务 + 状态查询 + 完成通知
- [ ] 前端页面（报表中心页、图表、导出按钮）
- [ ] 更多报表类型：人员变动报表、招聘漏斗报表等
- [ ] 报表数据缓存（优化大数量查询性能）
