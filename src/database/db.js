const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
	? { connectionString: process.env.DATABASE_URL }
	: {
			host: process.env.DB_HOST || 'localhost',
			port: Number.parseInt(process.env.DB_PORT || '5432', 10),
			database: process.env.DB_NAME || 'springs_invests',
			user: process.env.DB_USER || 'postgres',
			password: process.env.DB_PASSWORD,
		};

if (process.env.NODE_ENV === 'production') {
	poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

pool.on('error', (error) => {
	console.error('Unexpected PostgreSQL pool error', error);
});

const query = (text, params) => pool.query(text, params);

const checkDatabaseConnection = async () => {
	await pool.query('SELECT 1');
	return true;
};

module.exports = { pool, query, checkDatabaseConnection };
