import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    host: true, // 允许局域网访问
    strictPort: false
  },
  build: {
    outDir: 'dist-react'
  }
})
