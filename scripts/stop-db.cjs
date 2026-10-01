const path = require('node:path');
const DatabaseManager = require('../electron/db-manager.cjs');

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

async function main() {
  const mgr = new DatabaseManager(fakeApp, false, console.log);
  mgr.findPostgresBin();
  mgr.pgBinDir = mgr.findPostgresBin();
  mgr.pgDataDir = path.join(fakeApp.getPath('userData'), 'pgdata');
  mgr.isEmbedded = true;
  await mgr.stop();
  console.log('[DB] Stop complete.');
}

main();
