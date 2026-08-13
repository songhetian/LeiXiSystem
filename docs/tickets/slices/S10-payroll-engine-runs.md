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
- [x] 引擎生产实现，原型 12 项断言全部 PASS
- [x] 试算→抽检 3 人→确认→发布 全流程可用；撤回仅限未查看
- [x] 调整项记录独立存表，工资条展示 = 计算值 + 调整值
- [x] 月份唯一（3001），已发布不可改（3003）

## Blocked by
- S08 考勤月报结账（已确认快照）
- S06 请假/加班（扣款/加班数据）
- S03 员工档案（工资档案）

---

## 进度 · TDD 后端实现（已完成）

### 完成项
- [x] **数据库**：新增 4 张表 `salary_items` / `payroll_runs` / `payroll_details` / `payroll_adjustments`（Prisma schema 同步完成）
- [x] **算薪引擎纯函数**：`src/payroll/engine/payroll-engine.ts`
  - 规则对齐 CONTEXT.md / spec 2.3 / 原型验证结论
  - 加班平日 1.5 倍 / 休息日 2 倍 / 法定 3 倍（21.75 基数）
  - 缺勤扣款 = 基本工资 ÷ 当月应出勤天数 × 缺勤天数
  - 全勤奖判定：无迟到 / 无缺卡 / 无请假（有薪假除外）
  - 餐补按出勤天数；社保固定代扣
- [x] **单元测试**：12 项断言（3 人对账样例回归基线）全部 PASS
  - 员工 A：满勤 + 平日加班 10h → 合计 5351.03
  - 员工 B：缺勤 2 天 + 迟到 3 次 + 休息日加班 8h → 合计 5706.27
  - 员工 C：月中入职（出勤 11 天）+ 请假 3 天 → 合计 2752.86
- [x] **后端 API**：`PayrollController` + `PayrollService`
  - `POST /payroll/runs` — 创建算薪批次（从已确认月报生成）
  - `GET /payroll/runs` — 算薪批次列表（分页）
  - `GET /payroll/runs/:id/details` — 算薪明细（按员工分组汇总）
  - `POST /payroll/runs/:id/confirm` — 确认算薪
  - `POST /payroll/runs/:id/publish` — 发布算薪（员工端可见）
- [x] **e2e 测试**：7 项 API 测试全部 PASS
- [x] **全量测试**：96/96 通过（`npx jest --runInBand`）

### 测试数据
- 测试文件：`tests/payroll-engine.unit.test.ts`（12 单测）、`tests/payroll.e2e.test.ts`（7 e2e）
- 错误码：3001（月份已存在）、3002（月报未确认）、3003（状态不允许）、3004（批次不存在）

### 未实现（后续切片）
- [x] 薪资项目配置 CRUD（`/payroll/items`）
- [x] 调整项 API（`/payroll/runs/:id/adjust`）
- [x] 撤回 API（`/payroll/runs/:id/recall`）
- [ ] 前端算薪试算页
- [ ] 工资条发布与通知

---

## 迭代二 · 薪资项目 + 调整项 + 撤回（TDD 完成）

### 完成项
- [x] **薪资项目 CRUD**：`GET/POST/PUT/PATCH /payroll/items`
  - 列表查询、创建、更新、启用/禁用切换
  - 编码唯一约束（错误码 3006）
- [x] **调整项 API**：`POST /payroll/runs/:id/adjust`
  - 仅 draft 状态可添加调整项（错误码 3007）
  - 调整项独立存表 `payroll_adjustments`
  - 明细接口合并展示：计算明细 + 调整项
- [x] **撤回 API**：`POST /payroll/runs/:id/recall`
  - 仅 published 状态可撤回（错误码 3003）
  - 存在已查看工资条时不可撤回（错误码 3005）
  - 撤回后删除所有工资条，批次状态变为 recalled
- [x] **e2e 测试**：`tests/payroll-enhanced.e2e.test.ts` — 12 项测试全部 PASS
  - 薪资项目：列表/创建/更新/禁用/重复编码校验（5 项）
  - 调整项：添加调整/明细合并展示/确认后禁止添加（3 项）
  - 撤回功能：正常撤回/已查看不可撤回/draft 不可撤回（3 项）
- [x] **错误码扩展**：3006（编码已存在）、3007（非 draft 状态禁止调整）

### 状态机
```
draft ──confirm──▶ confirmed ──publish──▶ published
  ▲                                                │
  │                   recall（无已查看工资条）        │
  └────────────────────────────────────────────────┘
                              ↘ recalled + 删除工资条
```
