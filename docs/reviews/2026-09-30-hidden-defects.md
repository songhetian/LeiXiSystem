# 隐藏缺陷审查报告（code-review 双轴 + 缺陷猎手）

> 日期：2026-09-30 ｜ 分支：`refactor-v2`
> 固定点：`78b7668`（与 `origin/main` 的 merge-base）→ `HEAD`，63 个提交 / 565 个生产文件
> 方法：code-review 技能双轴（Standards / Spec）+ 2 路领域缺陷猎手子代理，**所有结论均由本人逐条复核**
> 复核原则：不采信子代理结论，一律回读源码/模型定义验证；被证伪的结论单列更正。

## 一、结论摘要

| # | 严重度 | 缺陷 | 位置 |
|---|---|---|---|
| 1 | **P0** | 非 admin 查询打卡流水必然运行时报错（非法 Prisma 过滤键） | `attendance/punch-logs.service.ts:79,81` |
| 2 | **P0** | 加班倍数（休息日 2 倍 / 法定 3 倍）在数据模型上无法生效；无排班日的加班完全不计 | `payroll/payroll.service.ts:115-119` + `engine/attendance-engine.ts:67` |
| 3 | **P1** | `listRuns` 空数据范围 fail-open → 泄露全公司算薪批次 | `payroll/payroll.service.ts:182-203` |
| 4 | **P1** | `attendance_daily.status` 双口径：重算会抹掉 makeup/weekend/holiday → 推高缺勤天数 | `attendance/daily-status.ts` vs `engine/daily-status-merger.ts` |
| 5 | **P1** | 月报 `generate` 可把已确认月报回写为 draft，破坏 ADR-0011 快照 | `attendance/attendance-monthly.service.ts:118-122` |
| 6 | P2 | `getRunDetails` 缺批次级范围校验（泄露批次汇总） | `payroll/payroll.service.ts:217` |
| 7 | P2 | 打卡同步无 P2002 捕获、无并发锁 → 重复批次整批失败 | `attendance/punch-sync.service.ts:121` |
| 8 | P2 | 审批重提次数上限在事务外判定，并发可突破 | `approval/approval.service.ts:481` |
| 9 | P2 | 全勤奖未豁免有薪假 / 请假日仍发餐补（口径待产品确认） | `payroll.service.ts:114,110` |
| 10 | P3 | 报表按本地时区取年月（负时区主机漂移） | `reports/reports.service.ts:36-45` |
| 11 | P3 | OKR 页 3 处硬编码 hex（违反设计 token 规约） | `frontend/.../performance/pages/okr.tsx:31,32,343` |
| 12 | P3 | `realtime.module` 导入未使用的 `NotificationModule` | `realtime/realtime.module.ts:2` |

---

## 二、已确认缺陷（含证据与修法）

### P0-1 非 admin 查询打卡流水必然报错

`punch-logs.service.ts:77-82` 用 `where.employee = { id }` / `{ departmentId: { in } }`，再传给 `prisma.punchLog.findMany`（:92）。但 `PunchLog` 模型**没有 `employee` 关系**——只有 `employeeNo String`（`prisma/schema.prisma` 的 `model PunchLog`）。

- **为什么错**：`employee` 不是 PunchLog 的合法过滤键 → Prisma 运行时抛 `Unknown argument 'employee'`。之所以 tsc 没拦住，是 :77 把 `where` 声明成了 `any`（不是 `as any`，本轮「as any 归零」统计没覆盖到这种逃逸）。
- **如何触发**：任何非 admin/hr 用户打开打卡流水页（主管按部门、员工按本人）→ 100% 500。
- **为何测试没发现**：`tests/punch-logs.e2e.test.ts` 虽建了 `staff` 角色用户，但只以 admin 身份跑 list。
- **修法**：PunchLog 无 `employeeId`，必须先按 `employeeNo` 反查可见员工集（同文件 `getValidEmployeeNos` 已有此模式），改成 `where.employeeNo = { in: visibleNos }`；并给 `where` 加真实类型消除 `any` 逃逸。
- **验证**：写一条「非 admin 列出打卡流水返回 200 且只见本范围」的集成用例（当前必红）。

