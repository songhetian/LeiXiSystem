import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SettingsPage from '@/features/system/pages/settings';
import { settingsApi } from '@/services/settings';
import { useAuthStore } from '@/store/auth';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/settings', () => ({
  settingsApi: {
    list: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    bulkUpdate: jest.fn(),
    remove: jest.fn(),
    // useSystemInfo 会读取系统信息，缺失该 mock 会抛 TypeError 导致用例失败
    info: jest.fn(() => Promise.resolve({ code: 0, data: undefined })),
    // 品牌 Logo 上传：页面渲染 <Upload> 时会调用
    uploadLogo: jest.fn(() => Promise.resolve({ code: 0, data: { url: '' } })),
  },
}));

jest.mock('@/store/auth', () => ({ useAuthStore: jest.fn() }));
const mockUseAuthStore = jest.mocked(useAuthStore);


jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, extra, children }: any) => (
    <div data-testid="page-container">
      {title && <h2 data-testid="page-title">{title}</h2>}
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
  // DataState 依赖的组件：错误态需暴露 subTitle 与「重试」按钮
  Result: ({ title, subTitle, extra }: any) => (
    <div>
      <h4>{title}</h4>
      <p>{subTitle}</p>
      {extra}
    </div>
  ),
  Empty: ({ description }: any) => <div>{description}</div>,
  Skeleton: () => null,
  // 页面内的品牌 Logo 上传容器；返回可渲染结构，避免组件为 undefined 导致渲染报错
  Upload: ({ children }: any) => <div>{children}</div>,
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
    clearDataCache();
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

  it('staff（无 system:setting:update）保存按钮与 Logo 上传入口不渲染', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { id: 2, username: 'staff', name: '王小明', permissions: ['attendance:view'] },
    });
    render(<SettingsPage />);
    // REFACTOR_PLAN 11.6-3：按钮无权限不渲染（PermissionGate），而非禁用
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /保存更改/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '上传 Logo' })).not.toBeInTheDocument();
    });
  });

  it('设置列表为空时仍渲染品牌卡片（系统名称 / Logo 不依赖已存在的设置项）', async () => {    // 全新部署：库中还没有任何设置项，但品牌配置仍应可编辑并保存（bulkUpdate 自带 upsert）
    (settingsApi.list as jest.Mock).mockResolvedValue({ code: 0, data: [] });
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, username: 'admin', name: '管理员', permissions: ['system:setting:update'] },
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('系统品牌')).toBeInTheDocument();
      expect(screen.getByText('暂无系统设置项')).toBeInTheDocument();
    });
  });

  it('设置列表返回业务错误(code!==0)时展示错误态，而非「暂无系统设置项」', async () => {
    (settingsApi.list as jest.Mock).mockResolvedValue({ code: 500, message: '设置读取失败' });
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, username: 'admin', name: '管理员', permissions: ['system:setting:update'] },
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('设置读取失败');
    });
    // 业务失败不能被渲染成「库里没有设置项」
    expect(screen.queryByText('暂无系统设置项')).not.toBeInTheDocument();
    expect(screen.getByText('系统品牌')).toBeInTheDocument();
  });

  it('设置列表加载失败时展示错误态与重试，品牌卡片仍可编辑', async () => {
    (settingsApi.list as jest.Mock).mockRejectedValueOnce(new Error('设置加载失败'));
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, username: 'admin', name: '管理员', permissions: ['system:setting:update'] },
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('设置加载失败');
    });
    // 品牌卡片不依赖列表数据，失败时仍应可编辑
    expect(screen.getByText('系统品牌')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();

    (settingsApi.list as jest.Mock).mockResolvedValue({ code: 0, data: mockSettings });
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(screen.getByText('公司名称')).toBeInTheDocument());
  });
});
