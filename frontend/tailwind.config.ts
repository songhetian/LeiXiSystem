import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#165dff',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          bg: 'rgba(22, 93, 255, 0.06)',
          weak: 'rgba(22, 93, 255, 0.15)',
          light: '#f2f7ff',
        },
        success: {
          DEFAULT: '#00b42a',
          bg: 'rgba(0, 180, 42, 0.06)',
          light: '#f0fff4',
        },
        warning: {
          DEFAULT: '#ff7d00',
          bg: 'rgba(255, 125, 0, 0.06)',
          light: '#fffbeb',
        },
        danger: {
          DEFAULT: '#f53f3f',
          bg: 'rgba(245, 63, 63, 0.06)',
          light: '#fff5f5',
        },
        purple: {
          DEFAULT: '#722ed1',
          bg: 'rgba(114, 46, 209, 0.06)',
        },
        info: {
          DEFAULT: '#165dff',
          bg: 'rgba(22, 93, 255, 0.06)',
        },
        text: {
          1: '#1d2129',
          2: '#4e5969',
          3: '#86909c',
          4: '#c9cdd4',
        },
        border: {
          1: '#e5e7eb',
          2: '#f2f3f5',
          3: '#d9dce0',
        },
        surface: '#ffffff',
        'bg-page': '#f7f8fa',
        'bg-hover': '#f2f3f5',
        'bg-soft': '#fafbfc',
        'bg-secondary': '#fafbfc',
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
