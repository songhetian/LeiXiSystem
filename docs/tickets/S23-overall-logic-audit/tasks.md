# S23 整体逻辑审计 任务清单

> 依据 `docs/tickets/S23-overall-logic-audit/spec.md`。A 级任务需先确认 D1/D2/D3 决策再动手。
> 约定：后端改动先写 `*.spec.ts`（TDD）；金额相关改动必须保持 `toCents/sumCents/fromCents` 定点口径。

## 阶段 0：决策确认

- [x] D1 分布式锁降级策略 → ①（Redis 故障时降级为进程内互斥，`fallbackToLocal` 默认 true）
- [x] D2 鉴权类降级策略 → ①（进程内兜底：限流固定窗口 + JWT 黑名单/会话镜像）
- [x] D3 工资条二级密码在 Redis 不可用时口径 → ①（内存通行证，与 D2 共用 `LocalFallbackStore`；未配置 Redis 同样要求二次验证）
- [x] D4 台账导出 → ①（`ProTable.onExportAll` + 工资条按 200/页分页拉全量）
- [x] D5 批次可见性口径 → ①（列表按 `PayrollDetail → employee.departmentId` 判定，与详情一致）
- [x] D6 缺月报员工 → ①（阻断创建并返回缺失名单，最多列 5 人）

## 阶段 1：A 级（安全与核心可用性）

- [x] A1 `distributed-lock.service.ts` 按 D1 调整降级策略；新增 `fallbackToLocal` 与进程内互斥 `acquireLocal`（同资源串行、释放清理队尾）
- [x] A1 新增 `distributed-lock.service.spec.ts` 用例：Redis 未配置 / 配置但故障 / 抢锁失败 三种分支
- [x] A2 `login-rate-limit.service.ts` 接入进程内固定窗口兜底；`redis.service.ts` 新增 `isAvailable()`（区分未配置/故障）
- [x] A2 新增限流降级用例：Redis 故障时第 6 次失败仍返回 429
- [x] A3 `jwt-auth.guard.ts` + `auth.service.ts` 增加内存黑名单/会话镜像（登录/登出/改密/隐私密码双写双清）
- [x] A3 新增守卫用例：Redis 故障下登出后的 token 立即 401

## 阶段 2：B 级（业务逻辑与契约）

- [x] B1 `payslip.service.ts` 按 D3 改造通行证存储；补「验证后详情仍 403」的回归用例
- [x] B2 `payroll.controller.ts` 透传 month/status；`payroll.service.ts#listRuns` 合并筛选条件（月份正则、状态枚举校验）
- [x] B2 `payroll.service.spec.ts` 增筛选用例（月份/状态/与数据权限叠加）
- [x] B3 `payroll.controller.ts#listItems` 统一为 `{list,total,page,pageSize}` 信封（支持 `status=active`），与 `services/payroll.ts` + `RunDetailsModal.tsx#data.list` 契约对齐
- [x] B4 `ProTable.tsx` 增加 `onExportAll`；`payslips.tsx` 台账导出按 D4 分页拉全量
- [x] B5 `expense/pages/approval.tsx` 动作弹窗改用点击行作为提交目标（移除 setTimeout 依赖）；驳回原因前后端必填
- [x] B5 `expense/__tests__/approval.test.tsx` 增「详情慢返回时确认仍生效」「空原因驳回被拦」用例
- [x] B5（审计外新增）`/reimbursements/pending` 返回 `items` 而前端读 `list`（列表恒空）+ `POST /reimbursements/:id/approve|reject` 不存在（404）→ 统一为 `list` 信封并通过 `APPROVAL_CLIENT` 补齐审批端点
- [x] B6 `payroll.service.ts#createRun` 事务前批量取薪资调整，事务内只写；`$transaction(..., { timeout: 30_000 })`
- [x] B6 `payroll.service.spec.ts` 增大批量（120 人）创建用例
- [x] B7 `payroll.service.ts#recallRun` 事务内复查 viewed + 状态条件更新；撤回竞态用例
- [x] B8 按 D5① 统一 `listRuns` 与 `getRunDetails` 可见性口径；补主管视角用例

## 阶段 3：C 级（健壮性 / 维护性）

- [x] C1 删除 `services/payroll.ts` 的 `getPayrollRunDetail`
- [x] C2 `services/payroll.ts#updateSalaryItem` 改 PUT；同步 `services/__tests__/payroll.test.ts`
- [x] C3 `use-cached-data.ts` 增加 LRU 容量上限（200）与过期清理
- [x] C4 `use-cached-data.ts` 切 key 首帧不渲染旧数据
- [x] C5 `payroll.service.ts#createRun` 按 D6① 阻断缺月报员工（新增错误码 3017 + `detail` 名单）
- [x] C6 `payroll.service.ts#getEffectiveSalary` 异常不再静默回退薪资
- [x] C7 `payslips.tsx` 催办改为分页拉全量（不再固定 200 上限）
- [x] C8 `payroll.service.ts` 发布/撤回通知改为有限重试 + 失败告警

## 验证

- [x] `pnpm --filter backend test`（136 suites / 1697 tests 全绿）
- [x] `pnpm --filter frontend test`（112 suites / 1072 tests 全绿）
- [x] `cd frontend && npx tsc --noEmit`（通过）；`cd backend && npx tsc --noEmit -p tsconfig.json`（通过）
- [x] Redis 停止状态下七条主链路：本机 Redis 未启动（6379 无监听），已用等价用例覆盖——限流第 6 次 429、登出后 token 401、算薪批次创建/确认（锁降级进程内互斥）、月报/打卡/请假余额（同一锁降级路径）、工资条二级密码通行证（内存兜底）；真实部署环境的手工走查留待上线前执行。
