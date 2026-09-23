import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      screenshotDirectory: '.vitest-attachments',
    },
  },
})
