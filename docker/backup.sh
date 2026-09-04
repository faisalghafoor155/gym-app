#!/bin/sh
# Dumps the database, encrypts it, copies it offsite, then deletes dumps older
# than the retention window.
#
# Runs in a loop inside its own container rather than as a cron daemon: the
# image is postgres:17-alpine, which has pg_dump but no cron, and adding one
# would mean a second process to supervise for no gain. `sleep` until the next
# run is the whole scheduler.
#
# Four properties matter more than the schedule:
#
#   * A dump is written to a temporary name and moved into place only once
#     pg_dump has succeeded. A backup directory must never contain a file that
#     looks like a backup but is half a database — that is worse than an empty
#     directory, because it is trusted.
#   * A failed dump never deletes anything. Retention runs only after a
#     success, so a week of failures leaves the last good backup alone instead
#     of quietly ageing it out.
#   * A dump holds every member's name, phone, address and payment history. On
#     disk that is a plaintext copy of the gym's entire customer list, and it
#     outlives the machine it was taken on — it gets copied to a laptop, a USB
#     stick, an object store. So it is encrypted before it is ever written,
#     with a key that is not the database password.
#   * A backup that only exists on the machine it was taken from is not a
#     backup. The disk that loses the database loses the dumps beside it, and
#     ransomware encrypts both in the same pass. So a copy goes offsite.
#
# Encryption and offsite upload are both OPTIONAL and both warn loudly when
# unset, rather than being mandatory. A gym running this on a laptop to try the
# app out should not be stopped by a missing S3 bucket; a gym running it for
# real needs to be told, every single run, that its members' data is sitting in
# plaintext on one disk.

set -eu

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
# How often to dump, in seconds. 86400 is a day.
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
# How many days of dumps to keep.
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
DB_HOST="${BACKUP_DB_HOST:-db}"

# Encrypts the dump at rest. Any passphrase; 32+ random characters is the
# sensible shape. Unset means dumps are written in plaintext.
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Offsite copy. Works with any S3-compatible store — AWS S3, Backblaze B2,
# Cloudflare R2, Wasabi, MinIO — because all of them speak SigV4.
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
S3_REGION="${BACKUP_S3_REGION:-us-east-1}"
# Only for non-AWS providers. AWS itself is derived from the bucket and region.
S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-}"
S3_PREFIX="${BACKUP_S3_PREFIX:-}"
S3_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:-}"
S3_SECRET="${BACKUP_S3_SECRET_ACCESS_KEY:-}"

mkdir -p "$BACKUP_DIR"

log() { echo "[backup] $(date -u '+%Y-%m-%d %H:%M:%SZ') $*"; }

# The tools for encryption and upload are not in postgres:17-alpine, and are
# added here rather than in a Dockerfile so the image stays the stock one —
# guaranteeing pg_dump matches the server version, which is the whole reason
# this container shares the database's image. openssl and curl together are
# about a megabyte; the aws-cli would have been 193MB of Python for one PUT.
ensure_tools() {
  need=""
  [ -n "$ENCRYPTION_KEY" ] && ! command -v openssl >/dev/null 2>&1 && need="$need openssl"
  [ -n "$S3_BUCKET" ] && ! command -v curl >/dev/null 2>&1 && need="$need curl"
  [ -z "$need" ] && return 0

  log "installing:$need"
  # shellcheck disable=SC2086
  if ! apk add --no-cache $need >/dev/null 2>&1; then
    log "WARNING: could not install$need — check the container has network access"
    return 1
  fi
  return 0
}

# Said once at startup rather than left for an operator to discover after the
# disk dies. Both of these are the difference between a backup and a liability.
warn_config() {
  if [ -z "$ENCRYPTION_KEY" ]; then
    log "WARNING: BACKUP_ENCRYPTION_KEY is not set — dumps are PLAINTEXT copies"
    log "         of every member's personal and payment data. Set it in .env."
  fi
  if [ -z "$S3_BUCKET" ]; then
    log "WARNING: BACKUP_S3_BUCKET is not set — backups stay on this machine"
    log "         only. A disk failure loses the database and every dump with it."
  fi
}

