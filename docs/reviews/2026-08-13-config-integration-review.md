# 配置与集成完整性审查（针对性）— 2026-08-13

> 范围：针对用户提出的 4 个具体问题（env 生产配置 / Redis 接入 / 外置打卡机对接 / 设置界面）以及前后端联调缺口，做代码实证核查。
> 基线：`8df006c` + 未提交 WIP（S04–S15）。与 `docs/reviews/2026-08-13-code-review-v2.md` 互补，不重复已列的坏味道。

---

## Q1：env 只有 2 个变量，生产配置（OSS/RDS/Redis）在哪？

**结论：确认缺失。生产所需变量一个都没定义，也没有 `.env.example` 模板。**

证据：
- `backend/.env` 仅含 `DATABASE_URL` + `JWT_SECRET`，全仓库无任何 `.env.example` / `.env.template`。
- `backend/src/app.module.ts:18`：`ConfigModule.forRoot({ isGlobal: true })` —— **没有 `validationSchema`、没有 `.env` 路径、没有类型化配置**。部署到生产若变量缺漏，应用会静默用代码里写死的默认值启动，而不是启动失败。
- 配置读取是"散弹打鸟"式 `process.env`，而非集中 ConfigService：
  - `backend/src/auth/auth.module.ts:12`：`secret: process.env.JWT_SECRET || 'dev-secret-change-in-production'`（JWT 密钥直接 env 硬读，且默认值是开发密钥！）
  - `backend/src/knowledge/knowledge.service.ts:9`：`private readonly previewSecret = process.env.PREVIEW_SECRET || 'default-preview-secret-change-me'`（文档预览密钥同样裸读 + 默认弱值）
- **完全不存在的变量**（代码里 grep 不到任何引用）：`OSS_*` / `ALIYUN_*` / `REDIS_*` / `SMTP_*` / `JWT_EXPIRES_IN` / `CORS_ORIGINS` / `PORT` / `RDS_HOST`。即 OSS、Redis、邮件、CORS、端口全部未接入也未留口子。

**风险**：当前代码无法连生产 RDS（只能 127.0.0.1）、无 OSS（上传/报表导出落地未知）、无 Redis、JWT 密钥默认开发值。部署即裸奔。

---

## Q2：Redis 是不是压根没接入？

**结论：确认——从头到尾没有接 Redis。** 代码里 `redis|ioredis|@nestjs/cache|cache` 零命中（排除 node_modules）。

影响面（本该用 Redis 却没用）：
- **JWT 无法即时吊销**：纯无状态 JWT，改密/离职/封号后旧 token 在过期前一直有效（无黑名单）。
- **无速率限制 / 防爆破**：登录接口无 throttle（撞库风险）。
- **打卡同步无分布式锁**：`punch-sync.service.ts` 用 `@Cron` 每 15 分钟跑（见 Q3）——多实例部署时每个实例都会并发拉设备，产生重复打卡记录（去重靠 DB 唯一键兜底，但浪费设备带宽）。
- **通知未读状态 / 报表快照**：无任何缓存层，每次都查库。

**建议**：单实例内网 HR 系统 Redis 非强制，但你明确要接，则应作为独立 ticket 引入 `ioredis` + `@nestjs/cache-manager`，至少覆盖 JWT 黑名单、登录限流、cron 分布式锁。

---

## Q3：外置打卡机的接口对接好了吗？

**结论：骨架约 70%，但"对接完成"谈不上。当前是「XFace 拉模式」单向集成，且存在硬伤。**

已存在（S05 相关）：
- `backend/prisma/schema.prisma:202` `PunchDevice` 模型（设备注册：ip/port/apiKey/enabled/status）+ `PunchSyncState` 同步状态表。
- `backend/src/attendance/punch-device.controller.ts:33` `@Controller('attendance/punch/devices')` —— **仅 CRUD**（create/list/get/update/delete），**无"立即同步"接口**。
- `backend/src/attendance/punch-sync.service.ts`：两个 cron —— `:204` `@Cron('0 */15 * * * *')` 每 15 分钟、` :215` `@Cron('0 30 0 * * *')` 每日；`syncNow()` 方法存在但**未通过 controller 暴露**。
- `backend/src/attendance/engine/xface-adapter.ts`：解析 XFace 设备 HTTP 响应（`ret/rows`、`emp_code` 等）。

