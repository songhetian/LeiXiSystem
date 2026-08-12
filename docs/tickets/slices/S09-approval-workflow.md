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
- [ ] 审批流可按角色/审批组配置，路由正确
- [ ] 请假/补卡接入真实审批（替换 S06 直通逻辑）
- [ ] 待办中心显示我的待审批项

## Blocked by
- S02 认证与权限（审批人=用户/角色）
