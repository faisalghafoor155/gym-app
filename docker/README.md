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
docker compose down              # stop, keep the database
docker compose down -v           # stop and DELETE the database volume
```

Source changes are **not** hot-reloaded — this is a production build. Re-run
`docker compose up -d --build` to pick them up.

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

## Configuration

All settings come from `.env` in this folder (see `.env.example`):

| Variable            | Purpose |
|---------------------|---------|
| `POSTGRES_USER`     | database user |
| `POSTGRES_PASSWORD` | database password |
| `POSTGRES_DB`       | database name |
| `JWT_SECRET`        | backend token signing secret (min 32 chars — the server refuses to boot otherwise) |
| `APP_PORT`          | host port for the app (default `8080`) |
| `CORS_ORIGIN`       | optional; comma-separated allowed origins. Leave empty — the app is same-origin behind nginx |
| `BACKUP_INTERVAL_SECONDS` | how often to dump (default `86400`, a day) |
| `BACKUP_KEEP_DAYS`  | how many days of dumps to keep (default `14`) |
| `BACKUP_DIR`        | where dumps are written on the host (default `./backups`) |

`DATABASE_URL` is assembled from the Postgres values in `docker-compose.yml` —
do not set it by hand. The backend's own `backend/.env` is excluded from the
image and is not used by the containers.

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
