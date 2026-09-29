import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
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
        },
        warning: {
          DEFAULT: 'var(--lx-warning)',
          bg: 'var(--lx-warning-bg)',
          light: 'var(--lx-warning-light)',
        },
        danger: {
          DEFAULT: 'var(--lx-danger)',
          bg: 'var(--lx-danger-bg)',
          light: 'var(--lx-danger-light)',
        },
        purple: {
          DEFAULT: 'var(--lx-purple)',
          bg: 'var(--lx-purple-bg)',
        },
        'clock-out': 'var(--lx-clock-out)',
        'quick-monthly': 'var(--lx-quick-monthly)',
        'quick-leave': 'var(--lx-quick-leave)',
        'quick-overtime': 'var(--lx-quick-overtime)',
        'quick-stats': 'var(--lx-quick-stats)',
        info: {
          DEFAULT: 'var(--lx-info)',
          bg: 'var(--lx-info-bg)',
        },
        text: {
          1: 'var(--lx-text-1)',
          2: 'var(--lx-text-2)',
          3: 'var(--lx-text-3)',
          4: 'var(--lx-text-4)',
        },
        border: {
          1: 'var(--lx-border-1)',
          2: 'var(--lx-border-2)',
          3: 'var(--lx-border-3)',
        },
        surface: 'var(--lx-bg-card)',
        'bg-page': 'var(--lx-bg-page)',
        'bg-hover': 'var(--lx-bg-hover)',
        'bg-soft': 'var(--lx-bg-soft)',
        'bg-secondary': 'var(--lx-bg-secondary)',
      },
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
      fontSize: {
        xs: '12px',
        sm: '13.5px',
        base: '14px',
        lg: '15px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '28px',
        '4xl': '32px',
      },
      fontWeight: {
        normal: '400',
        medium: '500',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(16, 24, 40, 0.05)',
        card: '0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.04)',
        'card-hover': '0 4px 12px rgba(16, 24, 40, 0.08)',
        md: '0 1px 3px 0 rgba(16, 24, 40, 0.05), 0 1px 2px 0 rgba(16, 24, 40, 0.04)',
        lg: '0 4px 8px rgba(16, 24, 40, 0.06)',
        xl: '0 10px 20px rgba(16, 24, 40, 0.08)',
        dropdown: '0 6px 20px rgba(16, 24, 40, 0.08), 0 2px 6px rgba(16, 24, 40, 0.04)',
      },
      spacing: {
        'sider': '216px',
        'sider-collapsed': '64px',
        'header': '56px',
      },
      transitionTimingFunction: {
        fast: 'cubic-bezier(0.4, 0, 0.2, 1)',
        base: 'cubic-bezier(0.4, 0, 0.2, 1)',
        slow: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
      zIndex: {
        dropdown: '1000',
        sticky: '1020',
        fixed: '1030',
        modal: '1040',
        popover: '1050',
        toast: '1060',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};

export default config;
