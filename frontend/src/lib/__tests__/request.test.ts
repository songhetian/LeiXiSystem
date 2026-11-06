import request, { notifyError, showErrorToast, ApiError, clearCsrfToken, primeCsrfToken } from '@/lib/request';
import { Message } from '@arco-design/web-react';

jest.mock('@/store/auth', () => ({
  useAuthStore: { getState: () => ({ isMockUser: false }) },
}));

jest.mock('@/lib/redirect', () => ({
  redirectToLogin: jest.fn(),
}));

jest.mock('@arco-design/web-react', () => ({
  Message: { error: jest.fn(), success: jest.fn() },
}));

import { redirectToLogin } from '@/lib/redirect';

const redirectToLoginMock = redirectToLogin as jest.Mock;
const messageError = Message.error as jest.Mock;

// 用自定义 adapter 让 axios 拦截器跑真实错误分支，从而验证 Toast 行为
const respondAdapter = (payload: any) => () => Promise.resolve({
  data: payload,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as any,
});

// 模拟 HTTP 401 的“网络层拒绝”（走 err 分支）
const rejectWithStatus = (status: number, body: any, url = '/auth/login') => () => Promise.reject({
  response: { status, data: body },
  message: `Request failed with status code ${status}`,
  config: { url },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('request 错误 Toast 去重', () => {
  it('业务错误(code!==0)时拦截器只弹一次 Toast，并标记 surfaced', async () => {
    (request.defaults.adapter as any) = respondAdapter({ code: 2001, message: '班次名称已存在' });

    await expect(request.get('/shifts')).rejects.toMatchObject({ code: 2001 });
    expect(messageError).toHaveBeenCalledTimes(1);
    expect(messageError).toHaveBeenCalledWith('班次名称已存在');
  });

  it('相同错误在窗口期内被去重，只弹一次', async () => {
    (request.defaults.adapter as any) = respondAdapter({ code: 2001, message: '系统繁忙' });

    await expect(request.get('/a')).rejects.toBeInstanceOf(ApiError);
    await expect(request.get('/a')).rejects.toBeInstanceOf(ApiError);
    expect(messageError).toHaveBeenCalledTimes(1);
  });

  it('notifyError 对已 surfaced 的错误不再重复提示', () => {
    const err = new ApiError(2001, '班次名称已存在');
    err.surfaced = true;
    notifyError(err, '操作失败');
    expect(messageError).not.toHaveBeenCalled();
  });

  it('notifyError 对未 surfaced 的错误使用 fallback 提示', () => {
    notifyError(new ApiError(-1, ''), '操作失败');
    expect(messageError).toHaveBeenCalledWith('操作失败');
  });

  it('notifyError 优先展示错误自带 message', () => {
    notifyError(new Error('自定义错误'), '操作失败');
    expect(messageError).toHaveBeenCalledWith('自定义错误');
  });

  it('showErrorToast 直接去重展示', () => {
    showErrorToast('重复提示');
    showErrorToast('重复提示');
    expect(messageError).toHaveBeenCalledTimes(1);
  });
});

describe('登录接口 401 不应触发会话过期跳转', () => {
  it('登录失败(401)时：不跳转 /login、不弹“登录已过期”，只抛真实错误', async () => {
    (request.defaults.adapter as any) = rejectWithStatus(401, { code: 5001, message: '用户名或密码错误' });
    await expect(request.post('/auth/login')).rejects.toMatchObject({ message: '用户名或密码错误' });
    // 不该触发整页跳转
    expect(redirectToLoginMock).not.toHaveBeenCalled();
    // 不该弹误导性的“登录已过期”
    expect(messageError).not.toHaveBeenCalledWith('登录已过期，请重新登录');
  });

  it('非登录接口的 401 仍正常触发会话过期跳转', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
      fn();
      return 0 as any;
    });
    (request.defaults.adapter as any) = rejectWithStatus(401, { code: 5001, message: 'token 失效' }, '/employees');
    try {
      await expect(request.get('/employees')).rejects.toBeInstanceOf(ApiError);
    } finally {
      setTimeoutSpy.mockRestore();
    }
    expect(redirectToLoginMock).toHaveBeenCalledWith('/login');
    expect(messageError).toHaveBeenCalledWith('登录已过期，请重新登录');
  });
});

/**
 * 后端对所有非安全方法校验 X-CSRF-Token（双提交）。
 *
 * 口径是「有就带上、没有照发」：不在请求拦截器里惰性取 token，否则每个写请求都会
 * 挂在一个额外往返上。缺 token 时服务端回 5012/5013，由响应拦截器换一颗**重放一次**
 * （CSRF 守卫在 controller 之前拒绝，重放不会重复执行写操作）。
 */
