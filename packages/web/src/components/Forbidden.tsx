import { motion } from 'motion/react';
import { ShieldX } from 'lucide-react';

/** 无权限访问时的兜底页（嵌套在布局内，保留侧边栏） */
export function Forbidden() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-panel py-24 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-fill text-faint">
        <ShieldX className="h-7 w-7" />
      </span>
      <p className="mt-5 text-4xl font-bold tracking-tight text-faint">403</p>
      <p className="mt-2 text-sm text-muted">你没有访问该页面的权限。</p>
      <p className="mt-1 text-xs text-faint">如需访问，请联系管理员为你的角色开通相应权限。</p>
    </motion.div>
  );
}