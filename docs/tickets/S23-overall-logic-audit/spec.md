# S23 整体逻辑深度审计与修复 Spec

> 审计范围：后端核心链路（鉴权 / Redis 降级 / 算薪 / 工资条 / 数据权限 / 报销）+ 前端数据获取与前后端契约。
> 审计方式：逐文件核对实现（非推测），标注「实测事实」；需要产品/技术决策的标注「待决策」。
> 结论分级：A = 安全或核心可用性缺陷；B = 业务逻辑错误/契约错位；C = 健壮性、可维护性、体验。

## 一、总体结论

- **金额与状态机是健全的**：全链路走 `toCents / sumCents / fromCents` 定点 + `Prisma.Decimal`；`PayrollRun` 状态机 `draft → confirmed → published → recalled` 严格条件更新；发布与撤回的状态变更和工资条生成/删除都在同一事务；`Payslip(runId+employeeId)`、`PayrollDetail(runId+employeeId+itemCode)` 唯一约束就位。
- **数据权限是 fail-closed 的**：`scopeIsEmpty` 在批次列表/明细/调整项/工资条详情处均能拒绝越权，不存在「范围为空 → 不过滤」的旧问题。
- **前后端权限码一致**（抽查 `reimbursement:approve`、`employee:tag:manage`、`helpdesk:sla:manage`、`payroll:my:view`、`attendance:location:manage`，均在 `backend/prisma/seed.ts` 权限表中存在）。
- **主要风险集中在 Redis 降级策略**：Redis 被设计为「可选组件」，但限流、JWT 黑名单、单设备登录、二级密码通行证、分布式锁都依赖它，且降级方向不一致（限流 fail-open、锁 fail-closed），因此在「REDIS_URL 已配置但 Redis 不可达」这一现实状态下，系统同时出现「安全校验失效」与「核心业务不可用」。

## 二、A 级缺陷

### A1 分布式锁 fail-closed 使核心业务在 Redis 不可用时整体不可用

- 实测位置：`backend/src/common/distributed-lock.service.ts#L47-L55`（`!isEnabled` 时 `failClosed=true` 直接返回 false）、`#L63-L68`（Redis 异常同样按 failClosed 返回 false）；`withLock` 默认 `failClosed = true`（`#L90`）。
- 受影响调用（均未传 `failClosed:false`）：
  - 算薪批次创建/确认/发布/撤回：`backend/src/payroll/payroll.service.ts#L68`、`#L306`、`#L353`、`#L413`
  - 考勤月报生成/确认/重算：`backend/src/attendance/attendance-monthly.service.ts#L48`、`#L229`、`#L337`
  - 打卡提交/补卡：`backend/src/attendance/punch.service.ts#L53`、`#L154`；设备同步：`punch-sync.service.ts#L122`
  - 年假额度初始化/结转：`backend/src/attendance/vacation.service.ts#L1089`、`#L1143`
- 触发场景：`REDIS_URL` 已配置但 Redis 未启动（当前本机即此状态，后端日志持续 `Redis 连接异常`）。此时 `isEnabled=true`，`getClient().set(...)` 抛异常 → `tryAcquire` 返回 false → 抛 `LockAcquisitionError` → 前端看到 409「无法获取分布式锁，请稍后重试」，算薪、月报、打卡、请假全部不可用。
- 与文档矛盾：`redis.service.ts#L7-L14` 明确「可选组件：REDIS_URL 缺失时降级为 no-op，不阻断应用启动，调用方据此走直通逻辑」。
- 修复方向（**待决策 D1**）：见「四、待决策」。

### A2 登录失败限流在 Redis 不可达时失效（fail-open）

