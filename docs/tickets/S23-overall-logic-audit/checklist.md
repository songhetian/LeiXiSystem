# S23 整体逻辑审计 验收清单

## 阶段 1：A 级（安全与核心可用性）

- [x] Redis 未配置 / 连接异常时，`withLock` 默认降级为进程内互斥，同资源并发串行，fn 异常仍释放锁
- [x] `fallbackToLocal:false` + `failClosed:true` 时 Redis 不可用抛 `LockAcquisitionError`；`failClosed:false` 放行
- [x] 抢锁失败（他人持有）一律抛 `LockAcquisitionError`，不执行 fn
- [x] Redis 连接异常时登录限流不再归零：同用户名第 5 次失败后第 6 次返回 429（`RATE_LIMIT_EXCEEDED`）
- [x] `reset` 同时清除 Redis 与进程内计数
- [x] Redis 连接异常时登出后的旧 token 立即 401（本地黑名单命中）
- [x] 单设备会话：本地会话镜像与 token 内 session 不一致 → 401；一致 → 放行
- [x] 改密撤销哨兵 `__revoked__` 在 Redis 不可用时经本地镜像生效

## 阶段 2：B 级（业务逻辑与契约）

- [x] 二级密码验证通过后，Redis 故障时仍可打开工资条详情（不再「验了也没用」）
- [x] 未验证（本地与 Redis 均无通行证）时仍返回 3013；未配置 Redis 时同样要求二次验证
- [x] 批次列表 `month` / `status` 筛选生效，非法值返回 4000；筛选与数据权限条件合并而非覆盖
- [x] `GET /payroll/items` 返回 `{list,total,page,pageSize}`，`RunDetailsModal` 调整项下拉可正常取到启用项
- [x] 工资条台账导出为全量（按 200/页分页拉全量），不再只导当前页
- [x] 报销审批动作不依赖详情请求返回时机，详情慢返回时点击确认仍会提交
- [x] 驳回原因为空时前端拦截、后端 DTO/服务层 400（`PARAM_INVALID`）
- [x] 报销待审批列表返回 `{list,...}` 信封，页面不再恒空；`POST /reimbursements/:id/approve|reject` 端点存在并经 `APPROVAL_CLIENT` 推进审批流
- [x] 算薪创建事务前一次性批量取薪资调整（120 人仅一次 `findMany`），事务显式 `timeout: 30_000`
- [x] 撤回在事务内复查 viewed 并条件更新状态：已查看 → 3012 且工资条与状态均不变
- [x] 批次列表与详情可见性口径一致（按明细所属部门），主管可见草稿批次

## 阶段 3：C 级（健壮性 / 维护性）

- [x] `getPayrollRunDetail` 已删除（含测试引用）
- [x] `updateSalaryItem` 改用 PUT，测试断言同步
- [x] `useCachedData` 缓存上限 200 + LRU 淘汰 + 过期清理
- [x] 切换 cacheKey 首帧不渲染旧数据（返回 `data: undefined` + `loading: true`）
- [x] 缺月报在职员工阻断创建，返回 3017 + `detail` 名单（最多 5 人）
- [x] `getEffectiveSalary` 读取异常上抛，不再按错误基数计薪
- [x] 一键催办分页拉全量，不再静默漏催 200 人之后
- [x] 发布/撤回通知有限重试 + 失败告警

## 验证

- [x] 后端全量单测：136 suites / 1697 tests 通过
- [x] 前端全量单测：112 suites / 1072 tests 通过
- [x] `backend npx tsc --noEmit`、`frontend npx tsc --noEmit` 均通过
- [x] 日期/金额口径未变：金额仍全程 `toCents/sumCents/fromCents` + `Prisma.Decimal`
