# Ticket: step-4 — 打卡机接入 + 自动算薪 + 报表

> 对应 REFACTOR_PLAN.md 第 6 章（新增功能设计）
> 状态核对：2026-09-29。逐条按仓库实际证据核对，不是计划口径。
> 标记约定：`[x]` 已达成 ｜ `[ ]` 未达成或无法从仓库核实（行尾注明原因）。

## 背景

本阶段是重构的核心新功能：把打卡机数据变成考勤日报/月报，再驱动算薪引擎生成工资条。**先试算后确认再发布**，避免算错直接发出。

## 待办

### 4.1 打卡机接入（熵基 XFace600，adapter 模式）

- [x] 打卡模块 —— `backend/src/attendance/` 下 `punch-device.*` / `punch-logs.*` /
      `punch-sync.service.ts` / `punch.service.ts` / `engine/xface-adapter.ts`，统一打卡流水接口
- [x] adapter 抽象 —— `attendance/engine/xface-adapter.ts`，单测 `tests/xface-adapter.unit.test.ts`
- [ ] **主路径：XFace600 HTTP API 增量拉取（LastSyncTime + 定时同步）**
      —— **代码已就绪、硬件未验证**：`punch-sync.service.ts` + `@nestjs/schedule` 定时已实现并有
      `punch-sync.e2e` 覆盖；但 **XFace600 设备未到货，T21 集成冻结**，无法做真机联调。
      另实现了**推送模式** `attendance/push/xface-push.controller.ts`（设备主动推送到服务端），
      与拉取模式并存（`tests/xface-push.e2e` + `tests/xface600-compat.unit.test.ts`）。
- [x] 兜底：CSV 导入 —— `dto/punch-import.dto.ts` + `punch-logs` 导入；重复导入报错
- [x] 打卡流水查询页（按人/设备/时间筛选，异常标记）—— 前端 `features/attendance`；
      设备 CRUD 见 `tests/punch-device-crud.e2e.test.ts`

### 4.2 考勤规则引擎

- [x] 班次匹配：打卡流水 × 排班 → 上班/下班卡识别 —— `attendance/engine/attendance-engine.ts`
      （`tests/attendance-engine.unit.test.ts` + `routing-engine*.unit.test.ts`）
- [x] 结果计算：迟到/早退/缺卡/加班（与加班申请联动）—— 含 `daily-status-merger.ts`
      与口径单一来源 `daily-status.ts`（本次重构消除的重复实现）
- [x] `attendance_daily` 日报 + `attendance_monthly` 月报聚合 —— `attendance-daily.service.ts` +
      `attendance-monthly.service.ts` + `engine/monthly-engine.ts`
- [x] 人工修正：补卡 / 异常申诉审批流 —— `punch-makeup.*` + `attendance-audit.*`，
      `tests/punch-makeup-approval.e2e` / `appeal-approval.e2e` / `attendance-daily-recalc.e2e`

### 4.3 自动算薪引擎

- [x] `salary_items` 薪资项目配置（固定/按天/按小时/公式）—— `payroll/dto/salary-item.dto.ts`
- [x] 计算流程：月结 → 汇总考勤/请假/加班（输入 = 已确认月报快照，ADR-0011）→ 逐项计算 → 试算
      —— `payroll/engine/payroll-engine.ts`（`tests/payroll-engine.unit.test.ts`）
- [x] 调整项（C6）：`payroll_adjustments` 表 + `dto/adjust-run.dto.ts`，试算后人工调整留痕
- [x] 确认发布：生成工资条 → 员工自助查看；撤回限未查看状态（C7）
      —— `payroll.controller.ts`（`dto/confirm.dto.ts` / `create-run.dto.ts`）+ `payslip.service.ts`
