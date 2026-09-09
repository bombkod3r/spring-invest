require('dotenv').config();

const bcrypt = require('bcryptjs');
const { query, pool } = require('../database/db');

const username = String(process.env.ADMIN_USERNAME || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');
const firstName = String(process.env.ADMIN_FIRST_NAME || 'Administrator').trim();
const lastName = String(process.env.ADMIN_LAST_NAME || 'Account').trim();

if (!username || password.length < 12) {
  console.error('ADMIN_USERNAME and an ADMIN_PASSWORD of at least 12 characters are required');
  process.exitCode = 1;
  pool.end();
} else {
  bcrypt.hash(password, 12)
    .then((passwordHash) => query(
      `INSERT INTO users (first_name, last_name, username, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = 'admin',
         is_active = TRUE,
         updated_at = NOW()`,
      [firstName, lastName, username, passwordHash],
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
