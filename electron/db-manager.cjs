const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { spawn, execFile, execSync } = require('node:child_process');

function checkPort(port, host = '127.0.0.1', timeout = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeout);
    socket.once('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

class DatabaseManager {
  constructor(app, isPackaged, logger = console.log) {
    this.app = app;
    this.isPackaged = isPackaged;
    this.logger = logger;
    this.embeddedProcess = null;
    this.pgDataDir = null;
    this.pgBinDir = null;
    this.databaseUrl = null;
    this.isEmbedded = false;
  }

  findPostgresBin() {
    const candidateDirs = [];

    if (this.isPackaged) {
      candidateDirs.push(
        // Where electron-builder actually puts `resources/**/*` when asar is
        // off: under the app folder, not beside it.
        path.join(this.app.getAppPath(), 'resources', 'postgres', 'bin'),
        path.join(process.resourcesPath, 'postgres', 'bin'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'postgres', 'bin')
      );
    } else {
      candidateDirs.push(
        path.join(__dirname, '..', 'resources', 'postgres', 'bin'),
        path.join(__dirname, '..', 'postgres', 'bin')
      );

      if (process.platform === 'win32') {
        candidateDirs.push(
          'C:\\Program Files\\PostgreSQL\\17\\bin',
          'C:\\Program Files\\PostgreSQL\\18\\bin',
          'C:\\Program Files\\PostgreSQL\\16\\bin',
          'C:\\Program Files\\PostgreSQL\\15\\bin',
          'C:\\Program Files\\PostgreSQL\\14\\bin'
        );
      }
    }

    for (const dir of candidateDirs) {
      const pgCtl = path.join(dir, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
      if (fs.existsSync(pgCtl)) {
        return dir;
      }
    }
    return null;
  }

  async initialize(onStatus) {
    onStatus = onStatus || (() => {});

    // Read backend/.env for DATABASE_URL if in dev
    const backendEnvPath = path.join(__dirname, '..', 'backend', '.env');
    let backendEnvDbUrl = null;
    if (fs.existsSync(backendEnvPath)) {
      try {
        const content = fs.readFileSync(backendEnvPath, 'utf8');
        const match = content.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
        if (match && match[1]) {
          backendEnvDbUrl = match[1];
        }
      } catch {
        // ignore
      }
    }

    // 1. Check if external database is already configured or running
    if (process.env.DATABASE_URL) {
      this.logger('[DB] Using DATABASE_URL from environment');
      this.databaseUrl = process.env.DATABASE_URL;
      return { success: true, url: this.databaseUrl, type: 'env' };
    }

    // 2. Check if local port 5433 is already active (Docker or pre-running embedded instance)
    onStatus('Checking for running database...');
    const port5433Open = await checkPort(5433);
    if (port5433Open) {
      this.logger('[DB] Detected PostgreSQL running on port 5433');
      this.databaseUrl = backendEnvDbUrl || 'postgresql://gymapp:99162a29589a02f11e2a35b252114149@127.0.0.1:5433/gymapp';
      return { success: true, url: this.databaseUrl, type: 'local_5433' };
    }

    // 3. Try Embedded / Portable PostgreSQL on port 5433
    onStatus('Locating embedded database engine...');
    const pgBinDir = this.findPostgresBin();

    if (!pgBinDir) {
      // If no embedded binary, check if port 5432 was explicitly configured in backend/.env
      if (backendEnvDbUrl && backendEnvDbUrl.includes(':5432/')) {
        const port5432Open = await checkPort(5432);
        if (port5432Open) {
          this.logger('[DB] Using configured port 5432 from backend/.env');
          this.databaseUrl = backendEnvDbUrl;
          return { success: true, url: this.databaseUrl, type: 'local_5432' };
        }
      }

      this.logger('[DB] No embedded PostgreSQL found and port 5433 is not running.');
      this.databaseUrl = backendEnvDbUrl || 'postgresql://gymapp:99162a29589a02f11e2a35b252114149@127.0.0.1:5433/gymapp';
      return {
        success: false,
        message: 'No running PostgreSQL server found on port 5433. Please ensure database is started or embedded binaries are present.',
        url: this.databaseUrl
      };
    }

    this.pgBinDir = pgBinDir;
    this.pgDataDir = path.join(this.app.getPath('userData'), 'pgdata');
    this.logger(`[DB] Embedded PG bin: ${this.pgBinDir}`);
    this.logger(`[DB] Embedded PG data: ${this.pgDataDir}`);

    const ext = process.platform === 'win32' ? '.exe' : '';
    const initDbPath = path.join(this.pgBinDir, `initdb${ext}`);
    const pgCtlPath = path.join(this.pgBinDir, `pg_ctl${ext}`);
    const createdbPath = path.join(this.pgBinDir, `createdb${ext}`);

    // If data directory does not exist or PG_VERSION is missing, initialize it
    if (!fs.existsSync(path.join(this.pgDataDir, 'PG_VERSION'))) {
      onStatus('Initializing new database storage...');
      this.logger('[DB] Initializing new cluster with initdb...');
      fs.mkdirSync(this.pgDataDir, { recursive: true });

      try {
        execSync(`"${initDbPath}" -D "${this.pgDataDir}" -U gymapp -E UTF8 --no-locale -A trust`, {
          windowsHide: true,
          stdio: 'pipe'
        });
        this.logger('[DB] Cluster initialized successfully.');
      } catch (err) {
        this.logger('[DB] initdb failed:', err.message);
        throw err;
      }
    }

    // Clean up stale postmaster.pid if port 5433 is not active
    const pidFile = path.join(this.pgDataDir, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      const portActive = await checkPort(5433);
      if (!portActive) {
        try {
          fs.unlinkSync(pidFile);
        } catch {
          // ignore
        }
      }
    }

    // Start PostgreSQL
    onStatus('Starting database service...');
    this.logger('[DB] Starting PostgreSQL service...');
    const logFile = path.join(path.dirname(this.pgDataDir), 'pg_ctl.log');

    try {
      const child = spawn(pgCtlPath, [
        '-D', this.pgDataDir,
        '-l', logFile,
        '-o', '-p 5433 -h 127.0.0.1 -c logging_collector=off',
        'start'
      ], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();
    } catch (err) {
      this.logger('[DB] pg_ctl start note/error:', err.message);
    }

    // Wait until PostgreSQL is fully ready to accept queries
    const isReadyPath = path.join(this.pgBinDir, `pg_isready${ext}`);
    const psqlPath = path.join(this.pgBinDir, `psql${ext}`);
    let attempts = 0;
    while (attempts < 30) {
      if (fs.existsSync(isReadyPath)) {
        try {
          execSync(`"${isReadyPath}" -h 127.0.0.1 -p 5433 -U gymapp`, {
            windowsHide: true,
            stdio: 'pipe',
            timeout: 1000
          });
          if (fs.existsSync(psqlPath)) {
            execSync(`"${psqlPath}" -U gymapp -h 127.0.0.1 -p 5433 -d postgres -c "SELECT 1;"`, {
              windowsHide: true,
              stdio: 'pipe',
              timeout: 1000
            });
          }
          break;
        } catch {
          // still starting up or recovering
        }
      } else {
        const ready = await checkPort(5433);
        if (ready) {
          await new Promise((r) => setTimeout(r, 600));
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 300));
      attempts++;
    }

    // Create database 'gymapp' if it doesn't exist
    try {
      execSync(`"${createdbPath}" -U gymapp -p 5433 -h 127.0.0.1 gymapp`, {
        windowsHide: true,
        stdio: 'pipe'
      });
      this.logger('[DB] Created gymapp database.');
    } catch (err) {
      // It's normal if database already exists
      this.logger('[DB] Database already exists or createdb message:', err.message);
    }

    this.isEmbedded = true;
    this.databaseUrl = backendEnvDbUrl || 'postgresql://gymapp:99162a29589a02f11e2a35b252114149@127.0.0.1:5433/gymapp';
    this.logger('[DB] Embedded PostgreSQL started successfully.');
    return { success: true, url: this.databaseUrl, type: 'embedded' };
  }

  async stop() {
    if (!this.isEmbedded || !this.pgBinDir || !this.pgDataDir) {
      return;
    }

    this.logger('[DB] Stopping embedded PostgreSQL...');
    const ext = process.platform === 'win32' ? '.exe' : '';
    const pgCtlPath = path.join(this.pgBinDir, `pg_ctl${ext}`);

    try {
      execSync(`"${pgCtlPath}" -D "${this.pgDataDir}" stop -m fast`, {
        windowsHide: true,
        stdio: 'pipe'
      });
      this.logger('[DB] Embedded PostgreSQL stopped cleanly.');
    } catch (err) {
      this.logger('[DB] pg_ctl stop error:', err.message);
    }
  }
}

module.exports = DatabaseManager;
