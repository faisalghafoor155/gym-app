const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const backup = require('./backup.cjs');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const http = require('node:http');
const os = require('node:os');
const net = require('node:net');
const { fork, execSync } = require('node:child_process');
const DatabaseManager = require('./db-manager.cjs');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

// Optimize Chromium performance & GPU rendering for Windows Desktop
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let splashWindow = null;
let mainWindow = null;
let backendProcess = null;
/** What the backend was started with, so a restore can restart it the same way. */
let currentDbUrl = null;
let currentConfig = null;
let dbManager = null;

const PORT = process.env.PORT || 5000;
const DEV_URL = 'http://localhost:5173';
const PROD_URL = `http://127.0.0.1:${PORT}`;

function getAppDataDir() {
  const dir = path.join(app.getPath('userData'), 'gympro-data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * The PC's address on the gym's Wi-Fi/LAN (e.g. 192.168.1.10), or null.
 *
 * Links the server builds (staff invites, password resets) and the address a
 * phone types in must point here — `localhost` on a phone means the phone.
 */
function getLanAddress() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal) continue;
      // Virtual adapters (VirtualBox, Hyper-V, WSL, VPNs) are unreachable
      // from a phone; prefer real Wi-Fi/Ethernet.
      const virtual = /virtual|vbox|vmware|hyper-v|vethernet|wsl|docker|loopback|tailscale|zerotier/i.test(name);
      const privateRange = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
      candidates.push({ address: a.address, score: (virtual ? 0 : 2) + (privateRange ? 1 : 0) });
    }
  }
  candidates.sort((x, y) => y.score - x.score);
  return candidates[0] ? candidates[0].address : null;
}

function getOrGenerateConfig() {
  const configFile = path.join(getAppDataDir(), 'config.json');
  let config = {};

  if (fs.existsSync(configFile)) {
    try {
      config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch {
      config = {};
    }
  }

  // Also check backend/.env for existing secrets if present
  const backendEnvFile = path.join(__dirname, '..', 'backend', '.env');
  if (fs.existsSync(backendEnvFile)) {
    try {
      const content = fs.readFileSync(backendEnvFile, 'utf8');
      const jwtMatch = content.match(/JWT_SECRET=["']?([^"'\r\n]+)["']?/);
      if (jwtMatch && jwtMatch[1] && !config.jwtSecret) {
        config.jwtSecret = jwtMatch[1];
      }
      const bioMatch = content.match(/BIOMETRIC_KEY=["']?([^"'\r\n]+)["']?/);
      if (bioMatch && bioMatch[1] && !config.biometricKey) {
        config.biometricKey = bioMatch[1];
      }
    } catch {
      // ignore
    }
  }

  let modified = false;

  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    config.jwtSecret = crypto.randomBytes(48).toString('base64url');
    modified = true;
  }

  if (!config.biometricKey) {
    config.biometricKey = crypto.randomBytes(32).toString('base64');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
  }

  // Merged after the write so settings carried on the USB are never copied
  // into this PC's AppData — take the stick away and they go with it.
  return { ...config, ...readPortableConfig() };
}

/**
 * `gympro-config.json` beside the .exe, for settings that should travel with
 * it rather than be typed into every PC: the online database the desktop
 * shares with the website, the BIOMETRIC_KEY that database's secrets are
 * encrypted with, the website's address for emailed links, and mail.
 *
 * electron-builder's portable build unpacks to a temp folder, so the .exe's
 * real folder comes from PORTABLE_EXECUTABLE_DIR; an installed build has the
 * file beside its own executable.
 */
function readPortableConfig() {
  const dir = process.env.PORTABLE_EXECUTABLE_DIR
    || (app.isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..'));
  const file = path.join(dir, 'gympro-config.json');
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(`[Config] Using ${file}`);
    // Blank values are the template's placeholders, not settings.
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    );
  } catch (err) {
    console.warn(`[Config] Ignoring unreadable ${file}: ${err.message}`);
    return {};
  }
}

/**
 * Waits until the online database answers on its port.
 *
 * Connecting to it is the whole job of an online build, so with no internet
 * there is nothing useful to open. Rather than a blank window or a server
 * that crashes on its first query, the splash says plainly that it is waiting
 * for the internet and keeps trying.
 */
