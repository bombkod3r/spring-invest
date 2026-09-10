const { query } = require('../database/db');

const listActiveProducts = async () => {
  const result = await query(
    `SELECT id, name, description, minimum_amount AS "minimumAmount", maximum_amount AS "maximumAmount",
            return_rate AS "returnRate", duration_hours AS "durationHours"
     FROM investment_products WHERE active = TRUE ORDER BY id`,
  );
  return result.rows;
};

const findActiveProductById = async (client, id) => {
  const result = await client.query('SELECT * FROM investment_products WHERE id = $1 AND active = TRUE', [id]);
  return result.rows[0] || null;
};

const create = async (client, { userId, productId, amount, profit, expectedPayout, maturityDate }) => {
  const result = await client.query(
    `INSERT INTO investments (user_id, product_id, amount, profit, expected_payout, maturity_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, product_id AS "productId", amount, profit, expected_payout AS "expectedPayout",
               status, start_date AS "startDate", maturity_date AS "maturityDate"`,
    [userId, productId, amount.toFixed(2), profit.toFixed(2), expectedPayout.toFixed(2), maturityDate],
  );
  return result.rows[0];
};

const listForUser = async (userId) => {
  const result = await query(
    `SELECT i.id, i.product_id AS "productId", p.name AS "productName", p.duration_hours AS "durationHours",
            i.amount, i.profit, i.expected_payout AS "expectedPayout", i.status, i.start_date AS "startDate",
            i.maturity_date AS "maturityDate", i.completed_at AS "completedAt"
     FROM investments i JOIN investment_products p ON p.id = i.product_id
     WHERE i.user_id = $1 ORDER BY i.start_date DESC, i.id DESC`,
    [userId],
  );
  return result.rows;
};

const findForUserById = async (userId, id) => {
  const result = await query(
    `SELECT i.id, i.product_id AS "productId", p.name AS "productName", p.duration_hours AS "durationHours",
            i.amount, i.profit, i.expected_payout AS "expectedPayout", i.status, i.start_date AS "startDate",
            i.maturity_date AS "maturityDate", i.completed_at AS "completedAt"
     FROM investments i JOIN investment_products p ON p.id = i.product_id
     WHERE i.user_id = $1 AND i.id = $2`,
    [userId, id],
  );
  return result.rows[0] || null;
};

const lockMaturedForUser = async (client, userId) => {
  const result = await client.query(
    `SELECT id, user_id AS "userId", expected_payout AS "expectedPayout"
     FROM investments
     WHERE user_id = $1 AND status = 'active' AND maturity_date <= NOW()
     FOR UPDATE`,
    [userId],
  );
  return result.rows;
};

const lockAllMatured = async (client) => {
  const result = await client.query(
    `SELECT id, user_id AS "userId", expected_payout AS "expectedPayout"
     FROM investments
     WHERE status = 'active' AND maturity_date <= NOW()
     FOR UPDATE SKIP LOCKED`,
  );
  return result.rows;
};

const markCompleted = async (client, id) => {
  await client.query(
    `UPDATE investments SET status = 'completed', completed_at = NOW() WHERE id = $1`,
    [id],
  );
};

module.exports = {
  listActiveProducts,
  findActiveProductById,
  create,
  listForUser,
  findForUserById,
  lockMaturedForUser,
  lockAllMatured,
  markCompleted,
};
