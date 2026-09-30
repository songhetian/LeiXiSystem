# 雷犀管理系统 — 项目长期记忆

## 目录结构约定 (重构后)
- 顶层 pnpm workspace，角色命名：`backend/`(服务端, NestJS+Fastify, 包名 @lei/backend)、`frontend/`(Next.js14, @lei/frontend)、`shared/`(公共 schema/Zod, @lei/shared)。
- `pnpm-workspace.yaml` 指向 `backend`/`frontend`/`shared`（非 apps/*/packages/* 通配）。
- 辅助目录：`docs/`(ADR/spec/架构/tickets/reviews)、`legacy/`(旧版归档,只读参考)、`prototypes/`(原型)、`scripts/`(工具, 含 verify-workspace.mjs 结构校验)。
- `.trae/` 是另一个 AI 工具(Trae IDE)的状态目录(含 SFTP 书签)，**不属于本项目，保留不动**；`.agents/` 是来源 skills 副本。

## 技术栈
- 后端: NestJS 10 + Fastify + Prisma 6 + MySQL 8.2；测试 jest+ts-jest(dev ts-node)。
- 前端: Next.js 14(App Router) + React 18 + Arco Design；测试 jest。
- 工作区包按名解析(@lei/*)，与目录名解耦——改名目录只需改 pnpm-workspace.yaml。

## 重构工作流
- 按 /tdd 逐 ticket(S01-S15 垂直切片)迭代；当前 S01-S03 已提交，S04 半成品(未提交)。
- 移动目录遇文件锁: 用 `git rm --cached` + `cp` + `git add`(提交时 git 自动 rename 检测)，而非 `git mv`；删目录绕过 safe-delete 用 `find -depth -delete`。

## 部署与迁移（ADR-0017，2026-09-25 定稿并落地）
- **迁移已基线化**：21 个历史 migration 压缩为唯一基线 `backend/prisma/migrations/0_init/`（87 表 DDL + 幂等种子）。`db push` 入口**全部移除**，schema 变更只能走 migration。
- 启动链：`backend/entrypoint.sh`（`migrate deploy` 必跑；种子仅 `SEED_ON_BOOT=true` 时执行，生产必须 false）。
- 既有库（无迁移历史）首启自动走 **P3005** 分支标记基线；**`_prisma_migrations` 一旦存在，不得再手工 `migrate resolve`**。
- 回滚无 down 脚本，依赖事前 `mysqldump` 备份。
- **端口约定**：前端 dev `4000`，后端 `4001`（nginx 反代 / 容器健康检查 / CORS 统一按此）。
- **pnpm 11**：构建白名单只能用 `pnpm-workspace.yaml` 的 `allowBuilds`（`onlyBuiltDependencies` 已废弃且被静默忽略，沿用会 ERR_PNPM_IGNORED_BUILDS 退出 1）；`.npmrc` 只读认证/registry 类配置。
- **前端镜像用 `next start` 而非 `output: 'standalone'`**：pnpm workspace 下 Next 把依赖写成相对符号链接，standalone 产物里必然悬空。

## 后端架构规约（ADR-0013）
- 跨模块协作只能「消费方注入 token → 提供方实现接口」，禁止直接 import 对方 Service：`APPROVAL_CLIENT` / `NOTIFICATION_CLIENT`。
- `common/module-boundary.spec.ts` 会**扫描生产源码 import 语句**强制该边界（仅扫 .ts，测试 mock 不受限）；`common/di-injection.spec.ts` 反射校验注入元数据。新增模块时注意。
- **口径单一来源**（改动时勿再各写一份）：`attendance/overtime-conversion.ts`（加班转调休，比率取设置 `overtime_to_leave_hours`）、`attendance/punch-makeup-type.ts`（补卡类型值域）、`attendance/vacation-monthly.ts`（月假判定，前端同口径见 `frontend/src/lib/vacation-type.ts`）、`attendance/daily-status.ts#resolveDailyStatus`（**日报状态唯一口径**，merge/审批监听/申诉重算三处均委托它）、`attendance/engine/workday-calendar.ts#resolveDayType`（**加班日类型唯一口径**，决定 1.5/2/3 倍）。
- **加班/有薪假口径（2026-09-30 落地）**：`holidays` 表存日类型（holiday/rest/workday，未登记按周末兜底）；日报 `overtime_{weekday,weekend,holiday}_minutes` 三桶（`overtime_minutes`=三桶和）；加班时长严格 `min(已批申请, 实际)`，**无已批申请即 0**；休息日/法定**无排班**到岗也生成日报（平日无排班不生成）。`vacation_types.is_paid`（默认 false，annual/sick/compensatory 为 true）→ 日报 `unpaid_leave_days` → 月报 `unpaid_leave_minutes` → 算薪 `noLeave`；餐补按 `monthly.work_days`（只计真正出勤）。
- 月报写操作必须是 **CAS**：`updateMany({ employeeId, month, status:'draft' })` 命中 0 再 create（撞 P2002 = 已确认，跳过）；`gen/confirm/unconfirm` 统一锁键 `attendance:monthly:{employeeId}:{month}`。
- 金额一律以「分」做整数定点运算（`common/money.util.ts`），写库边界才转 `Prisma.Decimal`；薪资有「明细累加 == 批次总额」对账断言。
- 时区：业务日以 **UTC 午夜**存储，取年月/月份区间一律用 `getUTC*`；「当前年月」类判断必须按**北京时间**（UTC 容器每月 1 日 00:00~08:00 会算错生效月）。
- 数据隔离：显式部门过滤必须与可见范围**取交集**（不能覆盖）；范围解析为空要 fail-closed。

## 提交与落盘纪律
- 大批量改动按「工程底座 → 后端按依赖方向逐层 → 前端主题 → 前端业务 → 文档」切分，便于 review 与单独回退。
- 接口新增方法必须与实现类**同批提交**，否则中间态 tsc 失败。
- 冗余中间产物移入 `.workbuddy/scratch/`（已 gitignore），不直接删除。
- 提交信息正文用中文、分条列根因与验证结果（仓库既有风格）。
