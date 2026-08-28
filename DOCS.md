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
- [Scheduled work](#scheduled-work)
- [Backups](#backups)
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

Then open <http://localhost:8080>. Four containers come up — Postgres, the API,
nginx serving the built frontend and proxying `/api`, and a [backup](#backups)
sidecar. Only nginx is published; everything else stays on the internal
network. See [docker/README.md](docker/README.md) for details.

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
| `REMINDER_CRON` | no | When the daily reminder runs, in the server's timezone. Defaults to `0 9 * * *` — nine in the morning. An invalid expression disables reminders and says so in the log rather than stopping the app |
| `RUN_JOBS` | no | `false` stops this process running scheduled work. Worth setting on all but one instance if you run several |

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
npm run retention:fingerprints              # preview expired fingerprints
npm run retention:fingerprints -- --delete  # and delete them

# frontend
npm run dev
npm run build       # tsc -b && vite build
npm run typecheck   # tsc -b — app and tests both
npm run lint
npm run test        # vitest run
npm run test:watch
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

A member can be checked in **once a day**. A repeat press answers `200` with the
existing row and `alreadyCheckedIn: true`, rather than `201` and a second row —
the desk's intent is already satisfied, and an error toast for a double press
trains staff to ignore errors. A `@@unique([memberId, checkedInOn])` backs it,
over a `GENERATED ALWAYS` date column, so the rule still holds when two
receptionists press the button in the same instant and both pass the check
before either insert lands.

The check-in **never blocks on membership state**. The response carries the
member's current membership instead — `expired`, `expiring`, `active`, or
`null` — so the front desk learns where they stand at the one moment it can do
something about it. Nothing else in the app locks an expired member out either:
the dashboard files them under people to phone, and somebody standing at the
counter with cash in hand is exactly who the gym wants inside.

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
- **Nothing a member sends can grant them anything.** See Online payments below.
- **Member photos are private.** The S3 bucket must not be public — see below.

## Member photos

A photograph of a person is personal data, and it is treated as such: the
bucket is private and no durable link to a photo exists anywhere.

- The row stores **`photoKey`** and never a URL. A URL that is worth storing is
  one that works without a signature, which is the thing being avoided.
- Every response mints a **signed URL valid for 5 minutes**
  (`SIGNED_URL_TTL_SECONDS` in `services/s3.ts`), served in the `photo` field
  the clients already render.
- `photoKey` is **stripped before the response**. It is the one input a URL is
  built from, so a client holding it holds the ingredient for an unsigned link.
- With no S3 configured, photos fall back to the legacy inline base64 `photo`
  column and everything still works — that is what the test suite exercises.

This replaced an earlier design that stored
`https://<bucket>.s3.<region>.amazonaws.com/photos/<id>/<uuid>.jpg` on the row
and uploaded with `CacheControl: public`. That link needed no login, never
expired, and could not be revoked; the uuid in the path was obscurity, not
access control, and such URLs escape through browser history, referrer headers
and any cache that touches the image. The `photoUrl` column was dropped rather
than emptied, so it cannot quietly come back.

### Securing the bucket

**The code change is only half of it.** An already-public bucket stays readable
until AWS is told otherwise:

```sh
aws s3api put-public-access-block --bucket "$S3_BUCKET_NAME" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Remove any bucket policy that granted public read
aws s3api delete-bucket-policy --bucket "$S3_BUCKET_NAME"
```

Then confirm an object is *not* reachable without a signature:

```sh
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://$S3_BUCKET_NAME.s3.$AWS_REGION.amazonaws.com/photos/<some-key>"
# expect 403
```

The IAM user the app runs as needs only `s3:PutObject`, `s3:GetObject` and
`s3:DeleteObject` on `arn:aws:s3:::<bucket>/photos/*` — signing is local
computation and needs no extra permission.

Photos uploaded while the bucket was public should be treated as already
disclosed: rotate them by re-uploading, since the old objects may sit in caches
and browser history regardless of what the bucket policy says now.

## Online payments

A member can renew or clear their dues from the portal. The rule the whole
design turns on: **starting a payment grants nothing.** `POST /checkout` writes
a `pending` PaymentIntent priced from the gym's own plan row — never from the
request — and returns a signed form for the provider. A Membership is created,
and a due is settled, only in the provider's callback, after:

1. the **signature** over the body verifies against the integrity salt, which
   the member does not have;
2. the **amount** in that callback equals the amount stored on the intent;
3. the intent is still `pending` and inside its one-hour window.

Callbacks are idempotent — `@@unique([provider, providerRef])` plus a
status-conditioned `updateMany` inside the settling transaction — so a provider
retrying, or the browser return racing the server-to-server post, cannot grant
a second membership. Membership and Payment are written in **one** transaction,
so neither can exist without the other.

`/callback/:provider` and `/return/:provider` are mounted **before** `auth`
deliberately: a provider carries no session cookie, and the signature is a
stronger claim than a session would be here — it proves the provider sent it.

Providers are pluggable (`services/gateways/`): JazzCash and Easypaisa ship,
and adding one means a file implementing `PaymentGateway` plus an enum value.
Watch the two things that differ between them — JazzCash amounts are in
**paisa** and signed with HMAC-SHA256, Easypaisa's are in **rupees** and hashed
with plain SHA-256.

With no gateway configured the flow still works: it files a front-desk request
that staff confirm with `canRecordPayments`. That path is restricted to the
`manual` provider, so the confirm button can never settle a real gateway
payment the provider never charged for.

### Setting a gateway up

Credentials come from the environment, so they are per **deployment**, not per
gym — one merchant account serves the whole instance. Get them by opening a
merchant account with JazzCash or Easypaisa; there is nothing to generate here.

In `backend/.env` for a local run, or `docker/.env` for the Docker stack:

```bash
APP_BASE_URL=https://api.yourgym.com   # see the warning below

JAZZCASH_MERCHANT_ID=MC12345
JAZZCASH_PASSWORD=abcdefghij
JAZZCASH_INTEGRITY_SALT=your-integrity-salt

EASYPAISA_STORE_ID=12345
EASYPAISA_HASH_KEY=your-hash-key
```

Restart the server. Whichever provider has all of its variables set appears in
the portal automatically; `manual` disappears once a real one is live.

Three things to get right:

- **`APP_BASE_URL` must be reachable from the provider's servers.** It is where
  they post the confirmation. Behind localhost, a private address, or an
  unforwarded port, the callback never arrives and every payment sits pending
  no matter how well the rest is configured. This is the usual cause of "the
  member paid but nothing happened".
- **The integrity salt and hash key are passwords, not identifiers.** They are
  what sign and verify callbacks — anyone holding one can forge a payment
  confirmation. They never belong in the repo, in a screenshot, or in a
  frontend build.
- **`JAZZCASH_POST_URL` defaults to sandbox.** Test there first, then set it to
  the live URL. A gym left on sandbox takes no real money.

## Expenses and profit

`Expense` is the other half of the books, and the reason a profit figure is
possible at all. Deliberately **not** a negative `Payment`: a payment belongs
to a member and settles something they owe, and every query over that table
assumes so — rent has no member.

`GET /api/expenses/profit` reports revenue, expenses, and the difference over
an optional date window. Two rules matter:

- Only **`paid`** payments count as revenue. A due is money the gym is owed,
  not money it has; counting it would report a profit the bank account
  disagrees with. It is reported alongside as `outstanding`.
- Both sides are summed in `Decimal` and converted once at the boundary, so
  `0.1 + 0.2 - 0.3` is `0` rather than `5.5e-17`.

The whole module sits behind one permission, `canManageExpenses` — owner,
manager or accountant. Unlike payments there is no per-row narrowing that would
make a partial view meaningful, so a receptionist who can see what a member
paid still sees nothing of the rent. The dashboard carries `expenses` and
`profit` per month inside the same `revenue` block, which is already omitted
entirely for staff without `canViewReports`.

## Prices that used to be hardcoded

The personal-trainer fee was the literal `10000`, written twice in
`membersController`. It now resolves trainer → gym: `Trainer.ptFee` if set,
otherwise `Gym.defaultPtFee`. A null `ptFee` means "use the gym's price", which
is not the same as `0` — that is a deliberate decision to charge nothing, and a
fee resolving to zero raises no due at all rather than a zero-rupee debt that
would sit on the member's balance forever.

The migration backfills `defaultPtFee = 10000` for gyms that already have a
trainer, so an existing gym keeps charging what it was charging. New gyms start
at 0, because a wrong price looks like a real one.

## Permissions are generated, not duplicated

`backend/src/services/permissions.ts` is the **only** copy anybody edits.
`frontend/src/utils/permissions.generated.ts` is written from it by
`npm run gen:permissions` (in `backend/`), and
`tests/services/permissions.test.ts` fails if the committed output no longer
matches its source.

This replaces two hand-maintained 150-line files that had already begun to
drift. Change the table, run the generator, commit both.

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

## Scheduled work

One job, run daily inside the backend process by `node-cron`: an email to each
member whose membership expires **that day**. `REMINDER_CRON` decides when, and
defaults to nine in the morning — early enough to act on, late enough that
somebody is awake to read the log.

Deliberately narrow. It does not chase members who lapsed months ago, and sends
no second reminder a week later. Each of those is a decision about how often a
gym should email its members, which belongs to the gym rather than to this app.

**Running it twice is harmless, which matters more than it sounds.** A restart,
a redeploy, or a second backend instance all re-run the job, and a member who
gets the same notice three times learns to ignore the first one next month. Each
send claims a `ReminderLog` row — unique on `(membershipId, kind, sentOn)` —
*before* the mail goes out, so a duplicate insert is how a second attempt finds
out it has nothing to do. Three simultaneous runs send exactly one email.

A send that fails **gives the claim back**, so the next day tries again: one
unreachable mail server should not silently cost a member their only notice. The
exception is having no transport configured at all, where the claim is kept —
otherwise the same notice would print to the log on every run for ever.

Not everyone can be reached. A member's email is optional, so members without
one are counted as `skippedNoEmail` and told nothing. A gym that wants this
feature to work has to be collecting addresses.

Every run logs a line whether or not it sent anything — `due 0` is how an
operator tells a working job from one that has quietly stopped:

```
[jobs] expiry reminders — due 3, sent 2, already sent 0, no email 1, failed 0
```

Set `RUN_JOBS=false` to stop a process scheduling anything. It is off
automatically under `NODE_ENV=test`, so the suite never fires a job it did not
ask for.

**In Docker, mind the timezone.** A container runs in UTC unless told
otherwise, so the default `0 9 * * *` fires at 9am *UTC* — two in the afternoon
in Karachi. Set `TZ` in `docker/.env` to the gym's own zone and the schedule
means what it looks like.

## Backups

A `backup` container dumps the database on a loop and prunes old dumps. It is
part of `docker compose up` and needs no configuration to work.

| Variable | Default | |
|---|---|---|
| `BACKUP_DIR` | `./backups` | Where dumps land **on the host** |
| `BACKUP_INTERVAL_SECONDS` | `86400` | Once a day |
| `BACKUP_KEEP_DAYS` | `14` | Older dumps are deleted |

It runs the same `postgres:17-alpine` image as the database, so `pg_dump` always
matches the server version — an older client is refused outright, and a newer
one can emit SQL the server cannot restore.

**Dumps go to the host, not a Docker volume.** A backup living inside Docker is
lost to the same `docker compose down -v` that loses the database. Copy them
somewhere else as well: a backup on the same disk survives a bad migration, not
a dead disk.

### Restoring

```sh
gunzip -c docker/backups/gymapp-20260813-090000.sql.gz \
  | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Verified end to end, not assumed: seed a row, dump, `DROP SCHEMA public
CASCADE`, restore, and the row and all fourteen tables come back with no errors.

### What it refuses to do

- **Write a file that is not a whole backup.** The dump goes to a hidden
  `.in-progress-*` name and is moved into place only on success. A directory
  holding something that looks like a backup but is half a database is worse
  than an empty one, because it is trusted.
- **Report a failure as a success.** A shell pipeline reports only its last
  command, so `pg_dump | gzip` succeeds whenever *gzip* does — and gzip will
  happily compress nothing. The first version of this script did exactly that
  and wrote zero-byte "backups" for as long as the database was down; the
  status is now carried out of the pipeline by hand, and an empty archive is
  rejected on top of that.
- **Prune after a failure.** Retention runs only after a dump succeeds, so a
  week of failures leaves the last good backup alone rather than quietly ageing
  it out.
- **Touch anything that is not a dump.** Only files matching
  `${POSTGRES_DB}-*.sql.gz` are eligible for deletion.

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

Vitest on both sides — `npm test` in `backend/` (198) and in `frontend/` (40).

**Tests live in `tests/`, never beside the code they cover.** Both trees mirror
the `src/` they test, so `src/` holds nothing but the app that ships and the
backend's `dist/` cannot accidentally contain a test file. Each side has a
`tsconfig.test.json` covering both trees, which is what `npm run typecheck`
uses — without it the tests would be checked by nothing and a broken one would
only surface when it ran.

```
backend/                      frontend/
  src/     <- app only          src/     <- app only
  tests/                        tests/
    helpers.ts                    setup.ts
    setup.ts                      components/
    routes/                       utils/
    services/
    jobs/
```

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

145 tests driving the real Express app over HTTP with supertest, against a real
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
  not `"2500"`, that dues arithmetic stays exact over ten `0.10` payments, that
  overpaying never produces a negative outstanding, and that the filtered
  totals cover every matching row rather than the page they were asked for.
- **`members`** — paging, server-side search, and the derived status tabs at
  their boundaries: day seven is still `expiring`, lapsing needs *more* than
  sixty days, a hand-deactivated member is lapsed whatever the dates say. Also
  that a search reaches a member who is nowhere near the first page, and that
  the tab counts follow the search without narrowing themselves by the tab.
- **`attendance`** — one check-in per member per day, including five fired at
  once to prove the unique constraint holds where the controller's own check
  cannot. And that an expired membership never blocks the door, but does come
  back in the response.
- **`expiryReminders`** — who gets told and how often. That a second run the
  same day sends nothing, that three simultaneous runs send exactly one mail,
  that a failed send frees its claim for tomorrow while a missing transport
  keeps it, and that a superseded membership — the one the renewal replaced —
  is never the subject of a "please renew". The transport is stubbed: these are
  about the decisions, not about SMTP.

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

### Frontend tests

40 tests in `frontend/tests/`, run with `npm test` there. jsdom rather than a
real browser — these are unit tests of rendering and behaviour, and a browser
would cost seconds per file for fidelity they do not use.

- **`utils/csv.ts`** — escaping, where the failure is silent and expensive. A
  member called `Khan, Ali` or a note reading `paid 2,500 "cash"` does not
  throw; it shifts every following column by one, and the gym reads the wrong
  number against the wrong person in a spreadsheet nobody thinks to doubt.
- **`components/Badge.tsx`** — that each status keeps the colour carrying its
  meaning (expired red because somebody can still be won back, lapsed grey
  because that moment has passed), and that an unknown status renders plain
  rather than unstyled.
- **`pages/Members.tsx`** — that searching and the status tabs are *asked of
  the server* rather than applied to the rows in hand. A page that quietly went
  back to filtering locally would look right on one page of members and lose
  people on the second, which a gym discovers by being unable to find somebody
  standing in front of them. Also that the tab counts describe the whole roster
  rather than the loaded page, and that a debounced search fires once per pause
  rather than once per keystroke.
- **`pages/Payments.tsx`** — that the tiles show the totals the server computed
  over every matching row, not the sum of the page. A page holding five rows
  worth Rs. 500 must still read `Rs. 4,000` when that is what the filters
  match; summing locally would under-report money and look correct doing it.

`tests/helpers.tsx` carries the scaffolding: a render that supplies the router
and auth context every page assumes, fixture builders, and `mockApi`, which
routes by URL substring and **records every URL asked for**. That recording is
the point — for server-side filtering, what the page *requests* is the
behaviour, and asserting on the rendered rows would pass even if the filter
never left the browser.

Pages are still the thin part: two of eleven have tests, and neither covers
creating or editing.

**A gotcha worth knowing.** `vitest.config.ts` pins `pool: 'threads'`. A forked
worker never finishes starting when the project path contains a space: it is
handed a percent-encoded path (`Gym%20App`) it cannot resolve, and the run dies
on "Timeout waiting for worker to respond" having attempted no tests at all.
Threads share the parent's resolution and are unaffected.

### Not covered

Google sign-in, the invite and password-reset flows end to end (token
generation is tested; clicking the emailed link is not), plan assignment,
supplement restocking and the sales report, and audit-log contents. On the
frontend, nine of the eleven pages, and every create-or-edit flow — the tests
there cover reading and filtering, not writing.

The mail transport is not covered either — every test that involves mail stubs
`sendMail`. What a message says and who it goes to is tested; whether Resend or
SMTP actually accepts it is not, and would need credentials the suite has no
business holding. The same goes for `node-cron` firing: the reminder job is
tested by calling it, and the schedule that calls it daily is not.

## CI

`.github/workflows/test.yml` runs on every push to `main` and on every pull
request, as two independent jobs:

| Job | Steps |
|---|---|
| **backend** | `npm ci` → `prisma generate` → `typecheck` → `test` |
| **frontend** | `npm ci` → `typecheck` → `lint` → `test` → `build` |

Postgres comes from a `postgres:17-alpine` service container with a
`pg_isready` health check, matching the version in `docker-compose.yml`. Node is
22, matching the Dockerfiles.

Two things are easy to get wrong here:

- **`prisma generate` is a required step.** The generated client is not
  committed — `npm ci` wipes `node_modules`, so anything importing
  `@prisma/client` fails to typecheck until it is regenerated. It also needs
  `DATABASE_URL` set, because `prisma.config.ts` reads it at config load.
- **There is no `migrate deploy` step.** `tests/setup.ts` drops, recreates
  and migrates `gymapp_test` itself, so migrating beforehand would only prepare
  a database the suite immediately throws away. `DATABASE_URL` connects as
  `postgres` because that setup needs rights to `CREATE DATABASE`.

The frontend keeps its `build` step alongside the tests rather than replaced by
them: a build catches an import that does not resolve or a bundle that cannot be
produced, neither of which the tests reach while coverage is this thin.

## Known gaps

- **Frontend coverage is uneven.** `Members` and `Payments` are tested where
  their logic lives — filtering, paging, and the totals. The other nine pages
  have nothing, and no test anywhere covers creating or editing a record. The
  build step still carries that weight.
- **`GET /supplements` is unbounded.** Left that way deliberately: a gym stocks
  tens of products, not thousands, and the category counts on the page are
  computed from the whole list. It is the one list where paging would cost more
  than it saves — revisit it if a gym ever carries hundreds of lines.
- **The payments CSV exports what has been loaded**, not every match, now that
  the list is paged. The toast says so ("Exported 50 of 213"), and pressing Show
  more first widens it. A server-side export would be the honest fix.
- `HTTPS=false` suits localhost, but must be flipped for any real deployment.