function waitForOnlineDatabase(databaseUrl, timeoutMs = 90000) {
  let host;
  let port;
  try {
    const u = new URL(databaseUrl);
    host = u.hostname;
    port = Number(u.port || 5432);
  } catch {
    return Promise.reject(new Error('databaseUrl in gympro-config.json is not a valid connection string.'));
  }

  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host, port });
      socket.setTimeout(5000);
      // A timeout can be followed by an error on the same socket; one retry
      // per attempt, or the waits would multiply.
      let settled = false;
      const retry = () => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Could not reach the online database. Check the internet connection and open GymPro again.'));
          return;
        }
        updateSplashStatus('No internet — waiting to reach the online database...');
        setTimeout(attempt, 3000);
      };
      socket.once('connect', () => { settled = true; socket.destroy(); resolve(); });
      socket.once('timeout', retry);
      socket.once('error', retry);
    };
    attempt();
  });
}

/** config.json key → backend env var, for the mail settings an owner may add. */
const MAIL_KEYS = {
  resendApiKey: 'RESEND_API_KEY',
  mailFrom: 'MAIL_FROM',
  smtpHost: 'SMTP_HOST',
  smtpPort: 'SMTP_PORT',
  smtpUser: 'SMTP_USER',
  smtpPass: 'SMTP_PASS',
  smtpFrom: 'SMTP_FROM'
};

function mailEnv(config) {
  const env = {};
  for (const [key, name] of Object.entries(MAIL_KEYS)) {
    const value = config[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      env[name] = String(value).trim();
    }
  }
  return env;
}

function updateSplashStatus(message) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash:status', message);
  }
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 380,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function checkServerHealth(url, timeoutMs = 25000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`${url}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server health check returned HTTP ${res.statusCode}`));
        } else {
          setTimeout(check, 400);
        }
      });

      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Server health check timed out.'));
        } else {
          setTimeout(check, 400);
        }
      });
      req.end();
    };

    check();
  });
}

async function runPrismaMigrations(databaseUrl) {
  try {
    updateSplashStatus('Checking database tables & migrations...');
    const backendRoot = app.isPackaged
      ? path.join(app.getAppPath(), 'backend')
      : path.join(__dirname, '..', 'backend');

    const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
    if (fs.existsSync(prismaCli)) {
      console.log('[Prisma] Running migrate deploy in', backendRoot);
      execSync(`node "node_modules/prisma/build/index.js" migrate deploy`, {
        cwd: backendRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        windowsHide: true,
        stdio: 'pipe',
        timeout: 60000
      });
      console.log('[Prisma] Migrations checked successfully.');
    }
  } catch (err) {
    const detail = err.stderr ? err.stderr.toString() : err.message;
    console.warn('[Prisma] Migration note/error:', detail);
  }
}

function startBackendServer(databaseUrl, config) {
  const backendRoot = app.isPackaged
    ? path.join(app.getAppPath(), 'backend')
    : path.join(__dirname, '..', 'backend');

  const backendEntry = path.join(backendRoot, 'dist', 'index.js');

  const staticDir = app.isPackaged
    ? path.join(app.getAppPath(), 'frontend', 'dist')
    : path.join(__dirname, '..', 'frontend', 'dist');

  console.log(`[Backend] Starting server from ${backendEntry}`);
  console.log(`[Backend] Serving static frontend from ${staticDir}`);

  const lanIp = getLanAddress();
  const publicUrl = lanIp ? `http://${lanIp}:${PORT}` : `http://localhost:${PORT}`;
  console.log(`[Backend] Phones on the same Wi-Fi can open: ${publicUrl}`);

  const env = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'production',
    DATABASE_URL: databaseUrl,
    JWT_SECRET: config.jwtSecret,
    BIOMETRIC_KEY: config.biometricKey,
    SERVE_STATIC_DIR: staticDir,
    // The desktop server is plain http. Without this the session cookie is
    // marked Secure, which a phone opening http://192.168.x.x refuses to
    // store — login "succeeds" and bounces straight back to the login page.
    // It also stops the server forcing https:// on the page's own scripts.
    HTTPS: 'false',
    // Invite / reset links are opened on other devices, so they must carry
    // an address those devices can reach. An explicit APP_URL still wins
    // (e.g. when the desktop app sits behind a real domain).
    // Online, links go to the website so they open from anywhere.
    APP_URL: process.env.APP_URL || config.appUrl || publicUrl,
    // Online, the website runs the daily reminders against the same data.
    // Every desk PC running them too would send each member the same message
    // once per PC.
    ...(config.databaseUrl && { RUN_JOBS: 'false' }),
    // Mail for staff/member invites and password resets. The packaged app
    // ships no .env, so these live in config.json beside the secrets; with
    // none set, invites fall back to a link the owner copies by hand.
    ...mailEnv(config),
    // The ZKTeco fingerprint reader on the gym's network. Only the desk PC
    // next to it can reach it, so this belongs in that PC's config file.
    ...(config.zktecoHost && { ZKTECO_HOST: String(config.zktecoHost).trim() }),
    ...(config.zktecoPort && { ZKTECO_PORT: String(config.zktecoPort).trim() })
  };

  backendProcess = fork(backendEntry, [], {
    cwd: backendRoot,
    env,
    stdio: 'pipe',
    windowsHide: true
  });

  backendProcess.stdout?.on('data', (data) => {
    console.log(`[Server] ${data.toString().trim()}`);
  });

  backendProcess.stderr?.on('data', (data) => {
    console.error(`[Server ERR] ${data.toString().trim()}`);
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`[Backend] Process exited with code ${code}, signal ${signal}`);
  });
}

