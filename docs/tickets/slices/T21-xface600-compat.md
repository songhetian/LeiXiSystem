# T21 — XFace600 打卡机兼容性接入（PUSH 接收端点）

**日期**：2026-08-13
**状态**：⏸ 待用户确认设备模式（A=Push 接收端点 / B=拉取 REST），冻结中，未实现
**依赖**：pending-decisions.md A6（设备=熵基 XFace600）、T20（apiKey 透传，Push 模式下需重做位置）
**阻塞项**：用户需确认设备固件走 **A. 出厂默认 Push（设备推我们）** 还是 **B. 服务端拉取 REST API**

---

## 0. 兼容性验证结论（已用契约测试证明，RED）

当前代码（`engine/xface-adapter.ts` + `punch-sync.service.ts`）**不兼容真实 XFace600**。
证据测试：`backend/tests/xface600-compat.unit.test.ts`（故意 RED，未提交，作契约证据保留）。
运行：`npx jest xface600-compat` → 当前抛 `XFace API response is null or invalid`，解析器不识别真实设备格式。

### 四个具体错配

| 维度 | 当前代码（假设） | 真实 XFace600（ZKTeco ADMS/Push） | 后果 |
|---|---|---|---|
| **方向** | 服务端主动 GET 拉取 | 设备主动 POST 推送 到我们 | 定时任务永远拉空 |
| **端点** | `/api/attendance/getRecord?lastSyncTime=` | `/iclock/cdata?SN=…&table=ATTLOG` | 端点不存在 |
| **格式** | JSON `{ret, rows:[{emp_code,…}]}` | **tab 分隔纯文本** `1001\t2026-08-13 09:05:00\t1\t15` | 解析器直接抛错 |
| **鉴权** | T20 的 `key=` query 参数 | **无鉴权**（协议本身不设） | T20 的 apiKey 在 Push 下无意义，需重做 |

> 关键纠正：`pending-decisions.md` A6 原写「XFace600 HTTP API **增量拉取**」是**错的**——
> XFace600 出厂默认 **Push 模式**（设备主动推记录给服务端）。S05 把「服务端期望设备回的 JSON」误当成「服务端去拉的格式」。

---

## 1. 实现计划（待用户选 A 后落地，TDD 垂直切片）

### 选 A：标准 Push（推荐，出厂默认）
1. **新增入站端点** `POST /iclock/cdata`（公开、关闭 CSRF/body 解析用 raw text）：
   - `table=ATTLOG` → 解析 body 的 tab 分隔行 `员工号\t时间\t状态\t验证方式`；
   - 设备号从 query 参数 `SN` 取（不在 body 内）。
2. **握手端点** `GET /iclock/cdata` → 回纯文本配置 `GET OPTION FROM: {SN} ...`。
3. 收到后回 `OK`（或 `OK: {count}`），设备据此停止重传。
4. 转成现有 `XFaceRecord` 落 `punch_logs`（复用既有落库逻辑）。
5. U 盘 CSV 导入兜底保持不变。
6. T20 的 `apiKey` 透传段落：Push 模式下从 `fetchFromDevice` 移除或改到正确鉴权位置（若设备启用 ADMS 云端 key 则另议）。

### 选 B：服务端拉取 REST API
- 需用户贴设备手册里该接口的真实路径 + 响应样例；
- 照真实格式改 `fetchFromDevice` + `parseXFaceRecords`（T20 的 `key=` 也需对齐手册字段名）。

---

## 2. 验证（GREEN 标准）
- `xface600-compat.unit.test.ts` 翻绿：真实 Push 报文（tab 分隔）被解析为打卡记录，设备号从 SN 取。
- 全量回归无破坏（punch-* 系列 suite）。

---

## 3. 当前冻结项
- ✅ 兼容性分析 + 错配表 + 实现计划（本文档）
- ✅ RED 契约测试 `backend/tests/xface600-compat.unit.test.ts`（保留，未提交）
- ⏸ 等待用户确认 A / B 后，按 §1 落地 T21
