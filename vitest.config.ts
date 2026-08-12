import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Load test env (test DB + secret) into process.env BEFORE the app's env.ts runs.
const testEnv = config({ path: '.env.test' }).parsed ?? {};

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: testEnv,
    hookTimeout: 30_000,
    testTimeout: 20_000,
  },
});
