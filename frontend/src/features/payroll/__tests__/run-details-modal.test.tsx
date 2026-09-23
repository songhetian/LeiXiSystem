import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RunDetailsModal from '@/features/payroll/components/RunDetailsModal';
import { payrollApi } from '@/services/payroll';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/payroll', () => ({
  payrollApi: {
    getPayrollRunDetails: jest.fn(),
    adjustPayrollRun: jest.fn(),
    getSalaryItems: jest.fn(),
  },
}));

// Arco Modal/Message 精简为可测试容器
jest.mock('@arco-design/web-react', () => {
  const React = require('react');
  return {
    Modal: ({ title, visible, children, footer }: any) =>
      visible ? (
        <div data-testid="arco-modal" data-title={title}>
          <h3>{title}</h3>
          {children}
          {footer === null ? null : <div data-testid="arco-modal-footer" />}
        </div>
      ) : null,
    Descriptions: ({ data }: any) => (
      <div data-testid="descriptions">{data.map((d: any) => (
        <span key={d.label} data-testid={`desc-${d.label}`}>{d.label}:{d.value}</span>
      ))}</div>
    ),
    Table: ({ data, expandedRowRender, loading }: any) => (
      <div data-testid="arco-table" data-loading={String(loading)}>
        {data.map((row: any) => (
          <div key={row.key}>
            <div data-row-emp>{row.employeeNo} {row.name}</div>
            <span data-testid="desc-合计">{row.total}</span>
            {expandedRowRender && (
              <div data-testid={`expand-${row.key}`}>{expandedRowRender(row)}</div>
            )}
          </div>
        ))}
      </div>
    ),
    Button: ({ children, onClick, ...rest }: any) => (
      <button type="button" onClick={onClick} {...rest}>{children}</button>
    ),
    Space: ({ children }: any) => <div>{children}</div>,
    Tag: ({ children }: any) => <span data-testid="tag">{children}</span>,
    Message: { success: jest.fn(), error: jest.fn() },
  };
});

// ModalForm 还原为可验证容器：确定直接回调 onOk(值)，取消回调 onCancel
jest.mock('@/components/ModalForm', () => ({
  __esModule: true,
  default: ({ visible, title, fields, onOk, onCancel, confirmLoading }: any) =>
    visible ? (
      <div data-testid="modal-form" data-title={title} data-loading={String(confirmLoading)}>
        {fields?.map((f: any) => <span key={f.key} data-testid={`field-${f.key}`}>{f.label}</span>)}
        <button type="button" data-testid="modal-ok" onClick={() => onOk({
          employeeId: 1, itemCode: 'penalty', amount: -100, reason: '测试调整',
        })}>确定</button>
        <button type="button" data-testid="modal-cancel" onClick={onCancel}>取消</button>
      </div>
    ) : null,
}));

const mockRun = {
  id: 1,
  month: '2026-08',
  status: 'draft' as const,
  totalEmployees: 1,
  totalAmount: 5200,
  createdAt: '2026-08-13T10:00:00+08:00',
};

const mockDetails = {
  run: mockRun,
  employees: [
    {
      employee: { id: 1, employeeNo: 'E001', name: '张三', departmentId: 1 },
      items: [
        { code: 'base', name: '基本工资', amount: 5000 },
        { code: 'meal', name: '餐补', amount: 300 },
      ],
      adjustments: [
        { id: 1, itemCode: 'penalty', amount: -100, reason: '迟到扣款', createdAt: '2026-08-01T00:00:00+08:00' },
      ],
      total: 5200,
    },
  ],
};

describe('RunDetailsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
    (payrollApi.getPayrollRunDetails as jest.Mock).mockResolvedValue({
      code: 0, message: 'ok', data: mockDetails,
    });
    (payrollApi.adjustPayrollRun as jest.Mock).mockResolvedValue({ code: 0, message: 'ok' });
    (payrollApi.getSalaryItems as jest.Mock).mockResolvedValue({
      code: 0, data: { list: [], total: 0, page: 1, pageSize: 20 },
    });
  });

  it('打开时拉取批次明细并展示员工信息与合计', async () => {
    render(<RunDetailsModal visible run={mockRun} onCancel={jest.fn()} />);
    await waitFor(() => {
      expect(payrollApi.getPayrollRunDetails).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.getByText('E001 张三')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('desc-合计')).toHaveTextContent('5200');
  });

  it('展开行展示工资构成（明细项 + 调整项）', async () => {
    render(<RunDetailsModal visible run={mockRun} onCancel={jest.fn()} />);
    await waitFor(() => {
      expect(payrollApi.getPayrollRunDetails).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.getByText('基本工资:5000')).toBeInTheDocument();
      expect(screen.getByText('餐补:300')).toBeInTheDocument();
      expect(screen.getByText('调整 · 迟到扣款:-100')).toBeInTheDocument();
    });
  });

  it('draft 批次可添加调整并调用 adjustPayrollRun 后刷新', async () => {
    const user = userEvent.setup();
    const onChanged = jest.fn();
    render(<RunDetailsModal visible run={mockRun} onCancel={jest.fn()} onChanged={onChanged} />);
    await waitFor(() => {
      expect(screen.getByText('添加调整')).toBeInTheDocument();
    });
    await user.click(screen.getByText('添加调整'));
    expect(screen.getByTestId('modal-form')).toHaveAttribute('data-title', '添加调整项');
    // 表单被 mock 以固定值回调 onOk
    await user.click(screen.getByTestId('modal-ok'));
    await waitFor(() => {
      expect(payrollApi.adjustPayrollRun).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ employeeId: 1, amount: -100, reason: '测试调整' }),
      );
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it('published 批次不展示添加调整按钮', async () => {
    render(<RunDetailsModal visible run={{ ...mockRun, status: 'published' }} onCancel={jest.fn()} />);
    await waitFor(() => {
      expect(payrollApi.getPayrollRunDetails).toHaveBeenCalledWith(1);
    });
    expect(screen.queryByText('添加调整')).not.toBeInTheDocument();
  });

  it('非 visible 时不渲染内容', () => {
    const { container } = render(<RunDetailsModal visible={false} run={mockRun} onCancel={jest.fn()} />);
    expect(container.querySelector('[data-testid="arco-modal"]')).not.toBeInTheDocument();
  });
});