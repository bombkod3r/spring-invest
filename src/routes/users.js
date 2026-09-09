const express = require('express');
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/me', userController.getMe);
router.put('/me', userController.updateMe);

module.exports = router;
