import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PunchPage from '@/features/attendance/pages/punch';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getTodayPunch: jest.fn(),
    getAvailableShifts: jest.fn(),
    clockIn: jest.fn(),
    clockOut: jest.fn(),
    selfSchedule: jest.fn(),
  },
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('打卡页 · 账号未绑定员工档案', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
  });

  it('超级管理员等无档案账号看到绑定引导，而不是「员工不存在」报错与死按钮', async () => {
    (attendanceApi.getTodayPunch as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        noEmployeeProfile: true,
        workDate: '2026-11-05',
        firstPunch: null,
        lastPunch: null,
        hasSchedule: false,
        isRestDay: false,
        clockIn: { allowed: false, message: '当前账号未绑定员工档案' },
        clockOut: { allowed: false, message: '当前账号未绑定员工档案' },
      },
    });

    render(<PunchPage />);

    expect(await screen.findByText('当前账号还没有绑定员工档案')).toBeInTheDocument();
    // 引导要给出可执行的下一步（去哪里绑定），否则用户仍然无从下手
    expect(screen.getByText('前往员工列表')).toBeInTheDocument();
    // 没有档案时不应该出现可点的打卡按钮
    expect(screen.queryByText('上班签到')).toBeNull();
  });
});
