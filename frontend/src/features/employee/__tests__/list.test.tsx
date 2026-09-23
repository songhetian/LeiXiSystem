import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import EmployeeListPage from '@/features/employee/pages/list';
import { employeeApi, employeeTagApi } from '@/services/employee';
import { systemApi } from '@/services/system';
import { clearDataCache } from '@/hooks/use-cached-data';
import { clearDictCache } from '@/hooks/use-dict';

jest.mock('@/services/employee', () => ({
  employeeApi: {
    getList: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    resign: jest.fn(),
  },
  employeeTagApi: {
    list: jest.fn(),
  },
}));

jest.mock('@/services/system', () => ({
  systemApi: {
    listDepartments: jest.fn(),
    listPositions: jest.fn(),
  },
}));


jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, action, children }: any) => (
    <div data-testid="page-container">
      {title && <h2 data-testid="page-title">{title}</h2>}
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

jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  return {
    ...actual,
    Modal: ({ visible, title, onOk, onCancel, okText, cancelText, children }: any) => {
      if (!visible) return null;
      return (
        <div role="dialog" data-testid="resign-modal">
          <div data-testid="resign-title">{title}</div>
          <div data-testid="resign-body">{children}</div>
          <button data-testid="resign-ok" onClick={() => onOk && onOk()}>{okText}</button>
          <button data-testid="resign-cancel" onClick={() => onCancel && onCancel()}>{cancelText}</button>
        </div>
      );
    },
  };
});

