import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { PositionList } from '@/features/system/pages/positions';
import { systemApi } from '@/services/system';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/system', () => ({
  systemApi: {
    listPositions: jest.fn(),
    createPosition: jest.fn(),
    updatePosition: jest.fn(),
    deletePosition: jest.fn(),
  },
}));

// 可切换的权限 mock：默认放行，无权限用例中 mockCan.mockReturnValue(false)
const mockCan = jest.fn(() => true);
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: mockCan }),
}));

// 精简 Arco 交互组件便于断言；Form/Input/Modal 主体保留原实现（对齐 departments.test 范式）
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  return {
    ...actual,
    Table: ({ data, columns, rowKey }: any) => (
      <table data-testid="position-table">
        <tbody>
          {(data || []).map((row: any) => {
            const key = String(row[rowKey || 'id']);
            return (
              <tr key={key} data-testid={`row-${key}`}>
                {columns.map((c: any) => (
                  <td key={c.dataIndex} data-testid={`cell-${key}-${c.dataIndex}`}>
                    {c.render ? c.render(row[c.dataIndex], row) : row[c.dataIndex]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    ),
    // 点击子元素即视为确认（跳过气泡动画等待）
    Popconfirm: ({ children, onOk }: any) => <span onClick={onOk}>{children}</span>,
  };
});

const positions = [
  { id: 1, name: '前端工程师' },
  { id: 2, name: '产品经理' },
];

describe('岗位列表（useCachedData 迁移）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 使用共享缓存 hook 的页面测试必须清空缓存，防止跨用例串数据
    clearDataCache();
    // jest.clearAllMocks 会清掉 mockCan 的返回值设定，恢复默认放行
    mockCan.mockReturnValue(true);
    (systemApi.listPositions as jest.Mock).mockResolvedValue({ code: 0, data: positions });
    (systemApi.createPosition as jest.Mock).mockResolvedValue({ code: 0, data: { id: 3 } });
    (systemApi.updatePosition as jest.Mock).mockResolvedValue({ code: 0, data: { id: 1 } });
    (systemApi.deletePosition as jest.Mock).mockResolvedValue({ code: 0, data: null });
  });

  it('通过共享缓存加载并展示岗位列表', async () => {
    render(<PositionList />);
    expect(await screen.findByText('前端工程师')).toBeInTheDocument();
    expect(screen.getByText('产品经理')).toBeInTheDocument();
    expect(systemApi.listPositions).toHaveBeenCalledTimes(1);
  });

  it('新增岗位成功后刷新列表', async () => {
    const user = userEvent.setup();
    render(<PositionList />);
    await screen.findByText('前端工程师');
    await user.click(screen.getByRole('button', { name: '新增岗位' }));
    await user.type(screen.getByPlaceholderText('请输入岗位名称'), '测试岗');
    await user.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => {
      expect(systemApi.createPosition).toHaveBeenCalledWith({ name: '测试岗' });
    });
    await waitFor(() => {
      expect(systemApi.listPositions).toHaveBeenCalledTimes(2);
    });
  });

  it('编辑岗位回填名称并调用 updatePosition', async () => {
    const user = userEvent.setup();
    render(<PositionList />);
    await screen.findByText('前端工程师');
    await user.click(screen.getAllByRole('button', { name: '编辑' })[0]);
    const input = screen.getByPlaceholderText('请输入岗位名称') as HTMLInputElement;
    expect(input.value).toBe('前端工程师');
    await user.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => {
      expect(systemApi.updatePosition).toHaveBeenCalledWith(1, { name: '前端工程师' });
    });
  });

  it('删除岗位确认后调用 deletePosition 并刷新列表', async () => {
    const user = userEvent.setup();
    render(<PositionList />);
    await screen.findByText('前端工程师');
    await user.click(screen.getAllByRole('button', { name: '删除' })[0]);
    await waitFor(() => {
      expect(systemApi.deletePosition).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(systemApi.listPositions).toHaveBeenCalledTimes(2);
    });
  });

  it('无 position:manage 时编辑/删除/新增岗位按钮不渲染', async () => {
    // REFACTOR_PLAN 11.6-3：按钮无权限不渲染（PermissionGate），而非禁用
    mockCan.mockReturnValue(false);
    render(<PositionList />);
    expect(await screen.findByText('前端工程师')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新增岗位' })).not.toBeInTheDocument();
  });
});
