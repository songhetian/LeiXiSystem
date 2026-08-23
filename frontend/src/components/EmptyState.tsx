'use client';
import { Empty } from '@arco-design/web-react';

interface EmptyStateProps {
  description?: string;
}

/**
 * 通用空状态占位组件。
 */
export function EmptyState({ description = '暂无数据' }: EmptyStateProps) {
  return (
    <Empty description={description} style={{ padding: '32px 0' }} />
  );
}

export default EmptyState;
