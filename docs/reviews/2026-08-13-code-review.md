# 代码评审报告 · 2026-08-13

- **评审对象**：`refactor-v2` 分支 `c7b779a`（清空旧代码、建文档体系）→ `HEAD`（`b2c70e5`，S01–S03）+ 工作区未提交（S04 班次排班半成品）
- **范围**：`apps/server/src`、`apps/web/src`、`packages/shared/src`
- **方法**：双轴并行评审（Standards 坏味道 + Spec 实现合规），对应增强后的 `/code-review` 提示词
- **缺口说明**：未找到"原始两份需求文档"独立文件，以 `legacy/` 旧系统作为原始参照（见 Spec 轴结论）

---

## 轴一 · 代码规范与坏味道（Standards）

### 🔴 高
1. **错误码中央表形同虚设 + 跨模块碰撞**
   - `apps/server/src/common/error-codes.ts:72-76`：同一文件内 `5001`/`5002` 被 auth 与 knowledge 双重定义（重复 key，静默冲突）。
   - 跨模块抢码：报销 `7001-7006` 与通知 `notification.service.ts:43/46`（7001/7002）；报表 `reports.service.ts` 与薪资 `payslip.service.ts`（共用 4001/4004）。
   - 根因：`ERROR_CODES` 几乎无人引用（仅 `vacation.service` 导入），其余 service 全写裸数字 `code: 2001`，中央表成死代码。
   - **建议**：全局 `import { ERROR_CODES }` 替换裸数字；按分段重新分配唯一码，删重复 key。

2. **`error-codes.ts` 分段契约被违反**：`4001-4099` 注释为"报销域"，却被报表/薪资占用。

### 🟠 中
3. **魔法数字未提取**：`payroll-engine.ts:55,60` 的 `21.75/8/1.5/2/3`；`attendance-engine.ts:33,52,57` 的 `1440`，应提为常量（`LEGAL_MONTHLY_DAYS`、`MINUTES_PER_DAY` 等）。
4. **`2001` 过载 + P2002 块重复**：`shifts.service.ts` 中 `2001` 承担"时间冲突/重名/不存在/已使用"4 种语义；create/update 的 `try{catch P2002}` 块重复。建议拆独立码 + 抽 `private saveShift()`。
5. **`422` 当业务码用**：`schedules.service.ts`、`employees.controller.ts` 中 `code: 422` 实为 HTTP 状态被当业务码，应改用 `4001` 段内"参数/外键不存在"码。

### 🟡 低
6. **冗余委托**：`employees.service.ts:82-83` 的 `private visibleScope` 仅转调 `dataScope.visibleScope`，删此 2 行。
7. **数据隔离判定重复**：`schedules.service.ts:123-130` 的 `assertInScope` 重写部门判断，应上提到 `DataScopeService.assertEmployeeInScope()`。

**总体**：有改进空间。最该先改：① 错误码落地为真实单一真相源并消除跨模块碰撞（最高危）；② 提取引擎魔法数字。

---

## 轴二 · 实现合规性校验（Spec Compliance）

### ✅ 合规项（对齐良好）
- 路由前缀 `api/v1`（spec§4 Base URL）。
- 认证：httpOnly+SameSite=Lax cookie；错误码 5001/5002 正确；无权限返 **5003**。
- 员工错误码 1001/1002/1003/1004 全对齐；离职状态机拒绝离职后修改。
- 部门隔离（ADR-0010）：admin/hr 全量、经理本部门+递归子部门，e2e 验证通过。
- 班次跨天标志 `Shift.isNextDay` 存在；名称唯一冲突返 2001。
- 唯一约束对齐：`punch_logs`、`attendance_daily`、`attendance_monthly`、`payroll_runs`、`payroll_details` 均与文档一致；已删表未出现。

### ⚠️ 偏差清单
1. **[中] 行级越权错误码不符** — `employees.service.ts:52-54`：跨部门查看详情抛 `1002`（员工不存在），但 ADR-0010/spec§4 规定"无权限访问他人数据返回 **5003**"。风险：前端按 5003 处理行级越权将失灵。
2. **[中] 未文档化新表** — `schema.prisma` 含多张文档未定义表（`punch_sync_state`、`attendance_daily_recalc_tasks`、`broadcast_reads`、`approval_group_members`、`knowledge_article_daily_stats`、`punch_devices`），违反 CONTEXT.md 铁律"变更先更新文档"。
3. **[低] 弱类型字段** — `punch_logs.punch_type` 文档 ENUM 实现 VARCHAR(10)；`salary_items.type` 文档 ENUM 实现 VARCHAR(20)；`attendance_daily.status` 比文档多 `late_early/abnormal`。
4. **[低] auth 响应结构偏差** — spec§3.1 要求 `user{employeeId,roles,accessTokenExpiresIn}`，实现仅 `{id,username,name,permissions}`。
5. **[低] CSRF 未实现** — spec§6.2 E1 要求写操作 CSRF 校验，当前无 CSRF 守卫（S01 半成品）。
6. **[低] "员工仅本人"未收窄** — `data-scope.service.ts` 按部门过滤，未对普通员工收窄到本人（但普通员工无 `employee:list` 权限，实际不可达）。

### 原始需求文档缺口
未找到"原始两份需求文档"独立文件。以 `legacy/`（旧系统源码、README.md、CODEBUDDY.md）作为原始参照。局限：legacy 是实现而非需求文档，业务规则需反推，可能遗漏未落码诉求；技术栈不同，仅能核对功能存在性。

**总体**：合规度中。最需纠正：偏差①（行级越权 1002→5003）与偏差②（schema 与文档双向对齐）。

---

## 共同最高优先级（两轴交汇）
1. **错误码治理体系**：消除跨模块碰撞 + 落地中央常量（影响 Standards 高①与 Spec 中①的 5003 语义）。
2. **文档与实现的双向对齐**：把 `schema.prisma` 中未文档化表补进 `docs/schema`，按铁律"先改文档再改码"。

## 备注
- S04 班次排班尚未提交且 2 个测试因 `400` vs `422` 语义问题待修（即坏味道轴 #5 同因），建议本轮一并收尾。
- 本报告依据增强版 `/code-review` 提示词（规范坏味道 + 实现合规双轴）生成。
