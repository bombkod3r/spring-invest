const { pool } = require('../database/db');
const investmentModel = require('../models/investmentModel');
const walletModel = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');

const asMoney = (value) => Number(value);

// Flat return_rate applied once over the product's full duration_hours.
const calculateStandardInvestment = (product, amount) => {
  const profit = asMoney(amount) * (Number(product.return_rate) / 100);
  const expectedPayout = asMoney(amount) + profit;
  const maturityDate = new Date(Date.now() + Number(product.duration_hours) * 60 * 60 * 1000);
  return { profit, expectedPayout, maturityDate };
};

// PLACEHOLDER: Gem's daily-profit-availability and capital-withdrawal rules
// haven't been confirmed yet. Until they are, Gem matures like a standard
// product at the end of its duration_hours rather than paying out daily.
const calculateGemInvestment = (product, amount) => calculateStandardInvestment(product, amount);

const calculateForProduct = (product, amount) => (
  product.name === 'Gem' ? calculateGemInvestment(product, amount) : calculateStandardInvestment(product, amount)
);

const settleMatured = async (client, matured) => {
  for (const investment of matured) {
    const wallet = await walletModel.lockWalletByUserId(client, investment.userId);
    const newBalance = Number(wallet.balance) + Number(investment.expectedPayout);
    await walletModel.setBalance(client, wallet.id, newBalance);
    await transactionModel.record(client, {
      userId: investment.userId,
      type: 'profit',
      amount: investment.expectedPayout,
      reference: `investment:${investment.id}`,
      description: 'Investment matured',
    });
    await investmentModel.markCompleted(client, investment.id);
  }
};

const processMaturity = async (userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const matured = await investmentModel.lockMaturedForUser(client, userId);
    if (matured.length > 0) await settleMatured(client, matured);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const processMaturitySweep = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const matured = await investmentModel.lockAllMatured(client);
    if (matured.length > 0) await settleMatured(client, matured);
    await client.query('COMMIT');
    return matured.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { calculateStandardInvestment, calculateGemInvestment, calculateForProduct, processMaturity, processMaturitySweep };
