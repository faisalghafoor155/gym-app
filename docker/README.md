# Gym App — Docker Setup

Production Docker setup for the whole stack. Everything Docker-related is kept
in this folder, so `backend/` and `frontend/` hold nothing but app code — no
Dockerfile, no `.dockerignore`.

```
Gym App/
├── backend/          <- app source only
├── frontend/         <- app source only
└── docker/           <- you are here
```

## Services

| Service    | Image base          | Port                  | Notes |
|------------|---------------------|-----------------------|-------|
| `db`       | `postgres:17-alpine`| internal only         | data in the `db-data` named volume |
| `backend`  | `node:22-alpine`    | internal only (5000)  | runs `prisma migrate deploy` on start |
| `frontend` | `nginx:1.27-alpine` | **`8080` on the host**| serves the Vite build, proxies `/api` → `backend` |

Only the frontend is published. The backend and database are reachable only on
the internal compose network, so the API has no directly exposed port.

## First run

All commands run from this folder — it is where `docker-compose.yml` lives.

```sh
cd docker
cp .env.example .env      # then edit the values
docker compose up -d --build
```

Open <http://localhost:8080>.

Generate a real `JWT_SECRET` before any non-local use:

```sh
openssl rand -base64 48
```

## Everyday commands

```sh
docker compose up -d --build     # rebuild + start after source changes
docker compose logs -f backend   # follow backend logs
docker compose ps                # health status
docker compose restart backend   # restart one service
docker compose down              # stop everything, keep the database
```

Source changes are **not** hot-reloaded — this is a production build. Re-run
`docker compose up -d --build` to pick them up.

Migrations need no command of their own: the entrypoint runs
`prisma migrate deploy` on every start, so `up -d --build` applies any new ones.

### Throwing the database away

There is one command that destroys data, and it is deliberately not in the list
above:

```sh
docker compose down -v     # deletes the database volume — every member, payment
                           # and fingerprint in it, with no undo
```

`-v` removes the named volumes, which is where Postgres keeps everything. It is
one character away from the `down` you run every day, and there is no
confirmation prompt.

