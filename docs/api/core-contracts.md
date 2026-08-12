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

| 码段 | 模块 |
|---|---|
| 1001~1099 | 员工域：1001 工号已存在、1002 员工不存在、1003 手机号格式错误、1004 员工已离职 |
| 2001~2099 | 考勤域：2001 班次时间冲突、2002 排班重复、2003 打卡记录重复导入、2004 补卡申请已存在、2005 排班未配置 |
| 3001~3099 | 薪资域：3001 该月份批次已存在、3002 项目编码重复、3003 批次已发布不可修改、3004 批次未确认不可发布、3005 员工无基本工资配置 |
| 4001~4099 | 报销域 |
| 5001~5099 | 认证/系统：5001 用户名或密码错误、5002 token 无效/过期、5003 无权限访问该数据（行级） |
| 6001~6099 | 文件域：6001 上传失败、6002 文件类型不允许、6003 超过大小限制 |

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

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /attendance/daily | 日报列表（范围：startDate/endDate/employeeId/departmentId；异常标记） |
| GET | /attendance/monthly | 月报列表（month/employeeId/departmentId） |
| POST | /attendance/makeup | 补卡申请（C4，走审批流） |
| GET | /shifts | 班次列表（含跨天标志 isNextDay，C1） |
| POST | /shifts | 新增班次 |
| GET | /schedules | 排班列表（月历视图数据，D2） |
| POST | /schedules/batch | 批量排班 |
| GET/POST | /leave-records | 请假申请/列表 |
| GET/POST | /overtime-records | 加班申请/列表 |
| POST | /attendance/punch/import | 打卡流水 CSV 导入（兜底，重复导入报 2003） |
| POST | /attendance/punch/sync | 触发 XFace600 HTTP API 增量拉取（LastSyncTime，定时任务自动执行） |

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
