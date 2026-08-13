# S13 · 报销

## What to build
报销端到端：申请（含明细项/附件）→ 审批（S09 审批流）→ 列表/详情；部门数据隔离生效。

## 五维清单
- **数据库**：reimbursements/reimbursement_items/reimbursement_types（已完成 Prisma 模型）
- **后端接口**：POST /reimbursements（申请）、GET /reimbursements/types、GET /reimbursements/mine、GET /reimbursements/pending、GET /reimbursements/:id、POST /reimbursements/:id/submit（审批联动）
- **业务算法**：报销金额校验（明细合计）；审批状态联动；权限校验（申请人/管理员/当前审批人）
- **前端页面**：expense feature（申请表单 ModalForm/列表/详情/审批弹窗）— 待前端实现
- **单元测试**：API e2e 11 个用例全部通过（类型列表、创建、金额校验、我的列表、详情、发起审批、待审批列表、主管同意、HR同意、驳回场景）

## Acceptance criteria
- [x] 报销申请→审批→通过/驳回 全流程可用（后端完成）
- [ ] 附件可上传（OSS 代理），金额校验正确（金额校验已完成，附件待实现）

## Blocked by
- S02 认证与权限 ✅
- S09 审批流 ✅

## 后端 TDD 完成记录
- **测试数**：11 个 e2e 测试全部通过
- **覆盖场景**：
  - 报销类型列表
  - 创建报销（含明细）
  - 金额校验失败（明细合计≠总金额）
  - 我的报销列表
  - 报销详情（含权限校验）
  - 发起审批（状态变更、生成审批实例）
  - 待审批列表
  - 主管同意 → 流转到 HR
  - HR 同意 → 审批完成
  - 驳回场景（创建 → 驳回 → 状态 rejected）
- **技术实现**：
  - Prisma 模型：ReimbursementType / Reimbursement / ReimbursementItem
  - 模块：ReimbursementModule（Service + Controller）
  - 与 S09 审批流深度联动：发起审批、状态同步、权限校验
