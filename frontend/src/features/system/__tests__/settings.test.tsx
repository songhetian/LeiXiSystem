import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SettingsPage from '@/features/system/pages/settings';
import { settingsApi } from '@/services/settings';
import { useAuthStore } from '@/store/auth';

jest.mock('@/services/settings', () => ({
  settingsApi: {
    list: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    bulkUpdate: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('@/store/auth', () => ({ useAuthStore: jest.fn() }));
const mockUseAuthStore = jest.mocked(useAuthStore);


jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, extra, children }: any) => (
    <div data-testid="page-container">
      <h2 data-testid="page-title">{title}</h2>
      <div data-testid="page-extra">{extra}</div>
      <div data-testid="page-content">{children}</div>
    </div>
  ),
}));

jest.mock('@arco-design/web-react', () => ({
  Button: ({ children, disabled, loading, onClick }: any) => (
    <button disabled={disabled || loading} onClick={onClick}>
      {children}
    </button>
  ),
  Input: ({ value, onChange, placeholder }: any) => (
    <input
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
      placeholder={placeholder}
    />
  ),
  Card: ({ title, children }: any) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
  Space: ({ children }: any) => <div>{children}</div>,
  Spin: () => null,
  Message: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const mockSettings = [
  {
    id: 1,
    group: 'general',
    key: 'companyName',
    value: '雷犀科技',
    label: '公司名称',
    description: null,
    isPublic: false,
    updatedAt: '2026-08-13T10:00:00+08:00',
    updatedBy: 1,
  },
];

describe('SettingsPage · 按钮级权限（T26）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (settingsApi.list as jest.Mock).mockResolvedValue({ code: 0, data: mockSettings });
  });

  it('admin（有 system:setting:update）保存按钮可用', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, username: 'admin', name: '管理员', permissions: ['system:setting:update'] },
    });
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /保存更改/i })).toBeEnabled();
    });
  });

  it('staff（无 system:setting:update）保存按钮禁用', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { id: 2, username: 'staff', name: '王小明', permissions: ['attendance:view'] },
    });
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /保存更改/i })).toBeDisabled();
    });
  });
});
