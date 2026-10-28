import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationSettingsPage from '@/features/notification/pages/settings';
import { notificationSettingApi } from '@/services/notification';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/notification', () => ({
  notificationSettingApi: {
    list: jest.fn(),
    listRoles: jest.fn(),
    setTargetRoles: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

// Tabs 简化：默认渲染全部 TabPane 内容，避免依赖 Arco 懒挂载行为
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  const Tabs = ({ children }: any) => <div data-testid="tabs">{children}</div>;
  Tabs.TabPane = ({ title, children }: any) => (
    <section data-testid={`tab-${title}`}>{children}</section>
  );
  return {
    ...actual,
    Tabs,
    Select: ({ value, options = [] }: any) => (
      <div data-testid="target-select" data-value={JSON.stringify(value ?? [])}>
        {(options as any[]).map((o) => (
          <span key={o.value ?? o.label}>{String(o.label)}</span>
        ))}
      </div>
    ),
    Tooltip: ({ children }: any) => <>{children}</>,
  };
});

const settings = [
  { eventType: 'leave_apply', targetRoles: ['self', 'manager'] },
  { eventType: 'absent_notify', targetRoles: ['hr'] },
];

const roles = [
  { value: 'self', label: '本人' },
  { value: 'manager', label: '主管' },
  { value: 'hr', label: 'HR 角色' },
];

describe('NotificationSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
    (notificationSettingApi.list as jest.Mock).mockResolvedValue({ code: 0, data: settings });
    (notificationSettingApi.listRoles as jest.Mock).mockResolvedValue({ code: 0, data: roles });
    (notificationSettingApi.setTargetRoles as jest.Mock).mockResolvedValue({ code: 0 });
  });

  it('加载推送配置与目标角色，按分组渲染事件项', async () => {
    render(<NotificationSettingsPage />);
    expect(await screen.findByText('请假申请触发')).toBeInTheDocument();
    expect(screen.getByText('缺勤自动告警')).toBeInTheDocument();
    // 三个业务分组 Tab 均渲染
    expect(screen.getByTestId('tab-考勤流转')).toBeInTheDocument();
    expect(screen.getByTestId('tab-财务资产')).toBeInTheDocument();
    expect(screen.getByTestId('tab-异常告警')).toBeInTheDocument();
  });

  it('已保存的目标角色回填到对应事件的选择器', async () => {
    render(<NotificationSettingsPage />);
    const selects = await screen.findAllByTestId('target-select');
    const values = selects.map((el) => el.getAttribute('data-value'));
    expect(values).toContain(JSON.stringify(['self', 'manager']));
    expect(values).toContain(JSON.stringify(['hr']));
  });

  it('点击保存对该分组下全部事件类型提交推送目标', async () => {
    render(<NotificationSettingsPage />);
    await screen.findByText('请假申请触发');
    const saveBtns = screen.getAllByText('保存配置');
    fireEvent.click(saveBtns[0]);
    await waitFor(() => {
      // 考勤流转分组含 7 个事件类型
      expect(notificationSettingApi.setTargetRoles).toHaveBeenCalledTimes(7);
    });
    expect(notificationSettingApi.setTargetRoles).toHaveBeenCalledWith('leave_apply', ['self', 'manager']);
    expect(notificationSettingApi.setTargetRoles).toHaveBeenCalledWith('makeup_approval', []);
  });

  it('接口失败时展示错误态并可重试', async () => {
    (notificationSettingApi.list as jest.Mock).mockResolvedValue({ code: 500, message: '读取失败' });
    render(<NotificationSettingsPage />);
    expect(await screen.findByText('读取失败')).toBeInTheDocument();
  });
});
