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

const DEFAULT_TAB: TabItem = { path: '/', label: '工作台' };

export const useTabsStore = create<TabsState>((set) => ({
  tabs: [DEFAULT_TAB],
  addTab: (path, label) =>
    set((state) => ({ tabs: ensureUnique(state.tabs, path, label) })),
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