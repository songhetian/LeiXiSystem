/**
 * 审批域状态映射 —— 单一来源。
 *
 * 枚举来自 prisma `ApprovalInstanceStatus`（pending / approved / rejected / cancelled）。
 * 此前 4 个页面各自维护映射，且文案/色系漂移（todo 用「待审批」、其余页用「审批中」；
 * dashboard 用 CSS 变量、列表页用 Arco 色名）。
 *
 * 颜色取值约定：
 *  - `color` 走 StatusTag 的语义色名（info/success/danger/default），不再用
 *    arcoblue/green/red 这类 Arco 原色名（StatusTag 内部虽会归一化，直接写语义名少一层转换）；
 *  - 需要裸色值（内联 style / 圆点）的场合用 `APPROVAL_STATUS_COLOR_VAR`。
 */

export interface ApprovalStatusConfig {
  label: string;
  color: string;
}

/** 审批实例状态（「我的申请」/ 详情页 / 工作台口径：pending=审批中） */
export const APPROVAL_INSTANCE_STATUS: Record<string, ApprovalStatusConfig> = {
  pending: { label: '审批中', color: 'info' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已驳回', color: 'danger' },
  cancelled: { label: '已撤销', color: 'default' },
};

/** 审批节点记录状态（待办列表 / 审批轨迹口径：pending=待审批） */
export const APPROVAL_RECORD_STATUS: Record<string, ApprovalStatusConfig> = {
  pending: { label: '待审批', color: 'info' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已驳回', color: 'danger' },
};

/** 审批实例状态 → 裸色值（CSS 变量），供工作台时间线圆点 / 内联 style 使用 */
export const APPROVAL_STATUS_COLOR_VAR: Record<string, string> = {
  pending: 'var(--lx-warning)',
  approved: 'var(--lx-success)',
  rejected: 'var(--lx-danger)',
  cancelled: 'var(--lx-text-3)',
};
