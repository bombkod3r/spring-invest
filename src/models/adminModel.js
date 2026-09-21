const { query } = require('../database/db');

const log = async (client, { adminId, action, targetType, targetId = null, description = null, ipAddress = null }) => {
  await client.query(
    `INSERT INTO admin_activity (admin_id, action, target_type, target_id, description, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [adminId, action, targetType, targetId, description, ipAddress],
  );
};

const listActivity = async (limit = 200) => {
  const result = await query(
    `SELECT a.id, a.action, a.target_type AS "targetType", a.target_id AS "targetId",
            a.description, a.ip_address AS "ipAddress", a.created_at AS "createdAt",
            u.username AS "adminUsername"
     FROM admin_activity a LEFT JOIN users u ON u.id = a.admin_id
     ORDER BY a.created_at DESC, a.id DESC LIMIT $1`,
    [limit],
  );
  return result.rows;
};

const stats = async () => {
  const result = await query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'user') AS users,
      (SELECT COUNT(*) FROM deposits WHERE status = 'pending') AS "pendingDeposits",
      (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending') AS "pendingWithdrawals",
      (SELECT COALESCE(SUM(balance), 0) FROM wallets) AS "totalBalance",
      (SELECT COUNT(DISTINCT user_id) FROM investments WHERE status = 'active') AS "activeInvestors",
      (SELECT COALESCE(SUM(amount), 0) FROM investments WHERE status = 'active') AS "totalInvested"`);
  return result.rows[0];
};

const listActiveInvestments = async () => {
  const result = await query(
    `SELECT i.id, i.user_id AS "userId", u.username, u.first_name AS "firstName", u.last_name AS "lastName",
            p.name AS "productName", p.duration_hours AS "durationHours",
            i.amount, i.profit, i.expected_payout AS "expectedPayout",
            i.start_date AS "startDate", i.maturity_date AS "maturityDate"
     FROM investments i
     JOIN users u ON u.id = i.user_id
     JOIN investment_products p ON p.id = i.product_id
     WHERE i.status = 'active'
     ORDER BY i.maturity_date ASC, i.id ASC`,
  );
  return result.rows;
};

module.exports = { log, listActivity, stats, listActiveInvestments };
