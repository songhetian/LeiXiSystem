import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSocket } from '@/hooks/use-socket';
import { useAuthStore } from '@/store/auth';
import { Message } from '@arco-design/web-react';
import { disconnectSocket, getSocket } from '@/lib/socket';

const mockReplace = jest.fn();
const mockLogout = jest.fn();

/**
 * mock socket.io-client：拦截 `io` 构造，返回一个可控的假 socket，
 * 从而让 `@/lib/socket` 的真实逻辑（initSocket / disconnectSocket）在测试中跑通。
 */
jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
    connected: false,
    auth: {} as { token?: string },
  };
  // 链式调用支持
  mockSocket.on.mockReturnValue(mockSocket);
  mockSocket.off.mockReturnValue(mockSocket);
  mockSocket.once.mockReturnValue(mockSocket);
  mockSocket.disconnect.mockReturnValue(mockSocket);
  mockSocket.removeAllListeners.mockReturnValue(mockSocket);

  const io = jest.fn((_url: string, opts?: { auth?: { token?: string } }) => {
    mockSocket.auth = opts?.auth ?? {};
    return mockSocket;
  });

  return { io, __mockSocket: mockSocket };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock('@arco-design/web-react', () => ({
  Message: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(),
}));

const mockUseAuthStore = jest.mocked(useAuthStore);
const mockMessageInfo = Message.info as jest.Mock;
const mockMessageError = Message.error as jest.Mock;
const mockSocketIo = jest.requireMock('socket.io-client') as {
  io: jest.Mock;
  __mockSocket: {
    on: jest.Mock;
    off: jest.Mock;
    disconnect: jest.Mock;
    removeAllListeners: jest.Mock;
    auth: { token?: string };
  };
};
const mockIo = mockSocketIo.io;
const mockSocket = mockSocketIo.__mockSocket;

