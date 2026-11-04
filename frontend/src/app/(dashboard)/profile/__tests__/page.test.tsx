import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ProfilePage from '../page';
import { authApi } from '@/services/auth';
import { employeeApi } from '@/services/employee';

jest.mock('@/services/auth', () => ({
  authApi: {
    login: jest.fn(),
    me: jest.fn(),
    changePassword: jest.fn(),
    getPrivacyPasswordStatus: jest.fn(),
    setPrivacyPassword: jest.fn(),
    resetPrivacyPassword: jest.fn(),
  },
}));

jest.mock('@/services/employee', () => ({
  employeeApi: {
    getMe: jest.fn(),
  },
}));

jest.mock('@/hooks/use-cached-data', () => ({
  useCachedData: jest.fn(() => ({
    data: {
      employeeNo: 'E001',
      phone: '13800000000',
      department: { name: '技术部' },
      position: { name: '工程师' },
      hireDate: '2026-01-01',
      user: { email: 'a@b.c' },
    },
    loading: false,
    error: null,
    revalidate: jest.fn(),
  })),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

jest.mock('@/store/auth', () => {
  // factory 内自包含：jest.mock 会被提升到 import 之前执行，外部变量此时尚未初始化
  const store: any = jest.fn(() => ({
    user: { id: 1, username: 'admin', name: '管理员' },
  }));
  store.getState = () => ({
    user: { id: 1, username: 'admin', name: '管理员' },
    logout: jest.fn(),
  });
  return { useAuthStore: store };
});

const statusEnabled = (enabled: boolean) =>
  (authApi.getPrivacyPasswordStatus as jest.Mock).mockResolvedValue({
    code: 0,
    message: 'ok',
    data: { enabled },
  });

describe('ProfilePage - 二级密码', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authApi.changePassword as jest.Mock).mockResolvedValue({ code: 0, message: '修改成功' });
    (authApi.setPrivacyPassword as jest.Mock).mockResolvedValue({ code: 0, message: 'ok' });
    (authApi.resetPrivacyPassword as jest.Mock).mockResolvedValue({ code: 0, message: 'ok' });
    statusEnabled(false);
  });

  /** 进入「二级密码」页签并等待状态加载完成 */
  const openPrivacyTab = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<ProfilePage />);
    await user.click(screen.getByText('二级密码'));
    await waitFor(() => {
      expect(screen.getByText('确认二级密码')).toBeInTheDocument();
    });
  };

  const fill = async (
    user: ReturnType<typeof userEvent.setup>,
    pairs: Array<[string, string]>,
  ) => {
    for (const [placeholder, value] of pairs) {
      await user.type(screen.getByPlaceholderText(placeholder), value);
    }
  };

  it('未设置状态：显示设置表单（无原二级密码输入）并展示未启用说明', async () => {
    const user = userEvent.setup();
    await openPrivacyTab(user);

    expect(screen.getByText(/未启用/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('请输入原二级密码')).toBeNull();
    expect(screen.getByRole('button', { name: '设置二级密码' })).toBeInTheDocument();
  });

  it('首次设置：提交新密码，不携带旧密码', async () => {
    const user = userEvent.setup();
    await openPrivacyTab(user);
    await fill(user, [
      ['请输入二级密码（至少 6 位）', '654321'],
      ['请再次输入二级密码', '654321'],
    ]);
    await user.click(screen.getByRole('button', { name: '设置二级密码' }));

    await waitFor(() => {
      expect(authApi.setPrivacyPassword).toHaveBeenCalledWith('654321', undefined);
    });
  });

  it('已设置状态：显示原二级密码输入，提交时携带旧密码', async () => {
    statusEnabled(true);
    const user = userEvent.setup();
    await openPrivacyTab(user);

    expect(screen.getByText(/已启用/)).toBeInTheDocument();
    await fill(user, [
      ['请输入原二级密码', '654321'],
      ['请输入二级密码（至少 6 位）', '888888'],
      ['请再次输入二级密码', '888888'],
    ]);
    await user.click(screen.getByRole('button', { name: '确认修改' }));

    await waitFor(() => {
      expect(authApi.setPrivacyPassword).toHaveBeenCalledWith('888888', '654321');
    });
  });

  it('忘记原二级密码：切换为登录密码重置并调用 resetPrivacyPassword', async () => {
    statusEnabled(true);
    const user = userEvent.setup();
    await openPrivacyTab(user);

    await user.click(screen.getByText(/忘记原二级密码/));
    expect(screen.getByPlaceholderText('请输入登录密码')).toBeInTheDocument();

    await fill(user, [
      ['请输入登录密码', 'loginPass123'],
      ['请输入二级密码（至少 6 位）', '888888'],
      ['请再次输入二级密码', '888888'],
    ]);
    await user.click(screen.getByRole('button', { name: '重置二级密码' }));

    await waitFor(() => {
      expect(authApi.resetPrivacyPassword).toHaveBeenCalledWith('loginPass123', '888888');
    });
  });

  it('设置成功后刷新状态', async () => {
    const user = userEvent.setup();
    await openPrivacyTab(user);
    await fill(user, [
      ['请输入二级密码（至少 6 位）', '654321'],
      ['请再次输入二级密码', '654321'],
    ]);
    await user.click(screen.getByRole('button', { name: '设置二级密码' }));

    await waitFor(() => {
      expect(authApi.getPrivacyPasswordStatus).toHaveBeenCalledTimes(2);
    });
  });
});
