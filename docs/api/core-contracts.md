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

> 码段与 `backend/src/common/error-codes.ts` 一一对应，新增错误码必须同时更新本表与该文件（中文 message 在 `error-messages.ts`）。

| 码段 | 模块 | 明细 |
|---|---|---|
| 1001~1099 | 员工域 | 1001 工号已存在、1002 员工不存在、1003 手机号格式错误、1004 员工已离职、1005 员工未离职、1006 员工标签不存在、1007 标签名称已存在、1008 打卡定位不存在 |
| 2001~2099 | 考勤域-通用 | 2001 班次时间冲突/名称重复、2002 排班重复、2003 打卡记录重复导入、2004 月报已确认、2005 月报不存在、2006 打卡设备离线、2007 设备编号重复/不存在、2008 熵基设备接口调用失败、2009 排班不存在、2010 班次不存在、2011 该班次已被排班使用，无法删除、2012 异常规则不存在、2013 异常规则重名或冲突、2014 异常记录不存在、2015 阈值不能大于阈值上限、2016 扣款分钟数不能为负、2017 扣款规则不存在、2018 扣款规则重名或冲突、2019 员工或班次不存在 |
| 2101~2199 | 考勤域-补卡 | 2101 补卡申请不存在、2102 员工信息不存在、2103 状态不可操作、2104 已提交审批、2105 未提交审批、2110 补卡日期超出可补天数范围、2111 不能补未来日期的卡、2112 当月补卡次数已达上限 |
| 2201~2299 | 考勤域-请假/加班/休假 | 2201 休假额度不存在、2202 额度不足、2203 请假记录不存在、2204 请假状态无效、2205 请假已提交、2206 请假未提交、2207 加班记录不存在、2208 加班状态无效、2209 加班已提交、2210 加班未提交、2211 加班未审批通过、2212 加班已兑换调休、2213 兑换时长超限、2214 员工信息不存在、2215 假期类型不存在、2216 假期类型被休假额度引用不可删除 |
| 2301~2399 | 考勤域-月报 | 2301 日报已被月报锁定、2302 月报未确认 |
| 3001~3099 | 薪资域 | 3001 批次已存在、3002 计薪月报未确认、3003 批次已发布、3004 批次不存在、3005 员工无工资配置、3006 薪资项目编码重复、3007 薪资项目不存在、3008 抽检人数不足、3009 抽检员工无效、3010 批次状态无效、3011 工资条不存在、3012 存在已查看工资条不可撤回 |
| 3101~3199 | 绩效/OKR 域 | 3101 绩效周期不存在、3102 周期名称已存在、3103 周期状态无效（仅 draft/active/closed）、3104 周期日期无效、3105 仅草稿周期可删除、3106 绩效目标不存在、3107 绩效评估不存在、3108 OKR 目标不存在、3109 关键结果不存在 |
| 4000 | 通用参数校验（跨域） | 4000 请求参数校验失败（所有 zod 校验失败的统一码） |
| 4006~4099 | 报销域 | 4006 明细金额合计与总金额不一致、4007 用户不存在、4008 报销类型不存在、4009 报销单不存在、4010 当前状态不可操作、4011 已在审批中、4012 报销类型编码已存在、4013 报销类型已被占用不可删除、4014 报销单号生成冲突（4001~4005 原为报表/导出误用，已收归 4302~4306） |
| 4101~4199 | 财务域（预算/费用标准） | 4101 预算不存在、4102 费用标准不存在 |
| 4301~4399 | 报表/导出域 | 4301 只有失败的任务才能重试、4302 缺少导出参数、4303 不支持的导出类型、4304 不支持的导出格式、4305 导出任务不存在、4306 导出文件未就绪 |
| 5000 | 服务器内部错误（跨域） | 5000 未预期的服务端异常 |
| 5001~5099 | 认证/系统/知识库 | 5001 凭据错误、5002 token 无效、5003 无权限访问该数据（行级/部门隔离）、5004 知识库分类不存在、5005 知识文章不存在、5006 请求过于频繁、5007 Redis 未启用、5008 不支持的报表类型、5009 知识库附件非法、5010 文章未删除不可操作、5011 分布式锁获取失败、5012 CSRF token 缺失、5013 CSRF token 无效、5014 账号已停用、5015 知识库附件不存在、5016 原密码错误、5017 用户不存在、5018 文件不存在或已被删除 |
| 6001~6099 | 系统-公告 | 6001 公告不存在、6002 公告状态错误、6003 接收人参数无效、6004 用户非该公告接收人 |
| 6101~6199 | 系统-用户 | 6101 用户不存在、6102 用户名已存在、6103 用户状态无效、6104 密码强度不足、6105 用户未删除不可操作、6106 不能删除管理员账户 |
| 6201~6299 | 系统-角色 | 6201 角色不存在、6202 角色编码已存在、6203 不能删除管理员角色 |
| 6301~6399 | 审批-审批流 | 6301 审批流重复、6302 该审批流已有关联的审批实例，无法删除、6303 没有可用的审批节点、6304 当前无待审批节点、6305 重新提交次数已达上限、6306 审批用户不存在、6307 审批状态已变更，请刷新后重试、6310 审批流不存在、6311 审批实例不存在、6312 实例状态无效、6313 无审批操作权限、6314 该节点已处理、6315 审批流未删除不可操作、6316 审批流未启用 |
| 6401~6499 | 审批-审批组 | 6401 审批组不存在、6402 编码重复 |
| 7001~7099 | 通知 | 7001 通知不存在、7002 无权限操作、7003 通知标题不能为空、7004 请选择接收人员、7005 请选择接收部门 |
| 7101~7199 | 系统-部门/岗位 | 7101 部门名称已存在、7102 部门不存在、7103 不能将自己设为父部门、7104 该部门下有子部门不能删除、7105 该部门下有在职员工不能删除、7106 部门负责人不存在、7110 部门未被删除不可恢复、7120 岗位名称已存在、7121 岗位不存在、7122 该岗位下有员工不能删除 |
| 7201~7299 | 系统设置 | 7201 设置项不存在、7202 变更历史不存在、7203 回滚值与当前值相同 |
| 7301~7399 | 系统-工单客服 | 7301 工单不存在、7302 工单编号重复、7303 SLA 不存在、7304 SLA 名称已存在、7305 该 SLA 已被工单使用，无法删除 |
| 8001~8099 | 系统-字典 | 8001 字典编码已存在、8002 字典类型不存在、8003 字典项不存在 |
| 9001~9899 | 员工事务 | 9001~9003 入职登记、9101~9103 离职申请、9201~9203 转正申请、9301~9302 合同（9301 不存在 / 9302 已终止或过期）、9401~9403 申诉、9501 证书、9601~9603 奖惩（9601 不存在 / 9602 仅草稿可操作 / 9603 已提交审批）、9701 培训、9801~9803 调岗调薪（不存在 / 仅草稿可操作 / 已提交审批）、9811~9815 证明申请（9811 不存在 / 9812 仅草稿可操作 / 9813 已提交审批 / 9814 非审批通过不可标记完成 / 9815 仅草稿或待审批可取消） |

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
| PUT | /shifts/:id | 编辑班次（部分字段更新） | 2001 名称重复/时间冲突、2010 班次不存在 |
| DELETE | /shifts/:id | 删除班次（被排班使用不可删） | 2011 被排班使用、2010 班次不存在 |
| GET | /schedules | 排班列表（月历视图数据） | |
| POST | /schedules/batch | 批量排班 | 2002 重复 |
| POST | /schedules | 单条新增排班 | 2002 重复 |
| PUT | /schedules/:id | 编辑排班 | 2009 排班不存在、2002 重复、5003 |
| DELETE | /schedules/:id | 删除排班 | 2009 排班不存在、5003 |
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
| POST | /vacation/balances/initialize | 初始化年度休假额度（幂等，`vacation:manage`；与定时任务共用分布式锁 `vacation:initialize-balances`，锁不可得时 5011） | 5011 |
| GET | /vacation/statistics | 考勤统计（员工×月份应休/已休/剩余/加班时长） | |
| POST | /vacation/convert | 加班兑换调休（管理员操作） | 2207、2211、2212、2213 |
| POST | /vacation/convert/mine | 加班兑换调休（员工自助） | 2214、2207、2211、2212、2213 |
| GET | /vacation/types | 假期类型列表 | |
| POST | /vacation/types | 新增假期类型（`vacation:manage`） | 4000 |
| PUT | /vacation/types/:id | 编辑假期类型（`vacation:manage`） | 4000、2215 |
| DELETE | /vacation/types/:id | 删除假期类型（`vacation:manage`） | 2215、2216 |
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
