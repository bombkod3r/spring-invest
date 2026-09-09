const express = require('express');
const withdrawalController = require('../controllers/withdrawalController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.post('/', withdrawalController.createWithdrawal);
router.get('/', withdrawalController.listWithdrawals);

module.exports = router;
