import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ReportsPage from '@/features/reports/pages/index';
import { reportsApi } from '@/services/reports';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/reports', () => ({
  reportsApi: {
    getAttendanceMonthly: jest.fn(),
    getLaborCost: jest.fn(),
    getEmployeeStructure: jest.fn(),
    createExportTask: jest.fn(),
    listExportTasks: jest.fn(),
    employeeListExportUrl: jest.fn(() => '/api/v1/reports/employee-list/export?format=xlsx'),
  },
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ action, children }: any) => (
    <div data-testid="page-container">
      <div data-testid="page-action">{action}</div>
      {children}
    </div>
  ),
}));

// ProTable 自带 DataState：这里按其语义复刻（有 error 时不渲染表格，只给错误 + 重试）
jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, loading, error, onRetry }: any) => (
    <div data-testid="pro-table" data-loading={!!loading}>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          {onRetry && <button onClick={onRetry}>重试</button>}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              {columns.map((c: any) => (
                <th key={c.dataIndex}>{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row: any) => (
              <tr key={row[rowKey]}>
                {columns.map((c: any) => (
                  <td key={c.dataIndex}>
                    {c.render ? c.render(row[c.dataIndex], row, 0) : row[c.dataIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  ),
}));

jest.mock('@arco-design/web-react', () => {
  const Card = ({ title, children }: any) => (
    <section data-testid={`card-${title}`}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
  const Statistic = ({ title, value, prefix, suffix, precision }: any) => (
    <div
      data-testid={`stat-${title}`}
      data-value={String(value)}
      data-value-type={typeof value}
      data-prefix={prefix ?? ''}
      data-precision={precision ?? ''}
    >
      {prefix}
      {String(value)}
      {suffix}
    </div>
  );
  const Row = ({ children }: any) => <div>{children}</div>;
  const Col = ({ children }: any) => <div>{children}</div>;
  const Space = ({ children }: any) => <div>{children}</div>;
  const Button = ({ children, onClick, disabled, loading }: any) => (
    <button onClick={onClick} disabled={!!disabled} data-loading={!!loading}>
      {children}
    </button>
  );
  const MonthPicker = ({ value, onChange, placeholder, allowClear }: any) => (
    <input
      aria-label={placeholder || 'month-picker'}
      data-allow-clear={String(!!allowClear)}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
  const DatePicker: any = {};
  DatePicker.MonthPicker = MonthPicker;

  return {
    Card,
    Statistic,
    Grid: { Row, Col },
    Space,
    Button,
    DatePicker,
    Message: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
    // DataState 依赖项
    Result: ({ subTitle, extra }: any) => (
      <div>
        <p>{subTitle}</p>
        {extra}
      </div>
    ),
    Empty: ({ description }: any) => <div>{description}</div>,
    Skeleton: () => null,
  };
});

const ATTENDANCE = {
  code: 0,
  data: {
    summary: {
      totalEmployees: 12,
      totalWorkDays: '210.00',
      totalLateCount: 3,
      totalEarlyCount: 1,
      totalAbsentDays: '2.50',
      totalOvertimeHours: '18.00',
    },
    departments: [
      {
        id: 1,
        name: '技术部',
        employeeCount: 8,
        totalWorkDays: '140.00',
        totalLateCount: 2,
        totalEarlyCount: 1,
        totalAbsentDays: '1.00',
        totalOvertimeHours: '12.00',
      },
    ],
  },
};

const LABOR = {
  code: 0,
  data: {
    summary: {
      totalEmployees: 12,
      totalBaseSalary: '120000.00',
      totalOvertimePay: '5000.50',
      totalDeduction: '0.00',
      totalAmount: '125000.50',
    },
    departments: [{ id: 1, name: '技术部', totalEmployees: 8, totalAmount: '98765.40' }],
  },
};

const STRUCTURE = { code: 0, data: { total: 12, onProbation: 2, avgTenure: { formatted: '2.5 年' } } };

const TASKS = {
  code: 0,
  data: {
    list: [
      {
        id: 3,
        type: 'attendance-monthly',
        format: 'xlsx',
        month: '2026-09',
        status: 'completed',
        createdAt: '2026-09-30T02:00:00.000Z',
      },
    ],
    total: 1,
  },
};

describe('ReportsPage（报表中心）', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    (reportsApi.getAttendanceMonthly as jest.Mock).mockResolvedValue(ATTENDANCE);
    (reportsApi.getLaborCost as jest.Mock).mockResolvedValue(LABOR);
    (reportsApi.getEmployeeStructure as jest.Mock).mockResolvedValue(STRUCTURE);
    (reportsApi.listExportTasks as jest.Mock).mockResolvedValue(TASKS);
  });

  it('人力成本表格金额按 formatMoney 输出（千分位 + 两位小数）', async () => {
    render(<ReportsPage />);
    expect(await screen.findByText('¥ 98,765.40')).toBeInTheDocument();
  });

  it('人力成本汇总用数值 + ¥ 前缀 + 两位小数，而非原样字符串', async () => {
    render(<ReportsPage />);

    const base = screen.getByTestId('stat-基础工资');
    await waitFor(() => expect(base).toHaveAttribute('data-value', '120000'));
    expect(base).toHaveAttribute('data-value-type', 'number');
    expect(base).toHaveAttribute('data-prefix', '¥');
    expect(base).toHaveAttribute('data-precision', '2');

    const total = screen.getByTestId('stat-合计');
    expect(total).toHaveAttribute('data-value', '125000.5');
    expect(total).toHaveAttribute('data-prefix', '¥');
  });

  it('导出任务状态走 StatusTag，展示业务文案而非原始 status', async () => {
    render(<ReportsPage />);
    const tag = await screen.findByTestId('status-tag');
    expect(tag).toHaveTextContent('已完成');
    expect(tag).toHaveAttribute('data-color', 'green');
  });

  it('导出任务类型/格式展示业务文案，不把后端编码直接摊给用户', async () => {
    render(<ReportsPage />);
    expect(await screen.findByText('考勤月报')).toBeInTheDocument();
    expect(screen.queryByText('attendance-monthly')).toBeNull();
    expect(screen.getByText('XLSX')).toBeInTheDocument();
  });

  it('切换月份后按新月份重新拉取报表', async () => {
    render(<ReportsPage />);
    await screen.findByText('¥ 98,765.40');

    const picker = screen.getByLabelText('选择月份');
    fireEvent.change(picker, { target: { value: '2026-08' } });

    await waitFor(() =>
      expect(reportsApi.getAttendanceMonthly).toHaveBeenLastCalledWith('2026-08'),
    );
    expect(reportsApi.getLaborCost).toHaveBeenLastCalledWith('2026-08');
  });

  it('报表接口业务码非 0 时展示错误态，重试后恢复数据', async () => {
    (reportsApi.getAttendanceMonthly as jest.Mock).mockResolvedValueOnce({
      code: 500,
      message: '考勤月报读取失败',
    });
    render(<ReportsPage />);

    await waitFor(() =>
      expect(screen.getAllByText('考勤月报读取失败').length).toBeGreaterThan(0),
    );
    // 失败时不应把 0 当真实数据摆出来
    expect(screen.queryByTestId('stat-员工数')).toBeNull();

    (reportsApi.getAttendanceMonthly as jest.Mock).mockResolvedValue(ATTENDANCE);
    await userEvent.click(screen.getAllByText('重试')[0]);

    await waitFor(() => expect(screen.getByTestId('stat-员工数')).toHaveTextContent('12'));
  });
});
