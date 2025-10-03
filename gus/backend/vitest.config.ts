import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    threads: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/migrations/**'],
      lines: 90,
      functions: 90,
      branches: 90,
      statements: 90
    }
  }
});
