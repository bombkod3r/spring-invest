const { query, pool } = require('../database/db');
const { validateWithdrawal } = require('../validators/paymentValidator');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');

// Flat Ksh 10 processing fee for every withdrawal method, per the frontend.
const calculateFee = () => 10;

const createWithdrawal = async (req, res, next) => {
  const { error, value } = validateWithdrawal(req.body);
  if (error) return res.status(400).json({ error });

  const fee = calculateFee(value.amount, value.method);
  const totalDebit = Number(value.amount) + fee;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const wallet = await walletModel.lockWalletByUserId(client, req.user.id);
    if (Number(wallet.balance) < totalDebit) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Debit and reserve funds now, at request time, so two concurrent
    // withdrawal requests can't both pass the balance check against the same
    // funds. If the request is later rejected, the reservation is refunded.
    const newBalance = Number(wallet.balance) - totalDebit;
    await walletModel.setBalance(client, wallet.id, newBalance);

    const transactionId = await transactionModel.record(client, {
      userId: req.user.id,
      type: 'withdrawal',
      method: value.method,
      amount: value.amount,
      fee,
      status: 'pending',
      description: 'Withdrawal requested, funds reserved pending review',
    });

    const result = await client.query(
      `INSERT INTO withdrawals (user_id, amount, fee, method, destination, transaction_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, amount, fee, method, destination, status, created_at AS "createdAt"`,
      [req.user.id, value.amount, fee.toFixed(2), value.method, value.destination, transactionId],
    );

    await client.query('COMMIT');
    return res.status(201).json({ withdrawal: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    return next(err);
  } finally {
    client.release();
  }
};

const listWithdrawals = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, amount, fee, method, destination, status, reviewed_at AS "reviewedAt", created_at AS "createdAt"
       FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC, id DESC`,
      [req.user.id],
    );
    return res.json({ withdrawals: result.rows });
  } catch (err) {
    return next(err);
  }
};

module.exports = { createWithdrawal, listWithdrawals };
