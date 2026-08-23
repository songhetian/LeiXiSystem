'use client';

export interface StatusConfig {
  label: string;
  color: string;
}

export interface StatusTagProps {
  status: string;
  statusMap?: Record<string, StatusConfig>;
}

const defaultStatusMap: Record<string, StatusConfig> = {
  active: { label: '在职', color: 'success' },
  inactive: { label: '离职', color: 'default' },
  resigned: { label: '离职', color: 'default' },
  pending: { label: '待审批', color: 'info' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已拒绝', color: 'danger' },
  error: { label: '异常', color: 'danger' },
  warning: { label: '警告', color: 'warning' },
  success: { label: '成功', color: 'success' },
  processing: { label: '处理中', color: 'info' },
  normal: { label: '正常', color: 'success' },
  draft: { label: '草稿', color: 'default' },
  published: { label: '已发布', color: 'success' },
  cancelled: { label: '已取消', color: 'default' },
  done: { label: '完成', color: 'success' },
  overtime: { label: '加班', color: 'purple' },
  leave: { label: '请假', color: 'warning' },
  late: { label: '迟到', color: 'danger' },
  early_leave: { label: '早退', color: 'danger' },
  absent: { label: '缺勤', color: 'danger' },
  on_leave: { label: '休假', color: 'warning' },
};

const COLOR_CLASSES: Record<string, string> = {
  info: 'bg-info-bg text-brand',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  purple: 'bg-purple-bg text-purple',
  default: 'bg-border-2 text-text-3',
};

const COLOR_MAP: Record<string, string> = {
  arcoblue: 'info',
  blue: 'info',
  sky: 'info',
  green: 'success',
  emerald: 'success',
  red: 'danger',
  orangered: 'warning',
  orange: 'warning',
  gold: 'warning',
  yellow: 'warning',
  purple: 'purple',
  violet: 'purple',
  gray: 'default',
  grey: 'default',
  default: 'default',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

function resolveColor(color: string): string {
  return COLOR_MAP[color] || 'default';
}

export default function StatusTag({ status, statusMap, ...props }: StatusTagProps & React.HTMLAttributes<HTMLSpanElement>) {
  const map = statusMap || defaultStatusMap;
  const config = map[status];

  const color = config?.color || 'default';
  const label = config?.label || status;
  const resolvedColor = resolveColor(color);
  const colorClass = COLOR_CLASSES[resolvedColor] || COLOR_CLASSES.default;

  return (
    <span
      data-testid="status-tag"
      data-color={color}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal leading-[1.8] whitespace-nowrap border-none ${colorClass}`}
      {...props}
    >
      {label}
    </span>
  );
}
