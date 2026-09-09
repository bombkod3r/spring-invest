const { query } = require('../database/db');

const publicUser = (user) => ({
  id: user.id,
  firstName: user.first_name,
  lastName: user.last_name,
  username: user.username,
  role: user.role,
});

const findByUsername = async (username, { activeOnly = true } = {}) => {
  const result = await query(
    `SELECT id, first_name, last_name, username, password_hash, role, is_active
     FROM users WHERE username = $1 ${activeOnly ? 'AND is_active = TRUE' : ''}`,
    [username],
  );
  return result.rows[0] || null;
};

const findById = async (id) => {
  const result = await query(
    `SELECT id, first_name, last_name, username, role, is_active
     FROM users WHERE id = $1`,
    [id],
  );
  return result.rows[0] || null;
};

const create = async ({ firstName, lastName, username, passwordHash }) => {
  const result = await query(
    `INSERT INTO users (first_name, last_name, username, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, first_name, last_name, username, role`,
    [firstName, lastName, username, passwordHash],
  );
  return result.rows[0];
};

const updateProfile = async (id, { firstName, lastName }) => {
  const result = await query(
    `UPDATE users SET first_name = $1, last_name = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id, first_name, last_name, username, role`,
    [firstName, lastName, id],
  );
  return result.rows[0];
};

const updatePasswordHash = async (id, passwordHash) => {
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, id]);
};

const listAll = async () => {
  const result = await query(
    `SELECT id, first_name AS "firstName", last_name AS "lastName", username, role,
            is_active AS "isActive", created_at AS "createdAt"
     FROM users ORDER BY created_at DESC, id DESC`,
  );
  return result.rows;
};

module.exports = { publicUser, findByUsername, findById, create, updateProfile, updatePasswordHash, listAll };
