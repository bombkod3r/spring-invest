# Springs Invests — Backend

Express + PostgreSQL API for Springs Invests, plus the connected frontend (`public/index.html`), served by this same app. The frontend only displays information and sends requests — every balance, approval, and calculation decision is made here and in PostgreSQL. The frontend never writes a wallet balance directly.

This guide walks through running the whole thing locally from scratch.

## 1. Prerequisites

You'll need:

- **Node.js 18+** — check with `node -v`
- **PostgreSQL 14+**, installed and running — check with `pg_isready`
- `npm` (comes with Node)

If PostgreSQL isn't installed:

- **Ubuntu/WSL**: `sudo apt install postgresql postgresql-contrib`
- **macOS**: `brew install postgresql@16 && brew services start postgresql@16`

## 2. Create a database and database user

Open `psql` as the postgres superuser and create a dedicated role + database for this project (pick your own password):

```bash
sudo -u postgres psql
```

```sql
CREATE USER springs_user WITH PASSWORD 'choose-a-password';
CREATE DATABASE springs_invests OWNER springs_user;
\q
```

## 3. Install dependencies

```bash
npm install
```

## 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set:

```
DATABASE_URL=postgresql://springs_user:choose-a-password@localhost:5432/springs_invests
JWT_SECRET=<any long random string>
FRONTEND_URL=http://localhost:5000
```

Generate a random `JWT_SECRET` if you need one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env` is gitignored — never commit it.

## 5. Initialize the database schema

This creates all the tables and seeds the investment products (Silver/Gold/Diamond/Platinum/Gem):

```bash
npm run db:init
```

Re-running this command later is safe — it won't touch existing user data, and it will re-sync the investment product numbers if `src/database/schema.sql` changes.

## 6. Start the server

```bash
npm run dev
```

This starts the API (and serves the frontend) with auto-restart on file changes. Use `npm start` instead for a plain run without auto-restart.

You should see:

```
Springs backend listening on port 5000
```

Confirm it's healthy:

```bash
curl http://localhost:5000/api/health
```

Expected response: `{"status":"ok","service":"springs-backend","database":"connected",...}`

## 7. Open the app

Go to **http://localhost:5000** in your browser. You'll land on the login page — click **Sign up** to create a regular user account.

## 8. Create an admin account (optional, for the admin panel)

Admin accounts aren't created through the UI — run this once per admin:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=choose-a-long-password npm run admin:create
```

Then in the app, click **Administrator login** at the bottom of the login page and sign in with those credentials. From there you can approve/reject pending deposits and withdrawals, and view users and the activity log.

Re-running `admin:create` with the same `ADMIN_USERNAME` updates that account's password instead of creating a duplicate.

## Trying it out

1. Sign up as a regular user.
2. Go to **Deposit**, choose M-Pesa, and submit any amount with a made-up transaction code (deposits are manually reviewed, so nothing needs to actually be paid in local dev).
3. Log in as admin in another browser tab (or after logging out) and approve the deposit — the user's wallet balance updates.
4. Back as the user, invest in a product and request a withdrawal — note the wallet balance is debited immediately when a withdrawal is requested (funds are reserved), and refunded automatically if the admin rejects it.

## Project structure

```
server.js                  Express app entrypoint, route mounting, maturity sweep
public/index.html          The connected frontend (served statically)
src/
├── routes/                Express routers — one per resource
├── controllers/           Request handling: validate → call services/models → respond
├── services/              Business logic (investment calculations/maturity, payment stubs)
├── models/                SQL queries, one file per table group
├── middleware/             Auth (JWT), admin-role gate, rate limiting
├── validators/             Input validation for each request body shape
├── scripts/create-admin.js  One-off script to create/update an admin user
└── database/
    ├── schema.sql          Full table definitions + seed data
    └── db.js               PostgreSQL connection pool
```

## API overview

- **Auth** — `POST /api/auth/{signup,login,logout,forgot-password,reset-password}`
- **Profile** — `GET/PUT /api/users/me`
- **Wallet** — `GET /api/wallet` (read-only)
- **Transactions** — `GET /api/transactions` (read-only ledger)
- **Deposits** — `POST/GET /api/deposits`
- **Withdrawals** — `POST/GET /api/withdrawals`
- **Investments** — `GET /api/investments/products`, `POST/GET /api/investments`, `GET /api/investments/:id`
- **Admin** — `POST /api/admin/login`, `GET /api/admin/{stats,users,deposits,withdrawals,activity}`, `POST /api/admin/{deposits,withdrawals}/:id/{approve,reject}`
- **Payments** — `POST /api/payments/{mpesa,crypto}` (thin wrappers over the deposits flow)

Users only ever see their own wallet/transactions/investments. Admin endpoints require the `admin` role and are otherwise rejected with `403`. Auth and admin-login endpoints are rate-limited.

## Known limitations (read before using this beyond local dev)

- **Password reset has no delivery channel.** In development, the API returns the reset token directly in the response so the frontend can chain the reset automatically. In production (`NODE_ENV=production`) that token is withheld, and the flow currently has no email/SMS to send it through — it will tell the user to contact support instead. Wire up a real delivery mechanism before launch.
- **Airtel Money deposits are disabled** in the frontend (no receiving account is configured for them yet) — Airtel still works for withdrawals.
- **Deposits/withdrawals are manually verified by an admin**, not automatically confirmed against M-Pesa/Airtel/blockchain APIs. See `src/services/{mpesa,airtel,crypto}.js` for where automated verification would plug in later.

## Deployment

`railway.json` starts the service with `npm start` and uses `/api/health` as the health check. Set `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and `NODE_ENV=production` as environment variables on the host — never hard-code secrets into the source.
