import { defineConfig } from 'vitest/config'

// Test-only config; the production build keeps using vite.config.js
// untouched. Environment is node — current tests cover pure service
// modules (no DOM). Switch to jsdom here when component tests are added.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
