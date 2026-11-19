import 'dotenv/config';
import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

// Test files run side by side, each worker on its own database (see
// tests/setup.ts). Two cores are left for Postgres. TEST_WORKERS overrides it;
// TEST_WORKERS=1 runs the files one at a time.
const workers = Number(process.env.TEST_WORKERS) || Math.max(1, Math.min(6, availableParallelism() - 2));
// Read by tests/setup.ts to know how many databases to create.
process.env.TEST_WORKERS = String(workers);

export default defineConfig({
  test: {
    // Tests live in tests/, mirroring the src/ tree they cover, so `src/` holds
    // nothing but the app that ships.
    include: ['tests/**/*.test.ts'],
    environment: 'node',

    // Provisions a throwaway database and repoints DATABASE_URL at it before
    // any app module loads. Unit tests are unaffected — they import nothing
    // that connects.
    globalSetup: ['./tests/setup.ts'],
    // Points each worker at its own copy of the test database.
    setupFiles: ['./tests/workerDb.ts'],
    maxWorkers: workers,

    // Migrations on a cold database push the first file past the 5s default.
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
