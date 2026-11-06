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
- **审批节点「谁审批」口径（ADR-0023）**：`type` 支持 `user`（指定人员，落 `approval_workflow_nodes.user_id`）/ `role` / `group` / `department_manager` / `initiator`。解析审批人的**四处必须同源**：`approval.service#notifyApproversForNode`（待办通知）、`#canUserApprove`（审批/转交/加签鉴权）、`#buildTodoWhere`（待办中心）、`ApprovalReminderService#getApproverIdsForNode`（超时催办）；漏一处即「能审但收不到通知 / 看不到待办」。`type='user'` 且 `user_id` 为空必须 fail-closed（不产生待办，也不能退化成全员可审）。`startInstance`/`resubmit` 构造 `engineNodes` 时**必须把 `userId` 与 `approvalGroupId` 一起传给引擎**——引擎只读 `node.userId` / `node.approvalGroupId || node.groupId`，不透传等于节点在链上展开为空（`group` 节点曾因此长期 `approvers` 为空）。
- **职责授权方向（ADR-0024 + ADR-0025）**：`role_workflows` 是「流程 → 适用角色」，主键 `(workflow_id, role_id)`；**同一角色可以出现在同模块的多条流程里**（请假/加班/补卡都适用「普通员工」是常态）—— 早先的「同 module 一角色一条 + 冲突码 6317」已删除，它让「一键把同一组角色套到全部流程」永远失败（考勤 4 条、员工事务 6 条同属一个 module），而它想防的「随机解析」早由 `resolveWorkflowForUser` 的 `orderBy workflowId + take 1` 固化成确定性规则。批量写入走 `PUT /approval/role-bindings/batch`（`mode: replace|append|remove`，单事务，13 条流程 ≈170ms）；前端不要循环调单条接口，中途失败会留下「一半新一半旧」。脚本/接口抛业务错误要带明细时**必须用 `detail` 字段**：`all-exceptions.filter` 会用 `messageOf(code)` 覆盖 message，只有 `detail` 能拼成「中央文案（明细）」。`approval_workflows.code` 仍唯一 → 一业务一流程，所以绑定只在业务未配置流程时影响路由。

