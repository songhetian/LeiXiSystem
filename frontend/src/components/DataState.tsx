'use client';

import { ReactNode } from 'react';
import { Empty, Button, Result, Skeleton } from '@arco-design/web-react';
import LoaderDots from '@/components/LoaderDots';

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
    <div className="data-state-skeleton-card">
      <div className="data-state-skeleton-card-head">
        <Skeleton text={{ rows: 1, width: 80 }} animation />
        <Skeleton text={{ rows: 1, width: 40 }} animation />
      </div>
      <Skeleton text={{ rows, width: ['100%', '80%', '60%'] }} animation />
    </div>
  );
}

function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="data-state-skeleton-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="data-state-skeleton-row">
          <Skeleton animation style={{ width: 32, height: 32, borderRadius: 6 }} />
          <div className="data-state-skeleton-row-body">
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
      return (
        // 骨架屏同样要有可播报的加载态：只画灰块不吭声，读屏用户会以为页面卡住。
        <div role="status" aria-live="polite">
          <span className="sr-only">{loadingText}</span>
          {skeletonType === 'list' ? (
            <SkeletonList rows={skeletonRows} />
          ) : (
            <SkeletonCard rows={skeletonRows} />
          )}
        </div>
      );
    }

    // 与非骨架加载态共用同一组件：文案、波点动画、延迟播报只维护一处，避免两套实现漂移
    return <LoaderDots text={loadingText} />;
  }

  if (error) {
    return (
      // 加载失败同样需要播报，且用 assertive 让错误优先被读出
      <div role="alert" aria-live="assertive" className="data-state-block">
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
      <div className="data-state-block">
        <Empty description={emptyText} />
        {emptyActionLabel && onEmptyAction ? (
          <div className="data-state-empty-action">
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