### P0-2 加班倍数形同虚设 + 无排班日加班不计

三处联动：

1. `attendance-engine.ts:67` 加班 = `last.min > endMin`（下班打卡超出班次结束），**与日类型无关**；同文件无任何周末/节假日判断。
2. `daily-status-merger.ts` 能拿到 `isWeekend`/`isHoliday`（`attendance-daily.service.ts:158` 计算后传入），但**只用来改 status，不进加班时长**。
3. 数据模型层：`AttendanceDaily` 只有 `overtimeMinutes`、`AttendanceMonthly` 只有 `overtimeHours`——**没有 weekday/weekend/holiday 拆分字段**，schema 里也**没有节假日日历表**。
4. `payroll.service.ts:115-119` 把月报单一汇总整块塞进 `weekday`，`weekend: 0, holiday: 0` 硬编码。

- **影响**：引擎里 `×1.5 / ×2 / ×3` 的规则**从未生效**——休息日、法定节假日加班一律按 1.5 倍计发（少发）；且**没有排班的日子不产生日报**（`attendance-daily.service.ts:121` 按 `schedules` 循环），休息日/节假日到岗加班若不排班则**完全不计加班费**（漏发）。
- **触发**：任何周末或节假日到岗；或排了周末班（会按 1.5 倍而非 2 倍）。
- **修法**（需 migration，按 ADR-0017 走迁移而非 db push）：日报/月报增加 `overtimeWeekdayMinutes / overtimeWeekendMinutes / overtimeHolidayMinutes` 三列；建 `holidays` 日历表；引擎按日类型归集；`payroll.service` 用三值入参。**或**先按现状把「无排班日加班不计」写成显式产品决策（若不打算付周末加班费），至少把死参数删掉避免误导。
- **口径冲突**：`vacation.service.ts:1382` 的加班时长取自 `OvertimeRecord(approved)` 求和，与这里的「打卡推算」是**两个来源**，也违反「口径单一来源」原则——需二选一。

### P1-3 `listRuns` 空数据范围 fail-open

`payroll.service.ts:182-203`：`where` 初始为 `undefined`，仅当 `scope.selfEmployeeId` 或 `!scope.all && scope.ids.length > 0` 才赋值 → **空范围时 `where` 仍是 `undefined`**，`payrollRun.findMany({ where: undefined })` = 全量。

- **可达性**：`computeScope`（`data-scope.service.ts:98`）在「非 admin/hr/manager 且未关联 Employee」时返回 `{ all:false, ids:[], selfEmployeeId: undefined }`——例如只挂了 `finance` 之类自定义角色的用户，或员工档案未建全的账号。
- **影响**：该用户可看到全部算薪批次（含 `totalAmount`/人数）。
- **修法**：用现成的 `scopeIsEmpty(scope)`（`data-scope.service.ts:16`）在入口 fail-closed（返回空列表），或把三分支改为显式 `where = { id: { in: [] } }`。

### P1-4 `attendance_daily.status` 双口径

- **写入路径 A**（日报生成）：`mergeLeaveMakeupIntoDaily` —— 识别 `makeup / weekend / holiday / leave`，且 `weekend/holiday` 会**覆盖** absent/late。
- **写入路径 B**（重算）：`daily-status.ts:resolveDailyStatus` —— 只看 `leaveDays / absentMinutes / punchCount / late / early`，**不认识 makeup/weekend/holiday**。
- **调用方 B**：`attendance-approval.listener.ts`（补卡撤回/驳回后重算）、`employee-tx.service.ts`（考勤申诉通过后重算）——两者都直接写 `attendance_daily.status`。
- **为什么错**：同一列由两条语义不同的路径写。周末行（status=`weekend`）经重算且无打卡 → 变成 `absent` → 月报 `absentDays` 增加 → **算薪按缺勤扣款**（多扣）。补卡通过的行会被抹掉 `makeup` 标记。
- **备注**：这是上轮「口径统一」遗留——当时统一的是**打卡推算口径**，未覆盖 `daily-status-merger` 的**覆盖类状态**，两套判定并存。
- **修法**：把 `mergeLeaveMakeupIntoDaily` 的覆盖语义并入单一来源（`resolveDailyStatus` 接收 `isWeekend/isHoliday/makeupCount/leaveDays` 一并判定），两路径共用。

