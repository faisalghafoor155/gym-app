# GymPro — Documentation

Gym management for a single gym: members, attendance, fees, workout and diet
plans, and supplement stock — with owner / staff / member accounts.

- [Stack](#stack)
- [Roles and access](#roles-and-access)
- [Plans and limits](#plans-and-limits)
- [Running it](#running-it)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [API reference](#api-reference)
- [How the data fits together](#how-the-data-fits-together)
- [Security notes](#security-notes)
- [Email](#email)
- [Scheduled work](#scheduled-work)
- [Subscription billing](#subscription-billing)
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

## Plans and limits

Each gym is on one of three tiers, stored as `Gym.plan`:

| | **free** | **basic** | **pro** |
|---|---|---|---|
| Active members | 50 | 300 | unlimited |
| Staff accounts | 2 | 6 | 15 |
| Trainers | 2 | 10 | unlimited |
| Classes | 3 | 20 | unlimited |
| WhatsApp reminders | — | ✅ | ✅ |
| Reports & analytics | — | ✅ | ✅ |
| Fingerprint check-in | — | — | ✅ |
| Online payments | — | — | ✅ |

`backend/src/services/subscription.ts` is the source of truth for that table.
The tiers are an enum in the schema — a gym is on exactly one of three and a
fourth value must not be storable — but what a tier is *worth* is a pricing
decision, so it lives in the service and changes without a migration. The
client's copy is generated from it into
`frontend/src/utils/entitlements.generated.ts`, exactly like the permission
table, and `tests/services/subscription.test.ts` fails if the two drift.

**The app bills for a plan** — see [Subscription billing](#subscription-billing)
for how a gym pays and what happens when it does not. An operator can still
move a gym by hand with `npm run plan <gymId> <tier>`, which refuses a
downgrade that would leave the gym over a ceiling unless given `--force`.

There is still no `PUT /subscription`. An owner asks to subscribe and is
issued an invoice; the tier moves when that invoice is **paid**, never when it
is requested.

**Limits are counted over what is live, not over history**: active members,
active trainers, staff accounts (including revoked ones, which still hold their
email address), and classes. That is what makes a limit escapable without
deleting anything — retire a lapsed member and the place is free. Each is
claimed inside a transaction behind `SELECT ... FOR UPDATE` on the gym row, so
two receptionists adding the 50th and 51st member at the same moment cannot
both get through.

**A refusal names what would fix it**, and the status says which kind it is:

| Status | Meaning | What the gym can do |
|---|---|---|
| `409` + `reason: "plan_limit"` | A ceiling is reached | Free a place, *or* upgrade |
| `402` + `reason: "plan_feature"` | The tier excludes the feature | Only upgrade |

Both bodies carry `upgradeTo` — the cheapest tier that would help, or `null`
when none would, because a prompt naming a tier that would not help is worse
than one naming none.

Three things are deliberately **not** gated, and each would be a trap if it
were: a payment gateway's callback (a gym that downgrades mid-payment must
still be able to credit money the member already sent), deleting a fingerprint
(disposal of a biometric must never sit behind a paywall), and
`GET /fingerprint/status` (which reports `licensed` so the page can tell "not
on your plan" from "no reader plugged in").

Existing gyms were moved to `basic` by the migration rather than left on the
column's old `"free"` default. That column was written at signup and never
read, so every row said `free` by accident rather than by choice; honouring it
would have capped gyms that had been running without limits at 50 members, and
they would have found out at the front desk.

`basic` is the tier that matches what the app already did — its six staff seats
are the figure that used to be hardcoded for every gym. What it does not cover
is size: a gym already past 300 active members or six staff keeps everything it
has, since the limits cap additions rather than existing rows, but cannot add
the next one until somebody moves it up. **Run `npm run plan` before deploying
this** — it lists every gym against its ceiling, and moving one up is a single
command.

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
| `BIOMETRIC_KEY` | yes | 32 bytes base64 — `openssl rand -base64 32`. Encrypts stored fingerprint templates; the server refuses to boot without it, reader attached or not. Losing it means re-enrolling every member |
| `AWS_*` / `S3_BUCKET_NAME` | in production, for photos | All four together. Without them a photo upload is refused in production (see [Member photos](#member-photos)); everything else works |
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
npm run gen:permissions   # regenerate the client's permission + plan tables
npm run plan              # list gyms and their subscription tiers
npm run plan <gymId>      # one gym's usage against its tier
npm run plan <gymId> pro  # move it to another tier
npm run gym               # suspend or resume a gym
npm run billing           # every gym's subscription and what it owes
npm run billing <gymId> start basic     # begin billing it
npm run billing <invoiceId> paid        # settle an invoice paid out of band
npm run billing run                     # run the daily billing sweep now

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

### Paged lists

Every list that grows without bound answers with the same envelope:

```json
{ "data": [ … ], "total": 213, "page": 1, "limit": 25, "hasMore": true }
```

`page` and `limit` are query parameters; `limit` is capped (100 on most lists,
200 on the monthly collection) so a caller cannot ask for the whole table
through it. `total` and any counts alongside it cover **everything matching the
filters**, never the page — a tab or a chip labelled with what happened to be
loaded would climb as the user pressed Show more.

The lists that answer this way: `/members`, `/payments`, `/audit-logs`,
`/expenses`, `/supplements`, `/trainers`, `/classes`, `/class-bookings`,
`/pt-sessions`, `/membership-plans`, `/members/:id/memberships`, `/payouts` and
`/users`. The last is the one exception to the shape: its rows stay under
`users` rather than `data`, because the seat count travels beside them.

**Filtering happens on the server.** A page that filtered what it had been
handed could only ever search the rows that happened to be loaded, so
`/supplements` takes `search` and `category`, `/trainers` takes `search` and
`includeInactive`, and so on.

**`all=true`** opts out of paging and returns everything, for the lists that
feed a picker rather than a table — `/trainers`, `/classes`,
`/membership-plans`, `/supplements`, `/members` and `/payouts`. A dropdown that
stopped at the page size would make later rows unselectable, which reads as data
having gone missing. It is deliberately explicit rather than the default: the
expensive shape should be the one you choose, not the one you get by forgetting.

Two lists deliberately do **not** default the way their neighbours do:

- **`/payouts` covers trainers who have left.** Leaving does not forfeit
  commission already earned, and hiding them would quietly write off money the
  gym still owes. `activeOnly=true` narrows it; the trainers list defaults the
  other way, because that one answers "who is on the floor".
- **The fingerprint matcher reads every enrolled template**, because 1:N
  identification has to compare against each candidate. See *Known gaps*.

### The member portal — `/api/me`

Everything a signed-in member can see and do about themselves: their profile,
membership history, payments, supplement purchases, class bookings, and the
timetable they can book from.

**Every endpoint is scoped by the session, never by an id in the URL.** That is
the whole security argument for this router — there is nothing to tamper with,
so "may this member see this?" is a question none of them has to answer. An
account with no member record (staff, owner) gets a `404` saying so, which is
truer than a `403`: they are not forbidden, they are not a member.

`POST /me/bookings` has **no `memberId` field** in its schema, unlike the staff
`POST /class-bookings` it mirrors. The member comes off the session, and the
strongest version of that guarantee is the one where somebody else's id never
arrives in the first place.

Booking needs an **active membership**, unlike check-in, which lets anybody
through. The two are different acts: waving somebody in costs the gym nothing
and is the moment to sell them a renewal, while holding a place in a class
takes it from a paying member. A lapsed member is answered with `403` and
`reason: "membership_inactive"`, so the portal can offer a renewal rather than
merely refusing.

Cancelling is a member's to do — a no-show holds a place nobody can use — but
an `attended` booking cannot be cancelled: attendance is a record of what
happened, and the place is long gone either way.

`GET /me/schedule` exists rather than the member reusing `/classes/schedules`
because the two answer different questions. The staff one says how full a class
is; a member also needs to know whether they are in it, and must not be handed
everybody else's bookings to work that out from. Only the count of other people
travels, never their ids.

The concurrency lives in `services/classBooking.ts`, shared with the staff
route rather than reimplemented. Capacity is counted and written under
`Serializable`, and a lost race is retried before it is ever reported as a full
class. A second copy of that would have been a second chance to get the
isolation level wrong, and the failure would be a class quietly running over
capacity rather than an error anybody sees.

Both booking paths write an audit row, under different actions —
`classBooking.create` for the desk and `classBooking.selfCreate` for the portal
— so the trail can tell who actually took the place.

`PUT /me` takes the four contact fields a member owns: phone, email, address
and emergency contact. The portal's Profile tab offers three of them and shows
the **email read-only**, though the endpoint would accept it — it is the
address an invite and a password reset go to, so a member repointing it is a
member moving their own login. That is a front-desk act, with a front-desk
record of it. Name, photo and membership are not writable here at all.

Blank is sent as `null` rather than omitted, which is how "clear this field"
is told apart from "leave it alone". The response is the whole profile, so the
page updates from what it saved rather than refetching it.

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
| GET / PUT | `/me` | signed-in — own record only |
| GET | `/me/memberships`, `/me/purchases`, `/me/bookings` | signed-in — own record only |
| GET | `/me/schedule` | signed-in — the timetable, with the member's own place in it |
| POST / DELETE | `/me/bookings`, `/me/bookings/:id` | signed-in — book or give up a place |
| GET | `/membership-plans`, POST, PUT/DELETE `/:id` | staff |
| GET | `/dashboard` | staff |
| GET | `/audit-logs` | owner |
| GET | `/subscription` | staff — the gym's tier, its usage, and every tier's limits |
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
- With no S3 configured, the behaviour depends on `NODE_ENV`:
  - **Outside production**, the photo falls back to the legacy inline base64
    `photo` column, so local work needs no AWS credentials.
  - **In production**, the upload is refused with a 503 naming the missing
    variables. The fallback writes up to 2MB of base64 onto a row that every
    member list, search and backup then carries, and a deploy that forgets one
    AWS variable would start doing it silently — a migration to undo, rather
    than a config change. Everything else about the member still works; only
    the photo is refused.
  - Rows written under the old fallback keep rendering either way. This is
    about what gets **written**, not what can be read.

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

Three jobs run daily inside the backend process by `node-cron`, each on its own
expression because "when do members hear from us", "when do we delete
biometrics" and "when do we bill" are unrelated decisions:

| Job | Default | Variable |
|---|---|---|
| Expiry reminders | 9am | `REMINDER_CRON` |
| Fingerprint retention | 3am | `FINGERPRINT_RETENTION_CRON` |
| Subscription billing | 4am | `BILLING_CRON` |

The first is an email to each member whose membership expires **that day**.
Nine in the morning is early enough to act on and late enough that somebody is
awake to read the log. The other two are described under
[Member photos](#member-photos) and
[Subscription billing](#subscription-billing).

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

## Subscription billing

What a **gym pays us**, as opposed to everything above, which is what a gym's
members pay it. The two never share a code path: different parties, different
merchant accounts, and a settlement that touches a gym's tier rather than a
membership.

| | |
|---|---|
| `GET /api/billing` | Owner — the term, the open invoice, and the last 12 |
| `POST /api/billing/subscribe` | Owner — ask for a tier; issues an invoice |
| `POST /api/billing/checkout` | Owner — start paying the open invoice |
| `POST /api/billing/callback/:provider` | **Public** — the provider settles it |
| `GET`/`POST` `/api/billing/return/:provider` | **Public** — where the browser lands |

**Asking is not paying.** `subscribe` writes a billing row and issues an
invoice; it does not move the gym. The tier is applied in `settleInvoice`, and
only there — an owner who could set their own `plan` would be an owner with Pro
for free. This is the same rule the member checkout follows, for the same
reason.

**The amount never comes from the request.** There is no amount field in either
checkout body, which is a stronger guarantee than validating one: the price is
read from the invoice, which was written from the rate captured on the gym's
own subscription row. A callback reporting a smaller figure is refused rather
than part-credited — a period is owed whole or not at all.

### The money is ours, not the gym's

The gateways live in `services/gateways/platform.ts`, a separate registry from
the gym-facing one, reading `PLATFORM_`-prefixed credentials. The protocol is
identical, so these are the *same* implementations behind a prefix rather than
copies — a copy would be a second place to get JazzCash's paisa conversion or
its Pakistan-time stamps wrong.

Sharing one registry would have meant a gym that wires up JazzCash for its
members gaining the ability to settle its own invoices against its own merchant
account, which is not a payment at all.

With nothing configured, billing still runs: invoices are issued and overdue
gyms are suspended, but a gym cannot pay from inside the app and an operator
settles each invoice by hand. The backend says so once at boot.

### Not paying gets you suspended, never downgraded

A gym that stops paying is **stopped with an explanation**, and keeps
everything. A silent downgrade would drop a gym below its own roster — members
it can still see, a front desk that cannot add the next one, and nothing on
screen saying why. Suspension destroys nothing and resuming puts the gym back
exactly where it was.

The daily sweep (`BILLING_CRON`, four in the morning) runs three passes in
order: issue what is due, **chase what is unpaid**, then suspend anything past
its due date **plus that subscription's grace period**. Grace is per gym rather
than global: an account somebody is already chasing should not be cut off at
the same hour as one that has simply vanished.

The order is the point. Chasing sits in the middle so an owner is warned —
repeatedly, and with the date access stops — before the last pass stops them.

### Nobody is suspended without being told

`BILLING_NOTICE_DAYS` is the schedule, in days before the due date, and
defaults to `7,1,0,-3`: a week out, the day before, the day itself, and once
more three days after it lapses. That last one sits inside the seven-day grace
on purpose — far enough from suspension that acting on it still works.

Every notice says the same three things — what is owed, by when, and that
**nothing is deleted** — because an owner reading the fourth after ignoring
three needs the facts rather than a louder adjective. Only the deadline and the
sharpness change.

Each notice is claimed by writing `lastNoticeDaysBefore` onto the invoice
*before* the send, exactly as `expiryReminders` claims a `ReminderLog` row
first: two instances racing must produce one email, and the loser must find out
before the owner has two copies. A send that then fails gives the claim back so
tomorrow tries again — unless no transport is configured, where keeping it
stops the same notice printing to the log for ever.

The schedule only ever counts down, so the most urgent threshold reached is the
notice due, and a smaller recorded number is always the later one. That is what
lets a single column track where the chasing has got to rather than a row per
notice. A gym already suspended is not chased: it has been told the strongest
way there is, and an email warning of a suspension would arrive after the fact.

A gym with **no active owner account** — revoked, or never replaced after a
transfer — has nobody to write to. It is counted as `no owner email` in the
run's log line rather than passed over silently, because it is about to be
suspended with nobody warned and that belongs in the log before it happens.

Paying lifts that suspension inside the same transaction that settles the
invoice — leaving it stopped until somebody noticed would reproduce the exact
complaint this feature exists to remove. The lift is **conditioned on the
reason**, so paying an invoice can never unlock a gym suspended for anything
else.

### A suspended gym can still reach its billing page

The one exception to the suspension gate in `middleware/auth.ts`, and it has to
be there. The commonest reason a gym is suspended is an unpaid invoice, so a
gym that cannot reach the page it pays from could never lift its own
suspension — it would have to phone somebody to be let back in to pay.

The exemption is narrow: `/api/billing` only, and the routes under it are
already owner-only. A suspended gym still cannot see a member, take a payment
at the desk, or mark anybody present. It can settle what it owes and nothing
else, which is asserted both ways in
`tests/routes/billing.integration.test.ts`.

The provider callbacks sit **before** `auth` entirely, like the member ones —
a provider posts server-to-server and carries no cookie. Behind `auth` a
suspended gym's payment would be rejected by the very gate it was paying to
lift.

### Running it twice is harmless

The sweep may run twice — a retried container, two backend instances — and
double-billing is money that was not owed. Two things prevent it: an `open`
invoice already awaiting payment means there is nothing to issue, and a period
always starts at `paidThrough`, so a second invoice would have to cover a
period the first already claimed.

Settlement is guarded the same way the member one is. The claim is a
conditional `updateMany` on `status: 'open'`, so of two callbacks racing — the
provider retrying alongside the browser return — the second updates zero rows
and rolls back rather than extending the term twice.

Renewal **adds to the end of the term**, taken from the invoice rather than
computed from today, so paying late does not shorten a period and paying early
does not lengthen one.

### Prices

`PLAN_PRICES` in `services/billing.ts`, overridable per deployment with
`PLAN_PRICE_BASIC` and `PLAN_PRICE_PRO`. What a gym is *actually* charged is
copied onto its subscription row when billing starts, so editing the table
re-prices new subscriptions and never silently re-prices a gym already on the
books.

`free` is never invoiced. A zero-rupee invoice is one no gateway can settle —
providers decline zero-amount transactions — carrying a due date that would
eventually suspend a gym that never owed anything.

### The operator's side

```sh
npm run billing                          # every gym and where it stands
npm run billing <gymId>                  # one gym's invoices in full
npm run billing <gymId> start basic      # begin billing, issue the first invoice
npm run billing <invoiceId> paid         # money arrived out of band
npm run billing <invoiceId> void "why"   # stop asking for it
npm run billing run                      # run the daily sweep now
```

`paid` settles an invoice with no signature behind it, which is right for a
bank transfer somebody has confirmed and wrong for anything else. It leaves
`provider` null — the honest difference between "the gateway told us" and
"somebody says so".

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
frontend, most pages have no test of their own. The write flows that are
covered are the member portal's — booking a class and saving the profile form
— and the staff-side writes that cannot be undone by pressing the button
again, which are tested for the payload they send and for the confirm gate in
front of them. Creating and editing from the staff side is not covered.

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
  their logic lives — filtering, paging, and the totals — and the portal's two
  writes are covered: class booking, including that it asks before giving a
  place up, and the profile form, including that it will not send an unchanged
  save and will not lose what was typed when one is refused. On the staff side
  the **irreversible** writes are tested — removing an account, revoking it,
  changing a role, transferring the gym, deleting a member or a supplement or a
  timetable slot, and suspending or cancelling a membership — each asserted on
  the payload it sends and on the confirm standing in front of it. Registering
  and editing a member is covered too, in `MemberFormModal.test.tsx`, and on
  the same principle: what is asserted is the shape of the request rather than
  the fields, because every rule there is a distinction the server would
  otherwise get wrong — a blank fee is no payment rather than a payment of
  nothing, a blank trainer fee is the usual rate rather than free, and a
  profile edit never carries a plan. The pages' own create-and-edit paths are
  now covered for the two things a gym cannot absorb being wrong — getting in,
  and money. `Login` covers both factors, including that the challenge token
  from the password step is what the code step spends and that a backup code
  reaches the server with its dash intact; `Security` covers the 2FA handshake,
  including that the backup codes travel back with the confirmation and that
  disabling costs the password. On the money side `Payments`, `Expenses`,
  `MembershipPlans` and `Trainers` cover create, edit and delete, asserted on
  the payload — a blank assignment fee as null rather than zero, a blank
  expense vendor as null rather than `''`, an amount as a number rather than
  the string the input holds, and a membership dropped when the payment is no
  longer for one.

  What remains untested is the read-only half — `Dashboard`, `Analytics`,
  `Subscription` and the member portal's own screens — plus `Attendance` and
  the permission-gated sidebar. Those go last deliberately: a page that renders
  the wrong number is visible to whoever is looking at it, where a payload that
  is quietly wrong is not. The build step still carries that weight.
- **The fingerprint matcher reads every enrolled template.** Not a paging
  oversight: 1:N identification has to compare the probe against each candidate,
  so a page of them would simply fail to recognise members further down the
  list. It is bounded by the gym's enrolled members rather than by its history,
  which is the reason it can stay that way.
- **Subscription billing has no proration.** Changing tier mid-term is refused
  rather than prorated: it would have to reconcile a period already paid for,
  which is a decision worth making deliberately rather than with a formula, so
  it stays an operator's job. Dunning notices go by **email only** — there is no
  WhatsApp equivalent, though members already get one for their memberships. The
  gym's own number is not collected for this purpose, which is the reason
  rather than an oversight.
- `HTTPS=false` suits localhost, but must be flipped for any real deployment.
