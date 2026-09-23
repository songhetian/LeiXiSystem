import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { Server as IOServer } from 'socket.io';
import { resolveTargetRooms, type NotifyTargets } from './notify.targets';

/** 连接鉴权所需的最小用户信息（由 UserRepo.findById 提供） */
export interface SocketUser {
  id: number;
  departmentId: number | null;
  roleIds: number[];
}

/** socket 依赖：校验 token + 解析用户以加入定向房间 */
export interface NotificationDeps {
  jwtSecret: string;
  loadUser: (userId: number) => Promise<SocketUser | null>;
  /** 可选：校验 access token 的 sid 是否为当前活跃会话（单设备踢人即时拒绝旧连接） */
  verifySid?: (userId: number, sid: string) => Promise<boolean>;
}

/** 统一通知函数：按目标定向发送事件到对应房间 */
export interface NotifyFn {
  (targets: NotifyTargets, event: string, data: unknown): void;
}

// 单例持有当前已激活的 notify：index.ts 挂载 socket 后写入，
// 业务模块可 import { notify } 直接在路由/服务里推送（无需侵入 app.ts 依赖）。
let currentNotify: NotifyFn | null = null;
export function setCurrentNotify(fn: NotifyFn | null): void {
  currentNotify = fn;
}

/** 统一的 socket 通知入口；未接入 socket 时为 no-op，业务可安全调用 */
export function notify(targets: NotifyTargets, event: string, data: unknown): void {
  if (!currentNotify) return;
  currentNotify(targets, event, data);
}

/** 创建 socket 通知中心：鉴权 + 入房 + 对外暴露 notify */
export function setupNotificationSocket(server: HttpServer, deps: NotificationDeps) {
  const io = new IOServer(server, {
    // 代理同源时无需 CORS；这里放开端口便于直连调试
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // 鉴权中间件：校验 accessToken + 当前活跃会话，失败则拒绝连接
  io.use((socket, next) => {
    const token: string | undefined = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = jwt.verify(token, deps.jwtSecret) as jwt.JwtPayload;
      if (payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        return next(new Error('unauthorized'));
      }
      const userId = Number(payload.sub);
      const check = deps.verifySid ? deps.verifySid(userId, payload.sid) : Promise.resolve(true);
      check
        .then((ok) => {
          if (!ok) return next(new Error('kicked')); // 被踢/会话轮换，旧 token 重建无效
          socket.data.userId = userId;
          next();
        })
        .catch(() => next(new Error('unauthorized')));
    } catch {
      next(new Error('unauthorized'));
    }
  });

  // 连接成功后加载用户并加入定向房间
  io.on('connection', async (socket) => {
    const userId = socket.data.userId as number;
    const user = await deps.loadUser(userId).catch(() => null);
    socket.emit('connected', { userId });
    if (!user) return;

    socket.join(`user:${userId}`);
    if (user.departmentId != null) socket.join(`dept:${user.departmentId}`);
    for (const rid of user.roleIds) socket.join(`role:${rid}`);
  });

  const notify: NotifyFn = (targets, event, data) => {
    const rooms = resolveTargetRooms(targets);
    for (const room of rooms) io.to(room).emit(event, data);
  };

  return { io, notify };
}