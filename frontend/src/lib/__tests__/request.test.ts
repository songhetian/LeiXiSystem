import request, { notifyError, showErrorToast, ApiError } from '@/lib/request';
import { Message } from '@arco-design/web-react';

jest.mock('@/store/auth', () => ({
  useAuthStore: { getState: () => ({ isMockUser: false }) },
}));

jest.mock('@arco-design/web-react', () => ({
  Message: { error: jest.fn(), success: jest.fn() },
}));

const messageError = Message.error as jest.Mock;

// 用自定义 adapter 让 axios 拦截器跑真实错误分支，从而验证 Toast 行为
const respondAdapter = (payload: any) => () => Promise.resolve({
  data: payload,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as any,
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