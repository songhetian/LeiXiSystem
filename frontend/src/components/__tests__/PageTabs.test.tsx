import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PageTabs from '@/components/PageTabs';
import { useTabsStore } from '@/store/tabs';

// 模拟 next/navigation
const push = jest.fn();
const replace = jest.fn();
const mockPathname = { current: '/' };
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => mockPathname.current,
}));

describe('PageTabs 可访问性', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTabsStore.setState({
      tabs: [
        { path: '/', label: '工作台' },
        { path: '/employees', label: '员工列表' },
        { path: '/attendance/shifts', label: '班次管理' },
      ],
    });
  });

  it('页签项是 button 且带 role=tab / aria-selected', async () => {
    render(<PageTabs />);
    const tab = screen.getByRole('tab', { name: /员工列表/ });
    expect(tab.tagName).toBe('BUTTON');
    expect(tab).not.toHaveAttribute('aria-selected', 'true');
  });

  it('激活页签 aria-selected=true, 并通过按钮点击切换路由', async () => {
    mockPathname.current = '/employees';
    const user = userEvent.setup();
    render(<PageTabs />);

    const active = screen.getByRole('tab', { name: /员工列表/ });
    expect(active).toHaveAttribute('aria-selected', 'true');

    const workbench = screen.getByRole('tab', { name: /工作台/ });
    await user.click(workbench);
    expect(push).toHaveBeenCalledWith('/');
  });

  it('关闭按钮是带 aria-label="关闭" 的可点击按钮', async () => {
    render(<PageTabs />);
    const closeBtns = screen.getAllByRole('button', { name: '关闭' });
    // 工作台不可关闭，其余两个页签各有关闭按钮
    expect(closeBtns).toHaveLength(2);
  });

  it('更多按钮带 aria-label="更多操作"', () => {
    render(<PageTabs />);
    expect(screen.getByRole('button', { name: /更多操作/ })).toBeInTheDocument();
  });
});