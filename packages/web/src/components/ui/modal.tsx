import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

/** 通用对话框：背板淡入 + 卡片上浮，Esc/背板可关闭 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            role="dialog"
            aria-modal="true"
            className={`relative w-full ${width} rounded-lg bg-panel shadow-lift border border-line`}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-4">
              <div>
                <h2 className="text-base font-semibold text-ink">{title}</h2>
                {description && <p className="mt-0.5 text-xs text-faint">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="rounded-md p-1 text-faint transition hover:bg-fill hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-line bg-panel-soft px-5 py-3 rounded-b-lg">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}