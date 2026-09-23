/**
 * 统一响应信封：全后端返回 { success, data, message }。
 * data 缺省为 null（而非 undefined），确保 JSON 序列化表达一致。
 */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  message: string;
}

export function okay<T>(data?: T): ApiEnvelope<T> {
  return { success: true, data: data ?? null, message: '' };
}

export function fail(message: string): ApiEnvelope<never> {
  return { success: false, data: null, message };
}