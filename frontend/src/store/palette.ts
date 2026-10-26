import { create } from 'zustand';

/**
 * 命令面板开关状态。
 *
 * 独立成 store 的原因：AppHeader 的搜索按钮与全局 Ctrl+K 监听（CommandPalette）
 * 都要改同一个开关，且 AppHeader 不应伪造 KeyboardEvent 去「按」另一个组件的
 * 快捷键——那是绕过组件边界的 hack，事件冒泡路径上任何监听者都会被误伤。
 */
interface PaletteState {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

export const usePaletteStore = create<PaletteState>((set, get) => ({
  open: false,
  toggle: () => set({ open: !get().open }),
  setOpen: (open) => set({ open }),
}));
