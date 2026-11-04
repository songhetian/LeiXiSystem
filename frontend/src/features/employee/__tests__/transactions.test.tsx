import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmployeeTransactions from '@/features/employee/pages/transactions';
import { employeeApi } from '@/services/employee';
import { systemApi } from '@/services/system';
import { clearDataCache } from '@/hooks/use-cached-data';
import { useAuthStore } from '@/store/auth';

jest.mock('@/services/employee', () => ({
  employeeApi: {
    getTxList: jest.fn(),
    getTxPendingCounts: jest.fn(),
    getList: jest.fn(),
  },
}));

jest.mock('@/services/system', () => ({
  systemApi: { listDepartments: jest.fn(), listPositions: jest.fn() },
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(),
}));
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

/** 各页签写权限点对齐 backend employee-tx.controller.ts：入职页签 → onboarding:manage */
const ADMIN_USER = {
  id: 1,
  username: 'admin',
  name: '系统管理员',
  permissions: ['onboarding:view', 'onboarding:manage'],
};
const STAFF_USER = {
  id: 2,
  username: 'staff',
  name: '王小明',
  permissions: [],
};

describe('EmployeeTransactions 按钮级权限', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, user: ADMIN_USER });
    (employeeApi.getTxList as jest.Mock).mockResolvedValue({ code: 0, data: { list: [], total: 0 } });
    (employeeApi.getTxPendingCounts as jest.Mock).mockResolvedValue({ code: 0, data: {} });
    (employeeApi.getList as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [], total: 0, page: 1, pageSize: 100 },
    });
    (systemApi.listDepartments as jest.Mock).mockResolvedValue({ code: 0, data: [] });
    (systemApi.listPositions as jest.Mock).mockResolvedValue({ code: 0, data: [] });
  });

  it('有 onboarding:manage 时入职页签渲染「新建」按钮', async () => {
    render(<EmployeeTransactions />);
    expect(await screen.findByText('新建')).toBeInTheDocument();
  });

  it('员工下拉参考数据翻页取全量（后端 pageSize 上限 100，不静默缺人）', async () => {
    // 101 名员工：按后端上限需分 2 页才能取全
    const employees = Array.from({ length: 101 }, (_, i) => ({
      id: i + 1,
      name: `员工${i + 1}`,
      employeeNo: `E${String(i + 1).padStart(3, '0')}`,
    }));
    (employeeApi.getList as jest.Mock).mockImplementation(({ page, pageSize }: any) =>
      Promise.resolve({
        code: 0,
        data: {
          list: employees.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
          total: employees.length,
          page,
          pageSize,
        },
      }),
    );

    render(<EmployeeTransactions />);

    await waitFor(() => expect(employeeApi.getList).toHaveBeenCalledTimes(2));
    const pages = (employeeApi.getList as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(pages.map((p: any) => p.page)).toEqual([1, 2]);
    expect(pages.every((p: any) => p.pageSize === 100)).toBe(true);
  });

  it('无 onboarding:manage 时「新建」按钮不渲染，页签仍可切换查看', async () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, user: STAFF_USER });
    render(<EmployeeTransactions />);
    await waitFor(() => expect(employeeApi.getTxList).toHaveBeenCalled());
    expect(screen.queryByText('新建')).not.toBeInTheDocument();
    // 页签标题不受权限影响（查看类）
    expect(screen.getByText('入职办理')).toBeInTheDocument();
  });
});
