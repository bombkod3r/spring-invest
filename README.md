## Springs backend

Express and PostgreSQL API for Springs Invests, organized as `routes → controllers → services/models → validators` per the project blueprint. The frontend only displays information and sends requests; every balance, approval, and calculation decision is made here and in PostgreSQL.

### Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `JWT_SECRET`.
2. Install dependencies with `npm install`.
3. Initialize the tables with `npm run db:init`.
4. Start the API with `npm run dev`.

The API listens on `PORT` (default `5000`). The health endpoint is `GET /api/health` and checks both the API process and PostgreSQL connection.

### Accounts

Users authenticate by `username` (not email). Endpoints under `/api/auth`: `POST /signup`, `POST /login`, `POST /logout`, `POST /forgot-password`, `POST /reset-password`. Profile access is under `/api/users`: `GET /me`, `PUT /me`. Passwords are hashed with bcrypt, sessions are persisted in PostgreSQL, and protected requests use `Authorization: Bearer <token>`. Login and signup are rate-limited (`src/middleware/rateLimit.js`).

Administrator access uses a separate endpoint, `POST /api/admin/login`, and only users with the database `admin` role can reach `/api/admin/*`. Create or rotate the administrator with `ADMIN_USERNAME=... ADMIN_PASSWORD=... npm run admin:create`; keep those values only in the deployment environment.

### Wallet, deposits, withdrawals

`GET /api/wallet` and `GET /api/transactions` are read-only; the frontend never writes a balance directly. `POST /api/deposits` creates a pending request (duplicate transaction references are rejected); an admin must call `POST /api/admin/deposits/:id/approve` or `/reject` before the wallet is credited. `POST /api/withdrawals` validates balance and **debits the wallet immediately**, reserving the funds for that request — this is what stops two concurrent withdrawal requests from both being approved against the same balance. Rejecting a withdrawal refunds the reservation. `POST /api/payments/mpesa` and `/api/payments/crypto` are thin wrappers over the deposits flow.

### Investments

`GET /api/investments/products`, `POST /api/investments`, `GET /api/investments`, `GET /api/investments/:id`. Investment creation debits the wallet and records a ledger entry atomically; profit and payout are computed and stored server-side at creation time, never trusted from the client. Maturity is processed lazily (on every `GET /api/investments` call for that user) and via a backstop sweep (`setInterval` in `server.js`, every 5 minutes) that credits any matured investment's payout to its owner's wallet.

**The seeded Silver/Gold/Diamond/Platinum/Gem products in `src/database/schema.sql` are placeholders** — minimum/maximum amount, duration, and return rate must be replaced with the real values from the existing frontend before launch. Gem's daily-profit-availability and capital-withdrawal rules are also not yet finalized; it currently matures like a standard product (see `src/services/investment.js`).

### Deployment

The included `railway.json` starts the service with `npm start` and uses `/api/health` as the deployment health check. Configure `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and `NODE_ENV=production` in the host's environment settings.
