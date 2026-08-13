import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import EmployeeListPage from '@/features/employee/pages/list';
import { employeeApi } from '@/services/employee';

jest.mock('@/services/employee', () => ({
  employeeApi: {
    getList: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    resign: jest.fn(),
  },
}));

jest.mock('@/components/AppLayout', () => ({
  __esModule: true,
  default: ({ children, title, activeMenu }: any) => (
    <div data-testid="app-layout" data-title={title} data-active-menu={activeMenu}>
      {children}
    </div>
  ),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, action, children }: any) => (
    <div data-testid="page-container">
      <h2 data-testid="page-title">{title}</h2>
      <div data-testid="page-action">{action}</div>
      <div data-testid="page-content">{children}</div>
    </div>
  ),
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, loading, searchFields, toolbar, pagination, onSearch, onPageChange }: any) => (
    <div data-testid="pro-table" data-loading={loading}>
      {searchFields && (
        <div data-testid="search-area">
          {searchFields.map((f: any) => (
            <span key={f.key} data-testid={`search-${f.key}`}>{f.label}</span>
          ))}
        </div>
      )}
      {toolbar && (
        <div data-testid="toolbar">
          {toolbar.map((t: any) => (
            <button key={t.key} data-testid={`toolbar-${t.key}`} onClick={t.onClick}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <table>
        <thead>
          <tr>
            {columns.map((c: any) => (
              <th key={c.dataIndex} data-testid={`col-${c.dataIndex}`}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row[rowKey]} data-testid="table-row">
              {columns.map((c: any) => (
                <td key={c.dataIndex} data-testid={`cell-${row[rowKey]}-${c.dataIndex}`}>
                  {c.render ? c.render(row[c.dataIndex], row) : row[c.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && pagination !== false && (
        <div data-testid="pagination">
          <span data-testid="page-current">{pagination.current}</span>
          <span data-testid="page-total">{pagination.total}</span>
        </div>
      )}
    </div>
  ),
}));

jest.mock('@/components/StatusTag', () => ({
  __esModule: true,
  default: ({ status }: any) => (
    <span data-testid={`status-tag-${status}`}>{status}</span>
  ),
}));

jest.mock('@/components/ModalForm', () => ({
  __esModule: true,
  default: ({ visible, title, fields, initialValues, onOk, onCancel, confirmLoading }: any) => {
    if (!visible) return null;
    return (
      <div role="dialog" data-testid="employee-modal" data-confirm-loading={confirmLoading}>
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-fields">
          {fields?.map((f: any) => (
            <span key={f.key} data-testid={`modal-field-${f.key}`}>{f.label}</span>
          ))}
        </div>
        <button data-testid="modal-cancel" onClick={onCancel}>取消</button>
        <button data-testid="modal-ok" onClick={() => onOk(initialValues || {})}>确定</button>
      </div>
    );
  },
}));

const mockEmployees = [
  { id: 1, employeeNo: 'E001', name: '张三', departmentName: '技术部', positionName: '工程师', hireDate: '2024-01-15', phone: '13800138000', status: 'active' },
  { id: 2, employeeNo: 'E002', name: '李四', departmentName: '产品部', positionName: '产品经理', hireDate: '2024-03-20', phone: '13900139000', status: 'active' },
  { id: 3, employeeNo: 'E003', name: '王五', departmentName: '技术部', positionName: '架构师', hireDate: '2023-06-01', phone: '13700137000', status: 'inactive' },
];

describe('EmployeeListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (employeeApi.getList as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        list: mockEmployees,
        total: 3,
        page: 1,
        pageSize: 20,
      },
    });
  });

  describe('正常用例', () => {
    it('renders inside AppLayout with correct menu', () => {
      render(<EmployeeListPage />);
      expect(screen.getByTestId('app-layout')).toHaveAttribute('data-active-menu', 'employee');
    });

    it('renders PageContainer with title 员工管理', () => {
      render(<EmployeeListPage />);
      expect(screen.getByTestId('page-title')).toHaveTextContent('员工管理');
    });

    it('renders ProTable with employee columns', async () => {
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toBeInTheDocument();
      });
      expect(screen.getByTestId('col-employeeNo')).toHaveTextContent('工号');
      expect(screen.getByTestId('col-name')).toHaveTextContent('姓名');
      expect(screen.getByTestId('col-departmentName')).toHaveTextContent('部门');
      expect(screen.getByTestId('col-positionName')).toHaveTextContent('职位');
      expect(screen.getByTestId('col-hireDate')).toHaveTextContent('入职日期');
      expect(screen.getByTestId('col-phone')).toHaveTextContent('手机号');
      expect(screen.getByTestId('col-status')).toHaveTextContent('状态');
    });

    it('fetches employee list on mount', async () => {
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(employeeApi.getList).toHaveBeenCalled();
      });
    });

    it('renders employee data in table', async () => {
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.getByTestId('cell-1-employeeNo')).toHaveTextContent('E001');
      expect(screen.getByTestId('cell-1-name')).toHaveTextContent('张三');
    });

    it('renders status tag for status column', async () => {
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      const activeTags = screen.getAllByTestId('status-tag-active');
      const inactiveTags = screen.getAllByTestId('status-tag-inactive');
      expect(activeTags.length).toBeGreaterThan(0);
      expect(inactiveTags.length).toBeGreaterThan(0);
    });

    it('has 新增 employee button in toolbar', async () => {
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-add')).toBeInTheDocument();
      });
      expect(screen.getByTestId('toolbar-add')).toHaveTextContent('新增员工');
    });

    it('renders search fields for filtering', async () => {
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('search-area')).toBeInTheDocument();
      });
      expect(screen.getByTestId('search-name')).toHaveTextContent('姓名');
      expect(screen.getByTestId('search-employeeNo')).toHaveTextContent('工号');
      expect(screen.getByTestId('search-status')).toHaveTextContent('状态');
    });

    it('shows pagination info', async () => {
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
      expect(screen.getByTestId('page-total')).toHaveTextContent('3');
    });
  });

  describe('边界用例', () => {
    it('shows loading state while fetching', () => {
      let resolveFn: (value: any) => void;
      (employeeApi.getList as jest.Mock).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );
      render(<EmployeeListPage />);
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-loading', 'true');
    });

    it('handles empty employee list', async () => {
      (employeeApi.getList as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(employeeApi.getList).toHaveBeenCalled();
      });
      expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
    });
  });

  describe('新增员工弹窗', () => {
    it('opens add modal when 新增员工 button clicked', async () => {
      const user = userEvent.setup();
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-add')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-add'));
      expect(screen.getByTestId('employee-modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('新增员工');
    });

    it('modal has correct form fields for new employee', async () => {
      const user = userEvent.setup();
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-add')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-add'));
      expect(screen.getByTestId('modal-field-employeeNo')).toBeInTheDocument();
      expect(screen.getByTestId('modal-field-name')).toBeInTheDocument();
      expect(screen.getByTestId('modal-field-departmentId')).toBeInTheDocument();
      expect(screen.getByTestId('modal-field-positionId')).toBeInTheDocument();
      expect(screen.getByTestId('modal-field-hireDate')).toBeInTheDocument();
      expect(screen.getByTestId('modal-field-phone')).toBeInTheDocument();
      expect(screen.getByTestId('modal-field-salary')).toBeInTheDocument();
    });

    it('calls employeeApi.create when confirming add', async () => {
      const user = userEvent.setup();
      (employeeApi.create as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { id: 4, employeeNo: 'E004', name: '新员工' },
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-add')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-add'));
      await user.click(screen.getByTestId('modal-ok'));
      expect(employeeApi.create).toHaveBeenCalled();
    });

    it('closes modal on cancel', async () => {
      const user = userEvent.setup();
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-add')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-add'));
      expect(screen.getByTestId('employee-modal')).toBeInTheDocument();
      await user.click(screen.getByTestId('modal-cancel'));
      expect(screen.queryByTestId('employee-modal')).not.toBeInTheDocument();
    });

    it('refreshes list after successful add', async () => {
      const user = userEvent.setup();
      (employeeApi.create as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { id: 4, employeeNo: 'E004', name: '新员工' },
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(employeeApi.getList).toHaveBeenCalledTimes(1);
      });
      await user.click(screen.getByTestId('toolbar-add'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(employeeApi.getList).toHaveBeenCalledTimes(2);
      });
    });

    it('handles duplicate employeeNo error (code 1001)', async () => {
      const user = userEvent.setup();
      (employeeApi.create as jest.Mock).mockResolvedValue({
        code: 1001,
        message: '工号已存在',
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-add')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-add'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(employeeApi.create).toHaveBeenCalled();
      });
    });
  });

  describe('操作列', () => {
    it('renders 操作 column with 编辑 and 离职 buttons', async () => {
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.getByTestId('col-action')).toHaveTextContent('操作');
      expect(screen.getAllByTestId('btn-edit-1').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('btn-resign-1').length).toBeGreaterThan(0);
    });

    it('does not show 离职 button for inactive employees', async () => {
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.queryByTestId('btn-resign-3')).not.toBeInTheDocument();
    });
  });

  describe('编辑员工', () => {
    it('opens edit modal with 编辑员工 title when edit clicked', async () => {
      const user = userEvent.setup();
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getByTestId('btn-edit-1'));
      expect(screen.getByTestId('employee-modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('编辑员工');
    });

    it('fills edit modal with employee data', async () => {
      const user = userEvent.setup();
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getByTestId('btn-edit-1'));
      expect(screen.getByTestId('modal-field-employeeNo')).toBeInTheDocument();
    });

    it('calls employeeApi.update when confirming edit', async () => {
      const user = userEvent.setup();
      (employeeApi.update as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { id: 1, name: '张三丰' },
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getByTestId('btn-edit-1'));
      await user.click(screen.getByTestId('modal-ok'));
      expect(employeeApi.update).toHaveBeenCalled();
    });

    it('refreshes list after successful edit', async () => {
      const user = userEvent.setup();
      (employeeApi.update as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { id: 1, name: '张三丰' },
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(employeeApi.getList).toHaveBeenCalledTimes(1);
      });
      await user.click(screen.getByTestId('btn-edit-1'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(employeeApi.getList).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('离职功能', () => {
    it('calls employeeApi.resign when resign confirmed', async () => {
      const user = userEvent.setup();
      (employeeApi.resign as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'inactive' },
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getByTestId('btn-resign-1'));
      expect(employeeApi.resign).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('refreshes list after successful resign', async () => {
      const user = userEvent.setup();
      (employeeApi.resign as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'inactive' },
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(employeeApi.getList).toHaveBeenCalledTimes(1);
      });
      await user.click(screen.getByTestId('btn-resign-1'));
      await waitFor(() => {
        expect(employeeApi.getList).toHaveBeenCalledTimes(2);
      });
    });

    it('handles employee already resigned error (code 1004)', async () => {
      const user = userEvent.setup();
      (employeeApi.resign as jest.Mock).mockResolvedValue({
        code: 1004,
        message: '员工已离职',
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getByTestId('btn-resign-1'));
      await waitFor(() => {
        expect(employeeApi.resign).toHaveBeenCalled();
      });
    });
  });
});
