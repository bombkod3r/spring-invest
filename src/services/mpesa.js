// M-Pesa deposits are currently verified manually by an admin against the
// Till number statement (see adminController.approveDeposit). This hook is
// where an automated STK-push / C2B confirmation lookup would plug in later.
const verifyDepositReference = async (reference) => ({ verified: false, reference, reason: 'manual_review_required' });

module.exports = { verifyDepositReference };
