# T19 — 配置治理（env 校验 + .env.example + 前端 dev 代理）

**日期**：2026-08-13
**状态**：🔧 进行中
**依赖**：zod@3.25.76（backend 直接依赖）、@nestjs/config@4

## 背景（来自 config-integration-review P0）
- `ConfigModule.forRoot({ isGlobal: true })` **无 validationSchema** → 缺变量/错变量启动时静默或不明确报错。
- `.env` 仅 `DATABASE_URL` + `JWT_SECRET`，无 `.env.example`，无 OSS/RDS/Redis/SMTP/CORS 变量说明。
- 前端 `next.config.*` **无 rewrites** → dev 下 `/api/v1` 请求 404，前后端联调断裂（review 已确认）。

## 目标
1. **T19.1 env 校验 schema（zod）**：必填 `DATABASE_URL` / `JWT_SECRET`，类型与格式校验；非法/缺失 → 明确错误（fail-fast）。
2. **T19.2 接入 ConfigModule**：`forRoot({ validate: (c) => envSchema.parse(c) })`，非法 env 启动即抛错。
3. **T19.3 `.env.example`**：列出全部变量 + 注释，作为部署模板。
4. **T19.4 前端 dev 代理**：`next.config` rewrites `/api/v1/:path*` → `http://localhost:3001/api/v1/:path*`，打通 dev 联调。

## TDD 纪律
- 每个子行为：先写 RED（单元/集成，不依赖 DB），再写最少实现 GREEN，再下一个。
- 校验逻辑为纯函数（zod schema），单测不启 Nest；接入后补一个启动期集成测试。

## 验收
- env 校验单测全绿；非法 env 启动失败；`.env.example` 存在；前端 dev 代理规则存在且指向 3001。
