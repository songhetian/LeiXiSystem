# S13 · 报销

## What to build
报销端到端：申请（含明细项/附件）→ 审批（S09 审批流）→ 列表/详情；部门数据隔离生效。

## 五维清单
- **数据库**：reimbursements/reimbursement_items/reimbursement_types/reimbursement_attachments（保留表迁移）
- **后端接口**：POST /reimbursements（申请）、GET /reimbursements（列表）、GET /reimbursements/:id、审批联动（S09）
- **业务算法**：报销金额校验（明细合计）；审批状态联动
- **前端页面**：expense feature（申请表单 ModalForm/列表/详情/审批弹窗）
- **单元测试**：API e2e（申请→审批→驳回）

## Acceptance criteria
- [ ] 报销申请→审批→通过/驳回 全流程可用
- [ ] 附件可上传（OSS 代理），金额校验正确

## Blocked by
- S02 认证与权限
- S09 审批流
