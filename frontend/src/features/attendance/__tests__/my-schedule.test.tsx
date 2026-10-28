import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MySchedulePage from '@/features/attendance/pages/my-schedule';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getMyScheduleList: jest.fn(),
  },
  __esModule: true,
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

describe('MySchedulePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
  });

  it('加载成功时渲染月历与当日排班', async () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    (attendanceApi.getMyScheduleList as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        list: [
          {
            id: 1,
            workDate: `${y}-${m}-${d}`,
            shift: { id: 9, name: '白班', startTime: '09:00', endTime: '18:00', color: '#2455D9' },
          },
        ],
      },
    });

    render(<MySchedulePage />);
    // 图例与日历格均展示班次名称
    expect((await screen.findAllByText(/白班/)).length).toBeGreaterThan(0);
    expect(screen.getByText('今天')).toBeInTheDocument();
  });

  it('无排班时展示空态', async () => {
    (attendanceApi.getMyScheduleList as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [] },
    });
    render(<MySchedulePage />);
    expect(await screen.findByText('本月暂无排班')).toBeInTheDocument();
  });

  it('接口失败时展示错误信息与重试入口', async () => {
    (attendanceApi.getMyScheduleList as jest.Mock).mockResolvedValue({
      code: 500,
      message: '排班加载失败',
    });
    render(<MySchedulePage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('排班加载失败');
    });
    expect(screen.getByText('重试')).toBeInTheDocument();
  });
});
