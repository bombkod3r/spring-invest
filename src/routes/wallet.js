const express = require('express');
const { pool, query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const parseAmount = (value) => {
  const amount = String(value ?? '').trim();
  return /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 ? amount : null;
};

const ensureWallet = async (userId, client = { query }) => {
  const result = await client.query(
    `INSERT INTO wallets (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING id, user_id, balance, currency, created_at, updated_at`,
    [userId],
  );
  return result.rows[0];
};

router.use(requireAuth);

router.post('/', async (req, res, next) => {
  try {
    const wallet = await ensureWallet(req.user.id);
    return res.status(201).json({ wallet });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const wallet = await ensureWallet(req.user.id);
    return res.json({ wallet });
  } catch (error) {
    return next(error);
  }
});

router.get('/ledger', async (req, res, next) => {
  try {
    const wallet = await ensureWallet(req.user.id);
    const result = await query(
      `SELECT id, entry_type AS "entryType", amount, balance_after AS "balanceAfter",
              reference, description, created_at AS "createdAt"
       FROM wallet_ledger WHERE wallet_id = $1 ORDER BY created_at DESC, id DESC`,
      [wallet.id],
    );
    return res.json({ entries: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/deposits', async (req, res, next) => {
  try {
    const amount = parseAmount(req.body.amount);
    const method = String(req.body.method || '').trim();
    const reference = String(req.body.reference || '').trim();
    if (!amount || !['mpesa_till', 'usdt_trc20'].includes(method) || !reference) {
      return res.status(400).json({ error: 'A positive amount, supported payment method, and transaction reference are required' });
    }

    const result = await query(
      `INSERT INTO deposit_requests (user_id, amount, method, reference)
       VALUES ($1, $2, $3, $4)
       RETURNING id, amount, method, reference, status, created_at AS "createdAt"`,
      [req.user.id, amount, method, reference],
    );
    return res.status(201).json({ request: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get('/deposits', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, amount, method, reference, status, reviewed_at AS "reviewedAt", created_at AS "createdAt"
       FROM deposit_requests WHERE user_id = $1 ORDER BY created_at DESC, id DESC`,
      [req.user.id],
    );
    return res.json({ requests: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/withdrawals', async (req, res, next) => {
  const amount = parseAmount(req.body.amount);
  const method = String(req.body.method || '').trim();
  const destination = String(req.body.destination || '').trim();
  if (!amount || !['mpesa', 'usdt_trc20'].includes(method) || !destination) {
    return res.status(400).json({ error: 'A positive amount, supported withdrawal method, and destination are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wallet = await ensureWallet(req.user.id, client);
    const lockedWalletResult = await client.query('SELECT balance FROM wallets WHERE id = $1 FOR UPDATE', [wallet.id]);
    if (Number(lockedWalletResult.rows[0].balance) < Number(amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const result = await client.query(
      `INSERT INTO withdrawal_requests (user_id, amount, method, destination)
       VALUES ($1, $2, $3, $4)
       RETURNING id, amount, method, destination, status, created_at AS "createdAt"`,
      [req.user.id, amount, method, destination],
    );
    await client.query('COMMIT');
    return res.status(201).json({ request: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.get('/withdrawals', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, amount, method, destination, status, reviewed_at AS "reviewedAt", created_at AS "createdAt"
       FROM withdrawal_requests WHERE user_id = $1 ORDER BY created_at DESC, id DESC`,
      [req.user.id],
    );
    return res.json({ requests: result.rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;