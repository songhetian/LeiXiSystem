# API 契约 v0.1（已确认 A3/A4/A7）

> Step 2 后端与 Step 3 前端以本文档为对接依据；实现时可微调字段，但**契约结构（响应格式/分页/错误码）不得变更**。

## 1. 通用约定

- Base URL：`/api/v1`（Nginx 反代到 apps/server）
- 请求体 / 响应体：JSON
- 统一响应：

```json
{ "code": 0, "message": "ok", "data": { } }
```

- 分页：`GET ?page=1&pageSize=20` → data 内返回 `{ list, total, page, pageSize }`
- 排序：`?sort=field`（升序）或 `?sort=-field`（降序）
- 日期：ISO 8601（`2026-08-12` / `2026-08-12T09:00:00+08:00`）
- 金额：字符串或 number 两位小数，前后端统一用 decimal（禁止 float）

## 2. 错误码体系

| 范围 | 含义 |
|---|---|
| code=0 | 成功 |
| code≠0 | 业务错误，message 给用户可读提示 |

HTTP 状态语义（传输层）：`401` 未认证 / `403` 无权限 / `404` 不存在 / `422` 校验失败 / `500` 服务异常。

业务码（4 位）：

| 码段 | 模块 | 明细 |
|---|---|---|
| 1001~1099 | 员工域 | 1001 工号已存在、1002 员工不存在、1003 手机号格式错误、1004 员工已离职 |
| 2001~2099 | 考勤域-通用 | 2001 班次时间冲突/名称重复、2002 排班重复、2003 打卡记录重复导入、2004 月报已确认、2005 月报不存在、2006 打卡设备离线、2007 设备编号重复/不存在 |
| 2101~2199 | 考勤域-补卡 | 2101 补卡申请不存在、2102 员工信息不存在、2103 状态不可操作、2104 已提交审批、2105 未提交审批 |
| 2201~2299 | 考勤域-请假/加班/休假 | 2201 休假额度不存在、2202 额度不足、2203 请假记录不存在、2204 请假状态无效、2205 请假已提交、2206 请假未提交、2207 加班记录不存在、2208 加班状态无效、2209 加班已提交、2210 加班未提交、2211 加班未审批通过、2212 加班已兑换调休、2213 兑换时长超限、2214 员工信息不存在 |
| 3001~3099 | 薪资域 | 3001 批次已存在、3002 项目编码重复、3003 批次已发布、3004 批次未确认、3005 员工无工资配置 |
| 4001~4099 | 报销域 | 4001 缺少参数、4002 不支持的类型、4003 不支持的格式、4004 任务不存在、4005 文件未就绪 |
| 5001~5099 | 认证/知识库 | 5001 凭据错误/分类不存在、5002 token 无效/文章不存在、5003 无权限访问该数据（行级） |
| 6001~6099 | 系统-公告 | 6001 公告不存在、6002 公告状态错误、6003 接收人参数无效 |
| 6401~6499 | 审批-审批组 | 6401 审批组不存在、6402 编码重复 |
| 7001~7099 | 通知 | 7001 通知不存在、7002 无权限操作 |

## 3. 核心模块契约

### 3.1 auth 认证

| 方法 | 路径 | 说明 | 请求 | 响应 data |
|---|---|---|---|---|
| POST | /auth/login | 登录 | `{ username, password }` | `{ user: { id, name, employeeId, roles, permissions }, accessTokenExpiresIn }`（JWT 存 httpOnly cookie） |
| POST | /auth/refresh | 刷新 token（cookie 内 refresh token） | — | `{ user }` |
| GET | /auth/me | 当前用户 | — | `{ user, permissions }` |
| POST | /auth/logout | 登出（黑名单落库，B6） | — | — |

### 3.2 employees 员工

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /employees | 列表（分页/搜索/部门过滤，C8 数据隔离生效） |
| POST | /employees | 新增（工号唯一校验 1001） |
| GET | /employees/:id | 详情 |
| PATCH | /employees/:id | 修改 |
| POST | /employees/:id/resign | 离职（记录离职日期，C2 计薪依据） |
| POST | /employees/import | Excel 批量导入（复用 exceljs） |
| GET | /employees/export | 导出（D3：>1 万行异步） |

核心字段：employeeNo、name、departmentId、positionId、hireDate、resignDate、salary（基本工资 DECIMAL）、phone、status。

### 3.3 attendance 考勤

