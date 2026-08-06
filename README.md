# GymPro

Gym management for a single gym: members, attendance, fees, workout and diet
plans, and supplement stock — with owner / staff / member accounts.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + Tailwind v4, TypeScript |
| Backend | Express 5 + Prisma 7, TypeScript (ESM) |
| Database | PostgreSQL |
| Auth | JWT in an httpOnly cookie, bcrypt, optional Google sign-in |

## Roles

| Role | Can do |
|---|---|
| **owner** | Everything, plus staff accounts, member logins and ownership transfer |
| **staff** | Members, attendance, payments, plans, supplements |
| **member** | Only their own plan, attendance and dues |

Public signup creates a **new gym**, and that account becomes its owner. Members
never sign themselves up — the owner creates a member record and then issues a
login for it.

## Running it

Everything Docker-related lives in `docker/`, so `backend/` and `frontend/`
hold nothing but app code:

```sh
cd docker
cp .env.example .env      # fill in the values
docker compose up -d --build
```

Then open <http://localhost:8080>. Three containers come up — Postgres, the
API, and nginx serving the built frontend and proxying `/api`. Only nginx is
published; the API and database stay on the internal network. See
[docker/README.md](docker/README.md) for details.

### Without Docker

```sh
# backend
cd backend
cp .env.example .env      # set DATABASE_URL and a 32+ char JWT_SECRET
npm install
npx prisma migrate deploy
npm run dev               # http://localhost:5000

# frontend (second terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173, proxies /api to the backend
```

## Scripts

```sh
# backend
npm run dev         # tsx watch
npm run build       # tsc -> dist/
npm run typecheck
npm run db:migrate

# frontend
npm run dev
npm run build       # tsc -b && vite build
npm run typecheck
npm run lint
```

## API

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/register` | public — creates a gym + owner |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/google` | public — links to an existing account only |
| POST | `/api/auth/forgot-password` | public |
| POST | `/api/auth/reset-password` | public |
| POST | `/api/auth/logout` | public |
| GET | `/api/auth/me` | any signed-in account |
| POST | `/api/auth/change-password` | any signed-in account |
| GET | `/api/me` | any signed-in account — own record only |
| GET | `/api/users` | staff |
| POST | `/api/users/staff` | owner |
| POST | `/api/users/member-login` | owner |
| POST | `/api/users/transfer-ownership` | owner |
| PUT/DELETE | `/api/users/:id` | owner |
| — | `/api/members`, `/api/attendance`, `/api/payments`, `/api/plans`, `/api/supplements`, `/api/dashboard` | staff |

## Security notes

- The session JWT is set as an **httpOnly, SameSite=Lax cookie**, so page
  scripts cannot read it and cross-site requests do not carry it. A `Bearer`
  header is still accepted for non-browser clients.
- Set `HTTPS=true` in the Docker env once the app is behind TLS, so the cookie
  is marked `Secure`. It is off by default because browsers refuse to store a
  Secure cookie over plain http.
- The role is read from the database on every request, so revoking an account
  takes effect immediately rather than when its 30-day token expires.
- Every query is scoped by `gymId`; one gym can never read another's data.
- All request bodies, params and query strings are validated with Zod.
- Password reset tokens are stored only as a SHA-256 hash, expire in one hour
  and are single-use.

### Email is not wired up yet

`forgot-password` writes the reset link to the server log instead of sending
mail. Replace the `console.log` in `backend/src/controllers/authController.ts`
with a real transport when SMTP is available.

### Google sign-in

Optional and off unless configured. Create an OAuth 2.0 Web client at
<https://console.cloud.google.com/apis/credentials>, add your origin to the
authorised JavaScript origins, then set:

- `GOOGLE_CLIENT_ID` for the backend
- `VITE_GOOGLE_CLIENT_ID` for the frontend

The button hides itself when no client id is set.
