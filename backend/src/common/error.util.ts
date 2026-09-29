/**
 * 异常字段读取工具。
 *
 * TypeScript 的 `strict` 下 `catch` 变量为 `unknown`，直接写 `catch (e: any)` 会让
 * `e.code` / `e.message` 的书写错误逃过编译期检查。这里提供显式收窄的读取口，
 * 既保留原有行为（读不到即 undefined / 回退字符串），又不再需要 `any`。
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** 异常携带的业务 / 驱动错误码（如 Prisma 的 `P2002`）。 */
export function errorCode(e: unknown): string | undefined {
  if (isRecord(e) && typeof e.code === 'string') return e.code;
  return undefined;
}

/** 异常携带的 HTTP 状态码（如 undici / Axios 的错误对象）。 */
export function errorStatus(e: unknown): number | undefined {
  if (isRecord(e) && typeof e.status === 'number') return e.status;
  return undefined;
}

/** 可读的错误消息；非 Error 时回退为 `String(e)`（与模板字符串插值行为一致）。 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (isRecord(e) && typeof e.message === 'string') return e.message;
  return String(e);
}
