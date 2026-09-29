/**
 * 请求上下文类型声明（Fastify 请求侧的类型收敛入口）。
 *
 * 背景：控制器过去一律写 `@Req() req: any`（全仓 121 处）与 `(req as any).user.id`
 * （30 处），字段改名无法在编译期暴露。此处集中收敛：
 *
 * 1. `FastifyRequest` 声明合并 —— JwtAuthGuard 注入的 `user` / `token`。
 * 2. `RequestContext` —— **控制器端口**：只声明控制器真正用到的字段（`user.id`、
 *    `token`）。按接口隔离原则，控制器不应依赖整个 `FastifyRequest`；副作用是单测
 *    可直接构造 `{ user: { id: 1 } }`，无需伪造 30 多个 Fastify 字段。
 * 3. `AuthenticatedRequest` —— 需要 `FastifyRequest` 额外能力（如
 *    `@fastify/multipart` 的 `files()`）时使用。
 *
 * `req.files()` 由 @fastify/multipart 自带的声明合并提供，不在此重复声明（重复会冲突）。
 */
import type { FastifyRequest } from 'fastify';

/** JwtAuthGuard 注入的登录主体（完整形态，供 guard / 拦截器使用）。 */
export interface AuthUser {
  id: number;
  username: string;
}

/**
 * 控制器对「已认证请求」的最小依赖面（端口）。
 * 只包含控制器读取的字段；需要完整 Fastify 能力时改用 {@link AuthenticatedRequest}。
 */
export interface RequestContext {
  user: { id: number };
  token?: string;
}

/** 已认证且需要完整 FastifyRequest 能力的请求（如文件上传 `req.files()`）。 */
export type AuthenticatedRequest = FastifyRequest & {
  user: AuthUser;
  token?: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * 由 JwtAuthGuard 注入；仅受保护路由存在，故可空。
     * 受保护路由请把 `@Req()` 标注为 `RequestContext`，得到必存在语义。
     */
    user?: AuthUser;
    /** 当前请求的原始 access token；由 JwtAuthGuard 注入。 */
    token?: string;
  }
}
