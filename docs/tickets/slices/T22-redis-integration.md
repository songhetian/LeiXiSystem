# T22 — Redis 接入（登录限流 + 健康检查）

**日期**：2026-08-13
**状态**：✅ 已完成（2026-08-13）
**依赖**：ioredis@^6（已装）、本地 Redis 服务在线（PONG）
**范围（用户确认）**：Redis 用于「登录失败限流（防爆破）」+「/health 含 redis ping」。Redis 为可选组件——`REDIS_URL` 缺失时降级为 no-op，不阻断启动。

## 垂直切片
- **T22.1** RedisModule(@Global) + RedisService：从 `REDIS_URL` 连接，ping 返回 PONG；缺失时 `isEnabled=false`、ping 返回 null、启动不崩。
- **T22.2** 错误码 + env：新增 `RATE_LIMIT_EXCEEDED=5006`(HTTP 429)；`REDIS_URL` 纳入 env schema(可选)。
- **T22.3** LoginRateLimitService：`assertNotBlocked / registerFailure / reset`，基于 Redis incr+expire 滑动窗口；纯逻辑单测（mock RedisService）。
- **T22.4** 接入 AuthService.login：失败计数、超限抛 429、成功重置；单测（mock Prisma/Redis/Jwt）。
- **T22.5** /health 含 redis 状态（up/down/disabled）：轻量 e2e。

## 验证
- 各切片单测全绿；真实 Redis 可用时 ping 集成通过。
- 回归：auth 登录既有行为不变（仅多一层限流）。

## 决策
- Redis 可选：无 `REDIS_URL` 时登录限流降级为直通（不抛错），保证无 Redis 环境也能跑。
- 限流维度：按 `username` 计数（防账号爆破为主）；窗口 15 分钟，上限 5 次。