Use it only to reset a development database on purpose. Never on a machine a
gym is using — a deployment or an upgrade never needs it. If the database is
broken, [restore from a backup](#backups-and-restore) instead; that is what they
are for.

## How the build works

The build context is this folder, and the app source is pulled in as a named
build context (`src: ../backend`). Files are copied explicitly rather
than with `COPY . .`, so the host's `node_modules` never enters an image and no
`.dockerignore` has to be added to the app folder.

Migrations run from `docker-entrypoint.sh` via `prisma migrate deploy` before
the server starts. The backend waits on the database's `pg_isready` healthcheck,
so ordering on a cold start is handled.

## Backups and restore

The `backup` service dumps the database on a timer and keeps the dumps for
`BACKUP_KEEP_DAYS`. They land in `./backups` on the host rather than in a
Docker volume, on purpose: a backup that lives only inside Docker is lost to
the same `docker compose down -v` that loses the database.

```sh
ls -lh backups/                  # what has been taken
docker compose logs backup       # whether it is still running
```

### Restoring

`restore.sh` is the other half. **Rehearse it before you ever need it** — a
backup nobody has restored is an untested assumption, and the moment it gets
tested is the worst possible moment to discover it does not work.

```sh
./restore.sh --list                          # what is available
./restore.sh --into gymapp_check             # REHEARSAL — live db untouched
./restore.sh                                 # restore the newest dump, live
./restore.sh backups/gymapp-20260813-093554.sql.gz
```

`--into` restores to a scratch database and prints the row counts, so a dump
can be proved good on a normal working day while the app carries on serving.
Drop the copy when you are done:

```sh
docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres \
  -c 'DROP DATABASE "gymapp_check";'
```

A restore over the live database asks you to type the database name first, and
takes a `pre-restore-*.sql.gz` safety dump before dropping anything — so
restoring the *wrong* file is itself recoverable. It refuses to proceed if that
safety dump cannot be written, checks the archive's integrity before touching
the database, and verifies afterwards that tables actually arrived. The backend
is restarted at the end so it reconnects.

Anything recorded *after* the dump was taken is lost — members added, fees
taken, attendance marked. Check the timestamp in the filename before restoring.

## HTTPS

The default stack serves plain http on `APP_PORT`, which is right for local
work and wrong for anything a member can reach: the session cookie is only
marked `Secure` when the app is actually behind TLS, and until then a single
downgraded request exposes it.

Going live is an overlay, not an edit — `docker-compose.https.yml` sits on top
of the base file so local runs keep working:

```sh
# 1. Point the domain's A record at this machine, and open 80 and 443.
#    Certbot proves control over port 80, so it must be reachable first.

# 2. Put the domain in .env
echo "DOMAIN=gym.example.com" >> .env

# 3. Issue the certificate once. Port 80 must be free while this runs.
docker compose -f docker-compose.yml -f docker-compose.https.yml \
  run --rm --service-ports certbot certonly \
  --standalone -d "$DOMAIN" --agree-tos -m you@example.com --no-eff-email

# 4. Bring the stack up on TLS
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d
```

After this the app answers on `https://$DOMAIN`, plain http 301-redirects to
it, and the `certbot` container renews twice a day without being asked.

Check it worked — the cookie must come back with `Secure`:

```sh
curl -sI https://$DOMAIN | grep -i strict-transport
curl -si https://$DOMAIN/api/auth/login -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}' | grep -i set-cookie
```

Two deliberate choices worth knowing:

- **`preload` is not set on HSTS.** Getting onto the browser preload list is
  easy and getting off takes months, during which the domain and every
  subdomain is https-only for everyone. Add it once you are sure.
- **Certbot only renews here; it does not issue.** First issuance is the manual
  step above, because a container that tries to issue on every boot will burn
  through Let's Encrypt's rate limits while DNS is still propagating.

## Configuration

All settings come from `.env` in this folder (see `.env.example`):

| Variable            | Purpose |
|---------------------|---------|
| `POSTGRES_USER`     | database user |
| `POSTGRES_PASSWORD` | database password |
| `POSTGRES_DB`       | database name |
| `JWT_SECRET`        | backend token signing secret (min 32 chars — the server refuses to boot otherwise) |
| `BIOMETRIC_KEY`     | encrypts stored fingerprint templates (32 bytes base64 — the server refuses to boot otherwise). See the warning below |
| `APP_PORT`          | host port for the app (default `8080`). Not used by the HTTPS overlay, which binds 80 and 443 |
| `DOMAIN`            | required only for HTTPS — the domain the certificate is issued for |
| `CORS_ORIGIN`       | optional; comma-separated allowed origins. Leave empty — the app is same-origin behind nginx |
| `FINGERPRINT_RETENTION_CRON` | when expired fingerprints are deleted (default `0 3 * * *`) |
| `FINGERPRINT_RETENTION_GRACE_DAYS` | days after a member lapses before their fingerprint is deleted (default `90`, on top of the 60 to lapse) |
| `BACKUP_INTERVAL_SECONDS` | how often to dump (default `86400`, a day) |
| `BACKUP_KEEP_DAYS`  | how many days of dumps to keep (default `14`) |
| `BACKUP_DIR`        | where dumps are written on the host (default `./backups`) |

`DATABASE_URL` is assembled from the Postgres values in `docker-compose.yml` —
do not set it by hand. The backend's own `backend/.env` is excluded from the
image and is not used by the containers.

### `BIOMETRIC_KEY`

Fingerprint templates are encrypted with this before they reach the database, so
the dumps in `./backups` carry ciphertext rather than members' biometrics. Two
consequences, both worth acting on before going live:

- **Keep a copy of the key somewhere other than `.env` on this host** — a
  password manager, a secret manager. It is not in the database, so a database
  backup will not bring it back, and without it every enrolled member has to be
  enrolled again in person.
- **Do not store it with the dumps.** A key sitting beside the backup it
  protects means anyone who takes the backup takes the templates too, which is
  the situation the encryption exists to prevent.

Rotating: put the new key first and keep the old one, so rows written under
either still decrypt — `BIOMETRIC_KEY="2:<new>,1:<old>"`. See
`backend/src/services/fingerprint/README.md`.

### Fingerprint retention

A daily job deletes the fingerprints of members who have stopped coming — no
active membership for 60 days (the point the app already calls lapsed) plus
`FINGERPRINT_RETENTION_GRACE_DAYS`, about five months at the defaults. Only the
template goes; the member, their attendance and their payments stay. Somebody
who returns enrols again at the desk.

It cannot be turned off through configuration on purpose. A gym that wants to
keep biometrics indefinitely has to stop scheduled work altogether with
`RUN_JOBS=false`, which also stops expiry reminders.

To see what it would delete without waiting for the schedule:

```sh
docker compose exec backend npm run retention:fingerprints
docker compose exec backend npm run retention:fingerprints -- --delete
```

The first only lists; deleting takes the flag, because it cannot be undone.

Note that old dumps in `./backups` still contain whatever was enrolled when they
were taken — encrypted, but not deleted by this job. Backup retention
(`BACKUP_KEEP_DAYS`) is what bounds that.

## Notes

- The frontend calls a relative `/api` baseURL, so `nginx.conf` proxies `/api/`
  to `http://backend:5000`. No API URL is baked into the bundle, and the same
  image works on any host.
- `client_max_body_size` is 10m because member photos are posted as base64
  data-URLs inside JSON. It sits above the backend's own `express.json()` limit
  of 4mb, so oversized uploads are rejected by the app with a readable 413
  rather than by nginx with a generic error page.
- The backend image is ~693MB because the Prisma CLI and query engines are kept
  in the runtime stage to run migrations at startup.
- `TRUST_PROXY_HOPS: 1` is set in `docker-compose.yml` so per-IP rate limiting
  reads the real client IP from `X-Forwarded-For` rather than nginx's own. It is
  deliberately a hop count, not `true`, so a client cannot spoof its IP.
- `.env` is gitignored here.
