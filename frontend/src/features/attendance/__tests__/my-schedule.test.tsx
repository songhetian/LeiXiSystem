import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MySchedulePage from '@/features/attendance/pages/my-schedule';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getMyScheduleList: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

const dayShift = {
  id: 1,
  name: '白班',
  startTime: '09:00',
  endTime: '18:00',
  color: '#3B82F6',
};

const emptyList = { code: 0, data: { list: [], total: 0, page: 1, pageSize: 400 } };

describe('MySchedulePage（我的排班）', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    (attendanceApi.getMyScheduleList as jest.Mock).mockResolvedValue(emptyList);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('默认月份与「今天」按北京时间判定，不受宿主机时区影响', async () => {
    jest.useFakeTimers();
    // 2026-10-31T16:30:00Z = 北京时间 2026-11-01 00:30（UTC 口径下仍是 10-31）
    jest.setSystemTime(new Date('2026-10-31T16:30:00Z'));
    (attendanceApi.getMyScheduleList as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        list: [{ id: 1, workDate: '2026-11-01', shift: dayShift }],
        total: 1,
        page: 1,
        pageSize: 400,
      },
    });

    render(<MySchedulePage />);

    expect(screen.getByText('2026 年 11 月')).toBeInTheDocument();
    // 当月区间也按北京时间取，而不是宿主机本地的 10 月
    await waitFor(() =>
      expect(attendanceApi.getMyScheduleList).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2026-11-01', endDate: '2026-11-30' }),
      ),
    );

    // 「今天」标在 11 月 1 日这一天
    const todayCell = (await screen.findByText('今天')).closest('.my-schedule-day') as HTMLElement;
    expect(todayCell.querySelector('span')?.textContent).toBe('1');
  });

  it('上一月跨年时年份只退一位，回到正确的 12 月', async () => {
    jest.useFakeTimers();
    // 北京时间 2026-01-15 10:00
    jest.setSystemTime(new Date('2026-01-15T02:00:00Z'));

    render(<MySchedulePage />);
    expect(screen.getByText('2026 年 1 月')).toBeInTheDocument();
    // 首屏加载期间翻月按钮是禁用的，等加载结束再点
    await waitFor(() => expect(screen.getByText('本月暂无排班')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '上一月' }));

    expect(screen.getByText('2025 年 12 月')).toBeInTheDocument();
    await waitFor(() =>
      expect(attendanceApi.getMyScheduleList).toHaveBeenLastCalledWith(
        expect.objectContaining({ startDate: '2025-12-01', endDate: '2025-12-31' }),
      ),
    );
  });

  it('渲染当月排班：日期格展示班次名称与时段', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-10T02:00:00Z'));
    (attendanceApi.getMyScheduleList as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        list: [{ id: 1, workDate: '2026-11-02', shift: dayShift }],
        total: 1,
        page: 1,
        pageSize: 400,
      },
    });

    render(<MySchedulePage />);

    // 图例 + 日期格都会有班次，按包含匹配（格子内是「白班<br/>09:00-18:00」）
    await waitFor(() => expect(screen.getAllByText(/白班/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/09:00-18:00/).length).toBeGreaterThan(0);
  });

  it('排班超过单页上限（400）时循环分页拉全量，不漏排班', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-10T02:00:00Z'));
    const firstPage = Array.from({ length: 400 }, (_, i) => ({
      id: i + 1,
      workDate: '2026-11-03',
      shift: dayShift,
    }));
    (attendanceApi.getMyScheduleList as jest.Mock).mockImplementation(({ page }: any) =>
      Promise.resolve({
        code: 0,
        data: {
          list:
            page === 1
              ? firstPage
              : [{ id: 401, workDate: '2026-11-28', shift: { ...dayShift, id: 2, name: '夜班' } }],
          total: 401,
          page,
          pageSize: 400,
        },
      }),
    );

    render(<MySchedulePage />);

    await waitFor(() => expect(screen.getAllByText(/夜班/).length).toBeGreaterThan(0));
    expect(attendanceApi.getMyScheduleList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 400 }),
    );
  });

  it('加载失败展示错误与重试，重试成功后正常渲染', async () => {
    (attendanceApi.getMyScheduleList as jest.Mock).mockResolvedValueOnce({
      code: 500,
      message: '排班服务异常',
    });

    render(<MySchedulePage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('排班服务异常');
    // 失败时不能显示「本月暂无排班」——那会让用户以为真的没有排班
    expect(screen.queryByText('本月暂无排班')).not.toBeInTheDocument();

    (attendanceApi.getMyScheduleList as jest.Mock).mockResolvedValue(emptyList);
    fireEvent.click(screen.getByText('重试'));

    await waitFor(() => expect(screen.getByText('本月暂无排班')).toBeInTheDocument());
  });
});
