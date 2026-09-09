const express = require('express');
const { checkDatabaseConnection } = require('../database/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await checkDatabaseConnection();
    res.json({
      status: 'ok',
      service: 'springs-backend',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check database error', error);
    res.status(503).json({
      status: 'degraded',
      service: 'springs-backend',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;