- 实测位置：`backend/src/auth/login-rate-limit.service.ts#L37-L38`（`!isEnabled` 直接 return）、`#L65-L66`（`registerFailure` 返回 0）、`#L87-L88`（`checkAndRecordFailure` 直接 return）；底层 `backend/src/common/redis/redis.service.ts#L53-L61`（`incr` 异常返回 0）、`#L72-L80`（`get` 异常返回 null）。
- 触发场景：`REDIS_URL` 已配置但 Redis 不可达 → `get` 返回 null、`incr` 返回 0 → 用户名 5 次 / IP 20 次的窗口计数永不生效，暴力破解防护完全失效（不是「放宽」，是「归零」）。
- 关联证据：用户贴出的日志 `Redis get 失败 [login:fail:user:admin]` 正是该分支。
- 修复方向（**待决策 D2**）：区分「未配置」与「配置了但故障」，后者启用进程内滑动窗口兜底。

### A3 JWT 黑名单与单设备会话在 Redis 不可达时失效（fail-open）

- 实测位置：`backend/src/auth/jwt-auth.guard.ts#L49-L73`；写侧 `backend/src/auth/auth.service.ts#L110-L126`（登录写 session）、`#L139-L151`（登出写黑名单）、`#L183-L187`（改密写撤销哨兵）。
- 触发场景：Redis 已配置但不可达 → 守卫内两次 `get` 均返回 null → ① 已登出的 token 仍可用，直到 JWT 7 天过期；② 改密后的旧 token 不再被撤销；③ 单设备登录不生效（新设备登录不会踢掉旧设备）。
- 修复方向（**待决策 D2**，与 A2 同一套「Redis 故障时的本地兜底」基础设施）。

## 三、B 级缺陷

### B1 工资条二级密码门禁在 Redis 不可达时给出「验证了也没用」的死循环

- 实测位置：`backend/src/payroll/payslip.service.ts#L267`（`verifyPassword` 成功后 `redis.set` 静默失败）与 `#L274-L279`（`getMyPayslipDetail` 读不到通行证即抛 403 `PAYSLIP_PASSWORD_REQUIRED`）。
- 触发场景：Redis 已配置但不可达 → 用户输对密码 → 接口返回 `verified:true` → 打开详情仍 403 → 再输一次仍 403，明细永久无法查看。
- 另：`#L274` 的注释称「Redis 未启用时直通降级」，即未配置时反而**不做二次验证**（安全降级，同样需要决策口径）。

### B2 算薪批次列表的「月份 / 状态」筛选完全无效

- 实测位置：前端 `frontend/src/features/payroll/pages/runs.tsx#L23-L32`（`searchFields` 提供 month/status）、`#L78-L90`（参数进 cacheKey 并透传）；后端 `backend/src/payroll/payroll.controller.ts#L69-L84` 只接收 `page/pageSize`，`backend/src/payroll/payroll.service.ts#L180-L225` 的 `where` 仅含数据权限条件。
- 触发场景：HR 选「月份=2026-10」或「状态=草稿」→ 重新请求 → 返回的仍是全量分页结果，界面看起来「筛选没反应」。
- 修复：service 合并 `month` / `status` 条件（枚举校验），controller 传参；补 `payroll.service.spec.ts` 用例。

### B3 调整项下拉的前后端契约错位，导致「添加调整项」不可用

- 实测位置：后端 `backend/src/payroll/payroll.controller.ts#L22-L28` 返回 `data: SalaryItem[]`（**数组**，无 `list/total` 信封）；前端 `frontend/src/services/payroll.ts#L137-L139` 声明为 `ListResult<SalaryItem>`，`frontend/src/features/payroll/components/RunDetailsModal.tsx#L121` 读 `sRes.data.list`。
- 触发场景：真实接口下 `data.list` 恒为 `undefined` → `salaryItems` 为空 → `salaryItemsBlocked` 为 true → 调整项入口被禁用，HR 无法补发/补扣。前端用例因 mock 了 `{list:[...]}` 而测不出该问题。
- 修复：二选一并统一类型与测试 —— ① 前端兼容数组（`Array.isArray(data) ? data : data.list`）；② 后端改为 `{list, total, page, pageSize}`。建议 ② 以符合 `docs/api/core-contracts.md` 统一信封。

### B4 管理端「工资条台账导出」只导出当前页

