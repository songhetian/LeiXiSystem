/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 品牌色：企业蓝（沉稳可信，非霓虹 AI 蓝紫）
        brand: {
          50: '#F0F5FF',
          100: '#E0EBFF',
          200: '#BDD4FF',
          300: '#8DB2FC',
          400: '#5689F5',
          500: '#2F6EF0',
          600: '#1D5CE6',
          700: '#1B4CC4',
          800: '#1C419E',
          900: '#1A3778',
          950: '#0E2050',
        },
        // 辅助：暖琥珀（仅用于「待审」等语义提示）
        ochre: {
          50: '#FCFAF4',
          100: '#F8F0DC',
          200: '#EFDCA8',
          300: '#E4C46D',
          400: '#DAAB3F',
          500: '#C9952A',
          600: '#A97620',
          700: '#85591D',
        },
        // ---- 语义 token：随亮/暗模式翻转 ----
        page: 'rgb(var(--page) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        'panel-soft': 'rgb(var(--panel-soft) / <alpha-value>)',
        fill: 'rgb(var(--fill) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        'brand-soft': 'rgb(var(--brand-soft) / <alpha-value>)',
        'brand-soft-2': 'rgb(var(--brand-soft-2) / <alpha-value>)',
        'brand-ink': 'rgb(var(--brand-ink) / <alpha-value>)',
        'ochre-soft': 'rgb(var(--ochre-soft) / <alpha-value>)',
        'ochre-ink': 'rgb(var(--ochre-ink) / <alpha-value>)',
        'brand-scrim': 'rgb(var(--brand-scrim) / <alpha-value>)',
        // 现有 stone-xx 类映射到语义 token，保证旧类暗色自动生效
        stone: {
          50: 'rgb(var(--fill) / <alpha-value>)',
          100: 'rgb(var(--fill) / <alpha-value>)',
          200: 'rgb(var(--line) / <alpha-value>)',
          300: 'rgb(var(--line-strong) / <alpha-value>)',
          400: 'rgb(var(--faint) / <alpha-value>)',
          500: 'rgb(var(--muted) / <alpha-value>)',
          600: 'rgb(var(--muted) / <alpha-value>)',
          700: 'rgb(var(--muted) / <alpha-value>)',
          800: 'rgb(var(--ink) / <alpha-value>)',
          900: 'rgb(var(--ink) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          'SF Pro Display',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Noto Sans SC"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif',
        ],
        display: ['inherit'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,40,0.04)',
        lift: '0 1px 2px rgba(16,24,40,0.05), 0 8px 24px rgba(16,24,40,0.08)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};