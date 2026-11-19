/**
 * Points this worker at its own copy of the test database, which
 * tests/setup.ts created for it. Runs before the test file is imported, so
 * `src/db.ts` connects to the right one.
 *
 * The base URL is kept aside on first use: a worker process can run several
 * files, and the suffix must not be added twice.
 */
process.env.TEST_DATABASE_BASE ??= process.env.DATABASE_URL!;
const url = new URL(process.env.TEST_DATABASE_BASE);
url.pathname = `${url.pathname}_${process.env.VITEST_POOL_ID ?? '1'}`;
process.env.DATABASE_URL = url.toString();
