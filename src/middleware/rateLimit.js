const rateLimit = require('express-rate-limit');

// A fresh instance per call — each has its own counter, so heavy traffic on
// one auth endpoint (e.g. admin login) never eats into another's quota
// (e.g. a real user's login attempts) just because they share the config.
const createAuthLimiter = () => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

module.exports = { createAuthLimiter, apiLimiter };
