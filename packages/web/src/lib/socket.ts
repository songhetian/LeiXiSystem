import { io, type Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

/**
 * 懒加载单例 socket 客户端：同源走 vite /socket.io 代理，Bearer 复用登录令牌。
 * 断线自动重连；token 更新后需手动 reconnect()。
 */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io('/', {
    auth: { token: getToken() },
    transports: ['websocket', 'polling'], // 优先 websocket，兼容代理
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

/** 登出/token 变更后重连，使新鉴权生的会话进入正确的定向房间 */
export function reconnectSocket(): void {
  disconnectSocket();
  getSocket();
}