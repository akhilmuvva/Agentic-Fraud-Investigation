import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Direct API endpoints — proxy only when NOT requesting HTML page
      '/cases': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: (req) => {
          // If browser navigation (requesting HTML), serve SPA index.html so React Router handles /cases/:caseId
          const accept = req.headers.accept || '';
          if (req.method === 'GET' && accept.includes('text/html')) {
            return '/index.html';
          }
        },
      },
      '/investigate': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
