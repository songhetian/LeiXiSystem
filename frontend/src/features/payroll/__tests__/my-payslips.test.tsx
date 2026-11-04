import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MyPayslipsPage, { buildSearchFields } from '@/features/payroll/pages/my-payslips';
import { payslipApi } from '@/services/payslip';
import { authApi } from '@/services/auth';
import { clearDataCache } from '@/hooks/use-cached-data';
import { buildPayslipPrintHtml } from '@/lib/payslip-print';

jest.mock('@/hooks/use-system-info', () => ({
  useSystemInfo: () => ({
    info: { name: '雷犀科技', logoUrl: '' },
    loading: false,
    revalidate: jest.fn(),
  }),
}));

jest.mock('@/services/payslip', () => ({
  payslipApi: {
    getMyPayslips: jest.fn(),
    getMyPayslipDetail: jest.fn(),
    markAsViewed: jest.fn(),
    verifyPassword: jest.fn(),
    getMyYearSummary: jest.fn(),
  },
}));

jest.mock('@/services/auth', () => ({
  authApi: {
    getPrivacyPasswordStatus: jest.fn(),
    setPrivacyPassword: jest.fn(),
    resetPrivacyPassword: jest.fn(),
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
  default: ({ columns, data, rowKey, loading, searchFields, toolbar, pagination, onSearch, onPageChange, onRowClick }: any) => (
    <div data-testid="pro-table" data-loading={loading}>
      {searchFields && (
        <div data-testid="search-area">
          {searchFields.map((f: any) => (
            <span key={f.key} data-testid={`search-${f.key}`}>{f.label}</span>
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
            <tr
              key={row[rowKey]}
              data-testid="table-row"
              onClick={() => onRowClick?.(row)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
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

const mockPayslips = [
  {
    id: 1,
    month: '2026-08',
    status: 'unviewed',
    baseSalary: 5000,
    totalIncome: 5700,
    totalDeduction: 500,
    netSalary: 5200,
    createdAt: '2026-08-13T10:00:00+08:00',
  },
  {
    id: 2,
    month: '2026-07',
    status: 'viewed',
    baseSalary: 5000,
    totalIncome: 5500,
    totalDeduction: 500,
    netSalary: 5000,
    createdAt: '2026-07-31T10:00:00+08:00',
    viewedAt: '2026-07-31T15:00:00+08:00',
  },
];

/** 明细月份(2026-08)的上一个月工资条，用于「与上月对比」 */
const mockPrevPayslip = {
  id: 2,
  month: '2026-07',
  status: 'viewed',
  baseSalary: 5000,
  totalIncome: 5500,
  totalDeduction: 500,
  netSalary: 5000,
  createdAt: '2026-07-31T10:00:00+08:00',
};

/**
 * 上月明细：加班费少 200、多一项餐补、没有全勤奖 —— 用于逐项差异断言。
 * 注意明细只能从详情接口拿（列表接口已不下发 itemsJson，门禁在服务端）。
 */
const mockPrevDetail = {
  ...mockPrevPayslip,
  items: [
    { code: 'BASE_SALARY', name: '基本工资', amount: 5000, type: 'income' },
    { code: 'OVERTIME', name: '加班费', amount: 300, type: 'income' },
    { code: 'MEAL', name: '餐补', amount: 100, type: 'income' },
    { code: 'SOCIAL_SECURITY', name: '社保', amount: 500, type: 'deduction' },
  ],
};

const mockPayslipDetail = {
  id: 1,
  employeeNo: 'E001',
  employeeName: '张三',
  departmentName: '技术部',
  month: '2026-08',
  status: 'unviewed',
  baseSalary: 5000,
  overtimePay: 500,
  absenceDeduction: 0,
  bonus: 200,
  totalIncome: 5700,
  totalDeduction: 500,
  netSalary: 5200,
  items: [
    { code: 'BASE_SALARY', name: '基本工资', amount: 5000, type: 'income' },
    { code: 'OVERTIME', name: '加班费', amount: 500, type: 'income' },
    { code: 'BONUS', name: '全勤奖', amount: 200, type: 'income' },
    { code: 'SOCIAL_SECURITY', name: '社保', amount: 500, type: 'deduction' },
  ],
  adjustments: [],
  createdAt: '2026-08-13T10:00:00+08:00',
  viewedAt: null,
};

describe('MyPayslipsPage', () => {
  /** 只统计「列表请求」（不带 month 参数），避免把「上月工资条」对比请求算进去 */
  const listCallCount = () =>
    (payslipApi.getMyPayslips as jest.Mock).mock.calls.filter(
      ([params]: any[]) => !params?.month,
    ).length;

  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    // 列表与「上月工资条」共用一个接口：按 params.month 分派，避免对比用例误取到列表数据
    (payslipApi.getMyPayslips as jest.Mock).mockImplementation((params: any = {}) => {
      if (params.month === mockPrevPayslip.month) {
        return Promise.resolve({
          code: 0,
          message: 'ok',
          data: { list: [mockPrevPayslip], total: 1, page: 1, pageSize: 1 },
        });
      }
      return Promise.resolve({
        code: 0,
        message: 'ok',
        data: {
          list: mockPayslips,
          total: 2,
          page: 1,
          pageSize: 20,
        },
      });
    });
    (payslipApi.getMyYearSummary as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        year: '2026',
        months: 8,
        totalIncome: '45600.00',
        totalDeduction: '-4000.00',
        netSalary: '41600.00',
      },
    });
    (payslipApi.getMyPayslipDetail as jest.Mock).mockImplementation((id: number) =>
      Promise.resolve({
        code: 0,
        message: 'ok',
        data: id === mockPrevPayslip.id ? mockPrevDetail : mockPayslipDetail,
      }),
    );
    (payslipApi.markAsViewed as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { id: 1, status: 'viewed' },
    });
    (payslipApi.verifyPassword as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { verified: true, expiresInSeconds: 300 },
    });
    (authApi.getPrivacyPasswordStatus as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { enabled: false },
    });
  });

  describe('正常用例', () => {
    it('不渲染冗余页面大标题（顶部已有全局面包屑）', async () => {
      render(<MyPayslipsPage />);
      // 冲刷挂载后的异步请求更新，避免同步用例结束时更新落在 act 空窗期产生告警
      await screen.findByTestId('page-container');
      expect(screen.queryByTestId('page-title')).toBeNull();
    });

    it('renders ProTable with payslip columns', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toBeInTheDocument();
      });
      expect(screen.getByTestId('col-month')).toHaveTextContent('月份');
      expect(screen.getByTestId('col-status')).toHaveTextContent('状态');
      expect(screen.getByTestId('col-baseSalary')).toHaveTextContent('基本工资');
      expect(screen.getByTestId('col-totalIncome')).toHaveTextContent('应发合计');
      expect(screen.getByTestId('col-totalDeduction')).toHaveTextContent('扣款合计');
      expect(screen.getByTestId('col-netSalary')).toHaveTextContent('实发工资');
      expect(screen.getByTestId('col-createdAt')).toHaveTextContent('发放时间');
    });

    it('fetches payslips on mount', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(payslipApi.getMyPayslips).toHaveBeenCalled();
      });
    });

    it('renders payslip data in table', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      expect(screen.getByTestId('cell-1-month')).toHaveTextContent('2026-08');
      // 金额统一走 MoneyText：千分位 + 两位小数，避免员工对着裸数字核对
      expect(screen.getByTestId('cell-1-netSalary')).toHaveTextContent('5,200.00');
      expect(screen.getByTestId('cell-2-month')).toHaveTextContent('2026-07');
      expect(screen.getByTestId('cell-2-netSalary')).toHaveTextContent('5,000.00');
    });

    it('renders status tag for each payslip', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      expect(screen.getAllByTestId('status-tag-unviewed').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-viewed').length).toBeGreaterThan(0);
    });

    it('renders search field for month filter', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('search-area')).toBeInTheDocument();
      });
      expect(screen.getByTestId('search-month')).toHaveTextContent('月份');
    });

    it('shows pagination info', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
      expect(screen.getByTestId('page-total')).toHaveTextContent('2');
    });
  });

  describe('二级密码门禁', () => {
    /** 走到「输入密码」这一步：渲染 → 点行 → 弹出二级密码弹窗 */
    const openPasswordModal = async () => {
      const user = userEvent.setup();
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      await user.click(screen.getByTestId('cell-1-month'));
      // 按弹窗标题等，不按 placeholder：placeholder 随二级密码状态变化，
      // 状态未就绪时是通用文案
      await waitFor(() => {
        expect(screen.getByText('二级密码验证')).toBeInTheDocument();
      });
      return user;
    };

    it('点击行不直接拉取明细，而是先弹出二级密码弹窗', async () => {
      await openPasswordModal();
      expect(screen.getByText('二级密码验证')).toBeInTheDocument();
      expect(payslipApi.getMyPayslipDetail).not.toHaveBeenCalled();
    });

    it('密码为空时点确认：提示必填，不发起验证请求', async () => {
      const user = await openPasswordModal();
      await user.click(screen.getByRole('button', { name: '确认查看' }));
      await waitFor(() => {
        expect(screen.getByText('请输入二级密码')).toBeInTheDocument();
      });
      expect(payslipApi.verifyPassword).not.toHaveBeenCalled();
    });

    it('密码错误：显示错误信息，不拉取明细', async () => {
      (payslipApi.verifyPassword as jest.Mock).mockResolvedValue({
        code: 3013,
        message: '二级密码错误',
      });
      const user = await openPasswordModal();
      await user.type(screen.getByPlaceholderText('请输入登录密码'), 'wrongpass');
      await user.click(screen.getByRole('button', { name: '确认查看' }));
      await waitFor(() => {
        expect(payslipApi.verifyPassword).toHaveBeenCalledWith('wrongpass');
      });
      expect(screen.getByText('二级密码错误')).toBeInTheDocument();
      expect(payslipApi.getMyPayslipDetail).not.toHaveBeenCalled();
    });

    it('验证请求被拒（HTTP 401 reject，不跳登录）：内联展示后端 message', async () => {
      (payslipApi.verifyPassword as jest.Mock).mockRejectedValue(
        new Error('二级密码错误'),
      );
      const user = await openPasswordModal();
      await user.type(screen.getByPlaceholderText('请输入登录密码'), 'wrongpass');
      await user.click(screen.getByRole('button', { name: '确认查看' }));
      await waitFor(() => {
        expect(screen.getByText('二级密码错误')).toBeInTheDocument();
      });
      expect(payslipApi.getMyPayslipDetail).not.toHaveBeenCalled();
    });

    it('密码正确：关闭验证弹窗并拉取明细', async () => {
      const user = await openPasswordModal();
      await user.type(screen.getByPlaceholderText('请输入登录密码'), 'secret123');
      await user.click(screen.getByRole('button', { name: '确认查看' }));
      await waitFor(() => {
        expect(payslipApi.verifyPassword).toHaveBeenCalledWith('secret123');
      });
      await waitFor(() => {
        expect(payslipApi.getMyPayslipDetail).toHaveBeenCalledWith(1);
      });
      // 冲刷 markAsViewed 后 revalidate 触发的列表刷新，避免更新落在 act 空窗期产生告警
      await waitFor(() => {
        expect(listCallCount()).toBe(2);
      });
    });

    it('验证通过后查看未读工资条：标记为已查看', async () => {
      const user = await openPasswordModal();
      await user.type(screen.getByPlaceholderText('请输入登录密码'), 'secret123');
      await user.click(screen.getByRole('button', { name: '确认查看' }));
      await waitFor(() => {
        expect(payslipApi.markAsViewed).toHaveBeenCalledWith(1);
      });
      // 未读→已读会 revalidate 列表，等待其完成以覆盖 act 空窗期的更新
      await waitFor(() => {
        expect(listCallCount()).toBe(2);
      });
    });

    it('验证通过后的免验窗口内，连续查看不再要求输入密码', async () => {
      const user = await openPasswordModal();
      await user.type(screen.getByPlaceholderText('请输入登录密码'), 'secret123');
      await user.click(screen.getByRole('button', { name: '确认查看' }));
      await waitFor(() => {
        expect(payslipApi.getMyPayslipDetail).toHaveBeenCalledWith(1);
      });

      // 后端给了 300s 免验窗口，前端必须跟着放行，否则「5 分钟内可连续查看」是空话
      await user.click(screen.getByTestId('cell-2-month'));
      await waitFor(() => {
        expect(payslipApi.getMyPayslipDetail).toHaveBeenCalledWith(2);
      });
      expect(payslipApi.verifyPassword).toHaveBeenCalledTimes(1);
    });

    it('免验窗口内后端实际已过期（3013）：给出重新验证入口，不再卡死', async () => {
      const user = await openPasswordModal();
      await user.type(screen.getByPlaceholderText('请输入登录密码'), 'secret123');
      await user.click(screen.getByRole('button', { name: '确认查看' }));
      await waitFor(() => {
        expect(payslipApi.getMyPayslipDetail).toHaveBeenCalledWith(1);
      });

      // 前端认为还在窗口内，但后端 Redis 标记已过期（RTT/重启/另一设备登出）
      (payslipApi.getMyPayslipDetail as jest.Mock).mockImplementation((id: number) =>
        id === 2
          ? Promise.reject(new Error('查看工资条需先完成二级密码验证'))
          : Promise.resolve({ code: 0, message: 'ok', data: mockPayslipDetail }),
      );
      await user.click(screen.getByTestId('cell-2-month'));

      // 必须有恢复路径：否则之后每次点「查看」都走免验分支，永远打不开
      const retry = await screen.findByRole('button', { name: '重新验证' });
      await user.click(retry);
      await waitFor(() => {
        expect(screen.getByText('二级密码验证')).toBeInTheDocument();
      });
    });
  });

  describe('二级密码状态感知', () => {
    /** 默认（未设置）状态下打开弹窗 */
    const openModal = async () => {
      const user = userEvent.setup();
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      await user.click(screen.getByTestId('cell-1-month'));
      // 同上：按弹窗标题等，placeholder 依赖二级密码状态查询结果
      await waitFor(() => {
        expect(screen.getByText('二级密码验证')).toBeInTheDocument();
      });
      return user;
    };

    /** 已设置独立二级密码时的弹窗打开 */
    const openPasswordModalWithPrivacy = async () => {
      (authApi.getPrivacyPasswordStatus as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { enabled: true },
      });
      const user = userEvent.setup();
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      await user.click(screen.getByTestId('cell-1-month'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('请输入二级密码')).toBeInTheDocument();
      });
      return user;
    };

    it('弹窗打开时查询二级密码设置状态', async () => {
      await openModal();
      expect(authApi.getPrivacyPasswordStatus).toHaveBeenCalled();
    });

    it('未设置二级密码：使用登录密码验证并提示去设置', async () => {
      await openModal();
      expect(screen.getByText(/尚未设置二级密码/)).toBeInTheDocument();
      expect(screen.getByText(/个人中心/)).toBeInTheDocument();
    });

    it('已设置二级密码：placeholder 为二级密码，不再出现登录密码引导', async () => {
      await openPasswordModalWithPrivacy();
      expect(screen.queryByPlaceholderText('请输入登录密码')).toBeNull();
      expect(screen.queryByText(/尚未设置二级密码/)).toBeNull();
    });

    it('状态查询失败：静默降级为通用提示，不阻断验证', async () => {
      (authApi.getPrivacyPasswordStatus as jest.Mock).mockRejectedValue(new Error('network'));
      await openModal();
      expect(payslipApi.getMyPayslipDetail).not.toHaveBeenCalled();
    });
  });

  describe('金额展示与操作入口', () => {
    it('扣款合计为负数时标红，与实发工资的正向绿区分', async () => {
      (payslipApi.getMyPayslips as jest.Mock).mockResolvedValue({
        code: 0,
        data: {
          list: [
            {
              id: 3,
              month: '2026-06',
              status: 'viewed',
              baseSalary: '5000.00',
              totalIncome: '5000.00',
              totalDeduction: '-500.00',
              netSalary: '4500.00',
              createdAt: '2026-06-30T10:00:00+08:00',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
      render(<MyPayslipsPage />);

      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(1));
      const deduction = screen.getByTestId('cell-3-totalDeduction');
      expect(deduction).toHaveTextContent('-500.00');
      expect(deduction.querySelector('.lx-money-negative')).not.toBeNull();
    });

    it('每行提供「查看」按钮，点击同样走二级密码门禁（不必猜行可点）', async () => {
      const user = userEvent.setup();
      render(<MyPayslipsPage />);
      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));

      expect(screen.getAllByRole('button', { name: '查看' })).toHaveLength(2);
      await user.click(screen.getAllByRole('button', { name: '查看' })[0]);

      await waitFor(() => expect(screen.getByText('二级密码验证')).toBeInTheDocument());
      expect(payslipApi.getMyPayslipDetail).not.toHaveBeenCalled();
    });

    it('缺少基本工资项时展示占位符而不是伪造的 0', async () => {
      (payslipApi.getMyPayslips as jest.Mock).mockResolvedValue({
        code: 0,
        data: {
          list: [
            {
              id: 4,
              month: '2026-05',
              status: 'viewed',
              baseSalary: null,
              totalIncome: '800.00',
              totalDeduction: '0.00',
              netSalary: '800.00',
              createdAt: '2026-05-31T10:00:00+08:00',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
      render(<MyPayslipsPage />);

      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(1));
      expect(screen.getByTestId('cell-4-baseSalary')).toHaveTextContent('--');
    });
  });

  describe('月份快捷筛选', () => {
    it('月份字段带「本月」「上月」预设，免去逐月点日历', () => {
      const monthField = buildSearchFields().find((f) => f.key === 'month');
      expect(monthField?.presets?.map((p) => p.label)).toEqual(['本月', '上月']);
    });

    it('预设值为 YYYY-MM，与后端 payslip.month 字段口径一致', () => {
      // 值随「当前月」变化，不与系统时间绑死：只校验格式口径，
      // 跨年边界（1 月 → 上年 12 月）由源码的 date 运算保证
      const presets = buildSearchFields().find((f) => f.key === 'month')?.presets ?? [];
      expect(presets).toHaveLength(2);
      for (const p of presets) {
        expect(p.value).toMatch(/^\d{4}-\d{2}$/);
      }
    });
  });

  describe('年度累计与月度对比', () => {
    const openDetail = async () => {
      const user = userEvent.setup();
      render(<MyPayslipsPage />);
      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));
      await user.click(screen.getByTestId('cell-1-month'));
      await user.type(screen.getByPlaceholderText('请输入登录密码'), 'secret123');
      await user.click(screen.getByRole('button', { name: '确认查看' }));
      await screen.findByText('收入明细');
      return user;
    };

    it('年度累计条展示应发/扣款/实发三项合计与已发放月份数', async () => {
      render(<MyPayslipsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('payslip-year')).toHaveTextContent('45,600.00');
      });
      const strip = screen.getByTestId('payslip-year');
      expect(strip).toHaveTextContent('-4,000.00');
      expect(strip).toHaveTextContent('41,600.00');
      expect(strip).toHaveTextContent('已发放 8 个月');
      // 年份取当前筛选月份所属年份，未筛选时取今年
      expect(payslipApi.getMyYearSummary).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}$/));
    });

    it('明细弹窗展示与上月的三项差额（涨绿跌红、持平中性）', async () => {
      await openDetail();

      const diff = await screen.findByTestId('payslip-diff');
      expect(diff).toHaveTextContent('2026-07');
      // 只看合计行（逐项差异区另有自己的 Δ），避免把明细项差额算进来
      const summary = diff.querySelector('.lx-payslip-diff-items') as HTMLElement;
      // 应发 5700 − 5500 = +200；实发 5200 − 5000 = +200
      expect(summary.querySelectorAll('.lx-payslip-delta.is-up')).toHaveLength(2);
      // 扣款持平 → 中性 0.00
      expect(summary.querySelector('.lx-payslip-delta.is-flat')?.textContent).toBe('0.00');
    });

    it('逐项差异：新增 / 取消 / 金额变动项落到具体工资项', async () => {
      await openDetail();

      const itemDiff = await screen.findByTestId('payslip-item-diff');
      // 上月明细要等详情接口回来（列表接口已不下发明细），先等数据落位再断言
      await waitFor(() => expect(itemDiff).toHaveTextContent('加班费'));
      // 加班费 300 → 500：变动项
      expect(itemDiff).toHaveTextContent('变动');
      // 本月新增全勤奖
      expect(itemDiff).toHaveTextContent('全勤奖');
      expect(itemDiff).toHaveTextContent('新增');
      // 上月有餐补、本月没有
      expect(itemDiff).toHaveTextContent('餐补');
      expect(itemDiff).toHaveTextContent('取消');
      // 基本工资/社保未变，不应出现在差异列表里
      expect(itemDiff).not.toHaveTextContent('基本工资');
    });

    it('各工资项完全一致时提示「与上月一致」', async () => {
      // 上月明细与本月完全一致（明细来自受门禁的详情接口）
      (payslipApi.getMyPayslipDetail as jest.Mock).mockImplementation((id: number) =>
        Promise.resolve({
          code: 0,
          message: 'ok',
          data: id === mockPrevPayslip.id ? { ...mockPrevDetail, items: mockPayslipDetail.items } : mockPayslipDetail,
        }),
      );

      await openDetail();

      const itemDiff = await screen.findByTestId('payslip-item-diff');
      await waitFor(() => expect(itemDiff).toHaveTextContent('各工资项与上月一致'));
    });

    it('年度累计接口失败时不再停留在「统计中…」', async () => {
      (payslipApi.getMyYearSummary as jest.Mock).mockRejectedValue(new Error('network'));
      render(<MyPayslipsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('payslip-year')).toHaveTextContent('统计失败');
      });
    });

    it('上月没有工资条时降级为「暂无可对比数据」', async () => {
      (payslipApi.getMyPayslips as jest.Mock).mockImplementation((params: any = {}) => {
        if (params.month === mockPrevPayslip.month) {
          return Promise.resolve({
            code: 0,
            data: { list: [], total: 0, page: 1, pageSize: 1 },
          });
        }
        return Promise.resolve({
          code: 0,
          data: { list: mockPayslips, total: 2, page: 1, pageSize: 20 },
        });
      });

      await openDetail();

      const diff = await screen.findByTestId('payslip-diff');
      expect(diff).toHaveTextContent('上月无工资条');
    });
  });

  describe('打印稿内容', () => {
    const html = buildPayslipPrintHtml(mockPayslipDetail as any, {
      companyName: '雷犀科技',
    });

    it('A4 排版：声明纸张尺寸、表头跨页重复、表格行不被跨页切断', () => {
      expect(html).toContain('@page');
      expect(html).toContain('table-header-group');
      expect(html).toContain('break-inside: avoid');
    });

    it('具备凭证要素：抬头、工资周期、防外传水印、生成时间', () => {
      expect(html).toContain('雷犀科技');
      expect(html).toContain('2026-08-01 ~ 2026-08-31');
      expect(html).toContain('watermark');
      expect(html).toContain('生成时间');
    });

    it('收入明细表带合计行（5000 + 500 + 200 = 5700）', () => {
      expect(html).toContain('5,700.00');
    });

    it('明细名称按 HTML 转义，避免名称里的标签在打印窗口执行', () => {
      const injected = buildPayslipPrintHtml(
        {
          ...(mockPayslipDetail as any),
          items: [{ code: 'X', name: '<img src=x onerror=alert(1)>', amount: 1, type: 'income' }],
        },
        {},
      );
      expect(injected).not.toContain('<img src=x');
      expect(injected).toContain('&lt;img');
    });
  });

  describe('打印 / 下载入口', () => {
    const openDetail = async () => {
      const user = userEvent.setup();
      render(<MyPayslipsPage />);
      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));
      await user.click(screen.getByTestId('cell-1-month'));
      await user.type(screen.getByPlaceholderText('请输入登录密码'), 'secret123');
      await user.click(screen.getByRole('button', { name: '确认查看' }));
      // 等到明细真正渲染出来（骨架屏阶段按钮不可用）
      await screen.findByText('收入明细');
      return user;
    };

    beforeEach(() => {
      (URL as any).createObjectURL = jest.fn(() => 'blob:payslip');
      (URL as any).revokeObjectURL = jest.fn();
    });

    it('点击打印：在独立窗口输出，加载完成后唤起打印，打印结束自动关闭', async () => {
      const fakeWin: any = { focus: jest.fn(), print: jest.fn(), close: jest.fn() };
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(fakeWin);
      const user = await openDetail();

      await user.click(screen.getByRole('button', { name: /打印/ }));

      expect(openSpy).toHaveBeenCalled();
      expect((URL as any).createObjectURL).toHaveBeenCalled();
      // 打印稿经 Blob 交给新窗口，不再用 document.write（后者易打出空白页）
      fakeWin.onload?.();
      expect(fakeWin.print).toHaveBeenCalled();
      expect(fakeWin.focus).toHaveBeenCalled();
      fakeWin.onafterprint?.();
      expect(fakeWin.close).toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it('点击下载：生成可保存的工资条文件', async () => {
      const user = await openDetail();

      await user.click(screen.getByRole('button', { name: '下载工资条' }));

      expect((URL as any).createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect((URL as any).revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('时间展示', () => {
    it('发放时间按北京时间格式化，不泄漏 ISO 原始串', async () => {
      (payslipApi.getMyPayslips as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: {
          list: [
            {
              id: 9,
              month: '2026-09',
              status: 'viewed',
              baseSalary: 1,
              totalIncome: 1,
              totalDeduction: 0,
              netSalary: 1,
              createdAt: '2026-09-28T10:36:44.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(1);
      });
      expect(screen.getByTestId('cell-9-createdAt')).toHaveTextContent('2026-09-28 18:36');
      expect(screen.queryByText(/2026-09-28T10:36:44/)).toBeNull();
    });
  });

  describe('边界用例', () => {
    it('shows loading state while fetching', async () => {
      let resolveFn: (value: any) => void;
      (payslipApi.getMyPayslips as jest.Mock).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );
      render(<MyPayslipsPage />);
      // 冲刷挂载后的渲染任务，避免同步用例中更新落在 act 空窗期产生告警
      await screen.findByTestId('pro-table');
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-loading', 'true');
    });

    it('handles empty list', async () => {
      (payslipApi.getMyPayslips as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(payslipApi.getMyPayslips).toHaveBeenCalled();
      });
      expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
    });
  });

  describe('异常用例', () => {
    it('handles payslip not found error (code 3011)', async () => {
      (payslipApi.getMyPayslips as jest.Mock).mockResolvedValue({
        code: 3011,
        message: '工资条不存在',
      });
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(payslipApi.getMyPayslips).toHaveBeenCalled();
      });
    });

    it('handles permission error (code 5003)', async () => {
      (payslipApi.getMyPayslips as jest.Mock).mockResolvedValue({
        code: 5003,
        message: '无权限访问该数据',
      });
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(payslipApi.getMyPayslips).toHaveBeenCalled();
      });
    });
  });
});
