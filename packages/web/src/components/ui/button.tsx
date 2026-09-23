import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm ring-1 ring-inset ring-white/15 ' +
    'hover:bg-brand-700 focus-visible:bg-brand-700 active:bg-brand-800',
  secondary:
    'border border-line-strong bg-panel text-muted ' +
    'hover:border-ink/20 hover:bg-fill hover:text-ink active:bg-fill',
  ghost: 'text-muted hover:bg-fill hover:text-ink',
  danger:
    'border border-red-200 text-red-600 hover:bg-red-50 focus-visible:ring-red-500/30 dark:border-red-500/30 dark:hover:bg-red-500/10',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
};

/** 统一按钮：主(企业蓝) / 次要 / 幽灵 / 危险；聚焦环=蓝、按下按压 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={twMerge(
        'inline-flex items-center justify-center font-medium transition-colors duration-150 select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}