import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['scripts/**/*.ts'],
      exclude: ['scripts/**/*.spec.ts'],
      all: true,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
