/**
 * Installs the backend's production dependencies into release-stage/ so
 * electron-builder can ship them.
 *
 * electron-builder strips every nested node_modules from `files`, so listing
 * backend/node_modules there does nothing — the packaged app then fails to
 * start with "Cannot find package 'express'". Copying them in as an
 * extraResource avoids that, and installing with --omit=dev here keeps
 * typescript, vitest and the other build tools out of the .exe.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const backend = path.join(root, 'backend');
const stage = path.join(root, 'release-stage', 'backend');

fs.rmSync(path.join(root, 'release-stage'), { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

for (const file of ['package.json', 'package-lock.json']) {
  fs.copyFileSync(path.join(backend, file), path.join(stage, file));
}

execSync('npm ci --omit=dev --no-audit --no-fund', { cwd: stage, stdio: 'inherit' });

// A fresh install has no generated Prisma client — `@prisma/client` is an empty
// shell until `prisma generate` writes node_modules/.prisma/client — and the
// backend fails on its first import without it. Generating needs the schema and
// config beside it; the DATABASE_URL is only read, never connected to.
fs.cpSync(path.join(backend, 'prisma', 'schema.prisma'), path.join(stage, 'prisma', 'schema.prisma'), { recursive: true });
fs.copyFileSync(path.join(backend, 'prisma.config.ts'), path.join(stage, 'prisma.config.ts'));
execSync('npx prisma generate', {
  cwd: stage,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'postgresql://stage:stage@localhost:5432/stage' },
});
console.log('[stage] backend production modules ready in', stage);
