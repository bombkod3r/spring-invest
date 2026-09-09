require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const healthRouter = require('./src/routes/health');
const authRouter = require('./src/routes/auth');
const usersRouter = require('./src/routes/users');
const walletRouter = require('./src/routes/wallet');
const transactionsRouter = require('./src/routes/transactions');
const depositsRouter = require('./src/routes/deposits');
const withdrawalsRouter = require('./src/routes/withdrawals');
const investmentsRouter = require('./src/routes/investments');
const adminRouter = require('./src/routes/admin');
const paymentsRouter = require('./src/routes/payments');
const { apiLimiter } = require('./src/middleware/rateLimit');
const { processMaturitySweep } = require('./src/services/investment');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
	throw new Error('JWT_SECRET must be configured in production');
}

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || '')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({
	origin: allowedOrigins.length > 0 ? allowedOrigins : true,
	credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/api', apiLimiter);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/deposits', depositsRouter);
app.use('/api/withdrawals', withdrawalsRouter);
app.use('/api/investments', investmentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payments', paymentsRouter);

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
	console.error(error);
	res.status(500).json({ error: 'Internal server error' });
});

const port = Number.parseInt(process.env.PORT || '5000', 10);
const maturitySweepIntervalMs = 5 * 60 * 1000;

if (require.main === module) {
	app.listen(port, () => {
		console.log(`Springs backend listening on port ${port}`);
	});

	setInterval(() => {
		processMaturitySweep().catch((error) => {
			console.error('Investment maturity sweep failed', error);
		});
	}, maturitySweepIntervalMs);
}

module.exports = app;
