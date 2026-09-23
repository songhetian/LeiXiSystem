import { useEffect, useRef } from 'react';
import { getSocket } from '../../lib/socket';
import type { NotificationPayload } from './types';

export type SocketEventHandler = (data: NotificationPayload) => void;

/**
 * 订阅 socket 通知的通用 hook。
 * 用法：useSocketNotifications('notification', handler)
 * 监听器常驻，组件卸载自动解绑；依赖 handler 变化时自动重新订阅。
 */
export function useSocketNotifications(event: string, handler: SocketEventHandler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const listener = (data: NotificationPayload) => handlerRef.current(data);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [event]);
}