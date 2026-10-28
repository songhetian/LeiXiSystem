import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import OkrPage from '@/features/performance/pages/okr';
import { okrApi } from '@/services/performance';
import { employeeApi } from '@/services/employee';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/performance', () => ({
  okrApi: { listObjectives: jest.fn() },
}));

jest.mock('@/lib/excel', () => ({
  exportToExcel: jest.fn(() => true),
}));

jest.mock('@/services/employee', () => ({
  employeeApi: { getList: jest.fn() },
}));

jest.mock('@/services/system', () => ({
  systemApi: {},
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@/hooks/use-departments', () => ({
  useDepartments: () => ({ departments: [] }),
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

const mockObjectives = [
  { id: 1, title: '目标A', type: 'personal', status: 'active', period: '2026Q3', progress: 10 },
  { id: 2, title: '目标B', type: 'department', status: 'completed', period: '2026Q3', progress: 100 },
];

describe('OkrPage 筛选清空', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    (okrApi.listObjectives as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockObjectives },
    });
    (employeeApi.getList as jest.Mock).mockResolvedValue({ code: 0, data: { list: [] } });
  });

  it('清空「目标类型」后列表保持完整，不应被 "undefined" 过滤为空', async () => {
    const user = userEvent.setup();
    render(<OkrPage />);

    await waitFor(() => expect(screen.getByText('共 2 个 OKR 目标')).toBeInTheDocument());

    await user.selectOptions(screen.getByTestId('select-全部类型'), '');

    await waitFor(() => expect(screen.getByText('共 2 个 OKR 目标')).toBeInTheDocument());
  });

  it('选中再清空「目标类型」，应恢复全量列表', async () => {
    const user = userEvent.setup();
    render(<OkrPage />);

    await waitFor(() => expect(screen.getByText('共 2 个 OKR 目标')).toBeInTheDocument());

    await user.selectOptions(screen.getByTestId('select-全部类型'), 'department');
    await waitFor(() => expect(screen.getByText('共 1 个 OKR 目标')).toBeInTheDocument());

    await user.selectOptions(screen.getByTestId('select-全部类型'), '');
    await waitFor(() => expect(screen.getByText('共 2 个 OKR 目标')).toBeInTheDocument());
  });

  it('清空「状态」后列表保持完整', async () => {
    const user = userEvent.setup();
    render(<OkrPage />);

    await waitFor(() => expect(screen.getByText('共 2 个 OKR 目标')).toBeInTheDocument());

    await user.selectOptions(screen.getByTestId('select-全部状态'), 'completed');
    await waitFor(() => expect(screen.getByText('共 1 个 OKR 目标')).toBeInTheDocument());

    await user.selectOptions(screen.getByTestId('select-全部状态'), '');
    await waitFor(() => expect(screen.getByText('共 2 个 OKR 目标')).toBeInTheDocument());
  });

  it('接口失败时展示错误态与重试入口，点击重试重新拉取', async () => {
    (okrApi.listObjectives as jest.Mock).mockRejectedValueOnce(new Error('目标加载失败'));
    render(<OkrPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('目标加载失败'));

    (okrApi.listObjectives as jest.Mock).mockResolvedValue({ code: 0, data: { list: mockObjectives } });
    await userEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(screen.getByText('共 2 个 OKR 目标')).toBeInTheDocument());
  });

  it('目标卡片的起止日期按 YYYY-MM-DD 展示，不把后端的 ISO 串直接摊出来', async () => {
    (okrApi.listObjectives as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        list: [
          {
            ...mockObjectives[0],
            // @db.Date 经 JSON 序列化后的真实形状
            startDate: '2026-07-01T00:00:00.000Z',
            endDate: '2026-09-30T00:00:00.000Z',
          },
        ],
      },
    });
    render(<OkrPage />);

    expect(await screen.findByText(/2026-07-01 ~ 2026-09-30/)).toBeInTheDocument();
    expect(screen.queryByText(/T00:00:00\.000Z/)).not.toBeInTheDocument();
  });

  it('导出时起止日期同样格式化（Excel 里不该出现 ISO 串）', async () => {
    const { exportToExcel } = require('@/lib/excel');
    const row = {
      ...mockObjectives[0],
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-09-30T00:00:00.000Z',
    };
    (okrApi.listObjectives as jest.Mock).mockResolvedValue({ code: 0, data: { list: [row] } });
    render(<OkrPage />);
    await screen.findByText('共 1 个 OKR 目标');

    await userEvent.click(screen.getByRole('button', { name: '导出 Excel' }));

    await waitFor(() => expect(exportToExcel).toHaveBeenCalled());
    const [, , columns] = (exportToExcel as jest.Mock).mock.calls[0];
    const byTitle = (title: string) => columns.find((c: any) => c.title === title);
    expect(byTitle('开始日期').value(row)).toBe('2026-07-01');
    expect(byTitle('结束日期').value(row)).toBe('2026-09-30');
  });
});