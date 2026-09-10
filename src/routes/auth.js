const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { createAuthLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/signup', createAuthLimiter(), authController.signup);
router.post('/login', createAuthLimiter(), authController.login);
router.post('/logout', requireAuth, authController.logout);
router.post('/forgot-password', createAuthLimiter(), authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
