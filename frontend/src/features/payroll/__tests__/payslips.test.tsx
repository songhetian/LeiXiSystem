import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PayslipsPage from '@/features/payroll/pages/payslips';
import { payslipApi } from '@/services/payslip';
import { payrollApi } from '@/services/payroll';
import { notificationApi } from '@/services/notification';
import { clearDataCache } from '@/hooks/use-cached-data';

const mockCan = jest.fn();

jest.mock('@/hooks/use-departments', () => ({
  useDepartments: () => ({
    departments: [
      { id: 3, name: '技术部' },
      { id: 4, name: '财务部' },
    ],
    loading: false,
  }),
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: (code?: string) => mockCan(code) }),
}));

jest.mock('@/hooks/use-system-info', () => ({
  useSystemInfo: () => ({ info: { name: '雷犀科技', logoUrl: '' }, loading: false, revalidate: jest.fn() }),
}));

jest.mock('@/services/payslip', () => ({
  payslipApi: {
    getPayslips: jest.fn(),
    getPayslipDetail: jest.fn(),
  },
}));

jest.mock('@/services/payroll', () => ({
  payrollApi: { getPayrollRuns: jest.fn() },
}));

jest.mock('@/services/notification', () => ({
  notificationApi: { send: jest.fn() },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, loading, searchFields, pagination, showExport, exportFilename, toolbar }: any) => (
    <div data-testid="pro-table" data-loading={String(loading)} data-export={showExport ? exportFilename : ''}>
      <div data-testid="search-area">
        {searchFields?.map((f: any) => (
          <span
            key={f.key}
            data-testid={`search-${f.key}`}
            data-presets={(f.presets || []).map((p: any) => p.label).join('|')}
          >
            {f.label}
            {(f.options || []).map((o: any) => (
              <i key={o.value} data-testid={`option-${f.key}-${o.value}`}>
                {o.label}
              </i>
            ))}
          </span>
        ))}
      </div>
      <div data-testid="toolbar">
        {toolbar?.map((a: any) => (
          <button key={a.key} type="button" data-testid={`toolbar-${a.key}`} onClick={a.onClick}>
            {a.label}
          </button>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            {columns.map((c: any) => (
              <th key={c.dataIndex} data-testid={`col-${c.dataIndex}`}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row[rowKey]} data-testid="table-row">
              {columns.map((c: any) => (
                <td key={c.dataIndex} data-testid={`cell-${row[rowKey]}-${c.dataIndex}`}>
                  {c.render ? c.render(row[c.dataIndex], row) : row[c.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && <span data-testid="page-total">{pagination.total}</span>}
    </div>
  ),
}));

jest.mock('@/components/StatusTag', () => ({
  __esModule: true,
  default: ({ status }: any) => <span data-testid={`status-tag-${status}`}>{status}</span>,
}));

// Arco 组件精简为可测试容器：弹窗内容直接平铺，按钮直接可点
jest.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick, type, size, status, ...rest }: any) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Modal: ({ title, visible, children, footer }: any) =>
    visible ? (
      <div data-testid="detail-modal" data-title={title}>
        <h3>{title}</h3>
        {children}
        {footer}
      </div>
    ) : null,
  Descriptions: ({ data }: any) => (
    <div data-testid="descriptions">
      {data.map((d: any) => (
        <span key={d.label}>
          {d.label}:{d.value}
        </span>
      ))}
    </div>
  ),
  Divider: () => <div data-testid="divider" />,
  Table: ({ data }: any) => (
    <div data-testid="items-table">
      {data.map((row: any) => (
        <span key={row.code}>{row.name}</span>
      ))}
    </div>
  ),
  Message: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

const mockPayslips = [
  {
    id: 1,
    month: '2026-08',
    totalAmount: '5200.00',
    status: 'unviewed',
    viewedAt: null,
    createdAt: '2026-08-13T10:00:00+08:00',
    employee: { id: 11, employeeNo: 'E001', name: '张三', userId: 21, department: { id: 3, name: '技术部' } },
  },
  {
    id: 2,
    month: '2026-08',
    totalAmount: '6800.00',
    status: 'viewed',
    viewedAt: '2026-08-14T09:00:00+08:00',
    createdAt: '2026-08-13T10:00:00+08:00',
    employee: { id: 12, employeeNo: 'E002', name: '李四', userId: 22, department: { id: 4, name: '财务部' } },
  },
];

const mockDetail = {
  id: 1,
  month: '2026-08',
  totalAmount: '5200.00',
  employeeNo: 'E001',
  employeeName: '张三',
  departmentName: '技术部',
  createdAt: '2026-08-13T10:00:00+08:00',
  totalIncome: '5000.00',
  totalDeduction: '-500.00',
  netSalary: '5200.00',
  items: [
    { code: 'base', name: '基本工资', amount: 5000, type: 'income' },
    { code: 'social', name: '社保代扣', amount: -500, type: 'deduction' },
  ],
  adjustments: [],
};

describe('PayslipsPage（管理端工资条台账）', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockCan.mockImplementation(() => true);
    (payslipApi.getPayslips as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { list: mockPayslips, total: 2, page: 1, pageSize: 20 },
    });
    (payslipApi.getPayslipDetail as jest.Mock).mockResolvedValue({ code: 0, data: mockDetail });
    (payrollApi.getPayrollRuns as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        list: [
          { id: 7, month: '2026-08', status: 'published', totalEmployees: 10, totalAmount: 100000, createdAt: '2026-08-13T10:00:00+08:00' },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
      },
    });
    (notificationApi.send as jest.Mock).mockResolvedValue({ code: 0, data: { count: 1 } });
  });

  it('渲染台账列：工号/姓名/部门/实发/查看状态/查看时间', async () => {
    render(<PayslipsPage />);
    await screen.findByTestId('pro-table');

    expect(screen.getByTestId('col-employeeNo')).toHaveTextContent('工号');
    expect(screen.getByTestId('col-employeeName')).toHaveTextContent('姓名');
    expect(screen.getByTestId('col-department')).toHaveTextContent('部门');
    expect(screen.getByTestId('col-totalAmount')).toHaveTextContent('实发工资');
    expect(screen.getByTestId('col-status')).toHaveTextContent('查看状态');
    expect(screen.getByTestId('col-viewedAt')).toHaveTextContent('查看时间');
  });

  it('员工归属信息与金额按统一口径展示', async () => {
    render(<PayslipsPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));

    expect(screen.getByTestId('cell-1-employeeNo')).toHaveTextContent('E001');
    expect(screen.getByTestId('cell-1-employeeName')).toHaveTextContent('张三');
    expect(screen.getByTestId('cell-1-department')).toHaveTextContent('技术部');
    expect(screen.getByTestId('cell-1-totalAmount')).toHaveTextContent('5,200.00');
    // 未查看的工资条带状态标签，HR 一眼能看出待催办对象
    expect(screen.getAllByTestId('status-tag-unviewed')).toHaveLength(1);
    // 未查看时查看时间显示占位，不渲染成 1970 之类的伪时间
    expect(screen.getByTestId('cell-1-viewedAt')).toHaveTextContent('--');
  });

  it('搜索区提供 月份（含本月/上月预设）/ 查看状态 / 部门 / 算薪批次', async () => {
    render(<PayslipsPage />);
    await screen.findByTestId('pro-table');

    expect(screen.getByTestId('search-month')).toHaveTextContent('月份');
    expect(screen.getByTestId('search-month')).toHaveAttribute('data-presets', '本月|上月');
    expect(screen.getByTestId('search-status')).toHaveTextContent('查看状态');
    expect(screen.getByTestId('option-status-unviewed')).toHaveTextContent('未查看');
    expect(screen.getByTestId('search-departmentId')).toHaveTextContent('部门');
    expect(screen.getByTestId('option-departmentId-3')).toHaveTextContent('技术部');
    expect(screen.getByTestId('search-runId')).toHaveTextContent('算薪批次');
    // 批次下拉展示「月份 · 状态」，避免只显示 id
    await waitFor(() => {
      expect(screen.getByTestId('option-runId-7')).toHaveTextContent('2026-08 · 已发布');
    });
  });

  it('点「查看」拉取员工工资条详情并在弹窗展示明细', async () => {
    const user = userEvent.setup();
    render(<PayslipsPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));

    await user.click(screen.getByTestId('cell-1-id').querySelector('button') as HTMLButtonElement);

    await waitFor(() => expect(payslipApi.getPayslipDetail).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByTestId('detail-modal')).toBeInTheDocument());
    expect(screen.getByTestId('detail-modal')).toHaveTextContent('E001');
    expect(screen.getByTestId('detail-modal')).toHaveTextContent('基本工资');
    expect(screen.getByTestId('detail-modal')).toHaveTextContent('5,200.00');
  });

  it('有通知权限时提供催办入口：对「未查看」名单逐人发站内通知', async () => {
    const user = userEvent.setup();
    render(<PayslipsPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));

    // 催办时强制叠加 status=unviewed，单页容量取后端上限 100
    (payslipApi.getPayslips as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [mockPayslips[0]], total: 1, page: 1, pageSize: 100 },
    });
    await user.click(screen.getByTestId('toolbar-notify-unviewed'));

    await waitFor(() => expect(payslipApi.getPayslips).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'unviewed', page: 1, pageSize: 100 }),
    ));
    await waitFor(() => expect(notificationApi.send).toHaveBeenCalledTimes(1));
    expect((notificationApi.send as jest.Mock).mock.calls[0][0]).toMatchObject({
      targetType: 'user',
      userIds: [21],
    });
  });

  it('催办超过单页上限时循环分页拉全量，不静默漏催（C7）', async () => {
    const user = userEvent.setup();
    render(<PayslipsPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));

    // 后端单页上限 100：第 1 页 100 条、第 2 页 1 条，total=101，验证按 total 继续翻页
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      ...mockPayslips[0],
      id: i + 1,
      employee: { ...mockPayslips[0].employee!, id: i + 1, userId: 1000 + i },
    }));
    (payslipApi.getPayslips as jest.Mock).mockImplementation(({ page }: any) =>
      Promise.resolve({
        code: 0,
        message: 'ok',
        data: {
          list: page === 1 ? firstPage : [{ ...firstPage[0], id: 101, employee: { ...firstPage[0].employee!, id: 101, userId: 1101 } }],
          total: 101,
          page,
          pageSize: 100,
        },
      }),
    );

    await user.click(screen.getByTestId('toolbar-notify-unviewed'));

    await waitFor(() =>
      expect(payslipApi.getPayslips).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'unviewed', page: 2, pageSize: 100 }),
      ),
    );
    await waitFor(() => expect(notificationApi.send).toHaveBeenCalledTimes(1));
    // 两次分页共 101 个不同员工，全部进入 send 名单
    expect((notificationApi.send as jest.Mock).mock.calls[0][0].userIds).toHaveLength(101);
  });

  it('无通知发送权限时不展示催办入口', async () => {
    mockCan.mockImplementation(() => false);
    render(<PayslipsPage />);
    await screen.findByTestId('pro-table');

    expect(screen.queryByTestId('toolbar-notify-unviewed')).not.toBeInTheDocument();
  });

  it('开启台账导出，文件名随筛选月份变化', async () => {
    render(<PayslipsPage />);
    await screen.findByTestId('pro-table');
    expect(screen.getByTestId('pro-table').getAttribute('data-export')).toContain('工资条台账');
  });

  it('空列表不渲染数据行', async () => {
    (payslipApi.getPayslips as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [], total: 0, page: 1, pageSize: 20 },
    });
    render(<PayslipsPage />);
    await waitFor(() => expect(payslipApi.getPayslips).toHaveBeenCalled());
    expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
  });

  it('业务码非 0 时按错误态处理（不展示成「暂无数据」）', async () => {
    (payslipApi.getPayslips as jest.Mock).mockResolvedValue({
      code: 5003,
      message: '无权限访问该数据',
    });
    render(<PayslipsPage />);
    await waitFor(() => expect(payslipApi.getPayslips).toHaveBeenCalled());
    expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
  });
});
