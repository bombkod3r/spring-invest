require('dotenv').config();

const { execFileSync } = require('child_process');
const fs = require('fs');

const databaseUrl = process.env.DATABASE_URL;
const file = process.argv[2];

if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exitCode = 1;
} else if (!file || !fs.existsSync(file)) {
  console.error('Usage: npm run db:restore -- <path-to-backup-file>');
  console.error('(run `npm run db:backup:list` to see available backups)');
  process.exitCode = 1;
} else {
  // --clean --if-exists drops existing objects first so the restore fully
  // replaces current data rather than merging with it.
  execFileSync(
    'pg_restore',
    ['--clean', '--if-exists', '--no-owner', '--dbname', databaseUrl, file],
    { stdio: 'inherit' },
  );

  console.log(`Restored from ${file}`);
}
