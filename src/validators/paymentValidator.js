const parseAmount = (value) => {
  const amount = String(value ?? '').trim();
  return /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0 ? amount : null;
};

const depositMethods = ['mpesa', 'usdt_trc20'];
const withdrawalMethods = ['mpesa', 'airtel', 'usdt_trc20'];

const validateDeposit = (body) => {
  const amount = parseAmount(body.amount);
  const method = String(body.method || '').trim();
  const reference = String(body.reference || '').trim();

  if (!amount) return { error: 'A positive amount is required' };
  if (!depositMethods.includes(method)) return { error: `Method must be one of: ${depositMethods.join(', ')}` };
  if (!reference) return { error: 'A transaction reference is required' };

  return { value: { amount, method, reference } };
};

const minimumWithdrawal = 500;

const validateWithdrawal = (body) => {
  const amount = parseAmount(body.amount);
  const method = String(body.method || '').trim();
  const destination = String(body.account || body.destination || '').trim();

  if (!amount) return { error: 'A positive amount is required' };
  if (Number(amount) < minimumWithdrawal) return { error: `Minimum withdrawal is ${minimumWithdrawal}` };
  if (!withdrawalMethods.includes(method)) return { error: `Method must be one of: ${withdrawalMethods.join(', ')}` };
  if (!destination) return { error: 'A destination account is required' };

  return { value: { amount, method, destination } };
};

module.exports = { validateDeposit, validateWithdrawal, depositMethods, withdrawalMethods, minimumWithdrawal };
