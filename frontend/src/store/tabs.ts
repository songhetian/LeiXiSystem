import { create } from 'zustand';

export interface TabItem {
  path: string;
  label: string;
}

interface TabsState {
  tabs: TabItem[];
  addTab: (path: string, label: string) => void;
  removeTab: (path: string) => void;
  closeOthers: (path: string) => void;
  closeAll: () => void;
}

// 打开新页签时对同路径去重并置于末尾
const ensureUnique = (tabs: TabItem[], path: string, label: string): TabItem[] => {
  const rest = tabs.filter((t) => t.path !== path);
  return [...rest, { path, label }];
};

// 同路径 + 同标题视为"标签已登记"：返回原引用，避免每次访问已打开页签都
// 生成新数组，从而触发 AppLayout / KeepAliveHost 等订阅方做无关重渲染。
const hasSame = (tabs: TabItem[], path: string, label: string): boolean =>
  tabs.some((t) => t.path === path && t.label === label);

const DEFAULT_TAB: TabItem = { path: '/', label: '工作台' };

export const useTabsStore = create<TabsState>((set) => ({
  tabs: [DEFAULT_TAB],
  addTab: (path, label) =>
    set((state) => {
      // 标签已登记：保持引用不变，跳过重渲染
      if (hasSame(state.tabs, path, label)) {
        return { tabs: state.tabs };
      }
      return { tabs: ensureUnique(state.tabs, path, label) };
    }),
  removeTab: (path) =>
    set((state) => ({
      tabs: state.tabs.filter((t) => t.path !== path),
    })),
  closeOthers: (path) =>
    set((state) => ({
      tabs: state.tabs.filter((t) => t.path === path || t.path === DEFAULT_TAB.path),
    })),
  closeAll: () => set({ tabs: [DEFAULT_TAB] }),
}));