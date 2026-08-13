'use client';

import { Tag } from '@arco-design/web-react';

export interface StatusConfig {
  label: string;
  color: string;
}

export interface StatusTagProps {
  status: string;
  statusMap?: Record<string, StatusConfig>;
}

const defaultStatusMap: Record<string, StatusConfig> = {
  active: { label: '在职', color: 'green' },
  inactive: { label: '离职', color: 'default' },
  pending: { label: '待审批', color: 'arcoblue' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
  error: { label: '异常', color: 'red' },
  warning: { label: '警告', color: 'orangered' },
  success: { label: '成功', color: 'green' },
  processing: { label: '处理中', color: 'arcoblue' },
};

export default function StatusTag({ status, statusMap }: StatusTagProps) {
  const map = statusMap || defaultStatusMap;
  const config = map[status];

  const color = config?.color || 'default';
  const label = config?.label || status;

  return <Tag color={color}>{label}</Tag>;
}
