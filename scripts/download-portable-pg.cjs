/**
 * Downloads official portable PostgreSQL binaries for Windows x64
 * and extracts them into resources/postgres.
 *
 * This allows GymPro to be bundled into a 100% self-contained
 * portable USB app that runs on any PC without installing PostgreSQL!
 */

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const PG_ZIP_URL = 'https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64-binaries.zip';
const TARGET_DIR = path.join(__dirname, '..', 'resources', 'postgres');
const TEMP_ZIP = path.join(__dirname, '..', 'resources', 'pg_temp.zip');

async function download(url, dest) {
  console.log(`Downloading PostgreSQL portable binaries from:\n${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const file = fs.createWriteStream(dest);

  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalSize > 0) {
          const pct = ((downloaded / totalSize) * 100).toFixed(1);
          process.stdout.write(`\rDownloading: ${pct}% (${(downloaded / (1024 * 1024)).toFixed(1)} MB / ${(totalSize / (1024 * 1024)).toFixed(1)} MB)`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          console.log('\nDownload complete.');
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  if (fs.existsSync(path.join(TARGET_DIR, 'bin', 'postgres.exe'))) {
    console.log(`PostgreSQL portable binaries already exist in ${TARGET_DIR}`);
    return;
  }

  try {
    await download(PG_ZIP_URL, TEMP_ZIP);

    console.log('Extracting PostgreSQL binaries...');
    const extractTemp = path.join(__dirname, '..', 'resources', 'pg_extract_temp');
    if (fs.existsSync(extractTemp)) {
      fs.rmSync(extractTemp, { recursive: true, force: true });
    }
    fs.mkdirSync(extractTemp, { recursive: true });

    // Use PowerShell Expand-Archive on Windows
    execSync(`powershell -Command "Expand-Archive -Path '${TEMP_ZIP}' -DestinationPath '${extractTemp}' -Force"`, {
      stdio: 'inherit'
    });

    // The zip usually unpacks into an inner 'pgsql' folder
    const innerPgsql = path.join(extractTemp, 'pgsql');
    const sourceDir = fs.existsSync(innerPgsql) ? innerPgsql : extractTemp;

    if (fs.existsSync(TARGET_DIR)) {
      fs.rmSync(TARGET_DIR, { recursive: true, force: true });
    }

    fs.renameSync(sourceDir, TARGET_DIR);
    console.log(`PostgreSQL portable binaries extracted to: ${TARGET_DIR}`);

    // Cleanup
    if (fs.existsSync(TEMP_ZIP)) fs.unlinkSync(TEMP_ZIP);
    if (fs.existsSync(extractTemp)) fs.rmSync(extractTemp, { recursive: true, force: true });

    console.log('Setup finished successfully!');
  } catch (err) {
    console.error('Failed to setup portable PostgreSQL:', err.message);
  }
}

main();
