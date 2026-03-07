import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  server: {
    port: 5173,
    host: true,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    // 启用 Gzip 压缩大小报告
    reportCompressedSize: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // 稳健的分包策略：消除循环依赖
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 核心基础库 (必须最先加载)
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('zustand') || id.includes('scheduler')) {
              return 'framework';
            }
            // Ant Design 体系：由于图标与组件高度耦合，合并打包以防止上下文丢失
            if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-')) {
              return 'ui-antd-all';
            }
            // 拼音库
            if (id.includes('pinyin-pro')) {
              return 'lib-pinyin';
            }
            // 独立的大型第三方库 (无循环引用风险)
            if (id.includes('recharts') || id.includes('chart.js') || id.includes('react-chartjs-2')) {
              return 'lib-charts';
            }
            if (id.includes('exceljs')) {
              return 'lib-excel';
            }
            if (id.includes('framer-motion')) {
              return 'lib-animation';
            }
            // 其他琐碎库
            return 'vendor';
          }
          // 登录页保持独立
          if (id.includes('src/pages/Login.jsx')) {
            return 'page-login';
          }
        },
        // 资源文件分类存放
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      }
    }
  }
})
