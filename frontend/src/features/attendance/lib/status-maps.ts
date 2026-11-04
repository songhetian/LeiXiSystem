/**
 * 考勤域状态映射 —— 单一来源。
 *
 * 此前「启用/停用」在 4 个设置页各写一份（punch-devices 还把「停用」写成了
 * 「禁用」），请假/补卡审批链在 2 个页面各写一份。现统一收敛到本文件；
 * 仅单页使用的映射（日报状态、月报状态等）仍留在各自页面。
 */

export interface AttendanceStatusConfig {
  label: string;
  color: string;
}

/** 启用/停用（color 为 StatusTag 语义色）。
 *  文案统一「停用」——原 punch-devices 写「禁用」，同一动作两种叫法。 */
export const ENABLED_STATUS_MAP: Record<string, AttendanceStatusConfig> = {
  enabled: { label: '启用', color: 'success' },
  disabled: { label: '停用', color: 'default' },
};

/** 请假/补卡审批链状态（draft→pending→approving→approved/rejected/cancelled）。
 *  vacation-audit 用全量；punch-makeup 是其子集，共用同一份（多余键无害）。 */
export const LEAVE_STATUS_MAP: Record<string, AttendanceStatusConfig> = {
  draft: { label: '草稿', color: 'default' },
  pending: { label: '待提交', color: 'default' },
  approving: { label: '审批中', color: 'info' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已拒绝', color: 'danger' },
  cancelled: { label: '已取消', color: 'default' },
};
