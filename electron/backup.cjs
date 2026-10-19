/**
 * Backing up and restoring the desktop app's own database.
 *
 * Only for the embedded Postgres the .exe starts itself. With an online
 * database the data lives on a server with its own backups, and pg_dump from
 * here would be a different major version from it more often than not.
 *
 * Uses the pg_dump / pg_restore that ship beside the embedded server, so the
 * tools and the server are always the same version. A backup is one file in
 * pg_dump's custom format: compressed, and `pg_restore --list` can read it back
 * without touching any database, which is how a file is checked before it is
 * allowed anywhere near the live data.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const AUTO_PREFIX = 'auto-';
const EXT = '.dump';

/** Splits a postgres:// URL into what the command-line tools take. */
function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '')
  };
}

function tool(binDir, name) {
  return path.join(binDir, process.platform === 'win32' ? `${name}.exe` : name);
}

/** Runs one tool to completion. Rejects with its stderr when it exits non-zero. */
function run(binDir, name, args, password) {
  return new Promise((resolve, reject) => {
    const child = spawn(tool(binDir, name), args, {
      windowsHide: true,
      // The password goes in the environment, not on the command line, where
      // any other process on the PC could read it from the process list.
      env: { ...process.env, PGPASSWORD: password || '' }
    });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${name} failed (${code}): ${stderr.trim().split('\n').slice(-3).join(' ')}`));
    });
  });
}

const connArgs = (c) => ['-h', c.host, '-p', c.port, '-U', c.user];

/** Throws unless `file` is a readable pg_dump archive. Touches no database. */
async function verifyBackup(binDir, file) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    throw new Error('That file is empty or missing.');
  }
  try {
    await run(binDir, 'pg_restore', ['--list', file]);
  } catch {
    throw new Error('That file is not a GymPro backup, or it is damaged.');
  }
}

/** Writes a backup of the database to `dest` and checks it reads back. */
async function createBackup({ binDir, dbUrl, dest }) {
  const c = parseDbUrl(dbUrl);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // Written beside the destination first, so a dump that dies half way never
  // leaves a plausible-looking file where a good backup should be.
  const partial = `${dest}.partial`;
  try {
    await run(binDir, 'pg_dump', [
      ...connArgs(c), '-d', c.database, '-Fc', '--no-owner', '--no-privileges', '-f', partial
    ], c.password);
    await verifyBackup(binDir, partial);
    fs.renameSync(partial, dest);
  } catch (err) {
    fs.rmSync(partial, { force: true });
    throw err;
  }
  return { path: dest, size: fs.statSync(dest).size };
}

/**
 * Replaces the database's contents with the backup's.
 *
 * One transaction: if anything fails part way, Postgres rolls the whole thing
 * back and the data is exactly as it was. The caller is expected to have
 * stopped whatever is using the database, and to have taken a copy first.
 */
async function restoreBackup({ binDir, dbUrl, file }) {
  const c = parseDbUrl(dbUrl);
  await verifyBackup(binDir, file);
  await run(binDir, 'pg_restore', [
    ...connArgs(c), '-d', c.database,
    '--clean', '--if-exists', '--no-owner', '--no-privileges', '--single-transaction', file
  ], c.password);
}

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;

/** `GymPro-Backup-2026-10-19_1730.dump` — what the save dialog suggests. */
const suggestedName = () => `GymPro-Backup-${stamp()}${EXT}`;

function listAuto(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.startsWith(AUTO_PREFIX) && f.endsWith(EXT))
    .map((f) => ({ file: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);
}

/**
 * The daily safety net: one backup a day into `dir`, the newest `keep` kept.
 *
 * It protects against a mistake (a deleted member, a bad edit), not against the
 * PC dying — a copy on the same disk goes with it. That is what the manual
 * backup to a USB drive is for, and the panel says so.
 */
async function autoBackup({ binDir, dbUrl, dir, keep = 14, minHours = 20, now = new Date() }) {
  const existing = listAuto(dir);
  if (existing[0] && now - existing[0].mtime < minHours * 3600 * 1000) {
    return { skipped: true };
  }
  const result = await createBackup({ binDir, dbUrl, dest: path.join(dir, `${AUTO_PREFIX}${stamp(now)}${EXT}`) });
  for (const old of listAuto(dir).slice(keep)) fs.rmSync(old.file, { force: true });
  return { skipped: false, ...result };
}

function autoStatus(dir) {
  const files = listAuto(dir);
  return { lastAutoAt: files[0] ? files[0].mtime.toISOString() : null, autoCount: files.length };
}

module.exports = {
  parseDbUrl, createBackup, restoreBackup, verifyBackup, autoBackup, autoStatus, suggestedName, stamp
};
