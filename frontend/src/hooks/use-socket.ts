'use client';

import { useEffect, useRef, useState } from 'react';
import { Message } from '@arco-design/web-react';
import { useRouter } from 'next/navigation';
import {
  initSocket,
  disconnectSocket,
  getSocket,
  SocketNotificationPayload,
  SocketKickedOutPayload,
} from '@/lib/socket';
import { useAuthStore } from '@/store/auth';

/**
 * 初始化并维护 Socket.IO 连接。
 *
 * 鉴权方式：通过 `withCredentials: true` 让浏览器自动携带 HttpOnly cookie，
 * 后端 RealtimeGateway 从 handshake cookie 中解析 access_token。
 * 前端无需（也无法）读取 HttpOnly cookie 中的 token。
 *
 * 职责：
 * - 仅在浏览器端、用户已登录时建连；
 * - 监听 `notification` 事件，收到时弹出 Arco Message 并派发 `socket-notification`
 *   自定义事件，供头部角标等组件刷新未读数；
 * - 监听 `kicked_out` 事件，收到时提示用户已被迫下线，主动断开 socket（不触发
 *   自动重连），清除认证状态并跳转登录页；
 * - socket 为模块级单例，跨页面导航持久存活，组件卸载时仅移除监听器、不断开连接。
 *
 * 自动重连策略：
 * - 正常断开（网络抖动 / 服务重启）→ Socket.IO 自动重连（reconnection: true）；
 * - kicked_out 主动断开 → 不会自动重连（手动 disconnect 不触发重连）。
 */
export function useSocket() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const userId = user?.id;
  const router = useRouter();
  const [socket, setSocket] = useState(getSocket());
  // 防止 kicked_out 事件在断开前被重复触发
  const kickedOutRef = useRef(false);

  useEffect(() => {
    // SSR 守卫
    if (typeof window === 'undefined') return;

    // 未认证：断开连接并清空实例
    if (!isAuthenticated) {
      disconnectSocket();
      setSocket(null);
      return;
    }

    // 重新登录场景下重置 kicked_out 标志
    kickedOutRef.current = false;

    // 已认证：通过 cookie 鉴权建连（无需手动传 token）
    const s = initSocket();
    setSocket(s);

    const handleNotification = (payload: SocketNotificationPayload) => {
      Message.info({
        content: payload?.title ?? '收到新通知',
        duration: 5000,
      });
      // 派发自定义事件，通知头部角标 / 通知列表等组件刷新未读数
      window.dispatchEvent(new CustomEvent('socket-notification'));
    };

    const handleKickedOut = (payload: SocketKickedOutPayload) => {
      // 防止重复处理（事件可能多次派发）
      if (kickedOutRef.current) return;
      kickedOutRef.current = true;

      Message.error({
        content: payload?.message ?? '您的账号在其他设备登录，已被迫下线',
        duration: 5000,
      });

      // 主动断开 socket —— 手动 disconnect 不会触发 Socket.IO 自动重连，
      // 因此被踢下线后不会重连旧会话。
      disconnectSocket();

      // 清除认证状态（同时清除 access_token cookie）
      logout();

      // 跳转登录页（replace 避免后退回到已失效的页面）
      router.replace('/login');
    };

    s.on('notification', handleNotification);
    s.on('kicked_out', handleKickedOut);

    return () => {
      // 不在卸载时断开连接——保持 socket 在页面导航间存活，仅移除监听器
      s.off('notification', handleNotification);
      s.off('kicked_out', handleKickedOut);
    };
  }, [isAuthenticated, userId, logout, router]);

  return socket;
}
