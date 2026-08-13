# S11 · 工资条自助 + 通知

## What to build
员工自助查看工资条（仅本人）+ HR 管理工资条；发布（S10）后生成工资条并推送通知（Socket.IO）；已查看状态追踪（C7 撤回限制依据）。

## 五维清单
- **数据库**：payslips/payslip_*（保留表迁移，扩展 viewed_at 查看状态）
- **后端接口**：GET /payslips/me（员工自助）、GET /payslips（HR 管理，部门隔离生效）、POST /payslips/:id/view（标记已查看）
- **业务算法**：查看状态机（未查看→已查看，撤回限制依据 C7）；通知推送（Socket.IO 网关）
- **前端页面**：我的工资条页（明细+调整值展示）、工资条管理页、通知中心（实时）
- **单元测试**：API e2e（本人/HR 权限、已查看状态、通知送达）

## Acceptance criteria
- [ ] 员工只能看到自己的工资条；HR 按部门数据隔离可见
- [ ] 发布后通知实时推送，员工查看后状态更新
- [ ] 已查看的工资条不可撤回（走补发/更正）

## Blocked by
- S10 算薪引擎 + 批次

---

## 进度 · TDD 后端实现（已完成）

### 完成项
- [x] **数据库**：新增 `payslips` 表（含 status/viewedAt/itemsJson 字段）
- [x] **工资条生成**：发布算薪批次时自动生成工资条（从 `payroll_details` 聚合）
- [x] **员工自助 API**：
  - `GET /payslips/me` — 我的工资条列表（仅本人）
  - `GET /payslips/me/:id` — 工资条详情（含明细项）
  - `POST /payslips/me/:id/view` — 标记已查看（状态 unviewed → viewed）
- [x] **HR 管理 API**：
  - `GET /payslips` — 工资条列表（按部门数据隔离）
- [x] **权限隔离**：员工只能看自己的工资条（越权返回 4004）
- [x] **e2e 测试**：5 项全部 PASS
- [x] **全量测试**：101/101 通过（`npx jest --runInBand`）

### 测试数据
- 测试文件：`tests/payslips.e2e.test.ts`（5 e2e）
- 错误码：4001（批次不存在）、4004（工资条不存在）

### 未实现（后续切片）
- [ ] 通知推送（Socket.IO 网关）
- [x] 通知中心（REST API + 数据库）
- [x] 撤回 API（仅未查看可撤回）— 已在 S10 迭代二中实现
- [ ] 前端我的工资条页
- [ ] 前端工资条管理页
- [ ] 前端通知中心页面

---

## 迭代二 · 通知中心（TDD 完成）

### 完成项
- [x] **数据库模型**：`Notification` 表（notifications）
  - 字段：userId, title, content, type, read, readAt
  - 关联：relatedId, relatedType（业务关联）
  - 索引：userId, userId+read, createdAt
- [x] **通知服务**：`src/notification/notification.service.ts`
  - 列表（分页 + 已读/类型筛选）
  - 未读数量统计
  - 单条标记已读（幂等）
  - 全部标记已读
  - 单条创建 + 批量创建
  - 事件发布：`notification.created`（供 Socket.IO 消费）
- [x] **通知 API**：`/api/v1/notifications`
  - `GET /` 我的通知列表
  - `GET /unread-count` 未读数量
  - `POST /:id/read` 标记已读
  - `POST /read-all` 全部标记已读
- [x] **数据隔离**：用户只能查看/操作自己的通知
- [x] **权限校验**：越权操作他人通知返回 403

### 测试数据
- e2e 测试：`tests/notifications.e2e.test.ts`（7 e2e）
  - 列表分页/时间倒序/数据隔离
  - 未读统计
  - 单条已读/全部已读/越权防护
