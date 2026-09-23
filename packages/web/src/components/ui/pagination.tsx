import { twMerge } from 'tailwind-merge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** 生成页码序列，含省略号 */
function buildPages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  if (lo > 2) pages.push('…');
  for (let i = lo; i <= hi; i++) pages.push(i);
  if (hi < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

/** 分页条：左显示总数，右页码导航 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);

  const btn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition ' +
    'border-line bg-panel text-muted hover:border-line-strong hover:text-ink ' +
    'disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
      <span className="text-xs text-faint">
        共 <span className="font-medium text-muted">{total}</span> 条
        {pageCount > 1 && (
          <>
            ，第 <span className="font-medium text-muted">{current}</span> / {pageCount} 页
          </>
        )}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={btn}
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {buildPages(current, pageCount).map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} className="px-1 text-xs text-faint">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={twMerge(
                btn,
                p === current &&
                  'border-brand-600 bg-brand-600 font-medium text-white hover:border-brand-600 hover:text-white',
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          className={btn}
          disabled={current >= pageCount}
          onClick={() => onPageChange(current + 1)}
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}