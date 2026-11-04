/**
 * 通知类型展示元数据 —— 单一来源。
 *
 * 顶栏下拉（components/NotificationDropdown.tsx）与通知中心列表页
 * （features/notification/pages/list.tsx）共用。此前两处各自维护映射，
 * 同一业务类型在两个界面颜色不一致（考勤一处紫一处绿、系统一处橙一处灰）。
 *
 * color 为 Arco `<Tag>` 预设色名；新增类型必须在此登记。
 */
export interface NotificationTypeMeta {
  label: string;
  color: string;
}

export const NOTIFICATION_TYPE_META: Record<string, NotificationTypeMeta> = {
  approval: { label: '审批', color: 'arcoblue' },
  payslip: { label: '薪资', color: 'green' },
  system: { label: '系统', color: 'orange' },
  attendance: { label: '考勤', color: 'purple' },
  broadcast: { label: '公告', color: 'orangered' },
  notice: { label: '通知', color: 'gray' },
};

/** 未登记类型的兜底：标签显示原始 type，灰色。 */
export function notificationTypeMeta(type: string): NotificationTypeMeta {
  return NOTIFICATION_TYPE_META[type] ?? { label: type, color: 'gray' };
}
