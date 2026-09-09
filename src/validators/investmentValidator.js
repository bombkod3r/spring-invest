const validateInvestmentCreate = (body) => {
  const productId = Number.parseInt(body.productId, 10);
  const amount = Number(body.amount);

  if (!Number.isInteger(productId) || productId <= 0) {
    return { error: 'A valid productId is required' };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'A positive investment amount is required' };
  }
  return { value: { productId, amount } };
};

module.exports = { validateInvestmentCreate };
