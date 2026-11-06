import axios from 'axios';
import { Message } from '@arco-design/web-react';
import { useAuthStore } from '@/store/auth';
import { redirectToLogin } from '@/lib/redirect';

export class ApiError extends Error {
  code: number;
  data?: any;
  /** 是否已由请求层弹出过错误提示；置 true 供调用方判断以避免重复 Toast */
  surfaced = false;

  constructor(code: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
  }
}

/** 相同文案在窗口期内只弹一次，避免拦截器与调用方重复 Toast */
const RECENT_TOASTS = new Map<string, number>();
const TOAST_DEDUP_MS = 2000;

export function showErrorToast(message: string) {
  const now = Date.now();
  const last = RECENT_TOASTS.get(message);
  if (last !== undefined && now - last < TOAST_DEDUP_MS) {
    return;
  }
  RECENT_TOASTS.set(message, now);
  Message.error(message);
}

/**
 * 在调用方 catch 块中替代裸 `Message.error`：
 * 若错误已由请求拦截器提示过（error.surfaced），则不再重复弹窗。
 */
export function notifyError(error: any, fallback = '操作失败') {
  if (error?.surfaced) return;
  showErrorToast(error?.message || fallback);
}

const request = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
  withCredentials: true,
  timeout: 15000,
});

// ===== CSRF（双提交校验）=====
// 后端对所有非安全方法校验 `X-CSRF-Token`：会话 Cookie 证明「是谁」，这个头证明
// 「请求来自本站页面」。token 有两个来源：登录响应下发（data.csrfToken）、
// 刷新页面后由 primeCsrfToken() 通过 GET /auth/csrf-token 补取。
//
// 刻意**不在请求拦截器里惰性取 token**：那会让每个写请求都挂在一个额外往返上，
// 取不到时还得分清「取 token 失败」和「请求本身失败」。现在的口径是
// 「有就带上，没有照发」—— 真缺了服务端会回 5012/5013，再由响应拦截器换一颗重放一次。
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_TOKEN_MISSING_CODE = 5012;
const CSRF_TOKEN_INVALID_CODE = 5013;
let csrfToken: string | null = null;
let csrfInFlight: Promise<string | null> | null = null;

/** 丢弃缓存里的 token（登出/换账号/服务端判无效） */
export function clearCsrfToken() {
  csrfToken = null;
  csrfInFlight = null;
}

/**
 * 主动补取 CSRF token（页面初始化、或服务端判 token 失效时调用）。
 * 失败返回 null 而不抛：拿不到 token 的后果是「写请求会 403」，
 * 那是一个具体的、能被用户看见并重试的失败，不该变成一个没人处理的 Promise rejection。
 */
export function primeCsrfToken(): Promise<string | null> {
  if (csrfToken) return Promise.resolve(csrfToken);
  // 并发去重：一屏同时触发多次只补取一次
  if (!csrfInFlight) {
    csrfInFlight = request
      .get('/auth/csrf-token')
      .then((body) => {
        // 响应拦截器已把信封拆开，这里拿到的是 { code, data: { token } }
        const token = (body as unknown as { data?: { token?: string } } | undefined)?.data?.token;
        csrfToken = typeof token === 'string' && token ? token : null;
        return csrfToken;
      })
      .catch(() => null)
      .finally(() => {
        csrfInFlight = null;
      });
  }
  return csrfInFlight;
}

request.interceptors.request.use((config) => {
  const method = String(config.method ?? 'get').toUpperCase();
  if (SAFE_METHODS.has(method)) return config;
  if (csrfToken) config.headers.set('X-CSRF-Token', csrfToken);
  return config;
});

request.interceptors.response.use(
  (res) => {
    const data = res.data;
    if (data && typeof data === 'object' && 'code' in data) {
      if (data.code === 0) {
        // 登录（以及换发）响应里带新 token，直接接管，
        // 省掉每个写请求前多打一次 GET /auth/csrf-token
        const issued = (data as { data?: { csrfToken?: unknown } }).data?.csrfToken;
        if (typeof issued === 'string' && issued) csrfToken = issued;
        return data;
      }
      const err = new ApiError(data.code, data.message || '请求失败', data.data);
      const isMockUser = useAuthStore.getState().isMockUser;
      if (!isMockUser && data.code !== 5003) {
        showErrorToast(data.message || '请求失败');
      }
      err.surfaced = true;
      return Promise.reject(err);
    }
    return data;
  },
  async (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message || '网络错误';
    const isMockUser = useAuthStore.getState().isMockUser;
    // 401/403 里有一类不是「会话过期/越权」，而是「需要重新输密码」的预期失败：
    // 二级密码错(3014)、工资条需要先验证(3013)、原二级密码错(5019)、
    // 登录密码错(5020)、缺少原二级密码(5021)。这类错误必须交给调用方内联展示，
    // 既不能跳登录页，也不能弹「没有权限」盖掉真实原因。
    const errCode = err.response?.data?.code;

    // CSRF 头缺失/失效（会话变更、Redis 重启清空了 token 列表、切换账号）：
    // 换一颗 token **重放一次**。可以安全重放 —— CSRF 守卫在 controller 之前就拒绝，
    // 请求一定没有产生任何副作用。只重放一次，第二次仍失败就按普通错误抛出去。
    const cfg = err.config as { __csrfRetried?: boolean } | undefined;
    if (
      cfg &&
      !cfg.__csrfRetried &&
      (errCode === CSRF_TOKEN_MISSING_CODE || errCode === CSRF_TOKEN_INVALID_CODE)
    ) {
      clearCsrfToken();
      const fresh = await primeCsrfToken();
      if (fresh) {
        return request({ ...err.config, __csrfRetried: true });
      }
    }

    // 3016 = 二级密码格式不合法，属表单校验，同样内联展示
    const INLINE_AUTH_ERROR_CODES = [3013, 3014, 3016, 5019, 5020, 5021];
    const isInlineAuthError =
      typeof errCode === 'number' && INLINE_AUTH_ERROR_CODES.includes(errCode);
    // 登录接口自身的 401（账号密码错）也只是表单错误，不该触发「登录已过期」跳转
    const isLoginRequest =
      typeof err.config?.url === 'string' &&
      (err.config.url === '/auth/login' || err.config.url.endsWith('/auth/login'));

    if (status === 401) {
      // 401 一律视为会话失效：jwt guard 只在 token 缺失/过期/无效时回 401，
      // 密码类错误走 403/400。例外是「预期内的密码错误」与登录接口自身。
      if (!isMockUser && !isInlineAuthError && !isLoginRequest) {
        showErrorToast('登录已过期，请重新登录');
        setTimeout(() => {
          redirectToLogin('/login');
        }, 1000);
      }
    } else if (status === 403) {
      if (!isMockUser && !isInlineAuthError) {
        // 403 不只代表「越权」：原密码错误(5016)、账号停用(5014) 也是 403。
        // 只有真正的权限点不足(5003)或后端没给文案时才用兜底话术，
        // 否则「没有权限执行此操作」会盖掉真实原因，用户反复重试也无法自查。
        const fallback = errCode === 5003 || !err.response?.data?.message;
        showErrorToast(fallback ? '没有权限执行此操作' : message);
      }
    } else {
      if (!isMockUser && !isInlineAuthError) {
        showErrorToast(message);
      }
    }
    
    const apiError = new ApiError(status || -1, message, err.response?.data);
    apiError.surfaced = true;
    return Promise.reject(apiError);
  },
);

export default request;
