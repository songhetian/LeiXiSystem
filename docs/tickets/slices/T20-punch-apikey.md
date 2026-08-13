# T20 — 打卡机 apiKey 接入（拉模式补全）

**日期**：2026-08-13
**状态**：🔧 进行中
**依赖**：决策 A6（已确认 2026-08-12）：熵基科技 XFace600，主路径 HTTP API 增量拉取，无需推模式

## 背景
- `docs/pending-decisions.md` A6：打卡机 = XFace600，PULL（HTTP `/api/attendance/getRecord` 增量拉取），LastSyncTime 游标，15min 定时 + 每日 00:30 完整性校验；U 盘 CSV 兜底。
- `docs/reviews/2026-08-13-config-integration-review.md` P1：
  1. `PunchDevice.apiKey` 已存库，但 `fetchFromDevice` 发请求时**既没带 Authorization 也没带 query 参数** → 设备侧鉴权形同虚设。
  2. 当前仅有 PULL 模式，已是 A6 既定主路径，无需补 PUSH（除非后续换推模式设备）。
- 目标：把 `device.apiKey` 真正透传到设备请求，闭合 P1 第 1 项。

## 协议假设（待用户确认）
- XFace/ZKTeco 拉取端点常见做法：apiKey 作为 **query 参数 `key`** 传递。本 ticket 默认采用此方式。
- ⚠️ 若设备手册要求 `Authorization` 头（`Bearer <key>`）或别的字段名，改为对应位置即可（1 行改动），测试同步调整。

## 垂直切片（TDD 红-绿-重构）
- **T20.1（曳光弹）**：`fetchFromDevice` 接受 `apiKey` 并将其写入请求 URL（query `key=`）；mock `global.fetch` 断言请求携带 key。
- **T20.2**：`syncFromDevice` 把 `device.apiKey` 透传给 `fetchFromDevice`；通过 `syncNow` 行为测试（mock prisma + spy `fetchFromDevice`）断言 key 从设备流向请求。

## 验收
- 单测 T20.1 / T20.2 全绿
- 回归：punch-sync / punch-logs e2e 无破坏
- `fetchFromDevice` 在无 apiKey 时行为不变（向后兼容，旧设备可不设 key）