# AES-256-CBC with a key derived by PBKDF2, which is what `openssl enc -pbkdf2`
# gives. Not GCM: the openssl CLI cannot stream an authenticated tag over a
# pipe, and the integrity that matters here is caught anyway — a corrupted file
# fails to decrypt, and restore.sh checks the archive before touching the
# database.
#
# The passphrase goes in through a file descriptor, never the command line: an
# argument is visible in `ps` to every process in the container.
encrypt_file() {
  src="$1"
  dst="$2"
  if printf '%s' "$ENCRYPTION_KEY" \
     | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
         -pass stdin -in "$src" -out "$dst" 2>/tmp/enc.err; then
    rm -f "$src"
    return 0
  fi
  log "FAILED to encrypt: $(tr '\n' ' ' < /tmp/enc.err)"
  rm -f "$dst"
  return 1
}

# A plain PUT, signed with SigV4 by curl itself. No SDK, no credentials file.
upload_file() {
  file="$1"
  name=$(basename "$file")

  if [ -z "$S3_KEY_ID" ] || [ -z "$S3_SECRET" ]; then
    log "WARNING: BACKUP_S3_BUCKET is set but its credentials are not — skipping upload"
    return 1
  fi

  if [ -n "$S3_ENDPOINT" ]; then
    url="${S3_ENDPOINT%/}/${S3_BUCKET}/${S3_PREFIX:+${S3_PREFIX%/}/}${name}"
  else
    url="https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${S3_PREFIX:+${S3_PREFIX%/}/}${name}"
  fi

  # --aws-sigv4 needs the region and service to build the signing scope.
  # -sS keeps it quiet but still prints the reason it failed.
  code=$(curl -sS -o /tmp/upload.out -w '%{http_code}' -X PUT \
    --aws-sigv4 "aws:amz:${S3_REGION}:s3" \
    --user "${S3_KEY_ID}:${S3_SECRET}" \
    --upload-file "$file" \
    "$url" 2>/tmp/upload.err) || {
      log "FAILED to upload: $(tr '\n' ' ' < /tmp/upload.err)"
      return 1
    }

  case "$code" in
    2*) log "uploaded $name to ${S3_BUCKET}"; return 0 ;;
    *)  log "FAILED to upload $name — HTTP $code $(tr '\n' ' ' < /tmp/upload.out | head -c 200)"
        return 1 ;;
  esac
}

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

  # Encrypted before it is moved into place, so a readable dump never exists
  # under a name anything looks for. A failure here fails the whole run rather
  # than falling back to plaintext: an operator who asked for encryption must
  # not silently get none.
  if [ -n "$ENCRYPTION_KEY" ]; then
    final="${final}.enc"
    if ! encrypt_file "$tmp" "${tmp}.enc"; then
      rm -f "$tmp"
      return 1
    fi
    tmp="${tmp}.enc"
  fi

  mv "$tmp" "$final"
  log "wrote $(basename "$final") ($(du -h "$final" | cut -f1))"

  # Upload failure does not fail the run: the local dump is already written and
  # is still a backup. It is logged loudly and retried on the next cycle.
  [ -n "$S3_BUCKET" ] && upload_file "$final" || true

  return 0
}

prune() {
  # -mtime +N is "older than N days". Only files matching the dump pattern are
  # eligible, so nothing an operator has left in the directory is at risk.
  # Both suffixes are swept, so turning encryption on does not strand the
  # plaintext dumps taken before it.
  removed=$(find "$BACKUP_DIR" -maxdepth 1 \
    \( -name "${POSTGRES_DB}-*.sql.gz" -o -name "${POSTGRES_DB}-*.sql.gz.enc" \) \
    -type f -mtime "+${KEEP_DAYS}" -print -delete | wc -l)
  [ "$removed" -gt 0 ] && log "pruned $removed backup(s) older than ${KEEP_DAYS}d"
  # Sweep any temporary file a killed run left behind. A day is long enough
  # that a dump still in progress is never caught by this.
  find "$BACKUP_DIR" -maxdepth 1 -name '.in-progress-*' -type f -mtime +1 -delete
  # Deliberately not pruned offsite. Remote retention belongs to a bucket
  # lifecycle rule, which survives this container being wrong — and a script
  # that can delete its own offsite copies is one bug away from deleting all of
  # them. See the backup section of README.md for the rule to set.
  return 0
}

log "starting — every ${INTERVAL}s, keeping ${KEEP_DAYS} days, into ${BACKUP_DIR}"
warn_config
ensure_tools || log "continuing without them — see the warning above"

while true; do
  if dump_once; then
    # Only after a success: a week of failures must not age out the last good
    # backup the gym still has.
    prune
  fi
  sleep "$INTERVAL"
done
