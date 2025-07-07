import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    testTimeout: 0, // Never timeout for generative tasks
    hookTimeout: 0, // Never timeout for setup/teardown hooks
  },
})