- 实测位置：`frontend/src/components/ProTable.tsx#L237-L253`（`handleExportCSV` 直接用 `data`，即当前 pageSize 行）；`frontend/src/features/payroll/pages/payslips.tsx#L329-L331` 以「台账导出」文案提供该按钮（pageSize 默认 20）。
- 触发场景：HR 点「导出 CSV」拿到 20 行，误以为导出了整月台账；「未查看名单可拿去逐个跟进」的用途失效。
- 修复（**待决策 D4**）：新增 `onExportAll` 拉全量（分批 200/页循环，或后端提供导出接口），否则把文案改为「导出当前页」。

### B5 报销审批「通过 / 驳回」存在竞态与空原因提交

- 实测位置：`frontend/src/features/expense/pages/approval.tsx` 列表操作列 —— `openDetail(record); setTimeout(() => openAction('approve'), 300);`；`handleAction` 开头 `if (!currentItem || !actionType) return;`。
- 触发场景：详情接口耗时 > 300ms 时，动作弹窗已弹出但 `currentItem` 仍为 null，用户点「确认通过」/「确认驳回」→ 函数直接 return，**无任何提示**，审批静默失败；另外驳回原因为空也可提交。
- 修复：动作弹窗改为不依赖详情请求（直接以 `record` 作为提交目标，详情并行拉取仅用于展示），或在 `handleAction` 内 `await` 详情 Promise 后再提交；驳回原因加必填校验（前端 + 后端 DTO）。

### B6 算薪创建在交互式事务内逐员工查询，易触发 Prisma 事务超时

- 实测位置：`backend/src/payroll/payroll.service.ts#L85-L157` 的事务体内，`#L101-L105` 对每个员工调用 `getEffectiveSalary`，而 `getEffectiveSalary`（`#L43-L65`）用的是 `this.prisma`（**事务外的连接**），既是一致性缺口也是一次/人的 N 次查询。
- 触发场景：员工数上百时，事务默认 timeout（Prisma 交互式事务 5s）极易触发 `P2028`，表现为「偶发创建算薪批次失败」；同时事务外的薪资调整读取不受快照保护。
- 修复：事务前一次 `salaryAdjustment.findMany({ where:{ employeeId:{in:[...]}, effectiveMonth:{ lte: month } } })` 批量取，在内存按 `(employeeId, effectiveMonth, createdAt)` 取最新；事务内只写；必要时显式 `{ timeout: 30_000 }`。

### B7 撤回与「员工已查看」存在竞态

- 实测位置：`backend/src/payroll/payroll.service.ts#L425-L432` 的 `viewedCount` 在事务外统计，`#L437-L446` 事务内无条件 `update` + `deleteMany`。
- 触发场景：统计完到删除之间，员工恰好打开工资条（`markAsViewed`，`payslip.service.ts#L311-L334`）→ 已被查看的工资条仍被删除，违反「已查看不可撤回」的业务规则。
- 修复：事务内用 `updateMany({ where:{ id: runId, status:'published' } })` 保证状态条件，并在同一事务内复查 viewedCount（或 `deleteMany({ where:{ runId, status:{ not:'viewed' } } })` 后校验删除数量）。

### B8 非全量用户「批次列表」与「批次详情」口径不一致

- 实测位置：`backend/src/payroll/payroll.service.ts#L192-L213`（列表用 `payslip.runId` 反查可见批次，而草稿/已确认批次尚无工资条 → 部门主管看不到）；`#L267-L269`（同一批次在详情接口只要明细可见即放行）。
- 触发场景：主管从其它入口（消息/深链）拿到 runId 可以打开批次详情，但列表里没有这条记录，出现「能打开但列表查不到」的不一致。
- 修复（**待决策 D5**）：统一以 `PayrollDetail → employee.departmentId` 判定列表可见性，或明确「未发布批次仅全量权限可见」并保留详情严格拦截。

## 四、C 级问题（健壮性 / 维护性）

