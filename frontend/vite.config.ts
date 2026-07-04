import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const ANALYZE = process.env.ANALYZE === 'true'

export default defineConfig({
  plugins: [
    react(),
    ANALYZE && (await import('rollup-plugin-visualizer')).default({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/**/__tests__/**',
        'node_modules',
      ],
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        modifyVars: {
          'arcoblue-6': '#10B981',
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@arco-design') && id.includes('/icon/')) {
            return 'vendor-arco-icons'
          }
          if (id.includes('@arco-design')) {
            return 'vendor-arco'
          }
          if (id.includes('axios') || id.includes('dayjs') || id.includes('zustand')) {
            return 'vendor-utils'
          }
          if (
            id.includes('/react/') ||
            id.includes('\\react\\') ||
            id.includes('/react-dom/') ||
            id.includes('\\react-dom\\') ||
            id.includes('/react-router-dom/') ||
            id.includes('\\react-router-dom\\')
          ) {
            return 'vendor-react'
          }
          if (id.includes('echarts')) {
            return 'vendor-echarts'
          }
          return undefined
        },
      },
    },
  },
})
