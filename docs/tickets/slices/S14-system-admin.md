# S14 · 系统管理（用户/角色/权限/日志/公告）

## What to build
系统管理闭环：用户管理（分配角色/部门）、角色与权限点管理（菜单+按钮，RBAC）、操作日志查询、公告发布。

## 五维清单
- **数据库**：users/roles/permissions/role_permissions/role_departments/user_departments/operation_logs/broadcasts/broadcast_recipients（保留表迁移）
- **后端接口**：用户 CRUD + 角色分配、角色 CRUD + 权限点勾选、GET /system/logs（操作日志）、公告 CRUD + 发布
- **业务算法**：权限点集合计算；操作日志 AOP 记录（写操作自动留痕）
- **前端页面**：system feature（用户管理/角色管理/权限点配置/日志页/公告页）
- **单元测试**：API e2e（角色变更后权限即时生效、日志记录完整）

## Acceptance criteria
- [ ] 用户/角色/权限点配置闭环，权限变更即时生效
- [ ] 核心写操作均有日志（操作人/时间/内容）
- [ ] 公告发布后全员可见（通知联动 S11）

## Blocked by
- S02 认证与权限

---

## 进度 · TDD 后端实现（已完成）

### 完成项
- [x] **数据库**：新增 2 张表 `operation_logs` / `broadcasts`
- [x] **操作日志 AOP 拦截器**：`OperationLogInterceptor`
  - 自动拦截所有写操作（POST/PUT/DELETE/PATCH）
  - 记录：操作人、模块、动作、方法、URL、IP、参数、结果、状态
  - 模块自动识别（system/employees/attendance/payroll/knowledge 等）
  - 异步记录，失败不影响主流程
- [x] **操作日志 API**：`GET /system/logs`（分页 + 按用户/模块/日期筛选）
- [x] **公告管理 API**：
  - `GET/POST/PUT/DELETE /system/broadcasts` — 公告 CRUD
  - `POST /system/broadcasts/:id/publish` — 发布公告
  - `GET /broadcasts` — 员工端查看已发布公告
- [x] **用户管理 API**：
  - `GET/POST/PUT /system/users` — 用户 CRUD
  - `POST /system/users/:id/roles` — 分配角色
- [x] **角色与权限 API**：
  - `GET /system/roles` — 角色列表（含权限点）
  - `GET /system/permissions` — 权限点列表
  - `POST /system/roles` — 创建角色
  - `POST /system/roles/:id/permissions` — 分配权限点
- [x] **权限控制**：system:view 可看，system:manage 可管理
- [x] **e2e 测试**：10 项全部 PASS
- [x] **全量测试**：126/126 通过（`npx jest --runInBand`）

### 测试数据
- e2e 测试：`tests/system-admin.e2e.test.ts`（10 e2e）
- 错误码：6001（公告不存在）、6002（公告状态异常）、6101（用户名已存在）、6102（用户不存在）、6201（角色编码已存在）、6202（角色不存在）

### 未实现（后续切片）
- [ ] 操作日志详情页
- [ ] 前端系统管理页面（用户/角色/权限/日志/公告）
- [x] 公告接收人表（全员/指定部门/指定人员）
- [x] 公告已读状态追踪

---

## 迭代三 · 公告指定接收人（TDD 完成）

### 完成项
- [x] **数据库模型**：`BroadcastRecipient` 表（broadcast_recipients）
  - 字段：broadcastId, recipientType(all/department/user), departmentId, userId
  - 索引：broadcastId / recipientType / departmentId / userId
  - 级联删除：删除公告同时删除接收人
- [x] **Broadcast 模型扩展**：新增 `recipientType` 字段（默认 all）
- [x] **公告创建/更新增强**：支持指定接收人
  - 全员公告（recipientType=all）：无需额外参数
  - 部门公告（recipientType=department）：需传 recipientDepartmentIds
  - 指定人员公告（recipientType=user）：需传 recipientUserIds
  - 校验：部门/人员类型必须传对应 ID 列表
  - 已发布公告不可修改接收人
- [x] **员工端公告可见范围过滤**
  - 列表仅返回：全员 + 所在部门 + 指定自己的公告
  - 未读数量按可见范围计算
- [x] **管理端详情返回接收人配置**

### 测试数据
- e2e 测试：`tests/broadcast-recipients.e2e.test.ts`（11 e2e）
- 覆盖场景：创建全员/创建部门/创建指定人员/参数校验/全员可见/部门可见/人员可见/未读计数/修改接收人/已发布不可改/详情返回接收人

---

## 迭代二 · 公告已读状态（TDD 完成）

### 完成项
- [x] **数据库模型**：`BroadcastRead` 表（broadcast_reads）
  - 字段：broadcastId, userId, readAt
  - 联合唯一：(broadcastId, userId)
  - 索引：userId
- [x] **公告服务增强**：`src/system/broadcast.service.ts`
  - `list()` 新增 `userId` 参数，返回每篇是否已读
  - `getDetail()` 新增 `userId` 参数，返回是否已读
  - `markRead()` 标记已读（upsert 幂等）
  - `unreadCount()` 未读公告数量
- [x] **公告接口增强**：
  - `GET /broadcasts` 列表返回 `read` 字段
  - `GET /broadcasts/:id` 详情返回 `read` 字段
  - `POST /broadcasts/:id/read` 标记已读
  - `GET /broadcasts/unread-count` 未读统计

### 测试数据
- e2e 测试：`tests/broadcast-read.e2e.test.ts`（8 e2e）
  - 标记已读/幂等/不存在处理
  - 列表/详情返回已读状态
  - 不同用户已读状态独立
  - 未读数量统计