| 编号 | 位置 | 问题 | 建议 |
|---|---|---|---|
| C1 | `frontend/src/services/payroll.ts#L157-L159` | `getPayrollRunDetail` 调用 `GET /payroll/runs/:id`，后端无此路由（`payroll.controller.ts` 只有 `/runs/:id/details`），无调用方 | 删除该死方法，避免将来误用 404 |
| C2 | `frontend/src/services/payroll.ts#L145-L147` vs `payroll.controller.ts#L46-L67` | `updateSalaryItem` 发 PATCH，后端 PATCH 是「启用/停用」，更新走 PUT | 改 PUT；同步 `services/__tests__/payroll.test.ts` 断言 |
| C3 | `frontend/src/hooks/use-cached-data.ts#L15`、`#L139` | `moduleCache` 无容量上限；`EmployeeSelect` 把搜索关键词编进 key（`components/EmployeeSelect.tsx`），长会话条目无界增长 | 加 LRU 容量上限（如 200 条）+ 过期清理 |
| C4 | `frontend/src/hooks/use-cached-data.ts#L60-L71`、`#L156-L161` | `cacheKey` 切换后首帧仍渲染旧 key 的 `data`，效果依赖的列表会短暂显示上一次筛选结果 | state 记录 key，key 不匹配时强制 `loading` |
| C5 | `backend/src/payroll/payroll.service.ts#L74-L81` | 只有「已确认考勤月报」的员工进入算薪，缺月报者被静默漏发 | 与在职员工名单比对，差异则阻断并返回缺失名单 |
| C6 | `backend/src/payroll/payroll.service.ts#L56-L64` | `getEffectiveSalary` 吞异常回退「员工当前薪资」，DB 故障时按错误基数计薪 | 异常时中止批次创建并告警 |
| C7 | `frontend/src/features/payroll/pages/payslips.tsx#L204-L238` | 一键催办 `pageSize: 200` 固定上限，超 200 人静默漏催 | 循环分页拉全量或提示「仅前 200 人」 |
| C8 | `backend/src/payroll/payroll.service.ts#L375-L397`、`#L450` | 发布通知走 `setImmediate`、撤回通知清理在事务外，进程中断会漏发/残留死链通知 | 记录待发通知（outbox 表）或至少失败重试 + 日志告警 |

## 五、决策结论（已实施）

- **D1 分布式锁降级策略**：采纳 ①——核心写操作在 Redis 不可用（未配置或连接异常）时降级为进程内互斥，单实例等价、多实例退化为「每实例互斥」；`fallbackToLocal:false` 仍可按 `failClosed` 拒绝。
- **D2 鉴权类降级策略**：采纳 ①——新增 `LocalFallbackStore` 进程内兜底：登录限流固定窗口、JWT 黑名单、单设备会话镜像、改密撤销哨兵双写双清。
- **D3 工资条二级密码**：采纳 ①——通行证同时写内存与 Redis；读取 `Redis ?? 内存`，两者皆无才 403。未配置 Redis 时同样要求二次验证（不再 fail-open）。
- **D4 台账导出**：采纳 ①——`ProTable.onExportAll` + 工资条按 200/页分页拉全量。
- **D5 批次可见性**：采纳 ①——列表按 `PayrollDetail → employee.departmentId` 判定，与详情口径一致（草稿/已确认批次主管也能看到）。
- **D6 缺月报员工**：采纳 ①——阻断创建，错误码 3017 + `detail` 返回缺失名单（最多 5 人，超出「等 N 人」）；在职口径为 `Employee.status = 'active'`。

## 六、验证方式

- 后端：新增/补充 `*.spec.ts`（TDD）—— 限流降级、JWT 黑名单降级、二级密码通行证、锁降级、算薪筛选、事务超时路径、撤回竞态；`pnpm --filter backend test`。
- 前端：`services/__tests__/payroll.test.ts` 补契约断言；`run-details-modal.test.tsx` 用真实数组形状回归；`payslips` 导出用例；`pnpm --filter frontend test` + `tsc --noEmit`。
- 手工：Redis 停止状态下跑「登录失败 6 次 / 登出后复用 token / 打开发薪批次 / 生成月报 / 打卡 / 提交请假 / 查看工资条明细」七条主链路，确认行为符合 D1/D2/D3 决策。
