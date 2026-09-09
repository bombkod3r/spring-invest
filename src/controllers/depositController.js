const { query, pool } = require('../database/db');
const { validateDeposit } = require('../validators/paymentValidator');
const transactionModel = require('../models/transactionModel');

const createDeposit = async (req, res, next) => {
  const { error, value } = validateDeposit(req.body);
  if (error) return res.status(400).json({ error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const duplicate = await client.query(
      `SELECT id FROM deposits WHERE reference = $1 AND status IN ('pending', 'approved')`,
      [value.reference],
    );
    if (duplicate.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That transaction reference has already been submitted' });
    }

    const transactionId = await transactionModel.record(client, {
      userId: req.user.id,
      type: 'deposit',
      method: value.method,
      amount: value.amount,
      reference: value.reference,
      status: 'pending',
      description: 'Deposit submitted, awaiting review',
    });

    const result = await client.query(
      `INSERT INTO deposits (user_id, amount, method, reference, transaction_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, amount, method, reference, status, created_at AS "createdAt"`,
      [req.user.id, value.amount, value.method, value.reference, transactionId],
    );

    await client.query('COMMIT');
    return res.status(201).json({ deposit: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That transaction reference has already been used' });
    }
    return next(err);
  } finally {
    client.release();
  }
};

const listDeposits = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, amount, method, reference, status, reviewed_at AS "reviewedAt", created_at AS "createdAt"
       FROM deposits WHERE user_id = $1 ORDER BY created_at DESC, id DESC`,
      [req.user.id],
    );
    return res.json({ deposits: result.rows });
  } catch (err) {
    return next(err);
  }
};

module.exports = { createDeposit, listDeposits };
