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
      (SELECT COALESCE(SUM(balance), 0) FROM wallets) AS "totalBalance"`);
  return result.rows[0];
};

module.exports = { log, listActivity, stats };