function clearAccessTokenCookie() {
  document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

function setAccessTokenCookie(token: string) {
  document.cookie = `access_token=${token}; path=/`;
}

const authenticatedUser = {
  id: 7,
  username: 'admin',
  name: '管理员',
  permissions: [],
};

describe('useSocket · Socket.IO 实时通知（T-socket）', () => {
  let mounted: { unmount: () => void } | null = null;

  beforeEach(() => {
    // 先重置模块级 socket 单例（会调用到 mockSocket.disconnect / removeAllListeners）
    disconnectSocket();
    // 再清空 mock 调用记录，保证断言干净
    jest.clearAllMocks();
    clearAccessTokenCookie();
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      logout: mockLogout,
    });
  });

  afterEach(() => {
    if (mounted) {
      mounted.unmount();
      mounted = null;
    }
  });

  it('已登录时通过 cookie 鉴权创建到 /ws 命名空间的连接', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: authenticatedUser,
      logout: mockLogout,
    });

    mounted = renderHook(() => useSocket());

    expect(mockIo).toHaveBeenCalledTimes(1);
    expect(mockIo).toHaveBeenCalledWith(
      'http://localhost:4001/ws',
      expect.objectContaining({
        withCredentials: true,
        transports: ['websocket'],
        autoConnect: true,
      }),
    );
  });

  it('收到 notification 事件时弹出 Arco Message 并派发 socket-notification 事件', () => {
    setAccessTokenCookie('my-jwt-token');
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: authenticatedUser,
      logout: mockLogout,
    });

    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');

    mounted = renderHook(() => useSocket());

    // 取出 hook 注册的 'notification' 回调（initSocket 还会注册 connect/disconnect/connect_error）
    const notificationCall = mockSocket.on.mock.calls.find((c) => c[0] === 'notification');
    expect(notificationCall).toBeTruthy();
    const handler = notificationCall![1] as (payload: {
      title: string;
      content?: string;
      type?: string;
    }) => void;

    handler({ title: '你有新的审批待处理', content: '请假申请', type: 'approval' });

    expect(mockMessageInfo).toHaveBeenCalledWith(
      expect.objectContaining({ content: '你有新的审批待处理', duration: 5000 }),
    );

    // 派发自定义事件供头部角标刷新未读数
    expect(dispatchSpy).toHaveBeenCalled();
    const dispatched = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(dispatched.type).toBe('socket-notification');

    dispatchSpy.mockRestore();
  });

  it('组件卸载时不断开连接（跨页面导航持久），disconnectSocket 才真正清理', () => {
    setAccessTokenCookie('my-jwt-token');
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: authenticatedUser,
      logout: mockLogout,
    });

    mounted = renderHook(() => useSocket());
    expect(getSocket()).not.toBeNull();

    // 卸载：仅移除 'notification' / 'kicked_out' 监听器，不调用 disconnect
    mounted!.unmount();
    mounted = null;
    expect(mockSocket.off).toHaveBeenCalledWith('notification', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('kicked_out', expect.any(Function));
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
    // 单例仍存活
    expect(getSocket()).not.toBeNull();

    // disconnectSocket：断开并清理单例
    disconnectSocket();
    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(getSocket()).toBeNull();
  });

  it('未登录时不建连，并清理已有连接', () => {
    setAccessTokenCookie('my-jwt-token');
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      logout: mockLogout,
    });

    mounted = renderHook(() => useSocket());

    expect(mockIo).not.toHaveBeenCalled();
    expect(getSocket()).toBeNull();
  });

  it('已登录时即使 JS 无法读取 HttpOnly cookie 也能建连（cookie 由浏览器自动携带）', () => {
    // HttpOnly cookie 无法被 JS 读取，但 withCredentials:true 让浏览器在 WS 握手时自动携带
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: authenticatedUser,
      logout: mockLogout,
    });

    mounted = renderHook(() => useSocket());

    expect(mockIo).toHaveBeenCalledTimes(1);
    expect(getSocket()).not.toBeNull();
  });

  it('收到 kicked_out 事件时弹出错误提示、断开连接、登出并跳转登录页', () => {
    setAccessTokenCookie('my-jwt-token');
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: authenticatedUser,
      logout: mockLogout,
    });

    mounted = renderHook(() => useSocket());

    // 取出 hook 注册的 'kicked_out' 回调
    const kickedCall = mockSocket.on.mock.calls.find((c) => c[0] === 'kicked_out');
    expect(kickedCall).toBeTruthy();
    const handler = kickedCall![1] as (payload: {
      userId?: number;
      message: string;
    }) => void;

    handler({ userId: 7, message: '您的账号在其他设备登录，已被迫下线' });

    // 弹出错误提示
    expect(mockMessageError).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '您的账号在其他设备登录，已被迫下线',
        duration: 5000,
      }),
    );
    // 主动断开 socket（不会触发自动重连）
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(mockSocket.removeAllListeners).toHaveBeenCalled();
    // 清除认证状态
    expect(mockLogout).toHaveBeenCalled();
    // 跳转登录页
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('kicked_out 事件重复派发时只处理一次（kickedOutRef 防抖）', () => {
    setAccessTokenCookie('my-jwt-token');
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: authenticatedUser,
      logout: mockLogout,
    });

    mounted = renderHook(() => useSocket());

    const kickedCall = mockSocket.on.mock.calls.find((c) => c[0] === 'kicked_out');
    expect(kickedCall).toBeTruthy();
    const handler = kickedCall![1] as (payload: {
      userId?: number;
      message: string;
    }) => void;

    handler({ userId: 7, message: '第一次下线提示' });
    handler({ userId: 7, message: '第二次下线提示' });

    // Message.error / logout / replace 只被调用一次
    expect(mockMessageError).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('未提供 message 时 kicked_out 使用默认提示文案', () => {
    setAccessTokenCookie('my-jwt-token');
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: authenticatedUser,
      logout: mockLogout,
    });

    mounted = renderHook(() => useSocket());

    const kickedCall = mockSocket.on.mock.calls.find((c) => c[0] === 'kicked_out');
    expect(kickedCall).toBeTruthy();
    const handler = kickedCall![1] as (payload: {
      userId?: number;
      message?: string;
    }) => void;

    // 仅传 userId，不传 message
    handler({ userId: 7 });

    expect(mockMessageError).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '您的账号在其他设备登录，已被迫下线',
        duration: 5000,
      }),
    );
    expect(mockLogout).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});
