const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
const userModel = require('../models/userModel');
const walletModel = require('../models/walletModel');
const { validateSignup, validateLogin, validatePasswordReset } = require('../validators/authValidator');

const sessionDurationSeconds = 7 * 24 * 60 * 60;

const issueSession = async (user) => {
  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + sessionDurationSeconds * 1000);
  const token = jwt.sign(
    { sub: String(user.id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: sessionDurationSeconds, jwtid: tokenId },
  );

  await query(
    'INSERT INTO sessions (user_id, token_id, expires_at) VALUES ($1, $2, $3)',
    [user.id, tokenId, expiresAt],
  );

  return { token, expiresAt };
};

const signup = async (req, res, next) => {
  const { error, value } = validateSignup(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const passwordHash = await bcrypt.hash(value.password, 12);
    const user = await userModel.create({ ...value, passwordHash });
    await walletModel.ensureWallet(user.id);
    const session = await issueSession(user);
    return res.status(201).json({ user: userModel.publicUser(user), ...session });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That username is already taken' });
    }
    return next(err);
  }
};

const login = async (req, res, next) => {
  const { error, value } = validateLogin(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const user = await userModel.findByUsername(value.username);
    if (!user || !(await bcrypt.compare(value.password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const session = await issueSession(user);
    return res.json({ user: userModel.publicUser(user), ...session });
  } catch (err) {
    return next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.get('authorization').slice(7);
    const payload = jwt.decode(token);
    await query('DELETE FROM sessions WHERE token_id = $1', [payload.jti]);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const user = await userModel.findByUsername(username);
    let resetToken;

    if (user) {
      resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
        [user.id, tokenHash],
      );
    }

    const response = { message: 'If an account exists for that username, reset instructions have been created' };
    if (process.env.NODE_ENV !== 'production' && resetToken) response.resetToken = resetToken;
    return res.json(response);
  } catch (err) {
    return next(err);
  }
};

const resetPassword = async (req, res, next) => {
  const { error, value } = validatePasswordReset(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const tokenHash = crypto.createHash('sha256').update(value.token).digest('hex');
    const tokenResult = await query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash],
    );
    if (tokenResult.rowCount === 0) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const passwordHash = await bcrypt.hash(value.password, 12);
    await userModel.updatePasswordHash(tokenResult.rows[0].user_id, passwordHash);
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenResult.rows[0].id]);
    await query('DELETE FROM sessions WHERE user_id = $1', [tokenResult.rows[0].user_id]);
    return res.json({ message: 'Password reset successfully' });
  } catch (err) {
    return next(err);
  }
};

module.exports = { issueSession, signup, login, logout, forgotPassword, resetPassword };
