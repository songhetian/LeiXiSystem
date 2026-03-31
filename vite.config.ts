import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'leixi-startup-banner',
      configureServer() {
        console.log('\n✨ \x1b[36m雷犀系统 v2 前端开发环境已就绪\x1b[0m');
        console.log('🔗 \x1b[32m本地访问:\x1b[0m http://localhost:5174');
        console.log('🌐 \x1b[32m局域网访问:\x1b[0m http://192.168.2.32:5174\n');
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('@mantine')) {
              return 'vendor-mantine';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('dayjs') || id.includes('zod') || id.includes('axios')) {
              return 'vendor-utils';
            }
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174, // 避免与 v1 冲突
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
  },
});
