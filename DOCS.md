# GymPro — Documentation

Gym management for a single gym: members, attendance, fees, workout and diet
plans, and supplement stock — with owner / staff / member accounts.

- [Stack](#stack)
- [Roles and access](#roles-and-access)
- [Running it](#running-it)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [API reference](#api-reference)
- [How the data fits together](#how-the-data-fits-together)
- [Security notes](#security-notes)
- [Email](#email)
- [Google sign-in](#google-sign-in)
- [Tests](#tests)
- [CI](#ci)
- [Known gaps](#known-gaps)

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + Tailwind v4, TypeScript |
| Backend | Express 5 + Prisma 7, TypeScript (ESM) |
| Database | PostgreSQL |
| Auth | JWT in an httpOnly cookie, bcrypt, optional Google sign-in |
| Mail | Resend HTTP API, or plain SMTP — both optional |

Layout: `backend/` and `frontend/` hold nothing but app code; everything
Docker-related lives in `docker/`.

## Roles and access

| Role | Can do |
|---|---|
| **owner** | Everything, plus staff accounts, member logins and ownership transfer |
| **staff** | Members, attendance, payments, plans, supplements |
| **member** | Only their own plan, attendance and dues |

Public signup creates a **new gym**, and that account becomes its owner.
Members never sign themselves up — the owner creates a member record, then
issues a login for it, which sends an invite the recipient activates by
choosing their own password. The owner never knows that password.

## Running it

```sh
cd docker
cp .env.example .env      # fill in the values
docker compose up -d --build
```

Then open <http://localhost:8080>. Three containers come up — Postgres, the
API, and nginx serving the built frontend and proxying `/api`. Only nginx is
published; the API and database stay on the internal network. See
[docker/README.md](docker/README.md) for details.

Check it is alive with `curl http://localhost:8080/api/health`, which answers
`{"status":"ok"}`.

`VITE_` variables are baked in at build time, so changing one needs a rebuild,
not just a restart:

```sh
docker compose up -d --build frontend
```

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

## Configuration

Backend variables (`backend/.env`, or the `docker/.env` equivalents):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET` | yes | 32+ characters — `openssl rand -base64 48`. Changing it signs everyone out |
| `APP_URL` | yes | How the app is reached in a browser. Invite and reset links are built from it, so a wrong value produces links that go nowhere |
| `PORT` | no | Defaults to 5000 |
| `HTTPS` | no | `true` once behind TLS, so the session cookie is marked `Secure` |
| `CORS_ORIGIN` | no | Comma-separated origins. Leave unset when frontend and API share an origin |
| `RESEND_API_KEY` | no | See [Email](#email) |
| `MAIL_FROM` / `SMTP_*` | no | See [Email](#email) |
| `GOOGLE_CLIENT_ID` | no | See [Google sign-in](#google-sign-in) |

Frontend: `VITE_GOOGLE_CLIENT_ID` only, and only for Google sign-in.

In Docker, `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` set up the
database container. **Changing `POSTGRES_PASSWORD` after first start makes the
existing volume unreadable** — leave it alone unless you mean it.

## Scripts

```sh
# backend
npm run dev         # tsx watch
npm run build       # tsc -> dist/
npm run start       # node dist/index.js
npm run typecheck
npm run test        # vitest run
npm run test:watch
npm run db:migrate  # prisma migrate dev
npm run db:generate
npm run db:seed

# frontend
npm run dev
npm run build       # tsc -b && vite build
npm run typecheck
npm run lint
```

## API reference

All paths are under `/api`. Access is the *minimum* role; owner can reach
everything staff can.

### Auth — `/api/auth`

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/register` | public | Creates a gym + its owner |
| POST | `/login` | public | |
| POST | `/google` | public | Links to an existing account only — never creates one |
| POST | `/forgot-password` | public | Always answers the same, whether or not the address exists |
| POST | `/reset-password` | public | |
| GET | `/invite` | public | Validates an invite token before showing the form |
| POST | `/accept-invite` | public | Recipient sets their own password |
| POST | `/logout` | public | |
| GET | `/me` | signed-in | |
| POST | `/change-password` | signed-in | |

### Members — `/api/members`

| Method | Path | Access |
|---|---|---|
| GET / POST | `/` | staff |
| GET / PUT / DELETE | `/:id` | staff |
| GET | `/:id/memberships` | staff |
| POST | `/:id/memberships/:membershipId/extend` | owner — grants extra days, reason required |

`GET /members` is paged and takes `search`, `status`, `page` and `limit` (max
100, default 25). Searching and the status tabs run on the server, so a search
covers the whole roster rather than the page in hand.

`status` is one of `active`, `expiring`, `expired`, `lapsed` or `none`. None of
these is a stored column — every one is derived from the expiry date against
today — so the filter becomes date arithmetic in SQL. `memberStatusWhere` in
`services/membership.ts` is that translation, and it has to keep agreeing with
`displayStatus` and `isLapsed` beside it.

With no `status`, the list omits lapsed members, which is what "everyone still
on the books" means. A `search` overrides that: somebody typing a name wants
that person found.

The response adds `counts` — a figure per tab over the whole roster, so a tab
does not relabel itself as you page. The counts follow the current search but
not the current tab, or every other tab would read zero the moment one was
picked.

`?all=true` returns every member for the pickers that need a complete list (the
payment form's dropdown cannot offer only the first 25 people in the gym). That
response **drops photos**, which are base64 data-URLs of up to 2MB stored inline
and the only reason a full list is expensive. It includes lapsed members, who
are exactly who the front desk is about to sell a renewal to.

### Supplements — `/api/supplements`

| Method | Path | Access |
|---|---|---|
| GET / POST | `/` | staff |
| PUT / DELETE | `/:id` | staff |
| POST | `/:id/sell` | staff — decrements stock, records the sale |
| POST | `/:id/restock` | staff — stock in from a supplier |
| GET | `/sales/report` | owner — month-by-month sales revenue |

### Payments — `/api/payments`

| Method | Path | Access |
|---|---|---|
| GET / POST | `/` | staff |
| GET | `/due` | staff — `paid` and `outstanding` per membership |
| DELETE | `/:id` | staff |

`GET /payments` is paged on the same terms as `/members`, alongside its existing
`status`, `type`, `search`, `from` and `to` filters.

It also returns `collected` and `outstanding`, totalled over **everything
matching the filters** rather than over the page. The tiles above the table say
"matching filters", and a figure that quietly totalled the first 25 rows while
claiming that would be wrong in the one direction money must never be wrong.
They are summed with `groupBy` in the database, because summing a page in the
client can only ever total the page — and they narrow with the staff scoping, so
a staff member's total covers their own takings and not the gym's.

### Attendance — `/api/attendance`

| Method | Path | Access |
|---|---|---|
| POST | `/checkin` | staff |
| GET | `/today` | staff |
| GET | `/member/:id` | staff |

### Plans — `/api/plans`

| Method | Path | Access |
|---|---|---|
| GET / POST | `/workout` | staff |
| GET / POST | `/diet` | staff |
| POST | `/assign` | staff |
| GET | `/member/:id` | staff |

### Users, and the rest

| Method | Path | Access |
|---|---|---|
| GET | `/users` | staff |
| POST | `/users/staff` | owner |
| POST | `/users/member-login` | owner |
| POST | `/users/transfer-ownership` | owner |
| PUT / DELETE | `/users/:id` | owner |
| GET | `/me` | signed-in — own record only |
| GET | `/membership-plans`, POST, PUT/DELETE `/:id` | staff |
| GET | `/dashboard` | staff |
| GET | `/audit-logs` | owner |
| GET | `/health` | public |

## How the data fits together

- A **member** is a person in the gym. A **membership** is one paid stretch of
  time for that member; extending one grants extra days and records a reason.
- A **payment** carries a `type` (`membership` / `supplement` / `other`) and an
  optional `membershipId` naming what it settled. The link is nullable because
  a supplement sale, or a renewal recorded as due, has no membership behind it.
- `GET /payments/due` uses that link to report `paid` and `outstanding` per
  membership, which keeps **"expired"** and **"owes money"** as separate facts.
  A member can be current but behind on fees, or paid up but lapsed.
- Selling a supplement decrements stock and writes a sale row, so the sales
  report is derived from real movements rather than a running total someone
  can edit.

## Security notes

- The session JWT is set as an **httpOnly, SameSite=Lax cookie**, so page
  scripts cannot read it and cross-site requests do not carry it. A `Bearer`
  header is still accepted for non-browser clients.
- Set `HTTPS=true` once the app is behind TLS, so the cookie is marked
  `Secure`. It is off by default because browsers refuse to store a Secure
  cookie over plain http.
- The role is read from the database on every request, so revoking an account
  takes effect immediately rather than when its 30-day token expires.
- Every query is scoped by `gymId`; one gym can never read another's data.
- All request bodies, params and query strings are validated with Zod.
- Money is stored as `Decimal(10,2)`, never a float, so the books add up to the
  paisa. Prisma hands back a `Decimal` and would serialise it as a *string*, so
  `services/money.ts` converts at the API boundary — the JSON contract is plain
  numbers. Sum money with its `sum()` helper rather than `+`.
- Password reset and invite tokens are stored only as a SHA-256 hash, expire,
  and are single-use.
- `forgot-password` answers identically whether or not the address exists, and
  a mail failure is logged rather than thrown — so the response never leaks
  which accounts are real.

## Email

Optional. `backend/src/services/mail.ts` supports two transports and picks
**Resend when both are configured**, being the one that needs no ports open:

| Transport | Set | Notes |
|---|---|---|
| Resend | `RESEND_API_KEY` | Easiest — one API key, no DNS. Leave `MAIL_FROM` unset to send from `onboarding@resend.dev`, which needs no domain verification |
| SMTP | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT` | Works with an account you already have. Gmail needs an **App Password**, not your normal password |

With neither set the app still runs: invite and password-reset links are
printed to the server log (`docker compose logs backend`) instead of emailed.
Both flows stay usable — you just copy the link out of the console.

Port note: implicit TLS on 465, STARTTLS on 587. Forcing `secure` on 587 makes
the connection hang rather than fail cleanly.

Gmail rewrites `From` to the authenticated account, so `SMTP_FROM` is cosmetic
there. Resend refuses a `From` on an unverified domain.

## Google sign-in

Optional and off unless configured, and it **only links to an account that
already exists** — it is not a second way to sign up. Create an OAuth 2.0 Web
client at <https://console.cloud.google.com/apis/credentials>, add your origin
to the authorised JavaScript origins, then set:

- `GOOGLE_CLIENT_ID` for the backend
- `VITE_GOOGLE_CLIENT_ID` for the frontend

The button hides itself when no client id is set. Rebuild the frontend after
changing it — `VITE_` values are compiled in.

## Tests

Vitest, on the backend, run with `npm test` in `backend/` — 167 tests across
two layers.

### Unit tests

53 tests over the pure logic where a silent mistake costs the most:

- **`services/money.ts`** — that Decimal arithmetic stays exact where floats
  drift (`0.1 + 0.2`, ten `0.10` payments), that null money stays null rather
  than becoming `0`, and that a converted row serialises as `2500` and not
  `"2500"`.
- **`services/membership.ts`** — the date-derived rules: the inclusive
  `expiring` boundary, the strict "more than 60 days" lapse rule, a stored
  `cancelled`/`suspended` winning over the calendar, a hand-set `inactive`
  surviving a renewal, and `daysUntil` counting from midnight so a membership
  does not flip to expired when the clock passes the hour it was sold at.

These need no database — they are pure functions taking an injected `now`, so
they are deterministic and run in under a second.

### Integration tests

114 tests driving the real Express app over HTTP with supertest, against a real
Postgres. Files are named `*.integration.test.ts` and cover:

- **`auth`** — registration, login, sessions and rate limiting. That a null
  password hash cannot sign in with *any* password, that login answers
  identically for a wrong password and an unknown address, that deactivating
  an account or bumping `tokenVersion` strands existing cookies immediately,
  and that the reset token is stored only as a SHA-256 digest.
- **`isolation`** — tenant scoping, the most important property in the app.
  Two real gyms, with A aiming requests at B's rows: reads, updates, deletes,
  selling from B's stock, paying against B's member. Also that a `gymId` in a
  request body is ignored in favour of the session's.
- **`roles`** — the owner > staff > member boundary on every guarded route,
  plus that a role change binds on the very next request.
- **`payments`** — money end to end: that amounts cross the API as numbers and
  not `"2500"`, that dues arithmetic stays exact over ten `0.10` payments, and
  that overpaying never produces a negative outstanding.

**How the database is handled.** `src/test/setup.ts` drops and recreates a
`gymapp_test` database once per run, applies the real migration files with
`prisma migrate deploy`, and repoints `DATABASE_URL` at it before any app
module loads. Your development database is never touched — the suite truncates
every table between tests, so pointing it at real data would wipe it. Tests run
single-file for that reason.

Requires a reachable Postgres: `DATABASE_URL` in `backend/.env` supplies the
host and credentials, and the account needs rights to create a database.

Two small accommodations exist in `src/index.ts`: the app is exported and only
calls `listen` outside `NODE_ENV=test`, and the auth rate limiter skips
requests carrying a test header. The limiter itself is still exercised — three
tests drive it with the bypass off, so the accommodation cannot hide a limiter
that has stopped working.

### Not covered

Google sign-in, the invite and password-reset flows end to end (token
generation is tested; clicking the emailed link is not), plan assignment,
supplement restocking and the sales report, audit-log contents, and the
frontend, which has no tests at all.

## CI

`.github/workflows/test.yml` runs on every push to `main` and on every pull
request, as two independent jobs:

| Job | Steps |
|---|---|
| **backend** | `npm ci` → `prisma generate` → `typecheck` → `test` |
| **frontend** | `npm ci` → `typecheck` → `lint` → `build` |

Postgres comes from a `postgres:17-alpine` service container with a
`pg_isready` health check, matching the version in `docker-compose.yml`. Node is
22, matching the Dockerfiles.

Two things are easy to get wrong here:

- **`prisma generate` is a required step.** The generated client is not
  committed — `npm ci` wipes `node_modules`, so anything importing
  `@prisma/client` fails to typecheck until it is regenerated. It also needs
  `DATABASE_URL` set, because `prisma.config.ts` reads it at config load.
- **There is no `migrate deploy` step.** `src/test/setup.ts` drops, recreates
  and migrates `gymapp_test` itself, so migrating beforehand would only prepare
  a database the suite immediately throws away. `DATABASE_URL` connects as
  `postgres` because that setup needs rights to `CREATE DATABASE`.

The frontend has no tests, so `build` stands in for one: it catches an import
that does not resolve or a bundle that cannot be produced, neither of which
`typecheck` alone will find.

## Known gaps

- **No frontend tests.** The backend is covered at both layers; React
  components and the API client are not. CI compensates only as far as a build
  goes — it proves the bundle compiles, not that a page behaves.
- **No database backup.** Postgres data lives only in a Docker volume; a real
  deployment wants a scheduled `pg_dump`.
- **`GET /supplements` is unbounded.** Left that way deliberately: a gym stocks
  tens of products, not thousands, and the category counts on the page are
  computed from the whole list. It is the one list where paging would cost more
  than it saves — revisit it if a gym ever carries hundreds of lines.
- **The payments CSV exports what has been loaded**, not every match, now that
  the list is paged. The toast says so ("Exported 50 of 213"), and pressing Show
  more first widens it. A server-side export would be the honest fix.
- `HTTPS=false` suits localhost, but must be flipped for any real deployment.
