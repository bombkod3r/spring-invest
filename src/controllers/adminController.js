const bcrypt = require('bcryptjs');
const { query, pool } = require('../database/db');
const userModel = require('../models/userModel');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');
const adminModel = require('../models/adminModel');
const { issueSession } = require('./authController');

const adminLogin = async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const admin = await userModel.findByUsername(username);

    if (!admin || admin.role !== 'admin' || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ error: 'Invalid administrator credentials' });
    }

    const session = await issueSession(admin);
    await adminModel.log(pool, {
      adminId: admin.id,
      action: 'admin_login',
      targetType: 'session',
      ipAddress: req.ip,
    });
    return res.json({ user: userModel.publicUser(admin), ...session });
  } catch (err) {
    return next(err);
  }
};

const getStats = async (req, res, next) => {
  try {
    const dashboard = await adminModel.stats();
    return res.json({ stats: dashboard });
  } catch (err) {
    return next(err);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const users = await userModel.listAll();
    return res.json({ users });
  } catch (err) {
    return next(err);
  }
};

const listDeposits = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT d.id, d.user_id AS "userId", u.username, d.amount, d.method, d.reference, d.status,
              d.reviewed_at AS "reviewedAt", d.created_at AS "createdAt"
       FROM deposits d JOIN users u ON u.id = d.user_id
       ORDER BY d.created_at DESC, d.id DESC`,
    );
    return res.json({ deposits: result.rows });
  } catch (err) {
    return next(err);
  }
};

const listWithdrawals = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT w.id, w.user_id AS "userId", u.username, w.amount, w.fee, w.method, w.destination, w.status,
              w.reviewed_at AS "reviewedAt", w.created_at AS "createdAt"
       FROM withdrawals w JOIN users u ON u.id = w.user_id
       ORDER BY w.created_at DESC, w.id DESC`,
    );
    return res.json({ withdrawals: result.rows });
  } catch (err) {
    return next(err);
  }
};

const reviewDeposit = (decision) => async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const requestResult = await client.query('SELECT * FROM deposits WHERE id = $1 FOR UPDATE', [req.params.id]);
    const deposit = requestResult.rows[0];
    if (!deposit) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Deposit not found' });
    }
    if (deposit.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Deposit was already reviewed' });
    }

    if (decision === 'approved') {
      const wallet = await walletModel.lockWalletByUserId(client, deposit.user_id);
      const newBalance = Number(wallet.balance) + Number(deposit.amount);
      await walletModel.setBalance(client, wallet.id, newBalance);
      await transactionModel.setStatus(client, deposit.transaction_id, 'completed');
    } else {
      await transactionModel.setStatus(client, deposit.transaction_id, 'cancelled');
    }

    await client.query(
      `UPDATE deposits SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
      [decision, req.user.id, deposit.id],
    );
    await adminModel.log(client, {
      adminId: req.user.id,
      action: `deposit_${decision}`,
      targetType: 'deposit',
      targetId: deposit.id,
      description: `${decision} deposit of ${deposit.amount} for user ${deposit.user_id}`,
      ipAddress: req.ip,
    });

    await client.query('COMMIT');
    return res.json({ message: `Deposit ${decision}` });
  } catch (err) {
    await client.query('ROLLBACK');
    return next(err);
  } finally {
    client.release();
  }
};

const reviewWithdrawal = (decision) => async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const requestResult = await client.query('SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE', [req.params.id]);
    const withdrawal = requestResult.rows[0];
    if (!withdrawal) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Withdrawal not found' });
    }
    if (withdrawal.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Withdrawal was already reviewed' });
    }

    if (decision === 'approved') {
      // Funds were already debited/reserved at request time; approval just
      // finalizes the transaction record.
      await transactionModel.setStatus(client, withdrawal.transaction_id, 'completed');
    } else {
      // Refund the reserved amount + fee back to the wallet.
      const wallet = await walletModel.lockWalletByUserId(client, withdrawal.user_id);
      const refund = Number(withdrawal.amount) + Number(withdrawal.fee);
      const newBalance = Number(wallet.balance) + refund;
      await walletModel.setBalance(client, wallet.id, newBalance);
      await transactionModel.setStatus(client, withdrawal.transaction_id, 'cancelled');
    }

    await client.query(
      `UPDATE withdrawals SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
      [decision, req.user.id, withdrawal.id],
    );
    await adminModel.log(client, {
      adminId: req.user.id,
      action: `withdrawal_${decision}`,
      targetType: 'withdrawal',
      targetId: withdrawal.id,
      description: `${decision} withdrawal of ${withdrawal.amount} for user ${withdrawal.user_id}`,
      ipAddress: req.ip,
    });

    await client.query('COMMIT');
    return res.json({ message: `Withdrawal ${decision}` });
  } catch (err) {
    await client.query('ROLLBACK');
    return next(err);
  } finally {
    client.release();
  }
};

const getActivity = async (req, res, next) => {
  try {
    const logs = await adminModel.listActivity();
    return res.json({ activity: logs });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  adminLogin,
  getStats,
  listUsers,
  listDeposits,
  listWithdrawals,
  approveDeposit: reviewDeposit('approved'),
  rejectDeposit: reviewDeposit('rejected'),
  approveWithdrawal: reviewWithdrawal('approved'),
  rejectWithdrawal: reviewWithdrawal('rejected'),
  getActivity,
};
