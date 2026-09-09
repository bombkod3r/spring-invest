const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, query } = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { issueSession } = require('./auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const result = await query(
      `SELECT id, email, full_name, role, password_hash
       FROM users WHERE email = $1 AND role = 'admin' AND is_active = TRUE`,
      [email],
    );
    const admin = result.rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ error: 'Invalid administrator credentials' });
    }

    const session = await issueSession(admin);
    return res.json({
      user: { id: admin.id, email: admin.email, fullName: admin.full_name, role: admin.role },
      ...session,
    });
  } catch (error) {
    return next(error);
  }
});

router.use(requireAuth, requireAdmin);

router.get('/dashboard', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'user') AS users,
        (SELECT COUNT(*) FROM deposit_requests WHERE status = 'pending') AS pending_deposits,
        (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending') AS pending_withdrawals,
        (SELECT COALESCE(SUM(balance), 0) FROM wallets) AS total_balance`);
    return res.json({ dashboard: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, email, full_name AS "fullName", role, is_active AS "isActive", created_at AS "createdAt"
       FROM users ORDER BY created_at DESC, id DESC`,
    );
    return res.json({ users: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/deposits', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT d.id, d.user_id AS "userId", u.email, d.amount, d.method, d.reference, d.status,
              d.reviewed_at AS "reviewedAt", d.created_at AS "createdAt"
       FROM deposit_requests d JOIN users u ON u.id = d.user_id
       ORDER BY d.created_at DESC, d.id DESC`,
    );
    return res.json({ requests: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/withdrawals', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT w.id, w.user_id AS "userId", u.email, w.amount, w.method, w.destination, w.status,
              w.reviewed_at AS "reviewedAt", w.created_at AS "createdAt"
       FROM withdrawal_requests w JOIN users u ON u.id = w.user_id
       ORDER BY w.created_at DESC, w.id DESC`,
    );
    return res.json({ requests: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.patch('/deposits/:id', async (req, res, next) => {
  const status = String(req.body.status || '').trim();
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const requestResult = await client.query('SELECT * FROM deposit_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    const request = requestResult.rows[0];
    if (!request) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Deposit request not found' });
    }
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Deposit request was already reviewed' });
    }

    let ledgerEntry;
    if (status === 'approved') {
      const walletResult = await client.query('SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE', [request.user_id]);
      const wallet = walletResult.rows[0] || (await client.query('INSERT INTO wallets (user_id) VALUES ($1) RETURNING id, balance', [request.user_id])).rows[0];
      const newBalance = Number(wallet.balance) + Number(request.amount);
      await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance.toFixed(2), wallet.id]);
      ledgerEntry = await client.query(
        `INSERT INTO wallet_ledger (wallet_id, entry_type, amount, balance_after, reference, description)
         VALUES ($1, 'deposit', $2, $3, $4, 'Deposit approved') RETURNING id`,
        [wallet.id, request.amount, newBalance.toFixed(2), request.reference],
      );
    }

    await client.query(
      `UPDATE deposit_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
      [status, req.user.id, request.id],
    );
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, $2, 'deposit_request', $3, $4)`,
      [req.user.id, `deposit_${status}`, request.id, JSON.stringify({ amount: request.amount, ledgerId: ledgerEntry?.rows[0]?.id || null })],
    );
    await client.query('COMMIT');
    return res.json({ message: `Deposit ${status}` });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.patch('/withdrawals/:id', async (req, res, next) => {
  const status = String(req.body.status || '').trim();
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const requestResult = await client.query('SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE', [req.params.id]);
    const request = requestResult.rows[0];
    if (!request) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Withdrawal request not found' });
    }
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Withdrawal request was already reviewed' });
    }

    let ledgerEntry;
    if (status === 'approved') {
      const walletResult = await client.query('SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE', [request.user_id]);
      const wallet = walletResult.rows[0];
      if (!wallet || Number(wallet.balance) < Number(request.amount)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Insufficient wallet balance for this withdrawal' });
      }
      const newBalance = Number(wallet.balance) - Number(request.amount);
      await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance.toFixed(2), wallet.id]);
      ledgerEntry = await client.query(
        `INSERT INTO wallet_ledger (wallet_id, entry_type, amount, balance_after, reference, description)
         VALUES ($1, 'withdrawal', $2, $3, $4, 'Withdrawal approved') RETURNING id`,
        [wallet.id, request.amount, newBalance.toFixed(2), `withdrawal:${request.id}`],
      );
    }

    await client.query('UPDATE withdrawal_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3', [status, req.user.id, request.id]);
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, $2, 'withdrawal_request', $3, $4)`,
      [req.user.id, `withdrawal_${status}`, request.id, JSON.stringify({ amount: request.amount, ledgerId: ledgerEntry?.rows[0]?.id || null })],
    );
    await client.query('COMMIT');
    return res.json({ message: `Withdrawal ${status}` });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.get('/audit-logs', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT a.id, a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
              a.details, a.created_at AS "createdAt", u.email AS "actorEmail"
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC, a.id DESC LIMIT 200`,
    );
    return res.json({ logs: result.rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;