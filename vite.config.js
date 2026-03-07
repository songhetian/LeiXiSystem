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
            // 极大且独立的库，单独拆分
            if (id.includes('pinyin-pro')) {
              return 'lib-pinyin';
            }
            if (id.includes('exceljs')) {
              return 'lib-excel';
            }
            // 其余所有 node_modules 合并为一个 vendor 块，避免块间循环依赖
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
