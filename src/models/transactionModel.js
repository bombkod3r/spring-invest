const { query } = require('../database/db');

const record = async (client, { userId, type, method = null, amount, fee = 0, reference = null, status = 'completed', description = null }) => {
  const result = await client.query(
    `INSERT INTO transactions (user_id, type, method, amount, fee, reference, status, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [userId, type, method, Number(amount).toFixed(2), Number(fee).toFixed(2), reference, status, description],
  );
  return result.rows[0].id;
};

const setStatus = async (client, transactionId, status) => {
  await client.query('UPDATE transactions SET status = $1 WHERE id = $2', [status, transactionId]);
};

const listForUser = async (userId) => {
  const result = await query(
    `SELECT id, type, method, amount, fee, reference, status, description, created_at AS "createdAt"
     FROM transactions WHERE user_id = $1 ORDER BY created_at DESC, id DESC`,
    [userId],
  );
  return result.rows;
};

module.exports = { record, setStatus, listForUser };
