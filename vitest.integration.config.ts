import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    passWithNoTests: false,
    restoreMocks: true,
    // Password hashing (scrypt at the OWASP minimum) is deliberately slow.
    testTimeout: 60_000,
  },
});
