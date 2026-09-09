const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const sessionDurationSeconds = 7 * 24 * 60 * 60;

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.full_name,
  role: user.role,
});

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

router.post('/signup', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const fullName = String(req.body.fullName || '').trim();
    const password = String(req.body.password || '');

    if (!email || !fullName || password.length < 8) {
      return res.status(400).json({ error: 'Full name, valid email, and a password of at least 8 characters are required' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (email, full_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, role`,
      [email, fullName, passwordHash],
    );
    const session = await issueSession(result.rows[0]);
    return res.status(201).json({ user: publicUser(result.rows[0]), ...session });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const result = await query(
      'SELECT id, email, full_name, password_hash, role FROM users WHERE email = $1 AND is_active = TRUE',
      [email],
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const session = await issueSession(user);
    return res.json({ user: publicUser(user), ...session });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const token = req.get('authorization').slice(7);
    const payload = jwt.decode(token);
    await query('DELETE FROM sessions WHERE token_id = $1', [payload.jti]);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email, fullName: req.user.full_name, role: req.user.role } });
});

router.post('/password-reset/request', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const result = await query('SELECT id FROM users WHERE email = $1 AND is_active = TRUE', [email]);
    let resetToken;

    if (result.rowCount > 0) {
      resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
        [result.rows[0].id, tokenHash],
      );
    }

    const response = { message: 'If an account exists for that email, reset instructions have been created' };
    if (process.env.NODE_ENV !== 'production' && resetToken) response.resetToken = resetToken;
    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

router.post('/password-reset/confirm', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!token || password.length < 8) {
      return res.status(400).json({ error: 'A reset token and password of at least 8 characters are required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenResult = await query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash],
    );
    if (tokenResult.rowCount === 0) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const passwordHash = await bcrypt.hash(password, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, tokenResult.rows[0].user_id]);
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenResult.rows[0].id]);
    await query('DELETE FROM sessions WHERE user_id = $1', [tokenResult.rows[0].user_id]);
    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
module.exports.issueSession = issueSession;