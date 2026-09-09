const express = require('express');
const depositController = require('../controllers/depositController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Thin wrappers over the deposits abstraction: each just pins the payment
// method before handing off to the same validation/creation logic as
// POST /api/deposits.
const withMethod = (method) => (req, res, next) => {
  req.body.method = method;
  return depositController.createDeposit(req, res, next);
};

router.post('/mpesa', withMethod('mpesa'));
router.post('/crypto', withMethod('usdt_trc20'));

module.exports = router;
