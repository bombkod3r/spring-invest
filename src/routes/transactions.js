const express = require('express');
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.get('/', requireAuth, userController.getTransactions);

module.exports = router;
