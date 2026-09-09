CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(20, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Single authoritative ledger for every money-moving event (deposits, withdrawals,
-- investments, profit, capital returns). `deposits`/`withdrawals` hold the
-- request-specific detail (method, reference, destination); this table is the
-- append-only record of what actually happened to the wallet.
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'investment', 'profit', 'capital_return')),
  method TEXT,
  amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
  fee NUMERIC(20, 2) NOT NULL DEFAULT 0,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deposits (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('mpesa', 'usdt_trc20')),
  reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  transaction_id BIGINT REFERENCES transactions(id),
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
  fee NUMERIC(20, 2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL CHECK (method IN ('mpesa', 'airtel', 'usdt_trc20')),
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  transaction_id BIGINT REFERENCES transactions(id),
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_activity (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id BIGINT,
  description TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investment_products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  minimum_amount NUMERIC(20, 2) NOT NULL CHECK (minimum_amount > 0),
  maximum_amount NUMERIC(20, 2) NOT NULL CHECK (maximum_amount >= minimum_amount),
  return_rate NUMERIC(8, 4) NOT NULL CHECK (return_rate >= 0),
  duration_hours INTEGER NOT NULL CHECK (duration_hours > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investments (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES investment_products(id),
  amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0),
  profit NUMERIC(20, 2) NOT NULL CHECK (profit >= 0),
  expected_payout NUMERIC(20, 2) NOT NULL CHECK (expected_payout >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'matured', 'completed', 'cancelled')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  maturity_date TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Values taken directly from the live frontend's `products` object
-- (springs_invests_manual_till_admin_ready.html). Re-running db:init keeps
-- these in sync with schema.sql if the numbers change.
INSERT INTO investment_products (name, description, minimum_amount, maximum_amount, return_rate, duration_hours)
VALUES
  ('Silver', 'Silver package.', 350, 1000, 12, 24),
  ('Gold', 'Gold package.', 1001, 10000, 18, 48),
  ('Diamond', 'Diamond package.', 10001, 50000, 20, 48),
  ('Platinum', 'Platinum package.', 50001, 200000, 25, 72),
  ('Gem', 'Gem package. Daily-profit-availability and capital-withdrawal rules pending confirmation.', 1000, 500000, 5, 24)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  minimum_amount = EXCLUDED.minimum_amount,
  maximum_amount = EXCLUDED.maximum_amount,
  return_rate = EXCLUDED.return_rate,
  duration_hours = EXCLUDED.duration_hours,
  updated_at = NOW();

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id);
CREATE INDEX IF NOT EXISTS deposits_user_id_idx ON deposits(user_id);
CREATE INDEX IF NOT EXISTS withdrawals_user_id_idx ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS admin_activity_created_at_idx ON admin_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS investments_user_id_idx ON investments(user_id);
CREATE INDEX IF NOT EXISTS investments_maturity_idx ON investments(status, maturity_date);
