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

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

// 用原生 select 复刻 Arco Select 的 onChange 语义：清空（allowClear）回调 undefined
jest.mock('@arco-design/web-react', () => {
  const original = jest.requireActual('@arco-design/web-react');
  const Option = ({ value, children }: any) => <option value={value}>{children}</option>;
  const Select = ({ value, onChange, children, placeholder }: any) => (
    <select
      data-testid={`select-${placeholder}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
    >
      <option value="">全部</option>
      {children}
    </select>
  );
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