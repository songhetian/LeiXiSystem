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

  it('进入 /attendance/statistics 时自动登记「考勤统计」页签', async () => {
    mockPathname.current = '/attendance/statistics';
    useTabsStore.setState({ tabs: [{ path: '/', label: '工作台' }] });
    render(<PageTabs />);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /考勤统计/ })).toBeInTheDocument();
    });
  });

  it('关闭当前页签时跳到右侧相邻页签（无右侧则取左侧）', () => {
    mockPathname.current = '/employees';
    render(<PageTabs />);
    fireEvent.click(screen.getAllByRole('button', { name: '关闭' })[0]);
    // /employees 的右侧邻居是 /attendance/shifts，而非最后打开的页签
    expect(push).toHaveBeenCalledWith('/attendance/shifts');
  });

  it('关闭最后一个业务页签（无右侧邻居）时回退到左侧相邻页签', () => {
    mockPathname.current = '/attendance/shifts';
    render(<PageTabs />);
    fireEvent.click(screen.getAllByRole('button', { name: '关闭' })[1]);
    // /attendance/shifts 无右侧邻居 → 回退左侧 /employees
    expect(push).toHaveBeenCalledWith('/employees');
  });

  it('关闭非当前页签时不切换路由', () => {
    mockPathname.current = '/';
    render(<PageTabs />);
    fireEvent.click(screen.getAllByRole('button', { name: '关闭' })[0]);
    expect(push).not.toHaveBeenCalled();
  });
});

describe('PageTabs 中键关闭（auxclick button=1）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.current = '/';
    useTabsStore.setState({
      tabs: [
        { path: '/', label: '工作台' },
        { path: '/employees', label: '员工列表' },
      ],
    });
  });

  it('中键点击页签可关闭该页签', () => {
    render(<PageTabs />);
    const employeeTab = screen.getByRole('tab', { name: /员工列表/ });
    fireEvent(employeeTab, new MouseEvent('auxclick', { bubbles: true, button: 1, cancelable: true }));
    const labels = useTabsStore.getState().tabs.map((t) => t.label);
    expect(labels).toEqual(['工作台']);
    expect(push).not.toHaveBeenCalled();
  });

  it('左键普通点击不触发关闭', () => {
    render(<PageTabs />);
    const workbench = screen.getByRole('tab', { name: /工作台/ });
    fireEvent(workbench, new MouseEvent('auxclick', { bubbles: true, button: 0, cancelable: true }));
    const labels = useTabsStore.getState().tabs.map((t) => t.label);
    expect(labels).toEqual(['工作台', '员工列表']);
  });
});

describe('PageTabs 页签右键菜单', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.current = '/';
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

describe('PageTabs 键盘可达与 ARIA 结构（WCAG SC 2.1.1 / 4.1.2 / 2.4.3）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.current = '/';
    useTabsStore.setState({
      tabs: [
        { path: '/', label: '工作台' },
        { path: '/employees', label: '员工列表' },
        { path: '/attendance/shifts', label: '班次管理' },
      ],
    });
  });

  it('页签容器是 role=tablist，且每个页签用 aria-controls 指向内容面板', () => {
    render(<PageTabs />);
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveClass('page-tabs-scroll');
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    for (const tab of tabs) {
      expect(tab).toHaveAttribute('aria-controls', 'app-tabpanel');
      expect(tab).toHaveAttribute('id');
    }
  });

  it('整组页签只有当前页签进入 Tab 序列（roving tabindex），方向键在组内移动焦点', async () => {
    const user = userEvent.setup();
    render(<PageTabs />);
    const tabs = screen.getAllByRole('tab');
    // 激活页签 tabIndex=0，其余为 -1，避免 Tab 键要在每个页签上停一次
    expect(tabs.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);

    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tabs[1]);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(tabs[0]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(tabs[2]);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('右键菜单是 role=menu + role=menuitem，打开后焦点移入首项', async () => {
    render(<PageTabs />);
    fireEvent.contextMenu(screen.getByRole('tab', { name: /员工列表/ }));
    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    expect(document.activeElement).toBe(items[0]);
  });

  it('菜单内方向键移动焦点，Escape 关闭并把焦点还给触发元素', async () => {
    const user = userEvent.setup();
    render(<PageTabs />);
    const tab = screen.getByRole('tab', { name: /员工列表/ });
    fireEvent.contextMenu(tab);
    const items = await screen.findAllByRole('menuitem');

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(items[items.length - 1]);
    await user.keyboard('{ArrowDown}');
    // 首尾循环
    expect(document.activeElement).toBe(items[0]);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(tab);
  });

  it('不再屏蔽整条页签栏的浏览器原生右键菜单（只在页签上接管）', () => {
    render(<PageTabs />);
    const bar = document.querySelector('.page-tabs') as HTMLElement;
    const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    bar.dispatchEvent(evt);
    // 未被 preventDefault：用户仍可用「在新标签页打开」「复制链接」等原生能力
    expect(evt.defaultPrevented).toBe(false);
  });
});
