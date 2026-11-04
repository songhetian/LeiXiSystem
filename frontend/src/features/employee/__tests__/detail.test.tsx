import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmployeeDetailPage from '@/features/employee/pages/detail';
import { employeeApi } from '@/services/employee';
import { attendanceApi } from '@/services/attendance';
import { systemApi } from '@/services/system';
import { clearDataCache } from '@/hooks/use-cached-data';
import { clearDictCache } from '@/hooks/use-dict';
import { useAuthStore } from '@/store/auth';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/services/employee', () => ({
  employeeApi: {
    getById: jest.fn(),
    update: jest.fn(),
    resign: jest.fn(),
    getTimeline: jest.fn(),
  },
}));

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getMonthlyList: jest.fn(),
    getBalanceList: jest.fn(),
  },
}));

jest.mock('@/services/system', () => ({
  systemApi: { listDepartments: jest.fn(), listPositions: jest.fn() },
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(),
}));
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

const mockEmployee = {
  id: 1,
  employeeNo: 'E001',
  name: '张三',
  status: 'active',
  departmentName: '技术部',
  positionName: '工程师',
  hireDate: '2024-01-15',
  phone: '13800138000',
  salary: '36000',
};

describe('EmployeeDetailPage 按钮级权限', () => {
  beforeEach(() => {
    clearDataCache();
    clearDictCache();
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 1, username: 'admin', name: '系统管理员', permissions: ['employee:view', 'employee:manage'] },
    });
    (employeeApi.getById as jest.Mock).mockResolvedValue({ code: 0, message: 'ok', data: mockEmployee });
    (attendanceApi.getMonthlyList as jest.Mock).mockResolvedValue({ code: 0, data: { list: [] } });
    (attendanceApi.getBalanceList as jest.Mock).mockResolvedValue({ code: 0, data: { list: [] } });
    (employeeApi.getTimeline as jest.Mock).mockResolvedValue({ code: 0, data: { list: [] } });
    (systemApi.listDepartments as jest.Mock).mockResolvedValue({ code: 0, data: [] });
    (systemApi.listPositions as jest.Mock).mockResolvedValue({ code: 0, data: [] });
  });

  it('有 employee:manage 时渲染编辑/办理离职按钮', async () => {
    render(<EmployeeDetailPage />);
    expect(await screen.findByRole('button', { name: '编辑' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '办理离职' })).toBeInTheDocument();
  });

  it('无 employee:manage 时编辑/办理离职按钮不渲染，详情仍可查看（员工查看自己不受影响）', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: 2, username: 'staff', name: '王小明', permissions: ['employee:view'] },
    });
    render(<EmployeeDetailPage />);
    // 详情内容正常展示（employee:view）
    expect(await screen.findByText('张三')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '办理离职' })).not.toBeInTheDocument();
  });
});
