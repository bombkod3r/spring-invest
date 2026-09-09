const { pool } = require('../database/db');
const investmentModel = require('../models/investmentModel');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');
const investmentService = require('../services/investment');
const { validateInvestmentCreate } = require('../validators/investmentValidator');

const getProducts = async (req, res, next) => {
  try {
    const products = await investmentModel.listActiveProducts();
    return res.json({ products });
  } catch (err) {
    return next(err);
  }
};

const createInvestment = async (req, res, next) => {
  const { error, value } = validateInvestmentCreate(req.body);
  if (error) return res.status(400).json({ error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const product = await investmentModel.findActiveProductById(client, value.productId);
    if (!product) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Investment product not found' });
    }
    if (value.amount < Number(product.minimum_amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Minimum investment for ${product.name} is ${product.minimum_amount}` });
    }
    if (value.amount > Number(product.maximum_amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Maximum investment for ${product.name} is ${product.maximum_amount}` });
    }

    const wallet = await walletModel.lockWalletByUserId(client, req.user.id);
    if (Number(wallet.balance) < value.amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const { profit, expectedPayout, maturityDate } = investmentService.calculateForProduct(product, value.amount);
    const investment = await investmentModel.create(client, {
      userId: req.user.id,
      productId: product.id,
      amount: value.amount,
      profit,
      expectedPayout,
      maturityDate,
    });

    const newBalance = Number(wallet.balance) - value.amount;
    await walletModel.setBalance(client, wallet.id, newBalance);
    await transactionModel.record(client, {
      userId: req.user.id,
      type: 'investment',
      amount: value.amount,
      reference: `investment:${investment.id}`,
      description: `Investment in ${product.name}`,
    });

    await client.query('COMMIT');
    return res.status(201).json({ investment });
  } catch (err) {
    await client.query('ROLLBACK');
    return next(err);
  } finally {
    client.release();
  }
};

const listInvestments = async (req, res, next) => {
  try {
    await investmentService.processMaturity(req.user.id);
    const investments = await investmentModel.listForUser(req.user.id);
    return res.json({ investments });
  } catch (err) {
    return next(err);
  }
};

const getInvestment = async (req, res, next) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid investment id' });

  try {
    await investmentService.processMaturity(req.user.id);
    const investment = await investmentModel.findForUserById(req.user.id, id);
    if (!investment) return res.status(404).json({ error: 'Investment not found' });
    return res.json({ investment });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getProducts, createInvestment, listInvestments, getInvestment };
