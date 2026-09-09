const express = require('express');
const depositController = require('../controllers/depositController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.post('/', depositController.createDeposit);
router.get('/', depositController.listDeposits);

module.exports = router;
