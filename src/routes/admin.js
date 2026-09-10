const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const { createAuthLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', createAuthLimiter(), adminController.adminLogin);

router.use(requireAuth, requireAdmin);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.listUsers);
router.get('/deposits', adminController.listDeposits);
router.get('/withdrawals', adminController.listWithdrawals);
router.get('/activity', adminController.getActivity);

router.post('/deposits/:id/approve', adminController.approveDeposit);
router.post('/deposits/:id/reject', adminController.rejectDeposit);
router.post('/withdrawals/:id/approve', adminController.approveWithdrawal);
router.post('/withdrawals/:id/reject', adminController.rejectWithdrawal);

module.exports = router;
