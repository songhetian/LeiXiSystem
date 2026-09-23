import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

type Tone = 'brand' | 'neutral' | 'success' | 'warn' | 'danger';

const tones: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-ink ring-brand-ink/25',
  neutral: 'bg-fill text-muted ring-line-strong/60',
  success: 'bg-emerald-500/10 text-emerald-600 ring-emerald-600/20 dark:text-emerald-400',
  warn: 'bg-ochre-soft text-ochre-ink ring-ochre-ink/25',
  danger: 'bg-red-500/10 text-red-600 ring-red-600/20 dark:text-red-400',
};

const dots: Record<Tone, string> = {
  brand: 'bg-brand-600',
  neutral: 'bg-muted',
  success: 'bg-emerald-500',
  warn: 'bg-ochre-500',
  danger: 'bg-red-500',
};

/** 状态徽标：语义软底色 + 同色小圆点，亮暗两用 */
export function Badge({
  tone = 'neutral',
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={twMerge('h-1.5 w-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  );
}