jest.mock('@/components/ModalForm', () => ({
  __esModule: true,
  default: ({ visible, title, fields, initialValues, onOk, onCancel, confirmLoading }: any) => {
    if (!visible) return null;
    return (
      <div role="dialog" data-testid="employee-modal" data-confirm-loading={confirmLoading}>
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-fields">
          {fields?.map((f: any) => (
            <div key={f.key}>
              <span data-testid={`modal-field-${f.key}`}>{f.label}</span>
              {f.type === 'select' && f.options?.length > 0 && (
                <div data-testid={`modal-options-${f.key}`}>
                  {f.options.map((o: any) => (
                    <span key={o.value} data-testid={`modal-option-${f.key}-${o.value}`}>
                      {o.label}
                    </span>
                  ))}
                </div>
              )}
              {f.type === 'tags' && f.options?.length > 0 && (
                <div data-testid={`modal-options-${f.key}`}>
                  {f.options.map((o: any) => (
                    <span key={o.value} data-testid={`modal-option-${f.key}-${o.value}`}>
                      {o.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
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
    clearDataCache();
    clearDictCache();
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
    (systemApi.listDepartments as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: [
        { id: 1, name: '技术部' },
        { id: 2, name: '产品部' },
      ],
    });
    (systemApi.listPositions as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: [
        { id: 1, name: '工程师' },
        { id: 2, name: '产品经理' },
      ],
    });
    (employeeTagApi.list as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        list: [
          { id: 1, name: '优秀员工', color: '#3B82F6' },
          { id: 2, name: '长期外派', color: '#16A34A' },
        ],
        total: 2,
      },
    });
  });

  describe('正常用例', () => {
    it('不渲染冗余页面大标题（顶部已有全局面包屑）', () => {
      render(<EmployeeListPage />);
      // 页面已省略 title，不再显示「员工管理」大标题
      expect(screen.queryByTestId('page-title')).toBeNull();
    });

    it('renders ProTable with employee columns', async () => {
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toBeInTheDocument();
      });
      expect(screen.getByTestId('col-name')).toHaveTextContent('姓名');
      expect(screen.queryByTestId('col-employeeNo')).not.toBeInTheDocument();
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
      expect(screen.queryByTestId('cell-1-employeeNo')).not.toBeInTheDocument();
      expect(screen.getByTestId('cell-1-name')).toHaveTextContent('张三');
    });

    it('入职日期列将 ISO 时间格式化为 YYYY-MM-DD 展示', async () => {
      (employeeApi.getList as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: {
          list: [
            {
              id: 9,
              employeeNo: 'E009',
              name: '赵六',
              departmentName: '技术部',
              positionName: '工程师',
              hireDate: '2024-04-07T00:00:00.000Z',
              phone: '',
              status: 'active',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('cell-9-hireDate')).toHaveTextContent('2024-04-07');
      });
      expect(screen.getByTestId('cell-9-hireDate')).not.toHaveTextContent('T00:00:00');
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
      // 对齐企业后台：姓名检索 + 多维过滤（状态/职级/部门/岗位/入职时间）
      expect(screen.getByTestId('search-keyword')).toHaveTextContent('姓名');
      expect(screen.getByTestId('search-status')).toHaveTextContent('状态');
      expect(screen.getByTestId('search-rating')).toHaveTextContent('职级');
      expect(screen.getByTestId('search-departmentId')).toHaveTextContent('部门');
      expect(screen.getByTestId('search-positionId')).toHaveTextContent('岗位');
      expect(screen.getByTestId('search-hireDate')).toHaveTextContent('入职时间');
    });

    it('shows pagination info', async () => {
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('page-total')).toHaveTextContent('3');
      });
    });
  });

  describe('边界用例', () => {
    it('shows loading state while fetching', async () => {
      (employeeApi.getList as jest.Mock).mockImplementation(
        () => new Promise(() => {}),
      );
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toHaveAttribute('data-loading', 'true');
      });
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

    it('modal loads department and position options from systemApi', async () => {
      const user = userEvent.setup();
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-add')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-add'));
      await waitFor(() => {
        expect(screen.getByTestId('employee-modal')).toBeInTheDocument();
      });
      expect(screen.getByTestId('modal-option-departmentId-1')).toHaveTextContent('技术部');
      expect(screen.getByTestId('modal-option-departmentId-2')).toHaveTextContent('产品部');
      expect(screen.getByTestId('modal-option-positionId-1')).toHaveTextContent('工程师');
      expect(screen.getByTestId('modal-option-positionId-2')).toHaveTextContent('产品经理');
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
      await waitFor(() => {
        expect(screen.getByTestId('modal-field-employeeNo')).toBeInTheDocument();
      });
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
      await waitFor(() => {
        expect(screen.getByTestId('modal-ok')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('modal-ok'));
      expect(employeeApi.update).toHaveBeenCalled();
    });

    it('编辑时通过 getById 获取完整数据，回显列表行未返回的字段（薪资/备注/技能）', async () => {
      const user = userEvent.setup();
      (employeeApi.getList as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: {
          list: [
            {
              id: 1,
              employeeNo: 'E001',
              name: '张三',
              departmentId: 1,
              positionId: 1,
              hireDate: '2024-01-15',
              phone: '13800138000',
              status: 'active',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
      // 列表行不返回薪资/备注/技能等字段，但 getById 返回完整数据
      (employeeApi.getById as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: {
          id: 1,
          employeeNo: 'E001',
          name: '张三',
          departmentId: 1,
          positionId: 1,
          hireDate: '2024-01-15',
          phone: '13800138000',
          status: 'active',
          salary: '36000',
          remark: '备注X',
          skills: '技能Y',
          emergencyContact: '李四',
          tags: [{ id: 1, name: '优秀员工' }],
        },
      });
      (employeeApi.update as jest.Mock).mockResolvedValue({ code: 0, message: 'ok', data: { id: 1 } });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('btn-edit-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-edit-1'));
      await waitFor(() => {
        expect(screen.getByTestId('modal-ok')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(employeeApi.update).toHaveBeenCalled();
      });
      expect(employeeApi.getById).toHaveBeenCalledWith(1);
      expect(employeeApi.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          salary: 36000,
          remark: '备注X',
          skills: '技能Y',
          emergencyContact: '李四',
          tagIds: [1],
        }),
      );
    });

    it('保存时将工资字符串转为 number 提交', async () => {
      const user = userEvent.setup();
      (employeeApi.getList as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: {
          list: [
            {
              id: 1,
              employeeNo: 'E001',
              name: '张三',
              departmentName: '技术部',
              positionName: '工程师',
              hireDate: '2024-01-15',
              phone: '13800138000',
              status: 'active',
              salary: '36000',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
      (employeeApi.update as jest.Mock).mockResolvedValue({ code: 0, message: 'ok', data: { id: 1 } });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('btn-edit-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-edit-1'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(employeeApi.update).toHaveBeenCalled();
      });
      // 后端 updateSchema 要求 salary 为 number，避免字符串校验 400
      expect(employeeApi.update).toHaveBeenCalledWith(1, expect.objectContaining({ salary: 36000 }));
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
        expect(screen.getByTestId('btn-edit-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-edit-1'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(employeeApi.getList).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('离职功能', () => {
    it('点击离职打开确认弹窗，填写离职原因后确认会随接口一并提交', async () => {
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
      // 先只打开弹窗，不应立即调接口
      expect(employeeApi.resign).not.toHaveBeenCalled();
      // 弹窗内包含离职原因输入框
      expect(screen.getByTestId('resign-reason-input')).toBeInTheDocument();
      await user.type(screen.getByTestId('resign-reason-input'), '个人发展方向调整');
      await user.click(screen.getByTestId('resign-ok'));
      await waitFor(() => {
        expect(employeeApi.resign).toHaveBeenCalledWith(1, {
          resignDate: expect.any(String),
          reason: '个人发展方向调整',
        });
      });
    });

    it('确认离职成功后刷新列表', async () => {
      const user = userEvent.setup();
      (employeeApi.resign as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'inactive' },
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('btn-resign-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-resign-1'));
      await user.click(screen.getByTestId('resign-ok'));
      await waitFor(() => {
        expect(employeeApi.getList).toHaveBeenCalledTimes(2);
      });
    });

    it('离职返回错误码时不刷新，仅提示', async () => {
      const user = userEvent.setup();
      (employeeApi.resign as jest.Mock).mockResolvedValue({
        code: 1004,
        message: '员工已离职',
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('btn-resign-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-resign-1'));
      await user.click(screen.getByTestId('resign-ok'));
      await waitFor(() => {
        expect(employeeApi.resign).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(employeeApi.getList).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('员工标签', () => {
    it('新增/编辑弹窗提供标签多选字段，选项来自 employeeTagApi', async () => {
      const user = userEvent.setup();
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-add')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-add'));
      // 弹窗中出现标签多选字段及其选项
      expect(screen.getByTestId('modal-field-tags')).toHaveTextContent('标签');
      expect(screen.getByTestId('modal-option-tags-1')).toHaveTextContent('优秀员工');
      expect(screen.getByTestId('modal-option-tags-2')).toHaveTextContent('长期外派');
    });

    it('员工列表展示标签列及标签名', async () => {
      (employeeApi.getList as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: {
          list: [
            {
              id: 5,
              employeeNo: 'E005',
              name: '钱七',
              departmentName: '技术部',
              positionName: '工程师',
              hireDate: '2024-05-01',
              phone: '',
              status: 'active',
              tags: [
                { id: 1, name: '优秀员工', color: '#3B82F6' },
                { id: 2, name: '长期外派', color: '#16A34A' },
              ],
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('col-tags')).toHaveTextContent('标签');
      });
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(1);
      });
      expect(screen.getByText('优秀员工')).toBeInTheDocument();
      expect(screen.getByText('长期外派')).toBeInTheDocument();
    });

    it('编辑员工时回显已有标签，确认后随 tagIds 提交', async () => {
      const user = userEvent.setup();
      (employeeApi.getList as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: {
          list: [
            {
              id: 1,
              employeeNo: 'E001',
              name: '张三',
              departmentName: '技术部',
              positionName: '工程师',
              hireDate: '2024-01-15',
              phone: '13800138000',
              status: 'active',
              tags: [{ id: 1, name: '优秀员工', color: '#3B82F6' }],
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
      (employeeApi.update as jest.Mock).mockResolvedValue({ code: 0, message: 'ok', data: { id: 1 } });
      render(<EmployeeListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('btn-edit-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-edit-1'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(employeeApi.update).toHaveBeenCalled();
      });
      // 弹窗 mock 以 initialValues 提交，编辑员工带既有标签时应回显为 id 数组并随 tagIds 传入
      expect(employeeApi.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ tagIds: [1] }),
      );
    });
  });
});
