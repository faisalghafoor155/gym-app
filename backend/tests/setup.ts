import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

/**
 * Prepares the throwaway databases for the integration suite and points the
 * app at them, before any application module is imported.
 *
 * This runs as a vitest `globalSetup`, so it happens once per run rather than
 * per file, and — crucially — before `src/db.ts` reads DATABASE_URL to build
 * its connection pool.
 *
 * Separate databases, never the development one: these tests empty every
 * table between cases, which would wipe real gym data if pointed at `gymapp`.
 *
 * Test files run in parallel, one per worker, and each worker gets its own copy
 * (`gymapp_test_1`, `gymapp_test_2`, ...) so one file emptying the tables
 * cannot delete another's fixtures mid-request. `workerDb.ts` points each
 * worker at its copy.
 *
 * The databases are kept between runs. Creating, dropping and migrating them
 * took over a minute on Windows, before a single test ran. Each one is labelled
 * with a hash of the migrations it was built from, and rebuilt only when that
 * no longer matches; otherwise its tables are just emptied.
 */

const TEST_DB = 'gymapp_test';
const MIGRATIONS = join(import.meta.dirname, '..', 'prisma', 'migrations');

/** Swaps the database name on the configured URL, keeping host and credentials. */
const withDatabase = (url: string, database: string): string => {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
};

const adminUrl = (url: string): string => withDatabase(url, 'postgres');

/** A hash of every migration file, so a new or edited migration rebuilds the databases. */
const migrationsHash = (): string => {
  const hash = createHash('sha256');
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else hash.update(entry.name).update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'));
    }
  };
  walk(MIGRATIONS);
  return hash.digest('hex').slice(0, 16);
};

/** Empties every table but `_prisma_migrations`, as `resetDb` does between tests. */
const emptyTables = async (url: string): Promise<void> => {
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query(`
      DO $$
      DECLARE r record;
      BEGIN
        SET LOCAL session_replication_role = replica;
        FOR r IN SELECT tablename FROM pg_tables
                 WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
          EXECUTE format('DELETE FROM public.%I', r.tablename);
        END LOOP;
      END $$
    `);
  } finally {
    await db.end();
  }
};

export default async function setup(): Promise<void> {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      'DATABASE_URL is not set. Integration tests need a reachable Postgres — ' +
      'copy backend/.env.example to backend/.env and fill it in.',
    );
  }

  // Drops and recreates databases and empties tables. Fine on this machine,
  // never on a hosted server that backend/.env may point at once local runs
  // share the deployed database.
  const host = new URL(base).hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) && process.env.ALLOW_REMOTE_TEST_DB !== 'true') {
    throw new Error(
      `Refusing to run the integration tests against ${host}: it is not a local database. ` +
      'Point DATABASE_URL at a local Postgres for the test run.',
    );
  }

  const testUrl = withDatabase(base, TEST_DB);
  const hash = migrationsHash();
  const workers = Number(process.env.TEST_WORKERS) || 1;
  const copies = Array.from({ length: workers }, (_, i) => `${TEST_DB}_${i + 1}`);

  const admin = new Client({ connectionString: adminUrl(base) });
  await admin.connect();
  try {
    const { rows } = await admin.query<{ datname: string; label: string | null }>(
      `SELECT datname, shobj_description(oid, 'pg_database') AS label FROM pg_database
       WHERE datname = ANY($1)`,
      [[TEST_DB, ...copies]],
    );
    const current = new Set(rows.filter(r => r.label === hash).map(r => r.datname));

    if (!current.has(TEST_DB)) {
      // FORCE disconnects any session left over from a killed run, which would
      // otherwise make the DROP hang.
      await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${TEST_DB}`);

      // `migrate deploy` rather than `db push`: it applies the real migration
      // files, so the tests run against the schema production actually gets.
      // The local binary rather than `npx`, and without shell:true — passing
      // args through a shell is a quoting hazard. Windows cannot spawn the .cmd
      // shim directly, so there it goes through cmd.exe with fixed arguments.
      const [cmd, cmdArgs] = process.platform === 'win32'
        ? ['cmd.exe', ['/c', 'node_modules\\.bin\\prisma.cmd', 'migrate', 'deploy']]
        : ['node_modules/.bin/prisma', ['migrate', 'deploy']];
      execFileSync(cmd, cmdArgs, {
        env: { ...process.env, DATABASE_URL: testUrl },
        stdio: 'pipe',
      });
      // Labelled only once migrated, so a run killed halfway rebuilds it.
      await admin.query(`COMMENT ON DATABASE ${TEST_DB} IS '${hash}'`);
      current.clear();
    }

    // Copies cloned from the migrated database: much quicker than migrating
    // each one, and identical by construction.
    for (const name of copies) {
      if (current.has(name)) {
        await emptyTables(withDatabase(base, name));
        continue;
      }
      await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${name} TEMPLATE ${TEST_DB}`);
      await admin.query(`COMMENT ON DATABASE ${name} IS '${hash}'`);
    }
  } finally {
    await admin.end();
  }

  // Handed to the test processes; `workerDb.ts` adds the worker's number and
  // `db.ts` picks it up when first imported.
  process.env.DATABASE_URL = testUrl;
  // Existing tests sign up and use the session straight away; the approval
  // path has its own test that turns this back on.
  process.env.REQUIRE_GYM_APPROVAL = 'false';
  process.env.NODE_ENV = 'test';
  // The suite covers limits and billing, which only exist with the switch on.
  process.env.SUBSCRIPTIONS_ENABLED ??= 'true';
  process.env.JWT_SECRET ??='test-secret-at-least-32-characters-long!!';
  // A fixed 32-byte key so the suite can enrol and read back templates. Every
  // run starts from emptied databases, so nothing is ever encrypted under one
  // run's key and read under another's.
  process.env.BIOMETRIC_KEY ??= Buffer.alloc(32, 7).toString('base64');
}
