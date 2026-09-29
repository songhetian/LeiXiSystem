import { create } from 'zustand';

export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'lx_theme_mode';

export type ResolvedTheme = 'light' | 'dark';

/** 解析当前生效主题：手动模式优先，system 回退 prefers-color-scheme */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadModeFromStorage(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'system';
}

export function saveModeToStorage(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

/** 将解析后的主题写入 <html data-theme> 与 body.arco-theme-dark */
export function applyTheme(resolved: ResolvedTheme) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  const body = document.body;
  if (resolved === 'dark') {
    body.classList.add('arco-theme-dark');
  } else {
    body.classList.remove('arco-theme-dark');
  }
}

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  hydrated: boolean;
  setMode: (mode: ThemeMode) => void;
  init: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  resolved: 'light',
  hydrated: false,

  setMode: (mode) => {
    saveModeToStorage(mode);
    const resolved = resolveTheme(mode);
    applyTheme(resolved);
    set({ mode, resolved });
  },

  init: () => {
    if (get().hydrated) return;
    const mode = loadModeFromStorage();
    const resolved = resolveTheme(mode);
    applyTheme(resolved);
    set({ mode, resolved, hydrated: true });
  },
}));

/** 注册系统主题变化监听，system 模式下实时跟随 */
export function watchSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    const { mode } = useThemeStore.getState();
    if (mode !== 'system') return;
    const resolved = resolveTheme('system');
    applyTheme(resolved);
    useThemeStore.setState({ resolved });
  };
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}