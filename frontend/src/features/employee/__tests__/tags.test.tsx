import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TagsPage from '@/features/employee/pages/tags';
import { employeeTagApi } from '@/services/employee';
import { clearDataCache } from '@/hooks/use-cached-data';
import { useAuthStore } from '@/store/auth';

jest.mock('@/services/employee', () => ({
  employeeTagApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(),
}));
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

/** 管理员：含 employee:tag:manage（对齐 backend seed.ts ADMIN_PERMISSIONS 全集语义） */
const ADMIN_USER = {
  id: 1,
  username: 'admin',
  name: '系统管理员',
  permissions: ['employee:view', 'employee:tag:manage'],
};
/** 普通员工：无标签管理权限（对齐 seed.ts STAFF_PERMISSIONS） */
const STAFF_USER = {
  id: 2,
  username: 'staff',
  name: '王小明',
  permissions: [],
};

const mockTags = [
  { id: 1, name: '优秀员工', color: '', sortOrder: 0 },
  { id: 2, name: '长期外派', color: '#16A34A', sortOrder: 1 },
];

describe('TagsPage 按钮级权限', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, user: ADMIN_USER });
    (employeeTagApi.list as jest.Mock).mockResolvedValue({ code: 0, data: { list: mockTags } });
  });

  it('有 employee:tag:manage 时渲染新建/编辑/删除按钮', async () => {
    render(<TagsPage />);
    expect(await screen.findByText('+ 新建标签')).toBeInTheDocument();
    expect(await screen.findByText('优秀员工')).toBeInTheDocument();
    expect(screen.getAllByText('编辑').length).toBeGreaterThan(0);
    expect(screen.getAllByText('删除').length).toBeGreaterThan(0);
  });

  it('无 employee:tag:manage 时写按钮不渲染，导出仍可用', async () => {
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, user: STAFF_USER });
    render(<TagsPage />);
    await waitFor(() => expect(employeeTagApi.list).toHaveBeenCalled());
    expect(await screen.findByText('优秀员工')).toBeInTheDocument();
    expect(screen.queryByText('+ 新建标签')).not.toBeInTheDocument();
    expect(screen.queryByText('编辑')).not.toBeInTheDocument();
    expect(screen.queryByText('删除')).not.toBeInTheDocument();
    // 导出为查看类动作，不受权限点控制
    expect(screen.getByText('导出 Excel')).toBeInTheDocument();
  });

  it('无色标签兜底为品牌主色 #2455D9（--lx-primary-600）', async () => {
    render(<TagsPage />);
    // 「优秀员工」color 为空串，色点应回退到品牌主色
    expect(await screen.findByTitle('#2455D9')).toBeInTheDocument();
    // 有色标签保持原色
    expect(screen.getByTitle('#16A34A')).toBeInTheDocument();
  });
});
