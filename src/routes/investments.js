const express = require('express');
const { pool, query } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const asMoney = (value) => Number(value).toFixed(2);

router.get('/products', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, description, minimum_amount AS "minimumAmount", annual_rate AS "annualRate",
              duration_days AS "durationDays" FROM investment_products WHERE is_active = TRUE ORDER BY id`,
    );
    return res.json({ products: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const productId = Number.parseInt(req.body.productId, 10);
  const principal = Number(req.body.amount);
  if (!Number.isInteger(productId) || !Number.isFinite(principal) || principal <= 0) {
    return res.status(400).json({ error: 'A valid product and positive investment amount are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productResult = await client.query('SELECT * FROM investment_products WHERE id = $1 AND is_active = TRUE', [productId]);
    const product = productResult.rows[0];
    if (!product) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Investment product not found' });
    }
    if (principal < Number(product.minimum_amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Minimum investment is ${product.minimum_amount}` });
    }

    const walletResult = await client.query('SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    const wallet = walletResult.rows[0];
    if (!wallet || Number(wallet.balance) < principal) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const expectedProfit = principal * (Number(product.annual_rate) / 100) * (Number(product.duration_days) / 365);
    const investmentResult = await client.query(
      `INSERT INTO investments (user_id, product_id, principal, expected_profit, matures_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 day'))
       RETURNING id, product_id AS "productId", principal, expected_profit AS "expectedProfit", status,
                 started_at AS "startedAt", matures_at AS "maturesAt"`,
      [req.user.id, productId, asMoney(principal), asMoney(expectedProfit), product.duration_days],
    );
    const newBalance = Number(wallet.balance) - principal;
    await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2', [asMoney(newBalance), wallet.id]);
    await client.query(
      `INSERT INTO wallet_ledger (wallet_id, entry_type, amount, balance_after, reference, description)
       VALUES ($1, 'investment', $2, $3, $4, 'Investment created')`,
      [wallet.id, asMoney(principal), asMoney(newBalance), `investment:${investmentResult.rows[0].id}`],
    );
    await client.query('COMMIT');
    return res.status(201).json({ investment: investmentResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT i.id, i.product_id AS "productId", p.name AS "productName", i.principal,
              i.expected_profit AS "expectedProfit", i.status, i.started_at AS "startedAt",
              i.matures_at AS "maturesAt", i.matured_at AS "maturedAt"
       FROM investments i JOIN investment_products p ON p.id = i.product_id
       WHERE i.user_id = $1 ORDER BY i.started_at DESC, i.id DESC`,
      [req.user.id],
    );
    return res.json({ investments: result.rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;