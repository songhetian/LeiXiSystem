import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DepartmentsPage from '@/features/system/pages/departments';
import { systemApi } from '@/services/system';
import { Modal } from '@arco-design/web-react';

jest.mock('@/services/system', () => ({
  systemApi: {
    listDepartments: jest.fn(),
    createDepartment: jest.fn(),
    updateDepartment: jest.fn(),
    deleteDepartment: jest.fn(),
    restoreDepartment: jest.fn(),
  },
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@/lib/request', () => ({
  notifyError: jest.fn(),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="page-container">
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

jest.mock('@/components/DataState', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="data-state">{children}</div>,
}));

// 精简 Arco 交互组件，便于断言；表单相关（Form/Input/Select/Modal 主体）保留原实现
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  return {
    ...actual,
    Table: ({ data, columns, rowKey }: any) => (
      <table data-testid="dept-table">
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
    Switch: ({ checked, onChange, disabled }: any) => (
      <button type="button" data-testid="status-switch" data-checked={String(checked)} disabled={disabled} onClick={() => onChange?.(!checked)}>
        {checked ? '启用' : '停用'}
      </button>
    ),
    Checkbox: ({ checked, onChange, children }: any) => (
      <label>
        <input type="checkbox" data-testid="show-deleted" checked={checked} onChange={() => onChange?.(!checked)} />
        {children}
      </label>
    ),
  };
});

const activeDepts = [
  { id: 1, name: '技术部', parentId: null, description: '研发与测试', status: 'active', employeeCount: 5 },
  { id: 2, name: '产品部', parentId: null, description: null, status: 'inactive', employeeCount: 3 },
];
const deletedDepts = [
  { id: 9, name: '旧部门', parentId: null, description: '已归档', status: 'active', deletedAt: '2026-01-01T00:00:00Z', employeeCount: 0 },
];

describe('部门管理（描述/启停/回收站/恢复）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (systemApi.listDepartments as jest.Mock).mockImplementation((includeDeleted?: boolean) =>
      Promise.resolve({ code: 0, data: includeDeleted ? deletedDepts : activeDepts }),
    );
    (systemApi.createDepartment as jest.Mock).mockResolvedValue({ code: 0, data: { id: 3 } });
    (systemApi.updateDepartment as jest.Mock).mockResolvedValue({ code: 0, data: { id: 1 } });
    (systemApi.restoreDepartment as jest.Mock).mockResolvedValue({ code: 0, data: { id: 9 } });
    (systemApi.deleteDepartment as jest.Mock).mockResolvedValue({ code: 0, data: { id: 1 } });
    // 确认弹窗直接执行 onOk，避免动画等待
    jest.spyOn(Modal, 'confirm').mockImplementation(((cfg: any) => {
      cfg.onOk?.();
      return {} as any;
    }) as any);
  });

  it('默认加载未删除部门并展示职责描述/在册人数/状态', async () => {
    render(<DepartmentsPage />);
    expect(await screen.findByText('技术部')).toBeInTheDocument();
    expect(systemApi.listDepartments).toHaveBeenCalledWith(false);
    expect(screen.getByText('研发与测试')).toBeInTheDocument();
    expect(screen.getByText('产品部')).toBeInTheDocument();
  });

  it('勾选「显示回收站」以 includeDeleted 重新拉取并展示已删除部门', async () => {
    const user = userEvent.setup();
    render(<DepartmentsPage />);
    await screen.findByText('技术部');
    await user.click(screen.getByTestId('show-deleted'));
    expect(await screen.findByText('旧部门')).toBeInTheDocument();
    expect(systemApi.listDepartments).toHaveBeenCalledWith(true);
    expect(screen.getByText('已销毁')).toBeInTheDocument();
  });

  it('启停开关触发确认后调用 updateDepartment({status})', async () => {
    const user = userEvent.setup();
    render(<DepartmentsPage />);
    const switches = await screen.findAllByTestId('status-switch');
    await user.click(switches[1]); // 产品部 停用→启用
    await waitFor(() => {
      expect(systemApi.updateDepartment).toHaveBeenCalledWith(2, { status: 'active' });
    });
  });

  it('回收站中点击「恢复」调用 restoreDepartment', async () => {
    const user = userEvent.setup();
    render(<DepartmentsPage />);
    await screen.findByText('技术部');
    await user.click(screen.getByTestId('show-deleted'));
    expect(await screen.findByText('恢复')).toBeInTheDocument();
    await user.click(screen.getByText('恢复'));
    await waitFor(() => {
      expect(systemApi.restoreDepartment).toHaveBeenCalledWith(9);
    });
  });

  it('新增部门携带职责描述', async () => {
    const user = userEvent.setup();
    render(<DepartmentsPage />);
    await user.click(screen.getByRole('button', { name: /新增部门/ }));
    await user.type(screen.getByPlaceholderText('请输入部门名称'), '市场部');
    await user.type(screen.getByPlaceholderText('请输入部门主要职责描述'), '负责市场推广');
    await user.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => {
      expect(systemApi.createDepartment).toHaveBeenCalledWith(
        expect.objectContaining({ name: '市场部', description: '负责市场推广' }),
      );
    });
  });
});