### P1-5 已确认月报可被回写为 draft

- `generate`（`attendance-monthly.service.ts:43-60`）先查 `existingConfirmed`，命中才拒绝——**check-then-write**；随后 `upsert` 的 `update` 分支（:118-122）把 `status` 写回 `'draft'`。
- `confirm`（:230）走 `updateMany({ where: { id, status: 'draft' } })` 的 CAS，但**锁 key 不同**：generate 用 `attendance:monthly:gen:${month}[:${employeeId}]`，confirm 用 `attendance:monthly:confirm:${id}` → 互不互斥。
- **如何触发**：定时/手动生成与用户确认并发（或生成任务在确认瞬间仍在跑）→ 已确认快照被重算值覆盖回 draft → 破坏「确认即锁定」（ADR-0011 的算薪输入可信性）。
- **修法**：generate / confirm / unconfirm 以 `employeeId` 维度共用同一锁 key；或在 upsert 的 `update` 加 `where: { status: 'draft' }` 条件（CAS），命中 0 行即中止。

### P2-6 `getRunDetails` 缺批次级范围校验

`payroll.service.ts:217-221` 先 `findUnique` 取 run（含 `totalAmount`/`totalEmployees`）再取 scope；同文件 `assertRunInScope`（:451）在 :301/:336/:401 都有调用，**唯 getRunDetails 漏了**。越权用户传他人 `runId` 可拿到批次汇总。修法：开头补 `await this.assertRunInScope(runId, userId)`。

### P2-7 打卡同步无幂等保护

`punch-sync.service.ts:121` 只有 `tx.punchLog.create`，**无 `withLock`、不捕获 P2002**（对比 `push/xface-push.service.ts` 已捕获）。并发（定时任务 + 手动 syncNow）时先查后写窗口内重复 → P2002 让整台设备批次失败回滚，且无逐条跳过。底层有 `@@unique([employeeNo, punchTime, deviceNo])` 兜底，故不会脏写，但**可用性受损**。修法：per-device 分布式锁 + 捕获 P2002 跳过重复。

### P2-8 审批重提上限并发可突破

`approval.service.ts:481` 的 `instance.resubmitCount >= maxResubmits` 在事务外读快照判定；后续递增无 status/CAS 约束。并发重提可双双通过 → 计数超限。修法：改为单条 `updateMany({ where: { id, status: { in: ['rejected','cancelled'] }, resubmitCount: { lt: max } }, data: { status: 'pending', resubmitCount: { increment: 1 } } })`，`count === 0` 即超限。

### P2-9 全勤奖/餐补口径（需产品确认）

- `payroll.service.ts:114` `noLeave: m.leaveMinutes === 0`——任何请假（**含有薪假**）都取消全勤奖，与引擎注释「无请假（**有薪假除外**）」（`payroll-engine.ts:6`）冲突。需确认 `leaveMinutes` 是否混入有薪假。
- `monthly-engine.ts:36-40` 把 `leave` 计入 `workDays`，而餐补 = `workDays × 10` → **请假日照发餐补**。需确认是否应由出勤基数排除。

---

## 三、子代理结论更正（已复核证伪）

| 子代理结论 | 复核结果 |
|---|---|
| `attendance-monthly.service.ts:151`、`payslip.service.ts:167` 空范围 fail-open | **证伪**。这两处走 `where.employee = { departmentId: { in: scope.ids } }`，`ids` 为空时 Prisma 的 `in: []` 返回 0 行 → **fail-closed**。真 fail-open 只有 `listRuns`（用 `ids.length > 0` 分支导致 `where` 留空）。 |
| `money.util.toCents` 负数舍入有误 | **证伪**。按绝对值四舍五入后回填符号，`toCents(-0.005) → -1` 正确；有单测覆盖。 |
| 多处 `getMonth()` 漏网（时区） | **部分成立**：`reports.service.ts:36-45` 确用本地 getter（见 P3-10）；考勤/算薪主链路已统一 `getUTC*`/`beijingNow()`，无漏网。 |
| punch 幂等缺失会脏写 | **部分成立**：唯一约束兜底，不会脏写，只是批次失败（见 P2-7）。 |

