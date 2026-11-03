const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const DatabaseManager = require('../electron/db-manager.cjs');

// Mock Electron app object for CLI usage
const appData = process.env.APPDATA || (process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library', 'Application Support')
  : path.join(process.env.HOME || '', '.config'));

const fakeApp = {
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(appData, 'Electron');
    }
    return appData;
  }
};

/**
 * True when backend/.env points at a database that is not on this machine —
 * the deployed one. Then there is nothing local to start, and `migrate deploy`
 * must not be run against it from here: the deploy already does that.
 */
function usesRemoteDatabase() {
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', 'backend', '.env'), 'utf8');
    const match = env.match(/^DATABASE_URL=["']?([^"'\r\n]+)["']?/m);
    if (!match) return false;
    const host = new URL(match[1]).hostname;
    return !['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  } catch {
    return false;
  }
}

async function main() {
  if (usesRemoteDatabase()) {
    console.log('[DB] backend/.env uses a remote database - not starting the local one.');
    process.exit(0);
  }
  console.log('[DB] Ensuring database service is ready...');
  const mgr = new DatabaseManager(fakeApp, false, console.log);

  try {
    const result = await mgr.initialize((status) => {
      console.log(`[DB] ${status}`);
    });

    if (!result.success) {
      console.error('[DB] Failed to initialize database:', result.message);
      process.exit(1);
    }

    console.log(`[DB] Database is active at ${result.url} (${result.type})`);

    // Ensure migrations are deployed
    const backendRoot = path.join(__dirname, '..', 'backend');
    const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
    if (fs.existsSync(prismaCli)) {
      console.log('[DB] Ensuring database schema is up-to-date...');
      try {
        execSync(`node "${prismaCli}" migrate deploy`, {
          cwd: backendRoot,
          env: { ...process.env, DATABASE_URL: result.url },
          windowsHide: true,
          stdio: 'pipe',
          timeout: 60000
        });
        console.log('[DB] Database schema is fully verified.');
      } catch (err) {
        console.warn('[DB] Migration note:', err.message);
      }
    }

    console.log('[DB] Database ready for backend connections!');
    process.exit(0);
  } catch (err) {
    console.error('[DB] Error starting database:', err.message);
    process.exit(1);
  }
}

main();
