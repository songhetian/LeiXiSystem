import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ApprovalSubmissionsPage from '@/features/approval/pages/submissions';
import { approvalApi } from '@/services/approval';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('@/services/approval', () => ({
  approvalApi: {
    listMySubmissions: jest.fn(),
  },
}));


jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="page-container">
      {title && <h2 data-testid="page-title">{title}</h2>}
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

// 页面已迁公共组件 ProTable（内部依赖 SearchForm/DatePicker 等），按仓库约定直接 mock
jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, pagination, onPageChange }: any) => (
    <div data-testid="table">
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
  ),
}));

jest.mock('@arco-design/web-react', () => {
  const Button = ({ children, onClick, type }: any) => (
    <button type="button" data-testid={`btn-${children}`} onClick={onClick}>
      {children}
    </button>
  );

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

  const Empty = ({ description }: any) => (
    <div data-testid="empty">{description || '暂无数据'}</div>
  );
  const Result = ({ title, subTitle, extra }: any) => (
    <div data-testid="result">
      <div>{title}</div>
      <div>{subTitle}</div>
      {extra}
    </div>
  );
  const Skeleton = (props: any) => (
    <div data-testid="skeleton" style={props.style || props.text} />
  );

  const Space = ({ children }: any) => <div data-testid="space">{children}</div>;

  const Select = ({ value, onChange, options, placeholder, allowClear }: any) => (
    <select
      data-testid="select"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options?.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  const Modal = ({ visible, title, onOk, onCancel, confirmLoading, okText, cancelText, children }: any) => {
    if (!visible) return null;
    return (
      <div role="dialog" data-testid="apply-modal" data-confirm-loading={confirmLoading}>
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-body">{children}</div>
        <button data-testid="modal-cancel" onClick={onCancel}>{cancelText || '取消'}</button>
        <button data-testid="modal-ok" onClick={onOk} disabled={confirmLoading}>
          {okText || '确定'}
        </button>
      </div>
    );
  };

  const Form = ({ children, form, layout }: any) => <div data-testid="form">{children}</div>;
  Form.Item = ({ label, field, children, rules }: any) => (
    <div data-testid={`form-item-${field}`}>
      {label && <label>{label}</label>}
      {children}
    </div>
  );
  Form.useForm = () => [{}];

  const Input = ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="input"
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
  Input.TextArea = ({ value, onChange, placeholder, style }: any) => (
    <textarea
      data-testid="textarea"
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      style={style}
    />
  );

  const Message = {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  };

  return {
    Button, Card, Table, Tag, Space, Message, Select, Modal, Form, Input,
    Empty, Result, Skeleton,
  };
});

const mockSubmissions = [
  { id: 1, instanceId: 103, title: '调休申请', workflowName: '调休审批', currentNodeName: 'HR审批', status: 'pending', submitTime: '2026-08-10T09:00:00+08:00' },
  { id: 2, instanceId: 104, title: '出差申请', workflowName: '出差审批', currentNodeName: '已完成', status: 'approved', submitTime: '2026-08-05T09:00:00+08:00' },
];

describe('ApprovalSubmissionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // useCachedData 模块级共享缓存需在用例间清空，防止缓存串数据
    clearDataCache();
    (approvalApi.listMySubmissions as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockSubmissions, total: 2, page: 1, pageSize: 20 },
    });
  });

  describe('正常用例', () => {
    it('mounts without page-title (顶部已统一用面包屑)', () => {
      render(<ApprovalSubmissionsPage />);
      // 顶部不再有 page-title（统一由面包屑承担）
      expect(screen.queryByTestId('page-title')).toBeNull();
    });

    it('loads submissions on mount', async () => {
      render(<ApprovalSubmissionsPage />);
      await waitFor(() => {
        expect(approvalApi.listMySubmissions).toHaveBeenCalled();
      });
    });

    it('renders submission items with correct columns', async () => {
      render(<ApprovalSubmissionsPage />);
      // 数据层已迁 useCachedData（异步 setState），等数据渲染后再断言
      await screen.findByText('调休申请');
      expect(screen.getByText('出差申请')).toBeInTheDocument();
      expect(screen.getByText('调休审批')).toBeInTheDocument();
      expect(screen.getByText('出差审批')).toBeInTheDocument();
    });

    it('shows status tags for different statuses', async () => {
      render(<ApprovalSubmissionsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('status-tag-pending').length).toBeGreaterThan(0);
      });
      expect(screen.getAllByTestId('status-tag-approved').length).toBeGreaterThan(0);
    });
  });

  describe('边界用例', () => {
    it('handles empty list', async () => {
      (approvalApi.listMySubmissions as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<ApprovalSubmissionsPage />);
      await waitFor(() => {
        expect(approvalApi.listMySubmissions).toHaveBeenCalled();
      });
      expect(screen.queryByText('调休申请')).not.toBeInTheDocument();
    });
  });

  describe('分页', () => {
    it('handles pagination', async () => {
      const user = userEvent.setup();
      render(<ApprovalSubmissionsPage />);
      await waitFor(() => {
        expect(approvalApi.listMySubmissions).toHaveBeenCalled();
      });
      expect(screen.getByTestId('page-current')).toHaveTextContent('1');
      await user.click(screen.getByTestId('page-next'));
      await waitFor(() => {
        expect(approvalApi.listMySubmissions).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
      });
    });
  });
});
