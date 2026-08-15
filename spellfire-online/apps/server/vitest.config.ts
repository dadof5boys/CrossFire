import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // DB-backed integration tests run serially against the local Supabase Postgres.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
