import { defineConfig } from 'vite'
import yaml from '@rollup/plugin-yaml'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'

export default defineConfig({
  plugins: [yaml(), vue({ template: { transformAssetUrls } }), quasar()],
  server: { proxy: { '/api': 'https://proxiedmail.com', '/gapi': 'https://proxiedmail.com' } },
})
