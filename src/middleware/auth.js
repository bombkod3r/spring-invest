const jwt = require('jsonwebtoken');
const { query } = require('../database/db');

const requireAuth = async (req, res, next) => {
  const authorization = req.get('authorization');
  const token = authorization && authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query(
      `SELECT u.id, u.email, u.full_name, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_id = $1 AND s.expires_at > NOW() AND u.is_active = TRUE`,
      [payload.jti],
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Session expired or revoked' });
    }

    req.user = result.rows[0];
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  return next();
};

module.exports = { requireAuth, requireAdmin };