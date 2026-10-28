import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RunDetailsModal from '@/features/payroll/components/RunDetailsModal';
import { payrollApi } from '@/services/payroll';
import { clearDataCache } from '@/hooks/use-cached-data';
import { Modal, Message } from '@arco-design/web-react';

jest.mock('@/services/payroll', () => ({
  payrollApi: {
    getPayrollRunDetails: jest.fn(),
    adjustPayrollRun: jest.fn(),
    getSalaryItems: jest.fn(),
    confirmPayrollRun: jest.fn(),
  },
}));

// Arco Modal/Message 精简为可测试容器
jest.mock('@arco-design/web-react', () => {
  const React = require('react');
  const Modal: any = ({ title, visible, children, footer }: any) =>
    visible ? (
      <div data-testid="arco-modal" data-title={title}>
        <h3>{title}</h3>
        {children}
        {footer === null ? null : <div data-testid="arco-modal-footer" />}
      </div>
    ) : null;
  // 组件用 Modal.confirm 做确认批次二次确认：这里只截获入参，
  // 由用例显式调用 onOk()，从而断言「点确认 → 调用 confirmPayrollRun」
  Modal.confirm = jest.fn();
  return {
    Modal,
    Descriptions: ({ data }: any) => (
      <div data-testid="descriptions">{data.map((d: any) => (
        <span key={d.label} data-testid={`desc-${d.label}`}>{d.label}:{d.value}</span>
      ))}</div>
    ),
    Table: ({ data, expandedRowRender, loading, rowSelection }: any) => (
      <div data-testid="arco-table" data-loading={String(loading)}>
        {data.map((row: any) => (
          <div key={row.key}>
            {rowSelection && (
              <input
                type="checkbox"
                data-testid={`select-${row.key}`}
                aria-label={`勾选 ${row.name}`}
                checked={(rowSelection.selectedRowKeys ?? []).includes(row.key)}
                onChange={(e) => {
                  const current: number[] = [...(rowSelection.selectedRowKeys ?? [])];
                  rowSelection.onChange(
                    e.target.checked
                      ? [...current, row.key]
                      : current.filter((k) => k !== row.key),
                  );
                }}
              />
            )}
            <div data-row-emp>{row.employeeNo} {row.name}</div>
            <span data-testid="desc-合计">{row.total}</span>
            {expandedRowRender && (
              <div data-testid={`expand-${row.key}`}>{expandedRowRender(row)}</div>
            )}
          </div>
        ))}
      </div>
    ),
    Button: ({ children, onClick, loading, ...rest }: any) => (
      <button type="button" onClick={onClick} {...rest}>{children}</button>
    ),
    Space: ({ children }: any) => <div>{children}</div>,
    Tag: ({ children }: any) => <span data-testid="tag">{children}</span>,
    Typography: { Text: ({ children }: any) => <span>{children}</span> },
    Message: { success: jest.fn(), error: jest.fn() },
    // DataState 依赖项：错误文案/空态/骨架屏（外层 role="alert" 已由 DataState 提供）
    Result: ({ subTitle, extra }: any) => (
      <div>
        <p>{subTitle}</p>
        {extra}
      </div>
    ),
    Empty: ({ description }: any) => <div data-testid="empty">{description}</div>,
    Skeleton: () => null,
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
    render(<RunDetailsModal canManage visible run={mockRun} onCancel={jest.fn()} />);
    await waitFor(() => {
      expect(payrollApi.getPayrollRunDetails).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.getByText('E001 张三')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('desc-合计')).toHaveTextContent('¥ 5,200.00');
  });

  it('展开行展示工资构成（明细项 + 调整项）', async () => {
    render(<RunDetailsModal canManage visible run={mockRun} onCancel={jest.fn()} />);
    await waitFor(() => {
      expect(payrollApi.getPayrollRunDetails).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId('salary-composition')).toBeInTheDocument();
    });
    // 明细项：标签与金额分列（金额千分位 + 两位小数）
    expect(screen.getByText('基本工资')).toBeInTheDocument();
    expect(screen.getByText('5,000.00')).toBeInTheDocument();
    expect(screen.getByText('餐补')).toBeInTheDocument();
    expect(screen.getByText('300.00')).toBeInTheDocument();
    // 调整项：展示原因，扣减带负号
    expect(screen.getByText('迟到扣款')).toBeInTheDocument();
    expect(screen.getByText('−100.00')).toBeInTheDocument();
    // 合计行
    expect(screen.getByText('5,200.00')).toBeInTheDocument();
  });

  it('draft 批次可添加调整并调用 adjustPayrollRun 后刷新', async () => {
    const user = userEvent.setup();
    const onChanged = jest.fn();
    render(<RunDetailsModal canManage visible run={mockRun} onCancel={jest.fn()} onChanged={onChanged} />);
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
    render(<RunDetailsModal canManage visible run={{ ...mockRun, status: 'published' }} onCancel={jest.fn()} />);
    await waitFor(() => {
      expect(payrollApi.getPayrollRunDetails).toHaveBeenCalledWith(1);
    });
    expect(screen.queryByText('添加调整')).not.toBeInTheDocument();
  });

  it('明细接口业务码非 0 时展示错误态与重试，不显示「暂无明细」', async () => {
    (payrollApi.getPayrollRunDetails as jest.Mock).mockResolvedValueOnce({
      code: 500,
      message: '批次明细读取失败',
    });
    render(<RunDetailsModal canManage visible run={mockRun} onCancel={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('批次明细读取失败');
    });
    expect(screen.queryByTestId('empty')).not.toBeInTheDocument();
    // 明细没拿到时不提供「添加调整」，避免对着空员工列表改工资
    expect(screen.queryByText('添加调整')).not.toBeInTheDocument();

    (payrollApi.getPayrollRunDetails as jest.Mock).mockResolvedValue({
      code: 0, message: 'ok', data: mockDetails,
    });
    await userEvent.click(screen.getByText('重试'));

    await waitFor(() => expect(screen.getByText('E001 张三')).toBeInTheDocument());
  });

  it('批次没有员工明细时展示空态文案而非空白表格', async () => {
    (payrollApi.getPayrollRunDetails as jest.Mock).mockResolvedValue({
      code: 0, message: 'ok', data: { ...mockDetails, employees: [] },
    });
    render(<RunDetailsModal canManage visible run={mockRun} onCancel={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty')).toHaveTextContent('该批次暂无员工明细');
    });
  });

  it('非 visible 时不渲染内容', async () => {
    const { container } = render(<RunDetailsModal canManage visible={false} run={mockRun} onCancel={jest.fn()} />);
    expect(container.querySelector('[data-testid="arco-modal"]')).not.toBeInTheDocument();
    // 关闭状态下两个缓存请求仍会立刻返回占位值，等其落地再结束用例
    await act(async () => {});
    expect(payrollApi.getPayrollRunDetails).not.toHaveBeenCalled();
  });

  // 后端 confirmRun 强校验「至少抽检 3 名员工」（confirmRunSchema），
  // 前端必须把这条前置条件摆到明细里，否则用户点了确认只会拿到 400。
  describe('确认批次（抽检 ≥3 人）', () => {
    const threeEmployees = {
      run: mockRun,
      employees: [1, 2, 3].map((i) => ({
        employee: { id: i, employeeNo: `E00${i}`, name: `员工${i}`, departmentId: 1 },
        items: [{ code: 'base', name: '基本工资', amount: 5000 }],
        adjustments: [],
        total: 5000,
      })),
    };

    beforeEach(() => {
      (payrollApi.getPayrollRunDetails as jest.Mock).mockResolvedValue({
        code: 0, message: 'ok', data: threeEmployees,
      });
      (Modal.confirm as jest.Mock).mockClear();
    });

    const confirmButton = () => screen.getByText('确认批次').closest('button') as HTMLButtonElement;

    it('未勾选或不足 3 人时禁用确认，并提示还差几人', async () => {
      const user = userEvent.setup();
      render(<RunDetailsModal canManage visible run={mockRun} onCancel={jest.fn()} />);
      await waitFor(() => expect(screen.getByText('E001 员工1')).toBeInTheDocument());

      expect(confirmButton()).toBeDisabled();
      expect(screen.getByText(/还差 3 名/)).toBeInTheDocument();

      await user.click(screen.getByTestId('select-1'));
      expect(confirmButton()).toBeDisabled();
      expect(screen.getByText(/还差 2 名/)).toBeInTheDocument();

      await user.click(screen.getByTestId('select-2'));
      expect(confirmButton()).toBeDisabled();

      await user.click(screen.getByTestId('select-3'));
      expect(confirmButton()).toBeEnabled();
      expect(screen.getByText(/已勾选 3 名员工/)).toBeInTheDocument();
      // 不足 3 人时不允许发起确认请求
      expect(payrollApi.confirmPayrollRun).not.toHaveBeenCalled();
    });

    it('选满 3 人确认后带抽检员工调用 confirmPayrollRun，成功后刷新并关闭', async () => {
      (payrollApi.confirmPayrollRun as jest.Mock).mockResolvedValue({ code: 0, message: 'ok' });
      const user = userEvent.setup();
      const onChanged = jest.fn();
      const onCancel = jest.fn();
      render(<RunDetailsModal canManage visible run={mockRun} onCancel={onCancel} onChanged={onChanged} />);
      await waitFor(() => expect(screen.getByText('E001 员工1')).toBeInTheDocument());

      await user.click(screen.getByTestId('select-1'));
      await user.click(screen.getByTestId('select-2'));
      await user.click(screen.getByTestId('select-3'));
      await user.click(confirmButton());

      // 二次确认弹窗：文案里要写明勾选人数与锁定后果
      expect(Modal.confirm).toHaveBeenCalledTimes(1);
      const opts = (Modal.confirm as jest.Mock).mock.calls[0][0];
      expect(opts.title).toBe('确认算薪批次');
      expect(opts.content).toContain('已勾选 3 名员工');
      expect(opts.content).toContain('2026-08');

      // onOk 内部会 setState（confirming / 关闭），必须包在 act 里
      await act(async () => {
        await opts.onOk();
      });

      await waitFor(() =>
        expect(payrollApi.confirmPayrollRun).toHaveBeenCalledWith(1, [1, 2, 3]),
      );
      expect(Message.success).toHaveBeenCalledWith('确认成功');
      expect(onChanged).toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalled();
    });

    it('确认失败时提示错误，不刷新也不关闭弹窗', async () => {
      (payrollApi.confirmPayrollRun as jest.Mock).mockResolvedValue({
        code: 4001, message: '抽检人数不足',
      });
      const user = userEvent.setup();
      const onChanged = jest.fn();
      const onCancel = jest.fn();
      render(<RunDetailsModal canManage visible run={mockRun} onCancel={onCancel} onChanged={onChanged} />);
      await waitFor(() => expect(screen.getByText('E001 员工1')).toBeInTheDocument());

      await user.click(screen.getByTestId('select-1'));
      await user.click(screen.getByTestId('select-2'));
      await user.click(screen.getByTestId('select-3'));
      await user.click(confirmButton());

      const failOpts = (Modal.confirm as jest.Mock).mock.calls[0][0];
      await act(async () => {
        await failOpts.onOk();
      });

      await waitFor(() => expect(Message.error).toHaveBeenCalledWith('确认失败'));
      expect(onChanged).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('非 draft 批次不展示确认入口与勾选框', async () => {
      render(
        <RunDetailsModal canManage visible run={{ ...mockRun, status: 'confirmed' }} onCancel={jest.fn()} />,
      );
      await waitFor(() => expect(screen.getByText('E001 员工1')).toBeInTheDocument());
      expect(screen.queryByText('确认批次')).not.toBeInTheDocument();
      expect(screen.queryByTestId('select-1')).not.toBeInTheDocument();
    });

    it('只有查看权限时仍可看明细，但不展示调整与确认入口', async () => {
      render(
        <RunDetailsModal canManage={false} visible run={mockRun} onCancel={jest.fn()} />,
      );
      await waitFor(() => expect(screen.getByText('E001 员工1')).toBeInTheDocument());
      // 明细与金额照常可见（payroll:view 足够）
      expect(screen.getAllByTestId('desc-合计')[0]).toHaveTextContent('¥ 5,000.00');
      // 写操作入口（后端要求 payroll:manage）一律不出现
      expect(screen.queryByText('添加调整')).not.toBeInTheDocument();
      expect(screen.queryByText('确认批次')).not.toBeInTheDocument();
      expect(screen.queryByTestId('select-1')).not.toBeInTheDocument();
    });
  });
});