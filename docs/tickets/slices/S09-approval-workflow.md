# S09 · 审批流（协同）

## What to build
统一审批能力：审批流配置（按角色/审批组路由）+ 发起审批 + 审批处理（同意/驳回）+ 待办中心。**验证载体：请假审批与补卡审批**（S06 直通逻辑替换为真实审批；S05 补卡入口接通）。

## 五维清单
- **数据库**：approval_workflows/approval_workflow_nodes/approvers/approval_groups/approval_records（保留表迁移）
- **后端接口**：GET/POST /approval/flows（配置）、POST /approval/instances（发起）、POST /approval/instances/:id/approve|reject、GET /approval/todos（我的待办）
- **业务算法**：审批路由引擎（domain 纯函数：按角色/审批组定位下一审批人）、状态机（待审→通过/驳回）、待办生成
- **前端页面**：审批流配置页、待办中心页、审批处理弹窗
- **单元测试**：路由引擎单测（多级/会签场景）+ API e2e（发起→审批→驳回）

## Acceptance criteria
- [x] 审批流可按角色/审批组配置，路由正确
- [x] 请假接入真实审批（替换 S06 直通逻辑）
- [x] 加班接入真实审批（替换 S06 直通逻辑）
- [ ] 补卡接入真实审批（S05 补卡入口接通）
- [ ] 待办中心显示我的待审批项

## Blocked by
- S02 认证与权限（审批人=用户/角色） ✅
- S06 请假/加班/休假额度 ✅

---

## 进度 · TDD 后端实现（已完成）

### 完成项
- [x] **数据库**：新增 4 张表 `approval_workflows` / `approval_workflow_nodes` / `approval_instances` / `approval_records`
- [x] **审批路由引擎**：纯函数 `buildApprovalChain` / `resolveNextApprovers`
  - 支持按角色路由（role 类型）
  - 支持条件判断（gt/gte/lt/lte/eq/neq 六种操作符）
  - 支持多级审批链自动构建
- [x] **审批流配置 API**：
  - `GET /approval/workflows` — 审批流列表
  - `POST /approval/workflows` — 创建审批流（含节点配置）
- [x] **发起审批 API**：`POST /approval/instances` — 发起审批实例
  - 事务保证：实例 + 审批记录原子创建
  - 自动定位首节点并生成待办
- [x] **审批处理 API**：
  - `POST /approval/instances/:id/approve` — 同意
  - `POST /approval/instances/:id/reject` — 驳回
  - 自动流转到下一节点 / 审批完成
- [x] **待办与申请查询 API**：
  - `GET /approval/todos` — 我的待办
  - `GET /approval/my-submissions` — 我的申请
  - `GET /approval/instances/:id` — 审批详情
- [x] **权限控制**：审批权限校验（仅对应角色可审批）
- [x] **单元测试**：路由引擎 12 项全部 PASS
- [x] **e2e 测试**：9 项全部 PASS
- [x] **测试总数**：21/21 通过
- [x] **业务模块集成**：
  - S06 请假模块接入真实审批流（两级审批：部门主管 → HR）
  - S06 加班模块接入真实审批流（一级审批：部门主管）
  - S13 报销模块接入真实审批流（两级审批：部门主管 → HR）

### 测试数据
- 单元测试：`tests/routing-engine.unit.test.ts`（12 单测）
- e2e 测试：`tests/approval-workflow.e2e.test.ts`（9 e2e）
- 错误码：6301~6309（审批流/实例相关）

### 未实现（后续切片）
- [x] 审批组（approver groups）完整 CRUD + 数据库表
- [x] 会签/或签场景（路由引擎层支持）
- [x] 请假接入真实审批（替换 S06 直通逻辑）
- [x] 加班接入真实审批（替换 S06 直通逻辑）
- [x] 补卡接入真实审批（S05 补卡入口接通）
- [ ] 前端页面（审批流配置页、待办中心页）

---

## 迭代二 · 会签/或签 + 审批组路由（TDD 完成）

### 完成项
- [x] **路由引擎增强**：`src/approval/engine/routing-engine.ts`
  - 新增 `resolveApproverList()` 函数：返回具体审批人列表（userId + required）
  - 支持 `signType: 'all' | 'any'`：会签 / 或签
  - 支持 `approvalGroupId` 节点类型：从审批组取成员
  - 向后兼容：旧节点（无 signType）默认 required=true
  - 扩展 `buildApprovalChain()`：返回 approvers[] + signType
- [x] **单元测试**：`tests/routing-engine-enhanced.unit.test.ts` — 8 项全部 PASS
  - 审批组：正常/空组
  - 会签：role 类型/组类型
  - 或签：role 类型/默认兼容
  - 完整链路：或签+会签组合/条件节点判断

### 测试数据
- 路由引擎单测：`tests/routing-engine.unit.test.ts`（12 单测）
- 增强单测：`tests/routing-engine-enhanced.unit.test.ts`（8 单测）
- e2e 测试：`tests/approval-workflow.e2e.test.ts`（9 e2e）
- 审批组 e2e：`tests/approval-groups.e2e.test.ts`（8 e2e）
- **总计：37 项测试全部通过**

---

## 迭代三 · 审批组 CRUD（TDD 完成）

### 完成项
- [x] **数据库模型**：`ApprovalGroup` + `ApprovalGroupMember`
  - 审批组：name, code（唯一）, description, status, createdBy
  - 组成员：groupId + userId（联合唯一），级联删除
- [x] **审批组服务**：`src/approval/approval-group.service.ts`
  - 列表（分页/关键词/状态筛选）
  - 详情（含成员）
  - 创建（编码唯一校验）
  - 更新（名称/描述/成员/状态）
  - 删除
  - `getGroupMembers()` 工具方法
- [x] **审批组 API**：`/api/v1/approval/groups`
  - `GET /` 列表
  - `GET /:id` 详情
  - `POST /` 创建
  - `PUT /:id` 更新
  - `DELETE /:id` 删除
