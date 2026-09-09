require('dotenv').config();

const bcrypt = require('bcryptjs');
const { query, pool } = require('../database/db');

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');

if (!email || password.length < 12) {
  console.error('ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters are required');
  process.exitCode = 1;
  pool.end();
} else {
  bcrypt.hash(password, 12)
    .then((passwordHash) => query(
      `INSERT INTO users (email, full_name, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = 'admin',
         is_active = TRUE,
         updated_at = NOW()`,
      [email, 'Administrator', passwordHash],
    ))
    .then(() => {
      console.log('Administrator account created or updated');
      return pool.end();
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
      return pool.end();
    });
}