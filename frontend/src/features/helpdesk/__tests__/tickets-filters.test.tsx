import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import HelpdeskTicketsPage from '@/features/helpdesk/pages/tickets';
import { helpdeskApi } from '@/services/helpdesk';
import { systemApi } from '@/services/system';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/helpdesk', () => ({
  helpdeskApi: { listTickets: jest.fn(), listSlas: jest.fn() },
}));

jest.mock('@/services/system', () => ({
  systemApi: { listUsers: jest.fn() },
}));

// 权限 mock 可配置：默认全放行，按钮级权限用例内单独覆盖（入参为权限点 code）
const mockCan = jest.fn((_code: string) => true);
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: mockCan }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

// 用原生 select 复刻 Arco Select 的 onChange 语义：清空（allowClear）回调 undefined
jest.mock('@arco-design/web-react', () => {
  const original = jest.requireActual('@arco-design/web-react');
  const Option = ({ value, children }: any) => <option value={value}>{children}</option>;
  const Select = ({ value, onChange, children, options, placeholder }: any) => {
    // SearchForm 以 options 数组传选项（且自带“全部”首项），旧式组件以 children 传
    const rendered = Array.isArray(options)
      ? options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)
      : children;
    return (
      <select
        data-testid={`select-${placeholder}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      >
        {rendered}
      </select>
    );
  };
  Select.Option = Option;
  return {
    ...original,
    Select,
    Message: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
  };
});

describe('HelpdeskTicketsPage 筛选', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    // 重置为全放行，避免按钮级权限用例的实现泄漏到筛选用例
    mockCan.mockImplementation(() => true);
    (helpdeskApi.listTickets as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [], total: 0 },
    });
    (helpdeskApi.listSlas as jest.Mock).mockResolvedValue({ code: 0, data: { list: [], total: 0 } });
    (systemApi.listUsers as jest.Mock).mockResolvedValue({ code: 0, data: { list: [] } });
  });

  it('清空「状态」后不应把字符串 "undefined" 当作筛选值发给服务端', async () => {
    const user = userEvent.setup();
    render(<HelpdeskTicketsPage />);

    await waitFor(() => expect(helpdeskApi.listTickets).toHaveBeenCalled());

    await user.selectOptions(screen.getByTestId('select-全部状态'), 'open');
    await waitFor(() =>
      expect(helpdeskApi.listTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'open' }),
      ),
    );

    await user.selectOptions(screen.getByTestId('select-全部状态'), '');

    // 清空后不得产生 status="undefined" 的请求（Arco allowClear 回调 undefined 被 String() 污染）
    await act(async () => {});
    const args = (helpdeskApi.listTickets as jest.Mock).mock.calls.map((c) => c[0]);
    expect(args.some((a) => a.status === 'undefined')).toBe(false);
  });

  it('清空「优先级」后不应把字符串 "undefined" 当作筛选值发给服务端', async () => {
    const user = userEvent.setup();
    render(<HelpdeskTicketsPage />);

    await waitFor(() => expect(helpdeskApi.listTickets).toHaveBeenCalled());

    await user.selectOptions(screen.getByTestId('select-全部优先级'), 'high');
    await waitFor(() =>
      expect(helpdeskApi.listTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ priority: 'high' }),
      ),
    );

    await user.selectOptions(screen.getByTestId('select-全部优先级'), '');

    await act(async () => {});
    const args = (helpdeskApi.listTickets as jest.Mock).mock.calls.map((c) => c[0]);
    expect(args.some((a) => a.priority === 'undefined')).toBe(false);
  });

  it('接口失败时展示真实错误信息，而不是被吞成兜底文案', async () => {
    (helpdeskApi.listTickets as jest.Mock).mockRejectedValue(new Error('后端不可用'));

    render(<HelpdeskTicketsPage />);

    await waitFor(() => expect(screen.getByText('后端不可用')).toBeInTheDocument());
    expect(screen.queryByText('获取工单列表失败')).not.toBeInTheDocument();
  });
});

describe('HelpdeskTicketsPage 按钮级权限（PermissionGate）', () => {
  const mockTicket = {
    id: 1,
    ticketNo: 'T001',
    title: '打印机故障',
    category: '办公设备',
    status: 'open',
    priority: 'high',
    requester: { id: 2, name: '王小明' },
    assignee: null,
  };
  const mockSla = {
    id: 1,
    name: '紧急工单',
    priority: 'urgent',
    firstResponseMinutes: 60,
    resolutionMinutes: 480,
    enabled: true,
  };

  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockCan.mockImplementation(() => true);
    (helpdeskApi.listTickets as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [mockTicket], total: 1 },
    });
    (helpdeskApi.listSlas as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [mockSla], total: 1 },
    });
    (systemApi.listUsers as jest.Mock).mockResolvedValue({ code: 0, data: { list: [] } });
  });

  it('有 helpdesk:manage 时工单写按钮渲染（新建工单/指派更新/删除）', async () => {
    mockCan.mockImplementation(
      (code: string) => code === 'helpdesk:view' || code === 'helpdesk:manage' || code === 'helpdesk:sla:manage',
    );
    render(<HelpdeskTicketsPage />);
    expect(await screen.findByText('新建工单')).toBeInTheDocument();
    expect(await screen.findByText('打印机故障')).toBeInTheDocument();
    expect(screen.getByText('指派/更新')).toBeInTheDocument();
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  it('无 helpdesk:manage 时工单写按钮不渲染，列表仍可查看', async () => {
    mockCan.mockImplementation((code: string) => code === 'helpdesk:view' || code === 'helpdesk:sla:manage');
    render(<HelpdeskTicketsPage />);
    await waitFor(() => expect(helpdeskApi.listTickets).toHaveBeenCalled());
    expect(screen.queryByText('新建工单')).not.toBeInTheDocument();
    expect(screen.queryByText('指派/更新')).not.toBeInTheDocument();
    // 工单数据本身仍展示（helpdesk:view 可看）
    expect(await screen.findByText('打印机故障')).toBeInTheDocument();
  });

  it('无 helpdesk:sla:manage 时 SLA 配置按钮不渲染，工单按钮不受影响', async () => {
    mockCan.mockImplementation((code: string) => code === 'helpdesk:view' || code === 'helpdesk:manage');
    render(<HelpdeskTicketsPage />);
    await waitFor(() => expect(helpdeskApi.listSlas).toHaveBeenCalled());
    // SLA 写按钮（新建 + 行内编辑/删除）不渲染，与 helpdesk:manage 解耦
    expect(screen.queryByText('新建 SLA')).not.toBeInTheDocument();
    expect(screen.queryByText('编辑')).not.toBeInTheDocument();
    // 工单管理按钮正常渲染
    expect(screen.getByText('新建工单')).toBeInTheDocument();
  });
});