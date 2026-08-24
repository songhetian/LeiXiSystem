import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmployeeDetailTabs from '@/features/employee/components/EmployeeDetailTabs';
import { attendanceApi } from '@/services/attendance';
import { employeeApi } from '@/services/employee';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getMonthlyList: jest.fn(),
    getBalanceList: jest.fn(),
  },
}));

jest.mock('@/services/employee', () => ({
  employeeApi: {
    getTimeline: jest.fn(),
  },
}));

// Arco 精简为可测试容器
jest.mock('@arco-design/web-react', () => {
  const React = require('react');
  const TabPane = ({ title, children }: any) => (
    <div data-testid="tabpane" data-title={title}>{children}</div>
  );
  const Tabs = ({ children }: any) => <div data-testid="tabs">{children}</div>;
  Tabs.TabPane = TabPane;
  const TimelineItem = ({ children }: any) => <div data-testid="timeline-item">{children}</div>;
  const Timeline = ({ children }: any) => <div data-testid="timeline">{children}</div>;
  Timeline.Item = TimelineItem;
  return {
    Tabs,
    TabPane,
    Table: ({ columns, data }: any) => (
      <div data-testid="arco-table">
        {data.map((row: any) => (
          <div key={row[columns[0]?.dataIndex] ?? row.id} data-testid="table-row">
            {columns.map((c: any) => (
              <span key={c.dataIndex} data-testid={`cell-${c.dataIndex}`}>
                {c.render ? c.render(row[c.dataIndex]) : row[c.dataIndex]}
              </span>
            ))}
          </div>
        ))}
      </div>
    ),
    Timeline,
    TimelineItem,
    Spin: ({ children }: any) => <div>{children}</div>,
    Empty: ({ description }: any) => <div data-testid="empty">{description}</div>,
    Tag: ({ children }: any) => <span>{children}</span>,
  };
});

const monthly = [
  {
    id: 1,
    employeeId: 1,
    month: '2026-08',
    workDays: 22,
    lateCount: 1,
    absentDays: 0,
    overtimeHours: 6,
    totalWorkHours: 176,
    status: 'confirmed',
    employeeNo: 'E001',
    employeeName: '张三',
    departmentName: '技术部',
  },
];

const balances = [
  {
    id: 1,
    employeeId: 1,
    vacationTypeId: 1,
    year: 2026,
    totalDays: 5,
    usedDays: 2,
    vacationType: { id: 1, name: '年假' },
  },
];

const timeline = [
  {
    id: 'evt-1',
    employeeId: 1,
    employeeName: '张三',
    employeeNo: 'E001',
    type: 'hire' as const,
    occurredAt: '2026-01-01',
    detailText: '入职',
  },
];

describe('EmployeeDetailTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (attendanceApi.getMonthlyList as jest.Mock).mockResolvedValue({
      code: 0, data: { list: monthly, total: 1, page: 1, pageSize: 12 },
    });
    (attendanceApi.getBalanceList as jest.Mock).mockResolvedValue({
      code: 0, data: { list: balances, total: 1 },
    });
    (employeeApi.getTimeline as jest.Mock).mockResolvedValue({
      code: 0, data: { list: timeline, total: 1, page: 1, pageSize: 20 },
    });
  });

  it('打开时按 employeeId 拉取考勤/假期/履历三类数据', async () => {
    render(<EmployeeDetailTabs employeeId={1} />);
    await waitFor(() => {
      expect(attendanceApi.getMonthlyList).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 1 }),
      );
      expect(attendanceApi.getBalanceList).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 1 }),
      );
      expect(employeeApi.getTimeline).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 1 }),
      );
    });
  });

  it('渲染三个维度 Tab：考勤 / 假期 / 履历', async () => {
    render(<EmployeeDetailTabs employeeId={1} />);
    await waitFor(() => {
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
    });
    const panes = screen.getAllByTestId('tabpane');
    const titles = panes.map((p) => p.getAttribute('data-title'));
    expect(titles).toContain('考勤');
    expect(titles).toContain('假期');
    expect(titles).toContain('履历');
  });

  it('考勤 Tab 展示月报行数据（按月/出勤/迟到/加班）', async () => {
    render(<EmployeeDetailTabs employeeId={1} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('cell-month').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByTestId('cell-month')[0]).toHaveTextContent('2026-08');
    expect(screen.getAllByTestId('cell-overtimeHours')[0]).toHaveTextContent('6');
  });

  it('假期 Tab 展示休假额度（类型/总额/已用/剩余）', async () => {
    render(<EmployeeDetailTabs employeeId={1} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('cell-vacationType').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByTestId('cell-vacationType')[0]).toHaveTextContent('年假');
    expect(screen.getAllByTestId('cell-usedDays')[0]).toHaveTextContent('2');
  });

  it('履历 Tab 展示时间线事件', async () => {
    render(<EmployeeDetailTabs employeeId={1} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('timeline-item').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('入职')).toBeInTheDocument();
  });
});