import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExpenseApprovalPage from '@/features/expense/pages/approval';
import { reimbursementApi } from '@/services/reimbursement';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), pathname: '/expense/approval' }),
}));

jest.mock('@/services/reimbursement', () => ({
  reimbursementApi: {
    getPendingApprovals: jest.fn(),
    getDetail: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
  },
}));

// 权限门：默认有 reimbursement:approve，无权限用例单独关闭
const mockCan = jest.fn((_code?: string) => true);
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: (perm: string) => mockCan(perm) }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey }: any) => (
    <div data-testid="pro-table">
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
    </div>
  ),
}));

jest.mock('@/components/StatusTag', () => ({
  __esModule: true,
  default: ({ status }: any) => <span data-testid={`status-tag-${status}`}>{status}</span>,
}));

const mockPending = [
  {
    id: 1,
    title: '8月差旅报销',
    applicantName: '张三',
    departmentName: '技术部',
    totalAmount: 1500,
    status: 'approving',
    createdAt: '2026-08-13T10:00:00+08:00',
  },
];

describe('ExpenseApprovalPage 权限门（11.6-3）', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockCan.mockReturnValue(true);
    (reimbursementApi.getPendingApprovals as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { list: mockPending, total: 1, page: 1, pageSize: 20 },
    });
  });

  it('有 reimbursement:approve 时渲染通过/驳回，权限判定使用该点', async () => {
    render(<ExpenseApprovalPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row')).toHaveLength(1);
    });
    expect(screen.getByRole('button', { name: '通过' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '驳回' })).toBeInTheDocument();
    expect(mockCan).toHaveBeenCalledWith('reimbursement:approve');
  });

  it('无 reimbursement:approve 时通过/驳回不渲染，查看保留', async () => {
    mockCan.mockImplementation((code?: string) => code !== 'reimbursement:approve');
    render(<ExpenseApprovalPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row')).toHaveLength(1);
    });
    expect(screen.queryByRole('button', { name: '通过' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '驳回' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看' })).toBeInTheDocument();
  });

  it('金额列负数红色标注（11.6-6，MoneyText）', async () => {
    (reimbursementApi.getPendingApprovals as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        list: [{ ...mockPending[0], totalAmount: -66.5 }],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    render(<ExpenseApprovalPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row')).toHaveLength(1);
    });
    expect(screen.getByText('-66.50')).toHaveClass('lx-money-negative');
  });

  // B5 竞态：详情接口慢返回时，动作弹窗的提交目标不能依赖 currentItem
  it('详情接口未返回时点击「确认通过」仍发起审批请求', async () => {
    // 详情接口一直挂起，模拟慢查询
    (reimbursementApi.getDetail as jest.Mock).mockReturnValue(new Promise(() => {}));
    (reimbursementApi.approve as jest.Mock).mockResolvedValue({ code: 0, data: { id: 1 } });

    render(<ExpenseApprovalPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row')).toHaveLength(1);
    });

    // 列表操作列「通过」：弹窗目标直接取点击时的 record
    fireEvent.click(screen.getAllByRole('button', { name: '通过' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: '确认通过' }));

    await waitFor(() => {
      expect(reimbursementApi.approve).toHaveBeenCalledWith(1, expect.objectContaining({ comment: '' }));
    });
  });

  // B5 空原因：驳回必须填写原因，前端拦截且不发起请求
  it('驳回原因为空时被拦截（不调用审批接口）', async () => {
    (reimbursementApi.getDetail as jest.Mock).mockReturnValue(new Promise(() => {}));
    (reimbursementApi.reject as jest.Mock).mockResolvedValue({ code: 0, data: { id: 1 } });

    render(<ExpenseApprovalPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row')).toHaveLength(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: '驳回' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: '确认驳回' }));

    expect(reimbursementApi.reject).not.toHaveBeenCalled();
    expect(await screen.findByText('请输入驳回原因')).toBeInTheDocument();
  });
});
