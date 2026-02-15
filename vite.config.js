import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
    host: true, // 允许局域网访问
    strictPort: false
  },
  build: {
    outDir: 'dist-react',
    sourcemap: false, // 禁用 sourcemap 以节省内存和时间
    minify: 'esbuild', // 确保使用速度最快的 esbuild
    chunkSizeWarningLimit: 1500, // 调高警告阈值
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'; // 将第三方库打包在一起，减少碎片文件
          }
        }
      }
    }
  }
})