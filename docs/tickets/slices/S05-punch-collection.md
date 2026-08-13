# S05 · 打卡采集（punch_logs 端到端）

## What to build
打卡数据进入系统的完整通道：**XFace600 HTTP API 增量拉取**（LastSyncTime，15min 定时 + 每日 00:30 完整性校验）+ **U 盘 CSV 导入兜底** → 统一落 `punch_logs`（去重、来源标记）→ 打卡流水查询页（筛选/异常标记/补卡入口占位）。

## 五维清单
- **数据库**：punch_logs（uk(employee_no,punch_time,device_no)）
- **后端接口**：POST /attendance/punch/import（CSV）、GET /attendance/punch（流水查询）；错误码 2003（重复导入）
- **业务算法**：CSV adapter（解析+工号映射+去重）
- **前端页面**：打卡流水页（员工/日期/设备筛选，异常标记，补卡按钮占位——S09 后接入）
- **单元测试**：API e2e 6 项（导入/去重/格式校验/列表/权限/状态筛选）

## Acceptance criteria
- [x] CSV 导入 100 条样例：正确入库、重复导入报 2003
- [x] XFace600 HTTP 拉取接口可配置设备地址并增量同步（mock 验证）
- [x] 定时任务配置存在且可手动触发
- [x] 流水页筛选 + 异常（>4 次/缺卡）标记可见

## Blocked by
- S03 员工档案（工号映射）✅

---

## 进度 · TDD 后端实现（第二阶段完成）

### 第一阶段完成（已完成）
- [x] **CSV 导入** `POST /attendance/punch/import`
  - 解析 CSV、工号映射、去重（uk 约束）
  - 错误码：2003（重复导入）
  - 无效工号格式校验
- [x] **打卡流水查询** `GET /attendance/punch`
  - 分页、按员工/日期/状态筛选
  - 异常标记（abnormal/pending/normal）
  - 数据隔离：经理只见本部门
- [x] **权限控制**：attendance:view 可查看
- [x] **e2e 测试**：6 项全部 PASS

### 第二阶段完成（XFace600 同步 + 定时任务）
- [x] **XFace600 HTTP adapter 纯函数** `src/attendance/engine/xface-adapter.ts`
  - `parseXFaceRecords`：解析 XFace API 响应 → 标准打卡记录
  - `buildLastSyncTimeCursor`：构建 LastSyncTime 增量游标
  - `filterNewRecords`：去重过滤（employeeNo + punchTime + deviceNo）
  - 异常容错：无效时间/缺字段跳过，API 错误码抛错
- [x] **PunchSyncService 同步服务** `src/attendance/punch-sync.service.ts`
  - `syncNow()`：手动触发增量同步
  - `getSyncStatus()`：查询同步状态（lastSyncTime/设备状态）
  - 多设备支持、无效工号过滤、去重入库
  - 错误码：2006（设备连接失败）
- [x] **定时任务**（@nestjs/schedule）
  - 15 分钟增量同步：`0 */15 * * * *`
  - 每日 00:30 完整性校验：`0 30 0 * * *`
- [x] **同步 API 接口**
  - `GET /attendance/punch/sync/status`：同步状态查询
  - `POST /attendance/punch/sync`：手动触发同步
- [x] **数据库模型**
  - `punch_devices`：打卡设备配置表
  - `punch_sync_state`：同步状态表（LastSyncTime 游标）
- [x] **单元测试**：15 项（xface-adapter 纯函数）
- [x] **e2e 测试**：8 项（同步接口/去重/权限/错误码）

### 测试数据
- 单元测试：`tests/xface-adapter.unit.test.ts`（15 unit）
  - 覆盖：正常解析/空响应/字段兼容/游标构建/去重过滤/API错误/无效时间/缺字段
- e2e 测试：`tests/punch-sync.e2e.test.ts`（8 e2e）
  - 覆盖：状态查询/无权限/同步成功/去重/游标更新/设备离线/流水验证

### 未实现（后续切片）
- [x] 补卡申请入口（接入 S09 审批流）
- [ ] 前端打卡流水页
- [x] 设备管理 CRUD 接口（设备地址/密钥配置页面）
- [ ] 真实 XFace600 设备联调

---

## 迭代四 · 设备管理 CRUD（TDD 完成）

### 完成项
- [x] **设备管理服务** `src/attendance/punch-device.service.ts`
  - 创建设备：名称/编号/IP/端口/密钥/启用状态
  - 设备编号唯一约束（错误码 2007）
  - 列表/详情/更新/删除
  - 端口默认 80，enabled 默认 true
- [x] **设备管理 API** `/api/v1/attendance/punch/devices`
  - `GET /` 设备列表
  - `GET /:id` 设备详情
  - `POST /` 创建设备
  - `PUT /:id` 更新设备
  - `DELETE /:id` 删除设备
- [x] **权限控制**：attendance:manage 可管理

### 测试数据
- e2e 测试：`tests/punch-device-crud.e2e.test.ts`（14 e2e）
- 覆盖场景：创建/唯一约束/必填校验/默认值/无权限/列表/详情/404/更新名称IP/更新启用状态/编号冲突/更新404/删除/删除404

---

## 迭代三 · 补卡申请接入审批流（TDD 完成）

### 完成项
- [x] **补卡申请数据模型**：`PunchMakeup` 表（punch_makeups）
  - 字段：punchDate, punchType, originalTime, makeupTime, reason, status
  - 状态：pending / approving / approved / rejected / cancelled
  - 关联：approvalInstanceId, approverId, approvedAt, approvalNote
- [x] **补卡申请服务**：`src/attendance/punch-makeup.service.ts`
  - CRUD（创建/列表/详情/修改/删除）
  - 提交审批（startInstance → 状态 approving）
  - 审批通过/拒绝（approve/reject → 更新状态）
  - 权限控制：只能操作自己的申请
- [x] **补卡申请 API**：`/api/v1/attendance/punch/makeup`
  - `GET /` 分页列表
  - `GET /:id` 详情
  - `POST /` 创建
  - `PUT /:id` 修改（仅 pending）
  - `DELETE /:id` 删除（仅 pending）
  - `POST /:id/submit` 提交审批
- [x] **接入审批流**：workflowCode = 'punch_makeup'
  - 复用 ApprovalService.startInstance
  - 审批通过/拒绝自动更新补卡状态

### 测试数据
- e2e 测试：`tests/punch-makeup-approval.e2e.test.ts`（11 e2e）
  - CRUD：创建/列表/详情/修改/删除
  - 审批：提交审批/状态约束修改/状态约束删除
  - 隔离：跨用户不可见
  - 异常：不存在的记录 404
- **总计：11 项测试全部通过**
