// A pasted USDT/TRC20 transaction ID does not by itself prove payment was
// made. This hook is where a TRON network / TRC20 contract lookup against the
// receiving address would plug in later; until then deposits and withdrawals
// are verified manually by an admin.
const verifyTransactionId = async (transactionId) => ({ verified: false, transactionId, reason: 'manual_review_required' });

module.exports = { verifyTransactionId };
