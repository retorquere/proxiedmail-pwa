import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'gen',
  publicDir: '../public',
  plugins: [
    {
      name: 'serve-source-entry',
      transformIndexHtml: {
        order: 'pre',
        handler(html, context) {
          if (!context.server) return html;
          return html.replace('../src/main.ts', `/@fs/${path.join(projectRoot, 'src/main.ts')}`);
        },
      },
    },
  ],
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