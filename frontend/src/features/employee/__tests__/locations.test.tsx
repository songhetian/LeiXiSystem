import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationsPage from '@/features/employee/pages/locations';
import { attendanceLocationApi } from '@/services/employee';
import { clearDataCache } from '@/hooks/use-cached-data';
import { useAuthStore } from '@/store/auth';

jest.mock('@/services/employee', () => ({
  attendanceLocationApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(),
}));
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

/** 权限点挂在考勤模块：attendance:location:manage（对齐 backend seed.ts） */
const ADMIN_USER = {
  id: 1,
  username: 'admin',
  name: '系统管理员',
  permissions: ['attendance:view', 'attendance:location:manage'],
};
const STAFF_USER = {
  id: 2,
  username: 'staff',
  name: '王小明',
  permissions: [],
};

const mockLocations = [
  {
    id: 1,
    name: '总部大楼',
    address: '北京市朝阳区科技园区A座',
    latitude: 23.123456,
    longitude: 113.654321,
    radius: 100,
    workType: 'office',
    enabled: true,
  },
];

describe('LocationsPage 按钮级权限', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, user: ADMIN_USER });
    (attendanceLocationApi.list as jest.Mock).mockResolvedValue({ code: 0, data: { list: mockLocations } });
  });

  it('有 attendance:location:manage 时渲染新建与行内编辑/启停/删除按钮', async () => {
    render(<LocationsPage />);
    expect(await screen.findByText('+ 新建定位')).toBeInTheDocument();
    expect(await screen.findByText('总部大楼')).toBeInTheDocument();
    expect(screen.getByText('编辑')).toBeInTheDocument();
    expect(screen.getByText('停用')).toBeInTheDocument();
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  it('无 attendance:location:manage 时写按钮不渲染，列表仍可查看', async () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, user: STAFF_USER });
    render(<LocationsPage />);
    await waitFor(() => expect(attendanceLocationApi.list).toHaveBeenCalled());
    expect(await screen.findByText('总部大楼')).toBeInTheDocument();
    expect(screen.queryByText('+ 新建定位')).not.toBeInTheDocument();
    expect(screen.queryByText('编辑')).not.toBeInTheDocument();
    expect(screen.queryByText('停用')).not.toBeInTheDocument();
    expect(screen.queryByText('删除')).not.toBeInTheDocument();
  });
});
