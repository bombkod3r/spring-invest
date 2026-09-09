require('dotenv').config();

const express = require('express');
const cors = require('cors');
const healthRouter = require('./src/routes/health');
const authRouter = require('./src/routes/auth');
const walletRouter = require('./src/routes/wallet');
const adminRouter = require('./src/routes/admin');
const investmentsRouter = require('./src/routes/investments');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
	throw new Error('JWT_SECRET must be configured in production');
}

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || '')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
	origin: allowedOrigins.length > 0 ? allowedOrigins : true,
	credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
	res.json({ name: 'springs-backend', status: 'ok' });
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/admin', adminRouter);
app.use('/api/investments', investmentsRouter);

app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
	console.error(error);
	res.status(500).json({ error: 'Internal server error' });
});

const port = Number.parseInt(process.env.PORT || '5000', 10);

if (require.main === module) {
	app.listen(port, () => {
		console.log(`Springs backend listening on port ${port}`);
	});
}

module.exports = app;
