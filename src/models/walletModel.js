const { query } = require('../database/db');

const ensureWallet = async (userId, client = { query }) => {
  const result = await client.query(
    `INSERT INTO wallets (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING id, user_id AS "userId", balance, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [userId],
  );
  return result.rows[0];
};

const lockWalletByUserId = async (client, userId) => {
  await ensureWallet(userId, client);
  const result = await client.query(
    'SELECT id, user_id AS "userId", balance FROM wallets WHERE user_id = $1 FOR UPDATE',
    [userId],
  );
  return result.rows[0];
};

const setBalance = async (client, walletId, balance) => {
  const result = await client.query(
    `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, user_id AS "userId", balance, updated_at AS "updatedAt"`,
    [balance.toFixed(2), walletId],
  );
  return result.rows[0];
};

module.exports = { ensureWallet, lockWalletByUserId, setBalance };
