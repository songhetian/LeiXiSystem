import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CyclesPage from '@/features/performance/pages/cycles';
import { performanceApi } from '@/services/performance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/performance', () => ({
  performanceApi: {
    listCycles: jest.fn(),
  },
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@arco-design/web-react', () => {
  const original = jest.requireActual('@arco-design/web-react');
  return {
    ...original,
    Message: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
  };
});

const cycles = [
  { id: 1, name: '2026 Q3 绩效周期', type: 'quarterly', status: 'active', startDate: '2026-07-01', endDate: '2026-09-30' },
];

describe('CyclesPage 状态与错误处理', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
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
});
