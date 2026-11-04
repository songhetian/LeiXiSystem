import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExceptionRulesPage from '@/features/attendance/pages/exception-rules';
import { exceptionApi } from '@/services/attendance';

// 权限门：默认全放行，个别用例切到无权限
const mockCan = jest.fn((_code?: string) => true);
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: (code?: string) => mockCan(code) }),
}));

jest.mock('@/services/attendance', () => ({
  exceptionApi: {
    listExceptions: jest.fn(),
    getExceptionRules: jest.fn(),
    createException: jest.fn(),
    handleException: jest.fn(),
    deleteException: jest.fn(),
    createExceptionRule: jest.fn(),
    updateExceptionRule: jest.fn(),
    toggleExceptionRule: jest.fn(),
    deleteExceptionRule: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, toolbar, error }: any) => (
    <div data-testid="pro-table">
      {error && <div data-testid="table-error">{error}</div>}
      {toolbar?.map((t: any) => (
        <button key={t.key} data-testid={`toolbar-${t.key}`} onClick={t.onClick}>
          {t.label}
        </button>
      ))}
      <table>
        <tbody>
          {data.map((row: any) => (
            <tr key={row[rowKey]} data-testid="table-row">
              {columns.map((col: any) => (
                <td key={col.dataIndex}>
                  {col.render ? col.render(row[col.dataIndex], row) : row[col.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}));

jest.mock('@arco-design/web-react', () => ({
  Message: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
  Modal: { confirm: jest.fn() },
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Space: ({ children }: any) => <div>{children}</div>,
  Tabs: Object.assign(({ children }: any) => <div>{children}</div>, {
    TabPane: ({ children }: any) => <div>{children}</div>,
  }),
}));

// ModalForm 作为独立 seam mock：本页断言点在权限门与列表，不测表单内部
jest.mock('@/components/ModalForm', () => ({
  __esModule: true,
  default: ({ visible, title }: any) => (visible ? <div data-testid="modal-form">{title}</div> : null),
}));

const mockExceptions = [
  { id: 1, employeeId: 1, workDate: '2026-08-13', type: '迟到', status: 'pending', deductMinutes: 30 },
];
const mockRules = [
  { id: 1, name: '迟到规则', type: '迟到', threshold: 0, autoResolve: false, deductMinutes: 30, status: 'enabled' },
];

describe('ExceptionRulesPage（考勤异常 / 异常规则）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCan.mockReturnValue(true);
    (exceptionApi.listExceptions as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockExceptions, total: 1 },
    });
    (exceptionApi.getExceptionRules as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockRules },
    });
  });

  it('渲染异常记录与规则列表及新增按钮', async () => {
    render(<ExceptionRulesPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row').length).toBeGreaterThanOrEqual(1));

    // Tabs 桩会同时渲染两个 tab，「迟到」在记录/规则中均出现
    expect(screen.getAllByText('迟到').length).toBeGreaterThan(0);
    // 异常记录与规则两个 tab 各有一个新增按钮
    expect(screen.getAllByTestId('toolbar-add')).toHaveLength(2);
  });

  it('无 attendance:exception:manage 时新增/处理/启停/编辑/删除按钮不渲染', async () => {
    mockCan.mockReturnValue(false);
    render(<ExceptionRulesPage />);
    await waitFor(() => expect(screen.getAllByTestId('table-row').length).toBeGreaterThanOrEqual(1));

    // 按钮无权限不渲染（PermissionGate），而非禁用
    expect(screen.queryByTestId('toolbar-add')).not.toBeInTheDocument();
    expect(screen.queryByText('处理')).not.toBeInTheDocument();
    expect(screen.queryByText('停用')).not.toBeInTheDocument();
    expect(screen.queryByText('编辑')).not.toBeInTheDocument();
    expect(screen.queryByText('删除')).not.toBeInTheDocument();
    // 数据照常展示（查看不受限）
    expect(screen.getAllByText('迟到').length).toBeGreaterThan(0);
  });
});
