import { defineConfig } from 'vite'
import yaml from '@rollup/plugin-yaml'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    yaml(),
    vue({ template: { transformAssetUrls } }),
    quasar(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ProxiedMail',
        short_name: 'ProxiedMail',
        description: 'Manage private email addresses without exposing your inbox.',
        theme_color: '#087e8b',
        background_color: '#f5f7f6',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/proxiedmail-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: { proxy: { '/api': 'https://proxiedmail.com', '/gapi': 'https://proxiedmail.com' } },
})
