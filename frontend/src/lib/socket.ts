import { io, Socket } from 'socket.io-client';

/**
 * 后端推送的通知事件载荷结构。
 * 后端 Socket.IO gateway 会向房间 `user:{userId}` 广播 `notification` 事件。
 */
export interface SocketNotificationPayload {
  id?: number;
  userId?: number;
  title: string;
  content?: string;
  type?: string;
  createdAt?: string;
}

/**
 * 被迫下线事件载荷结构。
 * 后端在检测到同账号在其他设备登录时，向旧连接广播 `kicked_out` 事件。
 */
export interface SocketKickedOutPayload {
  userId?: number;
  message: string;
}

let socket: Socket | null = null;

/** 获取当前已建立的 socket 实例（可能为 null）。 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * 创建（或重建）到 `/ws` 命名空间的 Socket.IO 连接。
 *
 * 鉴权方式：通过 `withCredentials: true` 让浏览器自动携带 HttpOnly cookie，
 * 后端 RealtimeGateway 从 handshake cookie 中解析 access_token 鉴权。
 * 兼容旧模式：若显式传入 token，则通过 `auth.token` 携带。
 */
export function initSocket(token?: string): Socket {
  // SSR 守卫：socket 只应在浏览器端创建
  if (typeof window === 'undefined') {
    return socket as Socket;
  }

  // 复用已存在的连接（同一 token）——避免重复建连
  const currentToken = (socket?.auth as { token?: string } | undefined)?.token;
  if (socket && currentToken === token) {
    return socket;
  }

  // 断开旧连接
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  // 确定 WS 地址：开发环境直连后端 3001 端口；生产环境同源（由 nginx 反代）
  const wsUrl =
    process.env.NODE_ENV === 'production'
      ? typeof window !== 'undefined'
        ? window.location.origin
        : ''
      : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001');

  socket = io(wsUrl + '/ws', {
    auth: token ? { token } : undefined,
    withCredentials: true,
    transports: ['websocket'],
    autoConnect: true,
    // 正常断开（网络抖动 / 服务重启）时自动重连；
    // kicked_out 场景下由 disconnectSocket() 主动断开，Socket.IO 不会对手动
    // disconnect 触发自动重连，因此被踢下线后不会重连。
    reconnection: true,
  });

  socket.on('connect', () => {
    if (process.env.NODE_ENV !== 'production') console.log('[Socket.IO] Connected');
  });

  socket.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'production') console.log('[Socket.IO] Disconnected');
  });

  socket.on('connect_error', (err: Error) => {
    if (process.env.NODE_ENV !== 'production') console.error('[Socket.IO] Connection error:', err.message);
  });

  return socket;
}

/** 主动断开并清理 socket 实例（登出 / 未认证时调用）。 */
export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
