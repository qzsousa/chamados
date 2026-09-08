import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.test.ts', 'src/index.ts', 'src/config/env.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'test-secret-key-min-32-characters-long',
      JWT_REFRESH_SECRET: 'test-refresh-secret-key-min-32-chars-long',
      FRONTEND_URL: 'http://localhost:5173',
      PORT: '3001'
    },
    alias: {
      '@shared': path.resolve(__dirname, '../shared/types'),
      '@': path.resolve(__dirname, 'src')
    }
  }
})