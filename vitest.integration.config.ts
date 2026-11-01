import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