| 方法 | 路径 | 说明 | 错误码 |
|---|---|---|---|
| GET | /attendance/daily | 日报列表（范围：startDate/endDate/employeeId/departmentId；异常标记） | |
| GET | /attendance/monthly | 月报列表（month/employeeId/departmentId） | 2004 已确认、2005 不存在 |
| POST | /attendance/makeup | 补卡申请（走审批流） | 2101~2105 |
| GET | /shifts | 班次列表（含跨天标志 isNextDay） | |
| POST | /shifts | 新增班次 | 2001 名称重复/时间冲突 |
| PUT | /shifts/:id | 编辑班次（部分字段更新） | 2001 |
| DELETE | /shifts/:id | 删除班次（被排班使用不可删） | 2001 |
| GET | /schedules | 排班列表（月历视图数据） | |
| POST | /schedules/batch | 批量排班 | 2002 重复 |
| POST | /schedules | 单条新增排班 | 2002 |
| PUT | /schedules/:id | 编辑排班 | 2002、5003 |
| DELETE | /schedules/:id | 删除排班 | 5003 |
| GET | /leave-records | 请假列表 | |
| POST | /leave-records | 请假申请 | 2201~2206 |
| POST | /leave-records/:id/submit | 提交请假审批 | 2203、2204、2205 |
| POST | /leave-records/:id/approve | 审批通过 | 2203、2206、2204 |
| POST | /leave-records/:id/reject | 审批拒绝 | 2203、2206、2204 |
| GET | /overtime-records | 加班列表 | |
| POST | /overtime-records | 加班申请 | 2207~2210 |
| POST | /overtime-records/:id/submit | 提交加班审批 | 2207、2208、2209 |
| POST | /overtime-records/:id/approve | 审批通过 | 2207、2210、2208 |
| POST | /overtime-records/:id/reject | 审批拒绝 | 2207、2210、2208 |
| GET | /vacation/balances | 休假额度列表（HR） | |
| GET | /vacation/balances/mine | 我的休假额度 | |
| POST | /vacation/convert | 加班兑换调休（管理员操作） | 2207、2211、2212、2213 |
| POST | /vacation/convert/mine | 加班兑换调休（员工自助） | 2214、2207、2211、2212、2213 |
| GET | /attendance/punch/devices | 打卡设备列表 | |
| GET | /attendance/punch/devices/:id | 打卡设备详情 | 2007 |
| POST | /attendance/punch/devices | 新增加卡设备 | 2007 编号重复 |
| PUT | /attendance/punch/devices/:id | 编辑打卡设备 | 2007 |
| DELETE | /attendance/punch/devices/:id | 删除打卡设备 | 2007 |
| POST | /attendance/punch/import | 打卡流水 CSV 导入（兜底，重复导入报 2003） | 2003 |
| POST | /attendance/punch/sync | 触发 XFace600 HTTP API 增量拉取 | 2006 设备离线 |

### 3.3.1 system 公告

| 方法 | 路径 | 说明 | 错误码 |
|---|---|---|---|
| GET | /broadcasts | 公告列表（管理端/员工端按可见范围过滤） | |
| GET | /broadcasts/:id | 公告详情 | 6001 |
| POST | /broadcasts | 创建公告（支持指定接收人） | 6003 |
| PUT | /broadcasts/:id | 编辑公告（已发布不可改） | 6001、6002、6003 |
| POST | /broadcasts/:id/publish | 发布公告 | 6001、6002 |
| DELETE | /broadcasts/:id | 删除公告 | 6001 |
| GET | /broadcasts/unread-count | 未读公告数 | |
| POST | /broadcasts/:id/read | 标记已读 | |

**接收人类型（recipientType）**：
- `all`：全员公告
- `department`：指定部门，需传 `recipientDepartmentIds: number[]`
- `user`：指定人员，需传 `recipientUserIds: number[]`

### 3.4 payroll 薪资

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | /payroll/items | 薪资项目列表/新增（编码重复报 3002） |
| PATCH | /payroll/items/:id | 修改项目 |
| POST | /payroll/runs | 创建批次（草稿；月份已存在报 3001） |
| GET | /payroll/runs | 批次列表 |
| GET | /payroll/runs/:id | 批次详情（含汇总） |
| GET | /payroll/runs/:id/details | 试算明细（按员工逐行，D1） |
| POST | /payroll/runs/:id/adjust | 添加调整项（C6 → payroll_adjustments） |
| POST | /payroll/runs/:id/confirm | 确认（3004 前置校验；D1 抽检 3 人） |
| POST | /payroll/runs/:id/publish | 发布 → 生成工资条 |
| POST | /payroll/runs/:id/recall | 撤回（C7：仅未查看状态） |
| GET | /payslips/me | 员工自助工资条 |
| GET | /payslips | 工资条管理（HR/超管，C8 生效） |

## 4. 校验规则（A7，Zod 落 shared）

| 字段 | 规则 |
|---|---|
| employeeNo | 唯一；`^[A-Za-z0-9-]{2,20}$` |
| phone | 中国手机号 `^1[3-9]\d{9}$` |
| 金额 | ≥0，两位小数（decimal） |
| 日期 | ISO date / datetime |
| 分页 | page ≥1、pageSize 1~100（默认 20） |

## 5. 认证细节（E1）

- access token：JWT，时效 2h，httpOnly cookie + `SameSite=Lax`
- refresh token：时效 7d，旋转（每次刷新换新）
- 写操作（POST/PATCH/DELETE）接口校验 CSRF token（登录时下发）
- 行级权限：后端统一按"可见部门范围"过滤（C8/5003）
