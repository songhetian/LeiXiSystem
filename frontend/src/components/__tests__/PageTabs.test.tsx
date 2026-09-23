import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PageTabs from '@/components/PageTabs';
import { useTabsStore } from '@/store/tabs';

// 模拟 next/navigation
const push = jest.fn();
const replace = jest.fn();
const refresh = jest.fn();
const mockPathname = { current: '/' };
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh }),
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

describe('PageTabs 页签右键菜单', () => {
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

  const rightClickOnTab = (label: string) => {
    const tab = screen.getByRole('tab', { name: new RegExp(label) });
    const wrap = tab.closest('.page-tab-wrap') as HTMLElement;
    fireEvent.contextMenu(wrap);
  };

  it('在页签上右键时应弹出菜单：刷新当前页 / 关闭其他 / 关闭所有', () => {
    render(<PageTabs />);
    rightClickOnTab('员工列表');
    expect(screen.getByText('刷新当前页')).toBeInTheDocument();
    expect(screen.getByText('关闭其他')).toBeInTheDocument();
    expect(screen.getByText('关闭所有')).toBeInTheDocument();
  });

  it('右键菜单通过 portal 渲染到 body 顶层，避免被 .page-tabs 的 backdrop-filter 包含块错位导致弹出框消失', () => {
    render(<PageTabs />);
    rightClickOnTab('员工列表');
    const menu = screen.getByText('关闭其他').closest('.page-tabs-menu') as HTMLElement;
    // 菜单不再嵌套在 .page-tabs 内（否则相对其形成包含块，fixed 定位与视口坐标错位）
    expect(menu.parentElement).toBe(document.body);
    const pageTabs = document.querySelector('.page-tabs') as HTMLElement;
    expect(pageTabs.contains(menu)).toBe(false);
  });

  it('点击「关闭其他」后仅保留当前页签与固定页签', async () => {
    const user = userEvent.setup();
    render(<PageTabs />);
    rightClickOnTab('员工列表');
    await user.click(screen.getByText('关闭其他'));
    const labels = useTabsStore.getState().tabs.map((t) => t.label);
    expect(labels).toEqual(['工作台', '员工列表']);
  });

  it('点击「关闭所有」后仅保留固定页签（工作台）', async () => {
    const user = userEvent.setup();
    render(<PageTabs />);
    rightClickOnTab('工作台');
    await user.click(screen.getByText('关闭所有'));
    const labels = useTabsStore.getState().tabs.map((t) => t.label);
    expect(labels).toEqual(['工作台']);
  });

  it('点击「刷新当前页」调用 router.refresh()，不走 _t 缓存破坏式 replace', async () => {
    mockPathname.current = '/employees';
    const user = userEvent.setup();
    render(<PageTabs />);
    rightClickOnTab('员工列表');
    await user.click(screen.getByText('刷新当前页'));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });
});