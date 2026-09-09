const express = require('express');
const investmentController = require('../controllers/investmentController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/products', investmentController.getProducts);
router.post('/', investmentController.createInvestment);
router.get('/', investmentController.listInvestments);
router.get('/:id', investmentController.getInvestment);

module.exports = router;
