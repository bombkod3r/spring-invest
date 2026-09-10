require('dotenv').config();

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exitCode = 1;
} else {
  const backupsDir = path.join(__dirname, '..', '..', 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(backupsDir, `springs-invests-${timestamp}.dump`);

  execFileSync('pg_dump', ['--format=custom', '--file', outFile, databaseUrl], { stdio: 'inherit' });

  console.log(`Backup written to ${outFile}`);
}
