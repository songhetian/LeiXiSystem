import { useThemeStore, watchSystemTheme, THEME_STORAGE_KEY } from '@/store/theme';

describe('useThemeStore · 主题（暗色模式）', () => {
  const originalMatchMedia = window.matchMedia;

  function stubSystemDark(dark: boolean) {
    window.matchMedia = (query: string) =>
      ({
        matches: dark,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }) as any;
  }

  function resetStore() {
    // 直接重置状态，避免被 init 的 hydrated 幂等门挡住
    useThemeStore.setState({ mode: 'system', resolved: 'light', hydrated: false });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    resetStore();
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('arco-theme-dark');
    stubSystemDark(false);
  });

  afterAll(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('setMode("dark") 写入 localStorage、更新 data-theme 与 body class', () => {
    useThemeStore.getState().setMode('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.body.classList.contains('arco-theme-dark')).toBe(true);
    expect(useThemeStore.getState().resolved).toBe('dark');
  });

  it('setMode("light") 移除暗色 class', () => {
    useThemeStore.getState().setMode('dark');
    useThemeStore.getState().setMode('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.body.classList.contains('arco-theme-dark')).toBe(false);
  });

  it('init 读取 localStorage 中持久化的 dark 模式', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    useThemeStore.getState().init();
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('system 模式跟随 prefers-color-scheme', () => {
    stubSystemDark(true);
    resetStore();
    useThemeStore.getState().init();
    expect(useThemeStore.getState().resolved).toBe('dark');
  });

  it('system 模式下系统主题切换会实时更新 resolved', () => {
    const mql = { matches: false, media: '', addEventListener: jest.fn(), removeEventListener: jest.fn() };
    window.matchMedia = (() => mql) as any;
    resetStore();
    useThemeStore.setState({ mode: 'system', resolved: 'light', hydrated: true });

    const unsubscribe = watchSystemTheme();
    expect(mql.addEventListener).toHaveBeenCalled();

    // 触发系统切到深色
    const listener = (mql.addEventListener as jest.Mock).mock.calls[0][1];
    mql.matches = true;
    listener();
    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    unsubscribe();
  });

  it('system 模式下即使系统变暗，手动 light 不会被覆盖', () => {
    const mql = { matches: true, media: '', addEventListener: jest.fn(), removeEventListener: jest.fn() };
    window.matchMedia = (() => mql) as any;
    resetStore();
    useThemeStore.setState({ mode: 'light', resolved: 'light', hydrated: true });

    const unsubscribe = watchSystemTheme();
    mql.matches = true;
    const listener = (mql.addEventListener as jest.Mock).mock.calls[0][1];
    listener();
    // mode !== 'system'，不应跟随
    expect(useThemeStore.getState().resolved).toBe('light');
    unsubscribe();
  });
});