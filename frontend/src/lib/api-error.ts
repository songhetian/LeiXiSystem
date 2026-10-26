/**
 * 统一从捕获到的错误里提取「给人看」的错误文案。
 *
 * 本项目的请求层（lib/request.ts）统一 reject 的是 ApiError（message 已含后端
 * 文案），但部分调用点直接拿到了 axios 原始错误（如文件下载、第三方拦截），
 * 因此这里同时兼容两种形态，避免调用方写 `e?.response?.data?.message || ...`
 * 这类三段式兜底链。
 */
interface ApiErrorShape {
  message?: string;
  response?: {
    data?: {
      message?: string;
      data?: { message?: string } | null;
    };
  };
}

export function getApiErrorMessage(e: unknown, fallback = '操作失败'): string {
  const err = (e ?? {}) as ApiErrorShape;
  return (
    (typeof err.message === 'string' && err.message) ||
    err.response?.data?.message ||
    err.response?.data?.data?.message ||
    fallback
  );
}