**未对接 / 硬伤（逐条）：**
1. **仅拉模式（PULL），无推模式（PUSH）**：`fetchFromDevice` 用 `fetch('http://{ip}:{port}/api/attendance/getRecord?...')`（`punch-sync.service.ts:163`）主动去设备拉。若你的打卡机是**推模式**（设备主动回调我们的 Webhook，如中控/ZKTeco push 协议），**目前完全没有对应的入站接收端点**。
2. **apiKey 未实际使用**：`PunchDevice.apiKey` 存了但 `fetchFromDevice` 发请求时**既没带 Authorization 也没带 query 参数**（`:163-176`）。设备侧鉴权形同虚设。
3. **无"立即同步"触发入口**：前端 `punch-devices.tsx` 页面存在且调了后端 CRUD，但无法手动触发同步（后端 syncNow 没暴露 endpoint，只能等 15 分钟 cron）。
4. **响应格式不统一**：`punch-device.controller.ts:47` 返回 `{ code: 0, message: 'ok', data }`（旧格式），与 core-contracts 要求的 `{code,message,data}` 虽形似，但 `code:0` 而非业务码体系，且与"全局异常过滤器缺失"问题同源。
5. **表没有迁移**：`punch_devices` / `punch_logs` / `punch_sync_state` 无 migration（S09–S15 迁移缺口的延续），`prisma migrate deploy` 后这些表在 prod 库里**根本不存在**，cron 跑起来会直接报错。

**给你的直接回答**：如果你的打卡机是 **XFace 且支持被动拉取那个 `/api/attendance/getRecord` 接口**，那"自动每 15 分钟拉取"的逻辑是通的（但 apiKey 没校验、表没建）；如果是**推模式设备**，那**没对接**。需要你确认设备型号/协议。

---

## Q4：设置界面呢？还是从 env 中配置？

**结论：两者皆无。** 既没有任何「设置」页面，也没有 env 驱动的配置管理，更没有集中配置服务。

证据：
- 后端无 `settings` 模块；`backend/src/system/system.controller.ts` 只有 `logs / broadcasts / users` 三类接口，**没有任何 config/setting 端点**。
- 前端无 `settings` feature 目录（features 下只有 approval/attendance/customer-service/employee/expense/knowledge/payroll/system）。
- 配置现状 = 散落各模块的 `process.env.X` 裸读（见 Q1）。无 ConfigService 封装、无校验、无 UI。

**给你的直接回答**：现在所有配置都"硬编码在 env 里 + 代码里写死默认兜底"，且**没有任何设置界面**。如果你想要"管理员在网页上改配置"的能力，需要新建 `settings` 模块（后端 config 表/接口 + 前端设置页），这块当前完全空白。

---

## 附加发现：前后端联调缺口（你提到"未和前端完成对接"）

后端 13 个模块 vs 前端 8 个 feature，对照：

| 后端模块 | 前端 feature | 状态 |
|---|---|---|
| approval | approval | ✅ |
| attendance | attendance | ✅（含 punch-devices 页，调 CRUD） |
| employees | employee | ✅ |
| reimbursement | expense | ✅ |
| knowledge | knowledge | ✅ |
| payroll | payroll | ✅ |
| auth | login | ✅ |
| **notification** | — | ❌ **后端有，前端无页面**（用户收通知但界面看不到） |
| **reports** | — | ❌ **后端有，前端无入口**（报表后端已实现，前端无菜单） |
| system | system | ⚠️ 仅 logs/broadcasts/users，无设置 |
| — | **customer-service** | ❌ **前端有客服模块，后端完全无对应**（前端调了不存在的接口会 404/500） |

**关键联调断裂（dev 环境直接跑不通）**：
- `frontend/src/lib/request.ts:4`：`baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'`
- 但 `frontend/next.config.*` **没有任何 `rewrites`/proxy**，也无 `middleware.ts`。即 dev 下前端请求 `/api/v1/*` 会被 Next 自己 404，**后端根本接不到**。prod 靠 `NEXT_PUBLIC_API_BASE_URL` 指后端域名能通，但 dev 联调是断的，且没有 `.env.example` 说明该变量。

---

## 优先级行动清单（建议下一轮按此开 ticket）

| 优先级 | 项 | 对应问题 |
|---|---|---|
| P0 | 补 `punch_devices/punch_logs/punch_sync_state` 等 S09–S15 缺失 migration | Q3-5 / 历史 migration 脱节 |
| P0 | 前端 dev 代理：在 `next.config` 加 `/api/v1` → backend 的 rewrites，或补齐 `.env.example` 的 `NEXT_PUBLIC_API_BASE_URL` | 联调断裂 |
| P0 | 建 `.env.example` 模板，列出 RDS/OSS/Redis/JWT_EXPIRES/CORS 等全部变量 + `ConfigModule` 加 `validationSchema` | Q1 |
| P1 | 确认打卡机协议：推模式→补入站 Webhook 端点；拉模式→`fetchFromDevice` 带 apiKey、暴露"立即同步" endpoint | Q3 |
| P1 | 引入 Redis（ioredis）：JWT 黑名单 + 登录限流 + cron 分布式锁 | Q2 |
| P2 | 新建 `settings` 模块（后端 config 接口 + 前端设置页），统一取代散落 `process.env` | Q4 |
| P2 | 补前端 notification / reports 页面；下线或对接前端 customer-service 模块 | 联调缺口 |

> 说明：本报告只核查了用户点名的 4 类问题 + 联调缺口，未覆盖业务正确性与坏味道（详见 `2026-08-13-code-review-v2.md`）。
