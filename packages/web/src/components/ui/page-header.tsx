import type { ReactNode } from 'react';
import { motion } from 'motion/react';

/** 页头：标题 + 描述 + 右对齐操作区（收敛、专业） */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink md:text-xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action && <motion.div whileTap={{ scale: 0.98 }}>{action}</motion.div>}
    </div>
  );
}

/** 页面入场动效包装：上浮淡入 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      {children}
    </motion.div>
  );
}