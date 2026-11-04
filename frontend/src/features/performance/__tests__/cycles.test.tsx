import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CyclesPage from '@/features/performance/pages/cycles';
import { performanceApi } from '@/services/performance';
import { exportToExcel } from '@/lib/excel';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/performance', () => ({
  performanceApi: {
    listCycles: jest.fn(),
    createCycle: jest.fn(),
    updateCycle: jest.fn(),
    deleteCycle: jest.fn(),
  },
}));

jest.mock('@/lib/excel', () => ({
  exportToExcel: jest.fn(() => true),
}));

// 权限门：默认有 performance:cycle:manage，无权限用例单独关闭
const mockCan = jest.fn((_code?: string) => true);
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: (perm: string) => mockCan(perm) }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@arco-design/web-react', () => {
  const original = jest.requireActual('@arco-design/web-react');
  // DatePicker 在 jsdom 里要靠面板点选，这里退化成普通输入框（Arco Form 通过 value/onChange 收值）
  const DatePicker = ({ value, onChange, placeholder }: any) => (
    <input
      aria-label={placeholder}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
  return {
    ...original,
    DatePicker,
    Message: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
  };
});

const { Message } = jest.requireMock('@arco-design/web-react');

const cycles = [
  { id: 1, name: '2026 Q3 绩效周期', type: 'quarterly', status: 'active', startDate: '2026-07-01', endDate: '2026-09-30' },
];

describe('CyclesPage 状态与错误处理', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockCan.mockReturnValue(true);
  });

  it('加载成功时渲染周期卡片', async () => {
    (performanceApi.listCycles as jest.Mock).mockResolvedValue({ code: 0, data: { list: cycles } });
    render(<CyclesPage />);
    expect(await screen.findByText('2026 Q3 绩效周期')).toBeInTheDocument();
  });

  it('无数据时展示空态文案', async () => {
    (performanceApi.listCycles as jest.Mock).mockResolvedValue({ code: 0, data: { list: [] } });
    render(<CyclesPage />);
    expect(await screen.findByText('暂无绩效周期，点击右上角新建周期')).toBeInTheDocument();
  });

  it('接口失败时展示错误态并可重试', async () => {
    (performanceApi.listCycles as jest.Mock).mockRejectedValueOnce(new Error('周期加载失败'));
    render(<CyclesPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('周期加载失败'));

    (performanceApi.listCycles as jest.Mock).mockResolvedValue({ code: 0, data: { list: cycles } });
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(screen.getByText('2026 Q3 绩效周期')).toBeInTheDocument());
  });

  it('后端返回的 DateTime 渲染成 YYYY-MM-DD，不把 ISO 串摊在卡片上', async () => {
    (performanceApi.listCycles as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        list: [
          {
            ...cycles[0],
            // Prisma DateTime 经 JSON 序列化后的真实形状（UTC 零点 = 北京时间当日 08:00）
            startDate: '2026-07-01T00:00:00.000Z',
            endDate: '2026-09-30T00:00:00.000Z',
            selfReviewDeadline: '2026-09-20T00:00:00.000Z',
          },
        ],
      },
    });
    render(<CyclesPage />);

    expect(await screen.findByText('2026-07-01 ~ 2026-09-30')).toBeInTheDocument();
    expect(screen.getByText('自评截止：2026-09-20')).toBeInTheDocument();
    expect(screen.queryByText(/T00:00:00\.000Z/)).not.toBeInTheDocument();
  });

  it('导出时日期同样格式化（Excel 里不该出现 ISO 串）', async () => {
    const isoRow = {
      ...cycles[0],
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-09-30T00:00:00.000Z',
    };
    (performanceApi.listCycles as jest.Mock).mockResolvedValue({ code: 0, data: { list: [isoRow] } });
    render(<CyclesPage />);
    await screen.findByText('2026 Q3 绩效周期');

    fireEvent.click(screen.getByRole('button', { name: '导出 Excel' }));

    await waitFor(() => expect(exportToExcel).toHaveBeenCalled());
    const [, , columns] = (exportToExcel as jest.Mock).mock.calls[0];
    const byTitle = (title: string) => columns.find((c: any) => c.title === title);
    expect(byTitle('开始日期').value(isoRow)).toBe('2026-07-01');
    expect(byTitle('结束日期').value(isoRow)).toBe('2026-09-30');
  });

  it('开始日期晚于结束日期时阻断提交并提示（后端只校验非空）', async () => {
    (performanceApi.listCycles as jest.Mock).mockResolvedValue({ code: 0, data: { list: [] } });
    render(<CyclesPage />);
    await screen.findByText('暂无绩效周期，点击右上角新建周期');

    fireEvent.click(screen.getByRole('button', { name: '+ 新建周期' }));
    await waitFor(() => expect(screen.getByText('新建绩效周期')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('例如：2026 年 Q1 绩效周期'), {
      target: { value: '2026 Q4' },
    });
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-09-30' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-09-01' } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(Message.error).toHaveBeenCalledWith('开始日期不能晚于结束日期'));
    expect(performanceApi.createCycle).not.toHaveBeenCalled();
  });

  describe('权限门（11.6-3）', () => {
    it('无 performance:cycle:manage 时新建/编辑/删除不渲染，导出保留', async () => {
      mockCan.mockImplementation((code?: string) => code !== 'performance:cycle:manage');
      (performanceApi.listCycles as jest.Mock).mockResolvedValue({ code: 0, data: { list: cycles } });
      render(<CyclesPage />);
      expect(await screen.findByText('2026 Q3 绩效周期')).toBeInTheDocument();

      expect(screen.queryByRole('button', { name: '+ 新建周期' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument();
      // 查看类操作不受影响
      expect(screen.getByRole('button', { name: '导出 Excel' })).toBeInTheDocument();
    });

    it('写操作权限点校准为 performance:cycle:manage（对齐后端 controller）', async () => {
      (performanceApi.listCycles as jest.Mock).mockResolvedValue({ code: 0, data: { list: cycles } });
      render(<CyclesPage />);
      await screen.findByText('2026 Q3 绩效周期');
      expect(mockCan).toHaveBeenCalledWith('performance:cycle:manage');
    });
  });
});
