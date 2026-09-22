import { defineConfig } from 'vite';

export default defineConfig({
  root: 'gen',
  publicDir: '../public',
  server: {
    proxy: {
      '/api/v1': {
        target: 'https://proxiedmail.com',
        changeOrigin: true,
        secure: true,
      },
      '/gapi': {
        target: 'https://proxiedmail.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});