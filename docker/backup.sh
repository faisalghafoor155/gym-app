#!/bin/sh
# Dumps the database, then deletes dumps older than the retention window.
#
# Runs in a loop inside its own container rather than as a cron daemon: the
# image is postgres:17-alpine, which has pg_dump but no cron, and adding one
# would mean a second process to supervise for no gain. `sleep` until the next
# run is the whole scheduler.
#
# Two properties matter more than the schedule:
#
#   * A dump is written to a temporary name and moved into place only once
#     pg_dump has succeeded. A backup directory must never contain a file that
#     looks like a backup but is half a database — that is worse than an empty
#     directory, because it is trusted.
#   * A failed dump never deletes anything. Retention runs only after a
#     success, so a week of failures leaves the last good backup alone instead
#     of quietly ageing it out.

set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
# How often to dump, in seconds. 86400 is a day.
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
# How many days of dumps to keep.
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
DB_HOST="${BACKUP_DB_HOST:-db}"

mkdir -p "$BACKUP_DIR"

log() { echo "[backup] $(date -u '+%Y-%m-%d %H:%M:%SZ') $*"; }

dump_once() {
  stamp=$(date -u '+%Y%m%d-%H%M%S')
  final="$BACKUP_DIR/${POSTGRES_DB}-${stamp}.sql.gz"
  # A partial file must never be mistaken for a backup, so it carries a name
  # nothing looks for until it is complete.
  tmp="$BACKUP_DIR/.in-progress-${stamp}.sql.gz"

  # Cleared before every attempt: a status left over from a previous failure
  # would condemn every run after it, and the loop would never recover.
  : > /tmp/dump.status
  : > /tmp/dump.err

  # pg_dump's exit status has to survive the pipe into gzip. A shell pipeline
  # reports only its *last* command, so `pg_dump | gzip` succeeds whenever gzip
  # does — and gzip is perfectly happy to compress nothing. A refused connection
  # would produce a valid 20-byte archive of an empty stream and be logged as a
  # backup. This is not hypothetical: the first version of this script did
  # exactly that, and wrote zero-byte "backups" for as long as the database was
  # down.
  #
  # `set -o pipefail` is not in POSIX sh, so the status is carried out of the
  # subshell by hand instead.
  if ! { pg_dump -h "$DB_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>/tmp/dump.err \
         || echo "$?" > /tmp/dump.status; } | gzip -c > "$tmp"; then
    rm -f "$tmp"
    log "FAILED: could not write the archive"
    return 1
  fi

  if [ -s /tmp/dump.status ]; then
    rm -f "$tmp" /tmp/dump.status
    log "FAILED: $(tr '\n' ' ' < /tmp/dump.err)"
    return 1
  fi

  # A dump that produced nothing is a failed dump whatever anyone's exit status
  # said. Belt and braces, because this is the file somebody restores from at
  # the worst possible moment.
  if [ ! -s "$tmp" ]; then
    rm -f "$tmp"
    log "FAILED: the dump was empty"
    return 1
  fi

  mv "$tmp" "$final"
  log "wrote $(basename "$final") ($(du -h "$final" | cut -f1))"
  return 0
}

prune() {
  # -mtime +N is "older than N days". Only files matching the dump pattern are
  # eligible, so nothing an operator has left in the directory is at risk.
  removed=$(find "$BACKUP_DIR" -maxdepth 1 -name "${POSTGRES_DB}-*.sql.gz" \
    -type f -mtime "+${KEEP_DAYS}" -print -delete | wc -l)
  [ "$removed" -gt 0 ] && log "pruned $removed backup(s) older than ${KEEP_DAYS}d"
  # Sweep any temporary file a killed run left behind. A day is long enough
  # that a dump still in progress is never caught by this.
  find "$BACKUP_DIR" -maxdepth 1 -name '.in-progress-*' -type f -mtime +1 -delete
  return 0
}

log "starting — every ${INTERVAL}s, keeping ${KEEP_DAYS} days, into ${BACKUP_DIR}"

while true; do
  if dump_once; then
    # Only after a success: a week of failures must not age out the last good
    # backup the gym still has.
    prune
  fi
  sleep "$INTERVAL"
done
