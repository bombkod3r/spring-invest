## Springs backend

Express and PostgreSQL API for Springs Invests.

### Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `JWT_SECRET`.
2. Install dependencies with `npm install`.
3. Initialize the tables with `npm run db:init`.
4. Start the API with `npm run dev`.

The API listens on `PORT` (default `5000`). The health endpoint is `GET /api/health` and checks both the API process and PostgreSQL connection.

### Accounts

The account endpoints are under `/api/auth`: `POST /signup`, `POST /login`, `POST /logout`, `GET /me`, `POST /password-reset/request`, and `POST /password-reset/confirm`. Passwords are hashed with bcrypt, sessions are persisted in PostgreSQL, and protected requests use `Authorization: Bearer <token>`.

Administrator access uses a separate endpoint, `POST /api/admin/login`, and only users with the database `admin` role can access the dashboard and review endpoints. Create or rotate the administrator with `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create`; keep those values only in the deployment environment.

Investment endpoints are under `/api/investments`: `GET /products`, `POST /`, and `GET /`. Investment creation debits the user's wallet and records a ledger entry atomically. The seeded Gem product currently models a one-day cycle; daily profit availability and capital withdrawal rules will be added once those exact product rules are confirmed.

### Deployment

The included `railway.json` starts the service with `npm start` and uses `/api/health` as the deployment health check. Configure `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and `NODE_ENV=production` in the host's environment settings.
