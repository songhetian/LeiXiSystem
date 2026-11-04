import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SystemRolesPage from '@/features/system/pages/roles';
import { systemApi } from '@/services/system';
import { useAuthStore } from '@/store/auth';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/system', () => ({
  systemApi: {
    listRoles: jest.fn(),
    listPermissions: jest.fn(),
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
    assignRolePermissions: jest.fn(),
  },
}));

// 按钮级权限走真实 usePermission + PermissionGate，仅 mock auth store 的用户与权限点
jest.mock('@/store/auth', () => ({ useAuthStore: jest.fn() }));
const mockUseAuthStore = jest.mocked(useAuthStore);

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

// 精简 ProTable：渲染工具栏按钮 + 行数据（columns.render 直接调用），便于断言按钮级权限
jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, toolbar }: any) => (
    <div data-testid="pro-table">
      {(toolbar || []).map((a: any) => (
        <button key={a.key} onClick={a.onClick}>{a.label}</button>
      ))}
      <table>
        <tbody>
          {(data || []).map((row: any) => (
            <tr key={String(row[rowKey || 'id'])}>
              {columns.map((c: any) => (
                <td key={c.dataIndex}>{c.render ? c.render(row[c.dataIndex], row) : row[c.dataIndex]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}));

const mockRoles = [
  {
    id: 1,
    code: 'admin',
    name: '管理员',
    description: '系统管理员',
    permissions: [{ permission: { id: 1, code: 'system:user:manage', name: '用户管理', module: 'system', type: 'api' } }],
  },
];

describe('角色管理 · 按钮级权限（REFACTOR_PLAN 11.6-3）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 使用 useCachedData 的页面测试必须清空共享缓存，防止跨用例串数据
    clearDataCache();
    (systemApi.listRoles as jest.Mock).mockResolvedValue({ code: 0, data: mockRoles });
    (systemApi.listPermissions as jest.Mock).mockResolvedValue({ code: 0, data: [] });
  });

  it('admin（含 system:role:manage）渲染新建/编辑/分配权限/删除按钮', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, username: 'admin', name: '管理员', permissions: ['system:role:manage'] },
    } as any);
    render(<SystemRolesPage />);
    expect(await screen.findByText('管理员')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建角色' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '分配权限' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument();
  });

  it('无 system:role:manage 时新建/编辑/分配权限/删除按钮不渲染', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { id: 2, username: 'staff', name: '王小明', permissions: ['system:role:view'] },
    } as any);
    render(<SystemRolesPage />);
    // 角色列表仍可见（只读），但全部写操作按钮被 PermissionGate 隐藏
    expect(await screen.findByText('管理员')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新建角色' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '分配权限' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument();
  });
});
