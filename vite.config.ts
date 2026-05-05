import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ProxiedMail',
        short_name: 'ProxiedMail',
        start_url: '.',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#4f46e5',
        description: 'PWA for managing proxy emails (CRUD)',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    proxy: {
      '/api': { target: 'https://proxiedmail.com', changeOrigin: true, followRedirects: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: 'https://proxiedmail.com', changeOrigin: true, followRedirects: true },
    },
  },
})