function createMainWindow(targetUrl) {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: 'GymPro',
    backgroundColor: '#090d16',
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false
    }
  });

  // Set up custom application menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Print',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow && mainWindow.webContents.print()
        },
        { type: 'separator' },
        { label: 'Quit GymPro', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.loadURL(targetUrl);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.warn(`[Window] Server not ready yet: ${validatedURL} (${errorCode}: ${errorDescription}). Retrying...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(targetUrl);
      }
    }, 1200);
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow && mainWindow.close());
ipcMain.on('window:print', () => mainWindow && mainWindow.webContents.print());
ipcMain.on('shell:openExternal', (_e, url) => shell.openExternal(url));


// --- Backup & restore -----------------------------------------------------
// Only for the embedded database. With an online one the data lives on a server
// that has its own backups.
const backupDir = () => path.join(getAppDataDir(), 'backups');
const backupSupported = () => Boolean(dbManager && dbManager.isEmbedded && dbManager.pgBinDir);
const notSupported = () => ({
  ok: false,
  error: 'Backups here are only for the data stored on this PC. Your data is on the online server, which keeps its own backups.'
});

/** Stops the backend and waits for it to let go of the database. */
function stopBackend() {
  return new Promise((resolve) => {
    if (!backendProcess) return resolve();
    const proc = backendProcess;
    const timer = setTimeout(resolve, 5000);
    proc.once('exit', () => { clearTimeout(timer); resolve(); });
    try { proc.kill(); } catch { clearTimeout(timer); resolve(); }
  });
}

ipcMain.handle('backup:status', () => {
  if (!backupSupported()) {
    return { supported: false, reason: notSupported().error };
  }
  return { supported: true, folder: backupDir(), ...backup.autoStatus(backupDir()) };
});

ipcMain.handle('backup:create', async () => {
  if (!backupSupported()) return notSupported();
  const pick = await dialog.showSaveDialog(mainWindow, {
    title: 'Save GymPro backup',
    defaultPath: path.join(app.getPath('documents'), backup.suggestedName()),
    filters: [{ name: 'GymPro backup', extensions: ['dump'] }]
  });
  if (pick.canceled || !pick.filePath) return { ok: false, canceled: true };
  try {
    const made = await backup.createBackup({ binDir: dbManager.pgBinDir, dbUrl: currentDbUrl, dest: pick.filePath });
    return { ok: true, path: made.path, size: made.size };
  } catch (err) {
    console.error('[Backup] failed:', err.message);
    return { ok: false, error: 'The backup could not be made. ' + err.message };
  }
});

ipcMain.handle('backup:restore', async () => {
  if (!backupSupported()) return notSupported();
  const pick = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a GymPro backup to restore',
    filters: [{ name: 'GymPro backup', extensions: ['dump'] }],
    properties: ['openFile']
  });
  if (pick.canceled || !pick.filePaths[0]) return { ok: false, canceled: true };
  const file = pick.filePaths[0];
  const binDir = dbManager.pgBinDir;

  // Checked before anyone is asked anything, so a wrong file is refused up
  // front rather than after a warning about losing the data.
  try {
    await backup.verifyBackup(binDir, file);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Replace my data with this backup'],
    defaultId: 0,
    cancelId: 0,
    title: 'Restore backup',
    message: 'Replace all current data with this backup?',
    detail: path.basename(file) + '\n\nEverything entered since this backup was made will be lost. ' +
      'A copy of the current data is saved first, in case you change your mind.'
  });
  if (choice.response !== 1) return { ok: false, canceled: true };

  const safetyCopy = path.join(backupDir(), `before-restore-${backup.stamp()}.dump`);
  try {
    await backup.createBackup({ binDir, dbUrl: currentDbUrl, dest: safetyCopy });
  } catch (err) {
    // No way back means no restore: the one thing worse than a failed restore
    // is a restore that cannot be undone.
    return { ok: false, error: 'Could not save a copy of the current data first, so nothing was changed. ' + err.message };
  }

  await stopBackend();
  let restoreError = null;
  try {
    await backup.restoreBackup({ binDir, dbUrl: currentDbUrl, file });
    // A backup from an older version lacks newer tables and columns.
    await runPrismaMigrations(currentDbUrl);
  } catch (err) {
    restoreError = err;
    console.error('[Backup] restore failed:', err.message);
  }

  // Back up either way: a failed restore rolls back and leaves the old data.
  startBackendServer(currentDbUrl, currentConfig);
  await checkServerHealth(PROD_URL);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();

  return restoreError
    ? { ok: false, error: 'The restore failed and nothing was changed. ' + restoreError.message }
    : { ok: true, safetyCopy };
});

ipcMain.handle('backup:openFolder', async () => {
  fs.mkdirSync(backupDir(), { recursive: true });
  await shell.openPath(backupDir());
});

/** The daily automatic copy. Never blocks start-up and never raises. */
function scheduleAutoBackup() {
  if (!backupSupported()) return;
  backup.autoBackup({ binDir: dbManager.pgBinDir, dbUrl: currentDbUrl, dir: backupDir() })
    .then((r) => { if (!r.skipped) console.log('[Backup] automatic backup saved'); })
    .catch((err) => console.warn('[Backup] automatic backup failed:', err.message));
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  createSplashWindow();

  try {
    const config = getOrGenerateConfig();

    let dbResult;
    if (config.databaseUrl) {
      // Online: the same data the website uses, so the owner can manage the
      // gym from a phone anywhere. The local Postgres is not started at all.
      updateSplashStatus('Connecting to the online database...');
      await waitForOnlineDatabase(config.databaseUrl);
      dbResult = { success: true, url: config.databaseUrl };
    } else {
      dbManager = new DatabaseManager(app, app.isPackaged, console.log);
      dbResult = await dbManager.initialize((status) => updateSplashStatus(status));
    }

    if (dbResult.success) {
      await runPrismaMigrations(dbResult.url);
    } else {
      console.warn('[DB] DB initialize warning:', dbResult.message);
    }

    updateSplashStatus('Starting GymPro server...');

    // If dev and Vite is active, we can connect dev to frontend
    if (isDev && process.env.ELECTRON_START_URL) {
      createMainWindow(process.env.ELECTRON_START_URL);
    } else {
      // Start express backend which serves the built frontend & handles /api
      currentDbUrl = dbResult.url;
      currentConfig = config;
      startBackendServer(dbResult.url, config);
      updateSplashStatus('Connecting to GymPro...');

      await checkServerHealth(PROD_URL);
      createMainWindow(PROD_URL);
      scheduleAutoBackup();
    }
  } catch (err) {
    console.error('Failed to initialize application:', err);
    updateSplashStatus(`Error: ${err.message}`);
    setTimeout(() => {
      app.quit();
    }, 5000);
  }
});

app.on('window-all-closed', async () => {
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch {
      // ignore
    }
  }

  if (dbManager) {
    await dbManager.stop();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch {
      // ignore
    }
  }
  if (dbManager) {
    await dbManager.stop();
  }
});