- [x] **对账验收：抽 3 名员工人工对账一致后方可上线** —— 样例回归基线已建立（2026-09-29）：
      对账工具 `payroll/engine/payroll-reconciliation.ts`（按 code 逐项比对，整数分定点）+
      `tests/payroll-reconciliation.unit.test.ts`（11 用例，覆盖全部 8 个工资项 code，
      人算期望值独立手算）+ 手算公式留痕 `docs/payroll/2026-09-29-payroll-3-person-reconciliation.md`。
      ⚠️ 样例对账证明的是**引擎规则正确**；真实批次上线前仍需按留痕文档第五节复跑一次（真实月报快照 + 财务手算）

### 4.4 报表中心

- [x] 考勤月报（部门×员工：出勤/迟到/加班汇总）—— `reports/reports.service.ts`
      （`tests/reports.e2e` + `reports-enhanced.e2e`）
- [x] 人力成本报表（工资构成：基本/加班/补贴/扣款）
- [x] Excel 导出（exceljs）—— 前端导出地址经 cookie 鉴权（`services/reports.ts`）

### 4.5 缺陷修复（2026-09-30，源自 `docs/reviews/2026-09-30-hidden-defects.md`）

- [x] **P0-2 加班倍率真正生效**：新增 `holidays` 日历表 + `overtime_*_{minutes,hours}` 三桶拆分；
      日类型唯一口径 `engine/workday-calendar.ts#resolveDayType`；无排班日（休息日/法定）到岗也生成日报；
      加班时长严格 `min(已批申请, 实际)`（`overtime-cap.ts`），无已批申请即 0
- [x] **P1-4 日报状态单一口径**：`daily-status.ts#resolveDailyStatus` 定为全仓唯一，
      merge / 审批监听 / 申诉重算三处一律委托（`tests/daily-status-unification.unit.test.ts` 等价性断言）
- [x] **P1-5 月报已确认不可回写**：`generate` 改 CAS（只更新 `status='draft'` 行），
      `gen/confirm/unconfirm` 统一锁键 `attendance:monthly:{employeeId}:{month}`
- [x] **P2-9 全勤奖豁免有薪假 + 餐补按实际出勤**：新增 `vacation_types.is_paid`
      （API / 种子 / 前端开关齐备）→ 日报 `unpaid_leave_days` → 月报 `unpaid_leave_minutes` → 算薪判定；
      出勤天数只计真正出勤（`ATTENDED_STATUSES`）
- [ ] **迁移上线动作**：`20260930120000_overtime_day_type_holidays` 需在预发库 `migrate deploy` 并核对回填
      （历史加班→平日桶、历史请假→无薪、`is_paid` 内置有薪类型），沙箱无 MySQL 未执行

## 完成标准

- [x] 从打卡数据到工资条的完整链路跑通（CSV/推送路径；HTTP 拉取路径待真机）
- [x] 试算→确认→发布状态流转无死角 —— `payroll-status-scope.e2e.test.ts` 覆盖状态边界
- [x] 3 名员工人工对账一致（核心验收，宁可慢不可错）—— 样例层达成：机算（真实引擎）vs 人算（独立手算）
      逐项 0 差异，已纳入测试回归（`tests/payroll-reconciliation.unit.test.ts`）；
      **真实批次复跑 + 签字归档**仍属上线前动作（见 §4.3 与留痕文档第五节）

## 与计划不一致 / 遗留

1. **硬件阻塞（唯一的硬阻塞）**：XFace600 未到货，HTTP 拉取主路径无法做真机验证（T21 冻结）。
   当前考勤采集靠 CSV 导入 + 推送模式 + 前端 mock punch-in 按钮（临时方案）跑通逻辑。
2. **多了一条推送模式**：原计划只有「HTTP 拉取 + CSV 兜底」，实际补了设备推送（`push/xface-push`）。
   两种模式并存，落地时需明确生产用哪种、是否需互斥，避免流水重复。
3. **对账验收分层达成**：样例回归基线（引擎规则正确性）已于 2026-09-29 建立并纳入 CI；
   真实批次复跑（财务手算 + 签字归档）仍待——方法已固化在
   `docs/payroll/2026-09-29-payroll-3-person-reconciliation.md` 第五节。