## 前端样式规约
- **Arco 2.x 类名必须先取证再写**：真相在 `node_modules/@arco-design/web-react/dist/css/arco.css` + `es/<Comp>/*.js`（DOM 上真正拼出的类）。Input 实际 DOM 是 `.arco-input-inner-wrapper > input.arco-input`（焦点态由 JS 打 `-focus` 类），**`.arco-input-wrapper` 不存在**；写在死类名上的样式静默失效（已出现多次）。常见真名：`.arco-form-label-item`(字号在 `> label`)、`.arco-modal-title`/`-content`、`.arco-drawer-content`、`.arco-table-row-checked`、`.arco-table-cell-expand-icon`、`.arco-table-no-data`、`.arco-select-focused`(边框在 `-view`)、`.arco-dropdown-menu`/`-item`、`.arco-radio-text`/`.arco-checkbox-text`、`.arco-card-header-extra`。
- **闸门**：`frontend/src/app/__tests__/arco-classnames.test.ts` 校验「自有 CSS 的 `.arco-*` 必须存在于 arco.css 或 DOM_ONLY 白名单」+「每个 `.lx-*` 至少被一处 tsx 引用」（防工具类残骸）。改样式后必跑。
- **特异性三级检查**：类名对 ≠ 生效。① 属性可能写在下级元素（`.arco-form-label-item > label` (0,1,1)）；② Arco 可能用组合选择器（`.arco-select.arco-select-focused .arco-select-view` (0,3,0)、`thead > .arco-table-tr > .arco-table-th`、`.arco-card-size-default .arco-card-header`）；③ 同权重靠**本文件后加载**胜出，非必要不加 `!important`（现 18 处，均注明竞争规则）。④ **状态类选择器普遍带 `:not(...)`**：`.arco-btn-secondary:not(.arco-btn-disabled)`、`.arco-btn-text:not(.arco-btn-disabled)` 都是 (0,2,0)，单类选择器 `.arco-btn-secondary{background}` 恒输 —— 这条曾长期静默失效，暗色下露出 Arco 自带的浅灰底（rgb(242,243,245)）变成一整块发白按钮；修法是补 `.arco-btn` 前缀到同档特异性。
- **主题化色值一律走 token**：`--lx-*` 在 `:root`/`[data-theme="dark"]` 成对定义；登录卡片曾硬编码 `rgba(255,255,255,.88)`，暗色下变成浅字压白卡（≈1.1:1）。现为 `--lx-login-card-bg`，`design-tokens-a11y.test.ts` 有对比度闸门。
- **不用就删**：Ribbon/Countdown/Steps/Transfer/Cascader/BackTop/AutoComplete/VirtualList 及独立 Menu 全仓 0 处使用，覆写已整段删除；侧栏是自研 `.side-item`，唯一的 `<Menu>` 在 Dropdown 内（prefixCls 变成 `arco-dropdown-menu`），故 `.arco-menu-*` 一条都命中不了。
- **禁止用通配符清除焦点样式**：`.xxx *:focus-within{outline:none}` 会把祖先的 `:focus-within` 光晕一起清掉（登录页曾因此整页无焦点提示，违反 WCAG 2.4.7）。输入框用 `--lx-focus-ring`（3px 品牌光晕），复选框描边挂 label，其余交全局 `:focus-visible`。
- **全屏遮罩禁止 `backdrop-filter`**：`.arco-modal-mask` 曾加 `blur(4px)`，遮罩淡入的每个动画帧都要把整页重采样一次，叠加大表格 + keep-alive 多页签在 2K 下直接卡成「所有弹窗都有延迟」。压暗用 `var(--lx-mask)` 即可。
- **整站已无 `backdrop-filter`**（2026-11-06）：`.cmdk-mask`(6px) / `.cmdk-panel`(20px saturate) / `.app-header`(12px) / `.page-tabs`(8px) 全部移除。顶栏与页签不是 `position:fixed`、下方没有内容滚过，模糊只是把纯色底再模糊一遍，零视觉收益却各生成一个合成层，任何全屏浮层出现时都要重新合成。`--lx-glass-*` token 随之删除，命令面板改实色卡。
- **浮层入场动画禁止 `scale`**：Arco Modal 默认 `.zoomModal-*` 是 `scale(0.5)→1`、400ms、`cubic-bezier(.3,1.3,.3,1)` 过冲曲线，整棵子树（表单/大表格）每帧重新光栅化，弹窗越大越卡。已覆盖为「opacity + translateY(8px)」160ms；遮罩 `fadeModal` 同步收到 160ms。命令面板同理去掉 framer-motion 的 scale。
- **业务域色 `GROUP_TONE`（`config/navigation.tsx`）是全站唯一的分类配色**：常用=蓝、人事=青、流程=紫、薪酬=橙、工具=靛、设置=中性。侧栏分组点 / 命令面板分组点+条目图标 / 首页快捷入口图标 / 面板标题竖条 / KPI 卡标签点 全部取自它（`toneOfGroup` / `toneOfPath`）。新增页面不要自己挑色相；未登记分组回落中性。文字/图标态取 `--lx-teal-text` 等深档（4.5:1），亮档 `--lx-teal` 只给图表与圆点。
- **登录页/首页曾因「unslop」删色过狠导致观感单调**：克制的做法不是全灰，而是把颜色放回小面积的分类记号（6px 点、3px 竖条、34px 图标块），卡片与背景保持中性。
- **Arco `Select` 用 `options` 数组时的搜索陷阱**：`extendChildren`（`es/Select/utils.js`）只把 `value/disabled/extra` 透传给内部 Option，自定义字段全被丢弃，`filterOption(input, option)` 的 `option` 是 **React 元素**（要读 `option.props.extra` / `.props.children`）。想按「别名/成员名」搜，搜索串必须塞进 `option.extra`。
- **不要装饰性 AI 味（2026-11-06 unslop）**：品牌面禁止 hue→hue 渐变（蓝→紫）、`blur()` 光团、网格纹理、`background-clip:text` 渐变文字、半透明玻璃卡；应用内禁止时段问候语（「早上好，欢迎回来」）、每个入口一个色相的图标、KPI 卡上的图标填充。`--lx-tone-*` 已整组删除；purple/teal/coral/pink/indigo/emerald 只作业务分类编码（绩效周期类型、OKR 范围、附件类型），不再用于图标着色。中文标题不做负字距、不做 `text-transform:uppercase`（对中文无效）。
- 一次性的存量数据回填写成**只含 DML 的新 migration**（幂等 `WHERE 旧值<>新值`），且**不得改 `updated_at`** —— 否则会把 ApprovalReconciler 的「最近 1 小时终态单」窗口撑大、重放陈年事件。验证手法：`$transaction` 内逐条执行后抛错强制回滚（不落库）。

## 本地环境与演示账号
- 演示账号：`admin/123456`（全部权限）、`staff/123456`（员工视角）；密码统一 123456，bcrypt cost 10。
- 种子入口：`backend/prisma/seed.ts`（它调 `seed-real-data.ts` 的 seedRealData；后者只导出不执行，直接跑无效）。种子幂等：员工=30 部门=4 日报=644 薪资批次=2。
- 本地 Redis：`"D:\Program Files\FlyEnv-Data\env\redis\redis-server.exe" --port 6379 --requirepass 123456`（Docker Desktop 未开时用）；后端启动：`cd backend && npx dotenv -e ../.env -- node --watch --require ts-node/register src/main.ts`（main.ts 的 dotenv 找 CWD 的 .env，必须借 dotenv -e 注入根目录 .env）。
- 登录体系：token 走 HttpOnly cookie（access_token）+ body.csrfToken，请求需 X-CSRF-Token。
- 登录失败文案统一在 `backend/src/common/error-messages.ts`（错误码→文案映射，会覆盖 service 里的 message）——2026-10-22 已把 AUTH_INVALID_CREDENTIALS 从「凭据错误」改为「账号或密码错误」。
- ⚠️ leixin_v2 本地库曾是旧版遗留结构（与迁移基线不兼容），2026-10-22 已整库 RENAME 备份到 `leixin_v2_old_backup` 后按迁移重建 + 种子；回滚把表搬回即可。

## 提交与落盘纪律
- 大批量改动按「工程底座 → 后端按依赖方向逐层 → 前端主题 → 前端业务 → 文档」切分，便于 review 与单独回退。
- 接口新增方法必须与实现类**同批提交**，否则中间态 tsc 失败。
- 冗余中间产物移入 `.workbuddy/scratch/`（已 gitignore），不直接删除。
- 提交信息正文用中文、分条列根因与验证结果（仓库既有风格）。
