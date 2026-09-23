import request, { notifyError, showErrorToast, ApiError } from '@/lib/request';
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