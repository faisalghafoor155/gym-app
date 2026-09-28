const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { execFile, execSync } = require('node:child_process');

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
        path.join(process.resourcesPath, 'postgres', 'bin'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'postgres', 'bin')
      );
    } else {
      candidateDirs.push(
        path.join(__dirname, '..', 'resources', 'postgres', 'bin'),
        path.join(__dirname, '..', 'postgres', 'bin')
      );
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

    // 1. Check if external database is already configured or running
    if (process.env.DATABASE_URL) {
      this.logger('[DB] Using DATABASE_URL from environment');
      this.databaseUrl = process.env.DATABASE_URL;
      return { success: true, url: this.databaseUrl, type: 'env' };
    }

    // 2. Check if local port 5433 or 5432 is already active
    onStatus('Checking for running database...');
    const port5433Open = await checkPort(5433);
    if (port5433Open) {
      this.logger('[DB] Detected PostgreSQL running on port 5433');
      this.databaseUrl = 'postgresql://gymapp:99162a29589a02f11e2a35b252114149@127.0.0.1:5433/gymapp';
      return { success: true, url: this.databaseUrl, type: 'local_5433' };
    }

    const port5432Open = await checkPort(5432);
    if (port5432Open) {
      this.logger('[DB] Detected PostgreSQL running on port 5432');
      this.databaseUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/gymapp';
      return { success: true, url: this.databaseUrl, type: 'local_5432' };
    }

    // 3. Try Embedded / Portable PostgreSQL
    onStatus('Locating embedded database engine...');
    const pgBinDir = this.findPostgresBin();

    if (!pgBinDir) {
      this.logger('[DB] No embedded PostgreSQL found and no external database running.');
      // Return fallback URL so user can run local Docker or local Postgres
      this.databaseUrl = 'postgresql://gymapp:99162a29589a02f11e2a35b252114149@127.0.0.1:5433/gymapp';
      return {
        success: false,
        message: 'No running PostgreSQL server found. Please ensure database is started or embedded binaries are present.',
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

    // Start PostgreSQL
    onStatus('Starting database service...');
    this.logger('[DB] Starting PostgreSQL service...');
    const logFile = path.join(this.pgDataDir, 'postgresql.log');

    try {
      execSync(
        `"${pgCtlPath}" -D "${this.pgDataDir}" -l "${logFile}" -o "-p 5433 -h 127.0.0.1" start`,
        { windowsHide: true, stdio: 'pipe' }
      );
    } catch (err) {
      this.logger('[DB] pg_ctl start note/error:', err.message);
    }

    // Wait until port 5433 is ready
    let attempts = 0;
    while (attempts < 20) {
      const ready = await checkPort(5433);
      if (ready) break;
      await new Promise((r) => setTimeout(r, 500));
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
    this.databaseUrl = 'postgresql://gymapp@127.0.0.1:5433/gymapp';
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
