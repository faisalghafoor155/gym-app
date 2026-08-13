#!/bin/sh
# Restores the database from one of backup.sh's dumps.
#
# A backup nobody has restored is not a backup — it is an untested assumption,
# and the moment it gets tested is the worst possible moment to find out it
# does not work. This is the other half of backup.sh, and the reason it exists
# as a script rather than a paragraph in the README: the steps have to be the
# same every time, including the ones nobody remembers under pressure.
#
# Run it from the docker/ directory:
#
#   ./restore.sh                                  # newest dump, asks first
#   ./restore.sh backups/gymapp-20260813-093554.sql.gz
#   ./restore.sh --list                           # what is available
#   ./restore.sh --into gymapp_check <file>       # rehearse, without touching live
#
# The safest way to use this is --into: it restores to a scratch database, so
# the dump can be proved good while the real one carries on serving. That is
# what makes a drill possible on a normal working day.

set -eu

COMPOSE="docker compose"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

die() { echo "restore: $*" >&2; exit 1; }

[ -f docker-compose.yml ] || die "run this from the docker/ directory"

# The credentials live in the same .env compose reads, so there is nothing
# extra to keep in step.
[ -f .env ] || die ".env not found — copy .env.example and fill it in"

# Read by name rather than sourced. `. ./.env` executes the file, so a perfectly
# valid line like MAIL_FROM=Gym Reception makes the shell try to run `Reception`
# — and the whole script dies on a variable it never needed. Only the two keys
# that matter here are extracted, and quotes are stripped so both
# FOO=bar and FOO="bar" work.
env_value() {
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" .env \
    | head -n 1 | sed 's/^"\(.*\)"$/\1/; s/^'\''\(.*\)'\''$/\1/'
}

POSTGRES_USER="${POSTGRES_USER:-$(env_value POSTGRES_USER)}"
POSTGRES_DB="${POSTGRES_DB:-$(env_value POSTGRES_DB)}"

[ -n "$POSTGRES_USER" ] || die "POSTGRES_USER is not set in .env"
[ -n "$POSTGRES_DB" ] || die "POSTGRES_DB is not set in .env"

newest_dump() {
  # Sorted by name, which for this stamp format is the same as by date and
  # does not depend on `ls -t` or `stat`, neither of which is portable.
  find "$BACKUP_DIR" -maxdepth 1 -name "${POSTGRES_DB}-*.sql.gz" -type f \
    | sort | tail -n 1
}

list_dumps() {
  echo "Backups in ${BACKUP_DIR}:"
  echo
  found=0
  for f in $(find "$BACKUP_DIR" -maxdepth 1 -name "${POSTGRES_DB}-*.sql.gz" -type f | sort); do
    printf '  %s  %s\n' "$(du -h "$f" | cut -f1)" "$f"
    found=1
  done
  [ "$found" -eq 1 ] || echo "  (none)"
}

TARGET_DB="$POSTGRES_DB"
DUMP=""

while [ $# -gt 0 ]; do
  case "$1" in
    --list) list_dumps; exit 0 ;;
    --into) TARGET_DB="${2:?--into needs a database name}"; shift 2 ;;
    -h|--help) sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) DUMP="$1"; shift ;;
  esac
done

[ -n "$DUMP" ] || DUMP="$(newest_dump)"
[ -n "$DUMP" ] || die "no dumps found in ${BACKUP_DIR} — run --list to check"
[ -f "$DUMP" ] || die "no such file: $DUMP"
[ -s "$DUMP" ] || die "that dump is empty: $DUMP"

# A truncated archive is the failure mode most likely to go unnoticed, and the
# cheapest to rule out. Better to find out here than half way through a restore
# that has already dropped the live database.
gzip -t "$DUMP" 2>/dev/null || die "that dump is corrupt (failed gzip integrity check)"

$COMPOSE ps db >/dev/null 2>&1 || die "compose is not available here"
$COMPOSE ps --status running db | grep -q db \
  || die "the db container is not running — start it with: docker compose up -d db"

psql_db() {
  # --set ON_ERROR_STOP=1 is what turns a failed statement into a failed
  # restore rather than a database that is silently missing a table.
  $COMPOSE exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$@"
}

echo "Dump:     $DUMP"
echo "Restoring into database: $TARGET_DB"

if [ "$TARGET_DB" = "$POSTGRES_DB" ]; then
  cat <<WARNING

  *** This REPLACES the live database. ***

  Every row currently in "$TARGET_DB" is dropped and replaced by the contents
  of the dump above. Anything recorded since that dump was taken is lost —
  members added, fees taken, attendance marked.

  To rehearse without touching it, run instead:
    ./restore.sh --into ${POSTGRES_DB}_check "$DUMP"

WARNING
  printf 'Type the database name (%s) to confirm: ' "$TARGET_DB"
  read -r reply
  [ "$reply" = "$TARGET_DB" ] || die "cancelled"

  # A dump of the current state before overwriting it, so a restore of the
  # wrong file is itself recoverable. This is the step that is never in the
  # README and always wanted about ten seconds later.
  safety="$BACKUP_DIR/pre-restore-$(date -u '+%Y%m%d-%H%M%S').sql.gz"
  echo "Taking a safety dump of the current database first..."
  if $COMPOSE exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip -c > "$safety" \
     && [ -s "$safety" ]; then
    echo "  saved: $safety"
  else
    rm -f "$safety"
    die "could not take a safety dump — refusing to overwrite the live database"
  fi
fi

# Terminated first: DROP DATABASE fails outright while anything is connected,
# and the backend holds a pool open. Restarting it afterwards is what picks the
# restored data up.
echo "Disconnecting clients from $TARGET_DB..."
psql_db -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();" >/dev/null

echo "Recreating $TARGET_DB..."
psql_db -d postgres -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";" >/dev/null
psql_db -d postgres -c "CREATE DATABASE \"$TARGET_DB\" OWNER \"$POSTGRES_USER\";" >/dev/null

echo "Loading the dump..."
# Decompressed on the host and piped in, so the file never has to be copied
# into the container first.
if ! gzip -dc "$DUMP" | psql_db -d "$TARGET_DB" >/dev/null; then
  die "the restore failed — $TARGET_DB is now incomplete. The dump itself is untouched."
fi

# Proof rather than assumption: a restore that reports success and leaves an
# empty database is the exact failure this whole script exists to catch.
tables=$(psql_db -d "$TARGET_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
[ "$tables" -gt 0 ] || die "the restore produced no tables — treat that dump as bad"

echo
echo "Restored $tables tables into $TARGET_DB."

# Row counts for the tables that hold the gym's actual records, so the operator
# can recognise their own data rather than trusting a table count.
psql_db -d "$TARGET_DB" -c \
  'SELECT (SELECT count(*) FROM "Gym") AS gyms,
          (SELECT count(*) FROM "Member") AS members,
          (SELECT count(*) FROM "Payment") AS payments,
          (SELECT count(*) FROM "User") AS users;' 2>/dev/null || true

if [ "$TARGET_DB" = "$POSTGRES_DB" ]; then
  echo
  echo "Restarting the backend so it reconnects..."
  $COMPOSE restart backend >/dev/null
  echo "Done."
else
  echo
  echo "This was a rehearsal — the live database was not touched."
  echo "Drop the copy when you are finished with it:"
  echo "  docker compose exec -T db psql -U $POSTGRES_USER -d postgres -c 'DROP DATABASE \"$TARGET_DB\";'"
fi