describe('CSRF token', () => {
  const readHeader = (headers: any, name: string) =>
    typeof headers?.get === 'function'
      ? headers.get(name)
      : (headers?.[name] ?? headers?.[name.toLowerCase()]);

  type Seen = { url: string; csrf?: unknown };

  /** 按 URL 应答的适配器：/auth/csrf-token 发 token，/auth/login 下发 token，其余成功 */
  const routingAdapter = (opts: { token?: string; loginToken?: string } = {}) => {
    const seen: Seen[] = [];
    (request.defaults.adapter as any) = (config: any) => {
      seen.push({ url: config.url, csrf: readHeader(config.headers, 'X-CSRF-Token') });
      let body: any = { code: 0, data: {} };
      if (config.url === '/auth/csrf-token') {
        body = { code: 0, data: { token: opts.token ?? 'tok-from-endpoint' } };
      } else if (config.url === '/auth/login') {
        body = { code: 0, data: { user: { id: 1 }, csrfToken: opts.loginToken ?? 'tok-from-login' } };
      }
      return Promise.resolve({ data: body, status: 200, statusText: 'OK', headers: {}, config });
    };
    return seen;
  };

  beforeEach(() => clearCsrfToken());

  it('没有 token 时写请求照发，不额外打一次 token 接口（不阻塞用户操作）', async () => {
    const seen = routingAdapter();

    await request.put('/approval/role-bindings/1', { roleIds: [] });

    expect(seen.map((s) => s.url)).toEqual(['/approval/role-bindings/1']);
    expect(seen[0].csrf).toBeUndefined();
  });

  it('安全方法不带头，也不去打 token 接口', async () => {
    const seen = routingAdapter();

    await request.get('/employees');

    expect(seen.map((s) => s.url)).toEqual(['/employees']);
  });

  it('登录响应里的 csrfToken 被接管，后续写请求直接带上', async () => {
    const seen = routingAdapter({ loginToken: 'tok-from-login' });

    await request.post('/auth/login', { username: 'admin', password: 'x' });
    await request.put('/approval/role-bindings/1', { roleIds: [] });

    expect(seen.map((s) => s.url)).toEqual(['/auth/login', '/approval/role-bindings/1']);
    expect(seen[1].csrf).toBe('tok-from-login');
  });

  it('primeCsrfToken() 主动补取后，写请求带上它', async () => {
    const seen = routingAdapter({ token: 'tok-primed' });

    const token = await primeCsrfToken();
    await request.put('/approval/role-bindings/1', { roleIds: [] });

    expect(token).toBe('tok-primed');
    expect(seen.map((s) => s.url)).toEqual(['/auth/csrf-token', '/approval/role-bindings/1']);
    expect(seen[1].csrf).toBe('tok-primed');
  });

  it('primeCsrfToken() 并发调用只取一次', async () => {
    const seen = routingAdapter();

    await Promise.all([primeCsrfToken(), primeCsrfToken(), primeCsrfToken()]);

    expect(seen.filter((s) => s.url === '/auth/csrf-token')).toHaveLength(1);
  });

  it('服务端判 token 失效（5013）时换一颗 token 重放一次，用户无感', async () => {
    let csrfFetches = 0;
    let writes = 0;
    (request.defaults.adapter as any) = (config: any) => {
      if (config.url === '/auth/csrf-token') {
        csrfFetches += 1;
        return Promise.resolve({
          data: { code: 0, data: { token: `tok-${csrfFetches}` } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
      }
      writes += 1;
      // 第一次写请求：token 不对（这里模拟服务端清空了 token 列表）
      if (writes === 1) {
        return Promise.reject({
          response: { status: 403, data: { code: 5013, message: 'CSRF token 无效' } },
          message: 'Request failed with status code 403',
          config,
        });
      }
      return Promise.resolve({
        data: { code: 0, data: { ok: true } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    };

    await expect(request.put('/approval/role-bindings/1', {})).resolves.toMatchObject({ code: 0 });
    expect(writes).toBe(2);
    expect(csrfFetches).toBe(1);
  });

  it('重放也只重放一次：换过 token 仍被拒就抛给调用方，不无限重试', async () => {
    let writes = 0;
    (request.defaults.adapter as any) = (config: any) => {
      if (config.url === '/auth/csrf-token') {
        return Promise.resolve({
          data: { code: 0, data: { token: 'tok' } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
      }
      writes += 1;
      return Promise.reject({
        response: { status: 403, data: { code: 5012, message: 'CSRF token 缺失' } },
        message: 'Request failed with status code 403',
        config,
      });
    };

    await expect(request.put('/approval/role-bindings/1', {})).rejects.toBeInstanceOf(ApiError);
    expect(writes).toBe(2);
  });

  it('primeCsrfToken() 取不到时返回 null，不抛（不能变成未处理的 rejection）', async () => {
    (request.defaults.adapter as any) = () =>
      Promise.reject({ response: { status: 401, data: { code: 5001 } }, message: '401', config: {} });

    await expect(primeCsrfToken()).resolves.toBeNull();
  });
});
