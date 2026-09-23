import { toast } from 'sonner';
import { useSocketNotifications } from './useSocketNotifications';
import type { NotificationPayload } from './types';

const KIND_TOAST: Record<string, (t: string) => void> = {
  success: (t) => toast.success(t),
  warning: (t) => toast.warning(t),
  error: (t) => toast.error(t),
  info: (t) => toast.info(t),
};

/**
 * 全局 socket 通知监听器：挂在 AdminLayout 下，常驻监听 'notification' 事件，
 * 把统一载荷统一渲染成 toast。业务事件如不是 'notification' 键，可单独用 hook 订阅。
 */
export function NotificationListener() {
  useSocketNotifications('notification', (n: NotificationPayload) => {
    const text = n.message ?? n.title ?? '';
    if (!text) return;
    const emit = KIND_TOAST[n.kind as string] ?? toast.info;
    emit(text);
  });
  return null;
}