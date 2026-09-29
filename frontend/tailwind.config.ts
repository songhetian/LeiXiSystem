import type { Config } from 'tailwindcss';

/**
 * 设计系统唯一真值来源 = `src/app/globals.css` 的 `--lx-*` token。
 *
 * 本配置**不再写任何字面量**（颜色 / 字号 / 间距 / 圆角 / 阴影 / 字重全部引用 CSS 变量），
 * 否则同一语义名在两套系统里会取到不同值（曾出现 `w-sider`=216px 而实际侧栏 240px
 * 这种"改 token 不生效"的陷阱）。
 *
 * 同时**收窄调色板**：只保留项目 token + white/transparent/current/inherit，
 * 从源头杜绝 `bg-gray-50`、`bg-white/50` 这类不随主题变化的"越权取色"
 * （它们在暗色模式下会变成刺眼的浅色块）。
 */
const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    colors: {
      inherit: 'inherit',
      current: 'currentColor',
      transparent: 'transparent',
      // 仅用于彩色/渐变底上的文字（如品牌按钮、打卡按钮），不随主题切换
      white: '#ffffff',

      brand: {
        DEFAULT: 'var(--lx-primary)',
        50: 'var(--lx-primary-50)',
        100: 'var(--lx-primary-100)',
        200: 'var(--lx-primary-200)',
        300: 'var(--lx-primary-300)',
        400: 'var(--lx-primary-400)',
        500: 'var(--lx-primary-500)',
        600: 'var(--lx-primary-600)',
        700: 'var(--lx-primary-700)',
        800: 'var(--lx-primary-800)',
        900: 'var(--lx-primary-900)',
        bg: 'var(--lx-primary-bg)',
        weak: 'var(--lx-primary-weak)',
        light: 'var(--lx-primary-light)',
      },
      success: {
        DEFAULT: 'var(--lx-success)',
        bg: 'var(--lx-success-bg)',
        light: 'var(--lx-success-light)',
        // 文字态（标签/文字用，保证 WCAG AA ≥4.5:1）
        text: 'var(--lx-success-text)',
      },
      warning: {
        DEFAULT: 'var(--lx-warning)',
        bg: 'var(--lx-warning-bg)',
        light: 'var(--lx-warning-light)',
        text: 'var(--lx-warning-text)',
      },
      danger: {
        DEFAULT: 'var(--lx-danger)',
        bg: 'var(--lx-danger-bg)',
        light: 'var(--lx-danger-light)',
        text: 'var(--lx-danger-text)',
      },
      purple: {
        DEFAULT: 'var(--lx-purple)',
        bg: 'var(--lx-purple-bg)',
        text: 'var(--lx-purple-text)',
      },
      info: {
        DEFAULT: 'var(--lx-info)',
        bg: 'var(--lx-info-bg)',
        text: 'var(--lx-info-text)',
      },
      neutral: {
        text: 'var(--lx-neutral-text)',
        bg: 'var(--lx-neutral-tag-bg)',
      },
      'clock-out': 'var(--lx-clock-out)',
      'quick-monthly': 'var(--lx-quick-monthly)',
      'quick-leave': 'var(--lx-quick-leave)',
      'quick-overtime': 'var(--lx-quick-overtime)',
      'quick-stats': 'var(--lx-quick-stats)',

      text: {
        1: 'var(--lx-text-1)',
        2: 'var(--lx-text-2)',
        3: 'var(--lx-text-3)',
        4: 'var(--lx-text-4)',
        white: 'var(--lx-text-white)',
      },
      border: {
        1: 'var(--lx-border-1)',
        2: 'var(--lx-border-2)',
        3: 'var(--lx-border-3)',
      },
      surface: 'var(--lx-bg-card)',
      'bg-page': 'var(--lx-bg-page)',
      'bg-hover': 'var(--lx-bg-hover)',
      'bg-active': 'var(--lx-bg-active)',
      'bg-soft': 'var(--lx-bg-soft)',
      'bg-secondary': 'var(--lx-bg-secondary)',
      'bg-tertiary': 'var(--lx-bg-tertiary)',

      // 半透明遮罩（原来用 bg-white/50 这类不可换肤的写法，现改为 token）
      'overlay-soft': 'var(--lx-overlay-soft)',
      'overlay-strong': 'var(--lx-overlay-strong)',
    },
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Helvetica Neue"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      // 字号：与 globals.css 的 --lx-font-* 一一对应
      fontSize: {
        xs: 'var(--lx-font-xs)',
        sm: 'var(--lx-font-sm)',
        base: 'var(--lx-font-md)',
        lg: 'var(--lx-font-lg)',
        xl: 'var(--lx-font-xl)',
        '2xl': 'var(--lx-font-2xl)',
        '3xl': 'var(--lx-font-3xl)',
        '4xl': 'var(--lx-font-4xl)',
      },
      fontWeight: {
        normal: 'var(--lx-font-normal)',
        medium: 'var(--lx-font-medium)',
        semibold: 'var(--lx-font-semibold)',
      },
      // 圆角：与 --lx-radius-* 对应
      borderRadius: {
        DEFAULT: 'var(--lx-radius-xs)',
        '2xs': 'var(--lx-radius-2xs)',
        xs: 'var(--lx-radius-xs)',
        sm: 'var(--lx-radius-sm)',
        md: 'var(--lx-radius-md)',
        lg: 'var(--lx-radius-lg)',
        xl: 'var(--lx-radius-xl)',
        full: 'var(--lx-radius-full)',
      },
      // 阴影：与 --lx-shadow-* 对应（暗色下 token 会换成黑色投影）
      boxShadow: {
        sm: 'var(--lx-shadow-sm)',
        card: 'var(--lx-shadow-card)',
        'card-hover': 'var(--lx-shadow-card-hover)',
        md: 'var(--lx-shadow-md)',
        lg: 'var(--lx-shadow-lg)',
        xl: 'var(--lx-shadow-xl)',
        dropdown: 'var(--lx-shadow-dropdown)',
      },
      // 外壳尺寸：与布局 token 对应（注意 extend 保留默认 spacing，否则 p-4 等会失效）
      spacing: {
        sider: 'var(--lx-sider-width)',
        'sider-collapsed': 'var(--lx-sider-collapsed-width)',
        header: 'var(--lx-header-height)',
        tabs: 'var(--lx-tabs-height)',
      },
      transitionTimingFunction: {
        standard: 'var(--lx-ease-standard)',
      },
      transitionDuration: {
        fast: 'var(--lx-duration-fast)',
        base: 'var(--lx-duration-base)',
        slow: 'var(--lx-duration-slow)',
      },
      zIndex: {
        dropdown: 'var(--lx-z-dropdown)',
        sticky: 'var(--lx-z-sticky)',
        fixed: 'var(--lx-z-fixed)',
        modal: 'var(--lx-z-modal)',
        popover: 'var(--lx-z-popover)',
        toast: 'var(--lx-z-toast)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};

export default config;
