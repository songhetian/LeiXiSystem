import { useTabsStore } from '@/store/tabs';

// 页签 store 是模块级单例，测试间需重置初始状态，避免串用例。
const resetTabs = () =>
  useTabsStore.setState({ tabs: [{ path: '/', label: '工作台' }] });

describe('tabs store — 切换页签重渲染优化', () => {
  beforeEach(resetTabs);

  it('重复访问已打开的同一页签（同路径同标题）时返回同一引用，避免无关重渲染', () => {
    const { addTab } = useTabsStore.getState();
    addTab('/employees', '员工列表');
    const first = useTabsStore.getState().tabs;
    expect(first.map((t) => t.path)).toEqual(['/', '/employees']);

    // 再次登记同一路径 + 标题：应保持引用不变，而非每次生成新数组
    addTab('/employees', '员工列表');
    const second = useTabsStore.getState().tabs;
    expect(second).toBe(first);
  });

  it('同路径但标题变化时更新标签并产生新引用', () => {
    const { addTab } = useTabsStore.getState();
    addTab('/employees', '员工列表');
    const first = useTabsStore.getState().tabs;

    addTab('/employees', '员工列表(新)');
    const second = useTabsStore.getState().tabs;
    expect(second).not.toBe(first);
    expect(second.find((t) => t.path === '/employees')?.label).toBe('员工列表(新)');
  });

  it('打开新页签追加，既有页签不会重复', () => {
    const { addTab } = useTabsStore.getState();
    addTab('/a', 'A');
    addTab('/b', 'B');
    addTab('/a', 'A');
    const tabs = useTabsStore.getState().tabs;
    expect(tabs.map((t) => t.path)).toEqual(['/', '/a', '/b']);
  });
});