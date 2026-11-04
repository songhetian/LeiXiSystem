import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BroadcastsPage from '@/features/system/pages/broadcasts';
import { broadcastApi } from '@/services/broadcast';
import { useAuthStore } from '@/store/auth';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/broadcast', () => ({
  broadcastApi: {
    getList: jest.fn(),
    getDetail: jest.fn(),
    publish: jest.fn(),
    remove: jest.fn(),
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

const mockBroadcasts = [
  {
    id: 1,
    title: '系统升级公告',
    recipientType: 'all',
    priority: 'normal',
    status: 'draft',
    publishedAt: null,
  },
];

describe('公告管理 · 按钮级权限（REFACTOR_PLAN 11.6-3）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 使用 useCachedData 的页面测试必须清空共享缓存，防止跨用例串数据
    clearDataCache();
    (broadcastApi.getList as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockBroadcasts, page: 1, pageSize: 20, total: 1 },
    });
  });

  it('admin（含 system:broadcast:manage）渲染新建/发布/删除/查看按钮', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, username: 'admin', name: '管理员', permissions: ['system:broadcast:manage'] },
    } as any);
    render(<BroadcastsPage />);
    expect(await screen.findByText('系统升级公告')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建公告' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发布' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看' })).toBeInTheDocument();
  });

  it('无 system:broadcast:manage 时新建/发布/删除不渲染，查看仍可见', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { id: 2, username: 'staff', name: '王小明', permissions: [] },
    } as any);
    render(<BroadcastsPage />);
    expect(await screen.findByText('系统升级公告')).toBeInTheDocument();
    // 写操作按钮被 PermissionGate 隐藏
    expect(screen.queryByRole('button', { name: '新建公告' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '发布' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument();
    // 「查看」不属管理写操作，始终渲染
    expect(screen.getByRole('button', { name: '查看' })).toBeInTheDocument();
  });
});
