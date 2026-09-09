// Airtel Money is currently only supported for withdrawals, disbursed and
// confirmed manually by an admin. This hook is where an automated disbursement
// API call would plug in later.
const verifyWithdrawalPayout = async (reference) => ({ verified: false, reference, reason: 'manual_review_required' });

module.exports = { verifyWithdrawalPayout };
