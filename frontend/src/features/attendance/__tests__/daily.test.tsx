import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AttendanceDailyPage from '@/features/attendance/pages/daily';
import { attendanceApi } from '@/services/attendance';
import { exportToExcel } from '@/lib/excel';
import { clearDataCache } from '@/hooks/use-cached-data';

// Modal.confirm 只截获入参：真实弹窗会渲染到独立 root，脱离 act 产生告警，
// 这里由用例显式调用 onOk 来断言「确认后才重算」
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  return {
    ...actual,
    Modal: Object.assign(actual.Modal, { confirm: jest.fn() }),
  };
});

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getDailyList: jest.fn(),
    recalcDaily: jest.fn(),
    importPunchLogs: jest.fn(),
  },
}));

jest.mock('@/lib/excel', () => ({
  exportToExcel: jest.fn(() => true),
}));

jest.mock('@/hooks/use-departments', () => ({
  useDepartments: () => ({ departments: [], loading: false }),
}));

// 权限门：默认全放行，个别用例切到无权限
const mockCan = jest.fn((_code?: string) => true);
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: (code?: string) => mockCan(code) }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

// ProTable 只保留搜索字段、toolbar 与单元格接缝：本页断言点是字段映射与打卡时间戳
jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ data, error, toolbar = [], columns = [], searchFields = [] }: any) => (
    <div data-testid="pro-table" data-error={error ?? ''} data-rows={data.length}>
      {searchFields.map((f: any) => (
        <span key={f.key} data-testid={`search-${f.key}`} data-type={f.type}>
          {f.label}
        </span>
      ))}
      {toolbar.map((t: any) => (
        <button key={t.key} type="button" disabled={t.disabled} onClick={t.onClick}>
          {t.label}
        </button>
      ))}
      {data.map((row: any) => (
        <div key={row.id} data-testid="table-row">
          {columns.map((c: any) => (
            <span key={c.dataIndex} data-testid={`cell-${row.id}-${c.dataIndex}`}>
              {c.render ? c.render(row[c.dataIndex], row, 0) : row[c.dataIndex]}
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

// 后端 GET /attendance/daily 返回 Prisma 原始行：employee / shift 是嵌套对象，
// 打卡时间是 firstPunch / lastPunch，没有 workHours 字段
const lateRow = {
  id: 1,
  employeeId: 1,
  workDate: '2026-10-27T00:00:00.000Z',
  shiftId: 1,
  // 2026-10-27T01:09:00Z = 北京时间 09:09
  firstPunch: '2026-10-27T01:09:00.000Z',
  // 2026-10-27T10:00:00Z = 北京时间 18:00
  lastPunch: '2026-10-27T10:00:00.000Z',
  lateMinutes: 9,
  earlyMinutes: 0,
  overtimeMinutes: 90,
  status: 'late',
  employee: { id: 1, employeeNo: 'E001', name: '张三', department: { id: 2, name: '研发部' } },
  shift: { id: 1, name: '标准班', startTime: '09:00', endTime: '18:00' },
};

describe('AttendanceDailyPage（考勤日报）', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockCan.mockReturnValue(true);
    (attendanceApi.getDailyList as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [lateRow], total: 1, page: 1, pageSize: 20 },
    });
    (attendanceApi.importPunchLogs as jest.Mock).mockResolvedValue({ code: 0, data: { imported: 1 } });
    (attendanceApi.recalcDaily as jest.Mock).mockResolvedValue({ code: 0, data: { count: 1, taskId: 8 } });
  });

  it('按后端真实字段渲染工号/姓名/部门/日期/班次/打卡时间', async () => {
    render(<AttendanceDailyPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(1));

    expect(screen.getByTestId('cell-1-employeeNo')).toHaveTextContent('E001');
    expect(screen.getByTestId('cell-1-employeeName')).toHaveTextContent('张三');
    expect(screen.getByTestId('cell-1-departmentName')).toHaveTextContent('研发部');
    expect(screen.getByTestId('cell-1-workDate')).toHaveTextContent('2026-10-27');
    expect(screen.getByTestId('cell-1-shiftName')).toHaveTextContent('标准班');
    // 打卡时间按北京时间只取时分，不能把 ISO 串直接摊在单元格里
    expect(screen.getByTestId('cell-1-firstPunch')).toHaveTextContent('09:09');
    expect(screen.getByTestId('cell-1-lastPunch')).toHaveTextContent('18:00');
  });

  it('迟到/早退/加班按分钟口径展示，0 值显示 --', async () => {
    render(<AttendanceDailyPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(1));

    expect(screen.getByTestId('cell-1-lateMinutes')).toHaveTextContent('9');
    expect(screen.getByTestId('cell-1-earlyMinutes')).toHaveTextContent('--');
    expect(screen.getByTestId('cell-1-overtimeMinutes')).toHaveTextContent('1.5');
  });

  it('状态按后端枚举完整映射，late 展示「迟到」而非原始英文', async () => {
    render(<AttendanceDailyPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(1));
    expect(screen.getByTestId('cell-1-status')).toHaveTextContent('迟到');
  });

  it('筛选栏用员工选择器（后端只认 employeeId，工号文本会被忽略）', async () => {
    render(<AttendanceDailyPage />);
    await waitFor(() => expect(screen.getByTestId('pro-table')).toBeInTheDocument());
    expect(screen.getByTestId('search-employeeId')).toHaveAttribute('data-type', 'employee');
  });

  it('导出会翻页取全量（后端 pageSize 上限 100，写 10000 会被静默截断成第一页）', async () => {
    // 150 条：按后端上限要分 2 页才能取完
    const rows = Array.from({ length: 150 }, (_, i) => ({
      ...lateRow,
      id: i + 1,
      employee: { ...lateRow.employee, employeeNo: `E${String(i + 1).padStart(3, '0')}` },
    }));
    (attendanceApi.getDailyList as jest.Mock).mockImplementation(({ page, pageSize }: any) => ({
      code: 0,
      data: {
        list: rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
        total: rows.length,
        page,
        pageSize,
      },
    }));

    render(<AttendanceDailyPage />);
    await waitFor(() => expect(screen.getByTestId('pro-table')).toHaveAttribute('data-rows', '20'));

    fireEvent.click(screen.getByRole('button', { name: '导出 Excel' }));

    await waitFor(() => expect(exportToExcel).toHaveBeenCalled());
    const [, , , exported] = (exportToExcel as jest.Mock).mock.calls[0];
    expect(exported).toHaveLength(150);
    // 每页请求都不超过后端上限
    const pages = (attendanceApi.getDailyList as jest.Mock).mock.calls
      .map((c) => c[0])
      .filter((p: any) => p.pageSize !== 20)
      .map((p: any) => p.page);
    expect(pages).toEqual([1, 2]);
  });

  it('导出时嵌套字段与状态文案都按列表口径输出', async () => {
    render(<AttendanceDailyPage />);
    await waitFor(() => expect(screen.getByTestId('pro-table')).toHaveAttribute('data-rows', '1'));

    fireEvent.click(screen.getByRole('button', { name: '导出 Excel' }));

    await waitFor(() => expect(exportToExcel).toHaveBeenCalled());
    const [, , columns] = (exportToExcel as jest.Mock).mock.calls[0];
    const byTitle = (title: string) => columns.find((c: any) => c.title === title);

    expect(byTitle('工号').value(lateRow)).toBe('E001');
    expect(byTitle('姓名').value(lateRow)).toBe('张三');
    expect(byTitle('部门').value(lateRow)).toBe('研发部');
    expect(byTitle('日期').value(lateRow)).toBe('2026-10-27');
    expect(byTitle('上班打卡').value(lateRow)).toBe('09:09');
    expect(byTitle('下班打卡').value(lateRow)).toBe('18:00');
    expect(byTitle('加班(小时)').value(lateRow)).toBe('1.5');
    expect(byTitle('状态').value(lateRow)).toBe('迟到');
  });

  it('「重新计算」需二次确认，确认后按北京时间当月首末日重算', async () => {
    jest.useFakeTimers();
    // 2026-10-28T02:30:05Z = 北京时间 2026-10-28 10:30:05
    jest.setSystemTime(new Date('2026-10-28T02:30:05Z'));
    try {
      render(<AttendanceDailyPage />);
      await waitFor(() => expect(screen.getByRole('button', { name: '重新计算' })).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: '重新计算' }));
      // 点开按钮只是弹确认框，不能已经开始重算（会覆盖当月已生成日报）
      expect(attendanceApi.recalcDaily).not.toHaveBeenCalled();

      const { Modal: MockedModal } = require('@arco-design/web-react');
      expect(MockedModal.confirm).toHaveBeenCalledTimes(1);
      const opts = (MockedModal.confirm as jest.Mock).mock.calls[0][0];
      // 确认文案必须写清重算范围与「覆盖」后果
      expect(opts.content).toContain('2026-10-01 ~ 2026-10-31');
      expect(opts.content).toContain('覆盖');

      await act(async () => {
        await opts.onOk();
      });

      expect(attendanceApi.recalcDaily).toHaveBeenCalledWith({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });
      // 重算成功后刷新列表
      await waitFor(() => expect(attendanceApi.getDailyList).toHaveBeenCalledTimes(2));
    } finally {
      jest.useRealTimers();
    }
  });

  it('模拟打卡的打卡时间按北京时间拼装（不受宿主机时区影响）', async () => {
    jest.useFakeTimers();
    // 2026-10-28T02:30:05Z = 北京时间 2026-10-28 10:30:05
    jest.setSystemTime(new Date('2026-10-28T02:30:05Z'));

    render(<AttendanceDailyPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: '模拟打卡' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '模拟打卡' }));

    await waitFor(() => expect(attendanceApi.importPunchLogs).toHaveBeenCalled());
    const csv = (attendanceApi.importPunchLogs as jest.Mock).mock.calls[0][0] as string;
    expect(csv).toContain('2026-10-28 10:30:05');
    // 打卡成功后会自动触发当月重算（避免测试结束时仍有挂起的 setState）
    await waitFor(() => expect(attendanceApi.recalcDaily).toHaveBeenCalled());

    jest.useRealTimers();
  });

  it('无 attendance:manage 时模拟打卡/重新计算不渲染，导出仍可见', async () => {
    mockCan.mockReturnValue(false);
    render(<AttendanceDailyPage />);
    await waitFor(() => expect(screen.getByTestId('pro-table')).toBeInTheDocument());

    // 按钮无权限不渲染（权限门），而非禁用
    expect(screen.queryByRole('button', { name: '模拟打卡' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新计算' })).not.toBeInTheDocument();
    // 导出为查看类动作，不受考勤管理权限点限制
    expect(screen.getByRole('button', { name: '导出 Excel' })).toBeInTheDocument();
  });
});
