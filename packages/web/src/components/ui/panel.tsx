import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

/** 面板卡片：发丝线描边、低对比投影，适合信息密度较高的管理页 */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={twMerge('panel', className)}>{children}</section>;
}

/** 面板标题栏（可选），用于卡片头部 */
export function PanelHeader({
  title,
  description,
  extra,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={twMerge(
        'flex items-center justify-between gap-4 border-b border-line px-5 py-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-faint">{description}</p>}
      </div>
      {extra}
    </div>
  );
}