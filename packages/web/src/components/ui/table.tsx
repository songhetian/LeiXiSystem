import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { twMerge } from 'tailwind-merge';

/** 表格：发丝线分隔、底纹表头、行悬停微反馈；随窗口滚动而非内部滚动 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={twMerge('overflow-x-auto', className)}>
      <table className="w-full min-w-max border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-line bg-panel-soft text-left text-xs font-medium uppercase tracking-wide text-muted">
        {children}
      </tr>
    </thead>
  );
}

export function TH({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={twMerge('px-4 py-2.5 font-medium', className)} {...rest} />;
}

export function TD({
  className,
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td className={twMerge('px-4 py-3 align-middle', className)} {...rest}>
      {children}
    </td>
  );
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr
      className={twMerge(
        'border-b border-line transition-colors last:border-0 hover:bg-brand-50/40',
        className,
      )}
    >
      {children}
    </tr>
  );
}

/** 空态占位 */
export function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={twMerge('px-5 py-12 text-center text-sm text-faint', className)}>{children}</div>
  );
}

/** 操作列容器：右对齐、间距一致 */
export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-1">{children}</div>;
}