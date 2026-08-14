import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ApprovalTodoPage from '@/features/approval/pages/todo';
import { approvalApi } from '@/services/approval';

jest.mock('@/services/approval', () => ({
  approvalApi: {
    listTodos: jest.fn(),
    listMySubmissions: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
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
  default: ({ title, children }: any) => (
    <div data-testid="page-container">
      <h2 data-testid="page-title">{title}</h2>
      <div data-testid="page-content">{children}</div>
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
  const React = require('react');
  const Tabs = ({ defaultActiveTab, onChange, children }: any) => {
    const [activeTab, setActiveTab] = React.useState(defaultActiveTab || 'todos');
    return (
      <div data-testid="tabs" data-active-tab={activeTab}>
        <div role="tablist">
          <button
            role="tab"
            data-testid="tab-todos"
            data-active={activeTab === 'todos'}
            onClick={() => { setActiveTab('todos'); onChange?.('todos'); }}
          >
            待办审批
          </button>
          <button
            role="tab"
            data-testid="tab-submissions"
            data-active={activeTab === 'submissions'}
            onClick={() => { setActiveTab('submissions'); onChange?.('submissions'); }}
          >
            我的申请
          </button>
        </div>
        <div data-testid="tab-content">{children}</div>
      </div>
    );
  };
  Tabs.TabPane = ({ children }: any) => <div data-testid="tab-pane">{children}</div>;

  const Button = ({ children, onClick, type }: any) => (
    <button type="button" data-testid={`btn-${children}`} onClick={onClick}>
      {children}
    </button>
  );

  const Modal = ({ visible, title, onOk, onCancel, confirmLoading, okText, cancelText, children }: any) => {
    if (!visible) return null;
    return (
      <div role="dialog" data-testid="action-modal" data-confirm-loading={confirmLoading}>
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-body">{children}</div>
        <button data-testid="modal-cancel" onClick={onCancel}>{cancelText || '取消'}</button>
        <button data-testid="modal-ok" onClick={onOk} disabled={confirmLoading}>
          {okText || '确定'}
        </button>
      </div>
    );
  };

  const TextArea = ({ value, onChange, placeholder, style }: any) => (
    <textarea
      data-testid="comment-textarea"
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      style={style}
    />
  );

  const Input = { TextArea };

  const Card = ({ children, style }: any) => (
    <div data-testid="card" style={style}>{children}</div>
  );

  const Table = ({ columns, data, rowKey, loading, pagination }: any) => {
    const onPageChange = pagination?.onChange;
    return (
    <div data-testid="table" data-loading={loading}>
      <table>
        <thead>
          <tr>
            {columns.map((col: any) => (
              <th key={col.dataIndex} data-testid={`col-${col.dataIndex}`}>{col.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row[rowKey]} data-testid="table-row">
              {columns.map((col: any) => (
                <td key={col.dataIndex} data-testid={`cell-${row[rowKey]}-${col.dataIndex}`}>
                  {col.render ? col.render(row[col.dataIndex], row) : row[col.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && (
        <div data-testid="pagination">
          <span data-testid="page-current">{pagination.current}</span>
          <span data-testid="page-total">{pagination.total}</span>
          <button
            data-testid="page-prev"
            onClick={() => onPageChange?.(pagination.current - 1, pagination.pageSize)}
          >上一页</button>
          <button
            data-testid="page-next"
            onClick={() => onPageChange?.(pagination.current + 1, pagination.pageSize)}
          >下一页</button>
        </div>
      )}
    </div>
  );
  };

  const Tag = ({ color, children }: any) => (
    <span data-testid="tag" data-color={color}>{children}</span>
  );

  const Space = ({ children }: any) => <div data-testid="space">{children}</div>;

  const Message = {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  };

  return { Tabs, Button, Modal, TextArea, Input, Card, Table, Tag, Space, Message };
});

const mockTodos = [
  { id: 1, instanceId: 101, title: '请假申请-张三', workflowName: '请假审批', submitterName: '张三', submitterDepartment: '技术部', submitTime: '2026-08-13T09:00:00+08:00', currentNodeName: '部门主管审批', status: 'pending' },
  { id: 2, instanceId: 102, title: '加班申请-李四', workflowName: '加班审批', submitterName: '李四', submitterDepartment: '产品部', submitTime: '2026-08-12T14:00:00+08:00', currentNodeName: '部门主管审批', status: 'pending' },
];

const mockSubmissions = [
  { id: 1, instanceId: 103, title: '调休申请', workflowName: '调休审批', currentNodeName: 'HR审批', status: 'pending', submitTime: '2026-08-10T09:00:00+08:00' },
  { id: 2, instanceId: 104, title: '出差申请', workflowName: '出差审批', currentNodeName: '已完成', status: 'approved', submitTime: '2026-08-05T09:00:00+08:00' },
];

describe('ApprovalTodoPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (approvalApi.listTodos as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockTodos, total: 2, page: 1, pageSize: 20 },
    });
    (approvalApi.listMySubmissions as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockSubmissions, total: 2, page: 1, pageSize: 20 },
    });
  });

  describe('正常用例', () => {
    it('renders inside AppLayout with approval-todo menu', () => {
      render(<ApprovalTodoPage />);
      expect(screen.getByTestId('app-layout')).toHaveAttribute('data-active-menu', 'approval-todo');
    });

    it('renders PageContainer with title 审批中心', () => {
      render(<ApprovalTodoPage />);
      expect(screen.getByTestId('page-title')).toHaveTextContent('审批中心');
    });

    it('renders tabs with 待办审批 and 我的申请', () => {
      render(<ApprovalTodoPage />);
      expect(screen.getByTestId('tab-todos')).toBeInTheDocument();
      expect(screen.getByTestId('tab-submissions')).toBeInTheDocument();
    });

    it('loads todo list on mount and shows 待办 tab as default', async () => {
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(approvalApi.listTodos).toHaveBeenCalled();
      });
      expect(screen.getByTestId('tab-todos')).toHaveAttribute('data-active', 'true');
    });
  });

  describe('待办列表', () => {
    it('renders todo items with correct columns', async () => {
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(approvalApi.listTodos).toHaveBeenCalled();
      });
      expect(screen.getByText('请假申请-张三')).toBeInTheDocument();
      expect(screen.getByText('加班申请-李四')).toBeInTheDocument();
    });

    it('renders workflow name and submitter info', async () => {
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(approvalApi.listTodos).toHaveBeenCalled();
      });
      expect(screen.getByText('请假审批')).toBeInTheDocument();
      expect(screen.getByText('张三')).toBeInTheDocument();
      expect(screen.getByText('技术部')).toBeInTheDocument();
    });

    it('renders status tag for pending items', async () => {
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(approvalApi.listTodos).toHaveBeenCalled();
      });
      expect(screen.getAllByTestId('status-tag-pending').length).toBeGreaterThan(0);
    });

    it('has 同意 and 驳回 buttons on todo items', async () => {
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(approvalApi.listTodos).toHaveBeenCalled();
      });
      expect(screen.getAllByTestId('btn-同意').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('btn-驳回').length).toBeGreaterThan(0);
    });
  });

  describe('我的申请 Tab', () => {
    it('switches to 我的申请 tab and loads submissions', async () => {
      const user = userEvent.setup();
      render(<ApprovalTodoPage />);
      await user.click(screen.getByTestId('tab-submissions'));
      await waitFor(() => {
        expect(approvalApi.listMySubmissions).toHaveBeenCalled();
      });
    });

    it('renders submission items in 我的申请 tab', async () => {
      const user = userEvent.setup();
      render(<ApprovalTodoPage />);
      await user.click(screen.getByTestId('tab-submissions'));
      await waitFor(() => {
        expect(approvalApi.listMySubmissions).toHaveBeenCalled();
      });
      expect(screen.getByText('调休申请')).toBeInTheDocument();
      expect(screen.getByText('出差申请')).toBeInTheDocument();
    });

    it('shows different status tags for different submission statuses', async () => {
      const user = userEvent.setup();
      render(<ApprovalTodoPage />);
      await user.click(screen.getByTestId('tab-submissions'));
      await waitFor(() => {
        expect(approvalApi.listMySubmissions).toHaveBeenCalled();
      });
      expect(screen.getAllByTestId('status-tag-pending').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-approved').length).toBeGreaterThan(0);
    });
  });

  describe('审批操作', () => {
    it('opens approve modal when 同意 clicked', async () => {
      const user = userEvent.setup();
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('btn-同意').length).toBeGreaterThan(0);
      });
      const approveBtn = screen.getAllByTestId('btn-同意')[0];
      await user.click(approveBtn);
      expect(screen.getByTestId('action-modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('同意');
    });

    it('opens reject modal when 驳回 clicked', async () => {
      const user = userEvent.setup();
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('btn-驳回').length).toBeGreaterThan(0);
      });
      const rejectBtn = screen.getAllByTestId('btn-驳回')[0];
      await user.click(rejectBtn);
      expect(screen.getByTestId('action-modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('驳回');
    });

    it('calls approve API when confirming approve', async () => {
      const user = userEvent.setup();
      (approvalApi.approve as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
      });
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('btn-同意').length).toBeGreaterThan(0);
      });
      const approveBtn = screen.getAllByTestId('btn-同意')[0];
      await user.click(approveBtn);
      await user.click(screen.getByTestId('modal-ok'));
      expect(approvalApi.approve).toHaveBeenCalled();
    });

    it('calls reject API when confirming reject with comment', async () => {
      const user = userEvent.setup();
      (approvalApi.reject as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
      });
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('btn-驳回').length).toBeGreaterThan(0);
      });
      const rejectBtn = screen.getAllByTestId('btn-驳回')[0];
      await user.click(rejectBtn);
      await user.click(screen.getByTestId('modal-ok'));
      expect(approvalApi.reject).toHaveBeenCalled();
    });

    it('refreshes todo list after successful approve', async () => {
      const user = userEvent.setup();
      (approvalApi.approve as jest.Mock).mockResolvedValue({ code: 0 });
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(approvalApi.listTodos).toHaveBeenCalledTimes(1);
      });
      const approveBtn = screen.getAllByTestId('btn-同意')[0];
      await user.click(approveBtn);
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(approvalApi.listTodos).toHaveBeenCalledTimes(2);
      });
    });

    it('closes modal on cancel', async () => {
      const user = userEvent.setup();
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('btn-同意').length).toBeGreaterThan(0);
      });
      const approveBtn = screen.getAllByTestId('btn-同意')[0];
      await user.click(approveBtn);
      expect(screen.getByTestId('action-modal')).toBeInTheDocument();
      await user.click(screen.getByTestId('modal-cancel'));
      expect(screen.queryByTestId('action-modal')).not.toBeInTheDocument();
    });
  });

  describe('边界用例', () => {
    it('handles empty todo list', async () => {
      (approvalApi.listTodos as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(approvalApi.listTodos).toHaveBeenCalled();
      });
      expect(screen.queryByText('请假申请-张三')).not.toBeInTheDocument();
    });
  });

  describe('异常用例', () => {
    it('handles already approved error (code 3001)', async () => {
      const user = userEvent.setup();
      (approvalApi.approve as jest.Mock).mockResolvedValue({
        code: 3001,
        message: '该审批已被处理',
      });
      render(<ApprovalTodoPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('btn-同意').length).toBeGreaterThan(0);
      });
      const approveBtn = screen.getAllByTestId('btn-同意')[0];
      await user.click(approveBtn);
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(approvalApi.approve).toHaveBeenCalled();
      });
    });
  });
});
