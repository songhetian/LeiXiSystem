import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { twMerge } from 'tailwind-merge';
import { Check, ChevronDown } from 'lucide-react';

const controlCls =
  'w-full rounded-md border border-line-strong bg-panel px-3 py-2 text-sm text-ink ' +
  'placeholder:text-faint transition ' +
  'hover:border-line-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={twMerge(controlCls, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={twMerge(controlCls, 'resize-none', className)} {...rest} />;
}

/** Select 选项 */
export interface SelectOption {
  label: ReactNode;
  value: string | number;
}

const eq = (a: string | number, b: string | number) => String(a) === String(b);

/**
 * 自定义下拉选择器：点击展开、点外关闭、上下键导航、Enter 选择、Esc 关闭。
 * 受控组件，替换原生 <select>。
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: {
  value?: string | number | null;
  onChange?: (value: string | number) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState<number>(() =>
    Math.max(0, options.findIndex((o) => eq(o.value, value ?? ''))),
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => eq(o.value, value ?? ''));

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // 打开时高亮当前项并滚动可见
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children?.[hi] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, hi]);

  const choose = (opt: SelectOption) => {
    onChange?.(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHi((h) => (h + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHi((h) => (h - 1 + options.length) % options.length);
        break;
      case 'Home':
        e.preventDefault();
        setHi(0);
        break;
      case 'End':
        e.preventDefault();
        setHi(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (options[hi]) choose(options[hi]);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={wrapRef} className={twMerge('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={twMerge(
          'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm',
          'border-line-strong bg-panel text-left transition',
          'hover:border-line-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-brand-500 ring-2 ring-brand-500/15',
        )}
      >
        <span className={twMerge('min-w-0 truncate', selected ? 'text-ink' : 'text-faint')}>
          {selected ? selected.label : placeholder ?? '请选择'}
        </span>
        <ChevronDown
          className={twMerge(
            'h-4 w-4 shrink-0 text-faint transition',
            open && 'rotate-180 text-muted',
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          ref={listRef}
          className={twMerge(
            'absolute z-30 mt-1 max-h-60 w-full min-w-[8rem] overflow-auto rounded-md border border-line',
            'bg-panel py-1 shadow-lift',
          )}
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-faint">暂无选项</li>
          )}
          {options.map((opt, i) => {
            const active = i === hi;
            const isSel = eq(opt.value, value ?? '');
            return (
              <li
                key={String(opt.value)}
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setHi(i)}
                onClick={() => choose(opt)}
                className={twMerge(
                  'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm transition-colors',
                  active ? 'bg-brand-50 text-brand-900' : 'text-ink',
                )}
              >
                <span className="min-w-0 truncate">{opt.label}</span>
                {isSel && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 表单字段容器：统一 label 与控件宽度，保证页面内字段对齐 */
export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={twMerge('block space-y-1.5', className)}>
      <span className="flex items-baseline gap-1 text-[13px] font-medium text-muted">
        {label}
        {required && <span className="text-red-400">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-faint">{hint}</span>}
    </label>
  );
}