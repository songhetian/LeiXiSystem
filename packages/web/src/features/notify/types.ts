/** socket 通知统一载荷约定：业务模块发 event 时带上 title/message 供前端渲染 */
export interface NotificationPayload {
  /** 通知类型，前端可按需区分图标/优先级 */
  kind?: 'info' | 'success' | 'warning' | 'error' | string;
  title?: string;
  message?: string;
  /** 业务附加数据 */
  data?: unknown;
}