---

## 四、Standards 轴（规约 + 坏味）

**违反已文档化规约**

1. 设计 token 硬编码：`okr.tsx:31,32,343`（`#14b8a6` / `#8b5cf6` / `#2455D9`）——同页其余已用 token，违反 ADR-0014 / REFACTOR_PLAN §11。
2. 时区取年月：`reports.service.ts:36-45` 本地 getter（见 P3-10）；`employees.service.ts:26` `toYm` 同型，需核对入参是否 UTC 存储。
3. 金额定点：`payroll-engine.ts:76,81` 的 `basicSalary/21.75/8`、`×1.5/2/3` 为裸浮点中间量（最终经 `toCents` 取整，暂无实证错值，但与「金额一律走定点工具」有张力）。
4. `any` 逃逸：本轮统计的是 `as any`，**`const where: any` 这类声明式逃逸未纳入**——正是 P0-1 得以存活的原因。建议把 `: any` 也纳入闸门。

**基线坏味（判断性）**

- Middle Man：`realtime.module.ts:2` 导入 `NotificationModule` 但 gateway 只用事件解耦，导入无作用 → 删。
- Primitive Obsession：加班时长以裸 number 分钟在日报/月报/引擎间传递，日类型信息丢失（P0-2 的根因之一）。

---

## 五、Spec 轴（规格符合性）

Spec 轴子代理执行失败（工具异常），以下为本人直接核对：

- **(a) 规格要求但缺失/部分**
  - §4.2/§4.3 加班倍数（1.5/2/3）：**数据模型不支持**（P0-2），规格要求实际未落地。
  - §4.3「对账验收：抽 3 名**员工**人工对账」：目前交付的是**代表性样例基线**，真实批次复跑未做（已在留痕文档标注为上线前动作，非隐瞒）。
  - §4.2「加班 = min(申请, 实际)」（引擎注释 C5 自述「生产版需」）：**未见实现**，打卡推算加班未与已批加班申请取小 → 可能超付。
- **(b) 范围蔓延（规格未要求但做了）**
  - 设备**推送模式**（`push/xface-push`）规格只写了「HTTP 拉取 + CSV 兜底」；两种模式并存需明确生产用哪种（否则流水重复）。
- **(c) 看起来实现但可能不对**
  - ADR-0011「算薪输入须为已确认快照」：读取侧成立，但**月报可被回写 draft**（P1-5）使快照不绝对可信。
  - §4.3「撤回限未查看状态」：**本次未验证**，建议单测确认（见第六节）。

---

## 六、待运行时验证（未能静态定论）

1. §4.3「撤回限未查看状态」是否真按员工已查看判定。
2. P2-9 的两条口径（有薪假是否混入 `leaveMinutes`、请假日餐补）需产品确认。
3. 加班是否与已批加班申请取 min（C5 注释声称的「生产版」行为）。

---

## 七、建议修复顺序

**第一批（本周，P0，均为小改）**：P0-1 改 `employeeNo in visibleNos` 并加集成用例 → P0-2 先做「产品决策」再定改造范围（涉及 migration，勿草率） → P1-3 用 `scopeIsEmpty` fail-closed → P1-5 upsert 加 CAS 或统一锁 key。

**第二批（P1/P2）**：P1-4 状态口径合并 → P2-6 补 `assertRunInScope` → P2-7 加锁 + 捕 P2002 → P2-8 改 CAS。

**第三批（P3/规约）**：P3-10 时区、P3-11 token、无用导入、`: any` 闸门。

> 说明：本报告为**只读审查**，未改动任何代码；以上修复建议均给出可验证的验收方式。
