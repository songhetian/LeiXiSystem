'use client';

import { ReactNode } from 'react';
import { Spin, Empty, Button, Result, Skeleton } from '@arco-design/web-react';

export interface DataStateProps {
  loading?: boolean;
  loadingText?: string;
  /** 骨架屏模式：loading 时渲染 skeleton 而非 spinner */
  skeleton?: boolean;
  /** 骨架屏行数 */
  skeletonRows?: number;
  /** 骨架屏类型：card | list | text */
  skeletonType?: 'card' | 'list' | 'text';
  isEmpty?: boolean;
  emptyText?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  error?: string | null;
  onRetry?: () => void;
  children: ReactNode;
}

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <Skeleton text={{ rows: 1, width: 80 }} animation />
        <Skeleton text={{ rows: 1, width: 40 }} animation />
      </div>
      <Skeleton text={{ rows, width: ['100%', '80%', '60%'] }} animation />
    </div>
  );
}

function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ padding: '12px 16px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 0',
            borderBottom: i < rows - 1 ? '1px solid #f1f5f9' : 'none',
          }}
        >
          <Skeleton animation style={{ width: 32, height: 32, borderRadius: 6 }} />
          <div style={{ flex: 1 }}>
            <Skeleton text={{ rows: 1, width: '50%' }} animation />
          </div>
          <Skeleton text={{ rows: 1, width: 60 }} animation />
        </div>
      ))}
    </div>
  );
}

export default function DataState({
  loading = false,
  loadingText = '加载中...',
  skeleton = false,
  skeletonRows = 3,
  skeletonType = 'card',
  isEmpty = false,
  emptyText = '暂无数据',
  emptyActionLabel,
  onEmptyAction,
  error = null,
  onRetry,
  children,
}: DataStateProps) {
  if (loading) {
    if (skeleton) {
      if (skeletonType === 'list') {
        return <SkeletonList rows={skeletonRows} />;
      }
      return <SkeletonCard rows={skeletonRows} />;
    }

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 0', gap: 8 }}>
        <Spin size={20} />
        <span style={{ color: '#86909c', fontSize: 14 }}>{loadingText}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '48px 0' }}>
        <Result
          status="error"
          title="加载失败"
          subTitle={error}
          extra={onRetry ? (
            <Button type="primary" onClick={onRetry}>
              重试
            </Button>
          ) : null}
        />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div style={{ padding: '48px 0' }}>
        <Empty description={emptyText} />
        {emptyActionLabel && onEmptyAction ? (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button type="primary" onClick={onEmptyAction}>
              {emptyActionLabel}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
