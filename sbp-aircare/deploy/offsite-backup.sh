#!/usr/bin/env bash
# SBP AirCare — nightly database backup + off-site copy with rclone. Rev.10.
#   1. server/backup.mjs makes a consistent copy while the site keeps running (VACUUM INTO) and checks it
#      (PRAGMA integrity_check); the newest BACKUP_KEEP copies stay on this server
#   2. rclone uploads that file to RCLONE_REMOTE (e.g. r2:sbp-aircare-backup/db) and checks the upload
#   3. remote copies older than OFFSITE_KEEP_DAYS (default 30) are deleted — only aircare-YYYYMMDD-HHMMSS.sqlite files,
#      and never the newest 7, so a long outage followed by one good night cannot empty the remote
#   4. optional dead-man's switch: HC_PING_URL (a Healthchecks.io check) gets /start, then success or /fail
# Plain install: aircare-backup.timer runs this as the aircare user with /etc/aircare/aircare.env loaded.
# Docker install: run it as root from cron —  AIRCARE_DOCKER=1 /opt/aircare/sbp-aircare/deploy/offsite-backup.sh
#   (the backup runs inside the app container, the file is copied out with "docker compose cp", then uploaded)
# Each setting comes from the environment, else from deploy/.env (read as plain text, never executed).
# Exit status: 0 done · 1 failed · 3 local copy made but RCLONE_REMOTE is not set (nothing left this server).
set -euo pipefail
export LC_ALL=C
umask 077

APP_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE=${ENV_FILE:-$APP_DIR/deploy/.env}
MIN_COPIES=7
HC='' STAGE=''
cd "$APP_DIR"

setting() {   # $1 = name → value from the environment, else the last "$1=" line of ENV_FILE
  local v=${!1:-}
  if [[ -z $v && -r $ENV_FILE ]]; then
    v=$(sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | tr -d '\r' | sed -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/")
  fi
  printf '%s' "$v"
}
log() { printf '%s %s\n' "$(TZ=Asia/Bangkok date '+%Y-%m-%d %H:%M:%S')" "$*"; }
hc() {   # Healthchecks.io ping: "" = success, /start, /fail — a ping problem never fails the backup itself
  if [[ -n $HC ]] && command -v curl >/dev/null 2>&1; then curl -fsS -m 10 --retry 3 -o /dev/null "$HC$1" || true; fi
}
fail() { log "✗ $*" >&2; exit 1; }
finish() {   # every non-zero exit (fail, exit 3, set -e) reports /fail; the staging folder never outlives the run
  local status=$?
  if [[ -n $STAGE ]]; then rm -rf -- "$STAGE"; fi
  if (( status != 0 )); then hc /fail; fi
}

REMOTE=$(setting RCLONE_REMOTE); REMOTE=${REMOTE%/}
KEEP_DAYS=$(setting OFFSITE_KEEP_DAYS); KEEP_DAYS=${KEEP_DAYS:-30}
HC=$(setting HC_PING_URL); HC=${HC%/}
RC=$(setting RCLONE_CONFIG)
if [[ -n $RC ]]; then export RCLONE_CONFIG=$RC; fi
trap finish EXIT
trap 'log "✗ line $LINENO: a command failed" >&2' ERR

[[ $KEEP_DAYS =~ ^[0-9]{1,5}$ ]] && (( 10#$KEEP_DAYS >= 1 )) || fail "OFFSITE_KEEP_DAYS must be a whole number of days (1 or more)"
KEEP_DAYS=$(( 10#$KEEP_DAYS ))
hc /start

# 1 — local copy, verified by backup.mjs (it exits non-zero when the copy fails PRAGMA integrity_check)
NODE=(node --disable-warning=ExperimentalWarning)
file_of() { sed -n 's/^ *"file": *"\([^"]*\)".*$/\1/p' | head -n 1; }
if [[ ${AIRCARE_DOCKER:-} == 1 ]]; then
  command -v docker >/dev/null 2>&1 || fail "docker is not installed"
  DC=(docker compose -f "$APP_DIR/deploy/compose.yaml")
  out=$("${DC[@]}" exec -T app "${NODE[@]}" server/backup.mjs) || fail "backup inside the app container failed (is it running? docker compose -f deploy/compose.yaml ps)"
  src=$(file_of <<<"$out")
  [[ $src == /* ]] || fail "server/backup.mjs did not report a file"
  STAGE=$(mktemp -d)
  "${DC[@]}" --progress quiet cp "app:$src" "$STAGE/" || fail "could not copy $src out of the container"
  file=$STAGE/${src##*/}
else
  out=$("${NODE[@]}" "$APP_DIR/server/backup.mjs") || fail "server/backup.mjs failed"
  file=$(file_of <<<"$out")
fi
[[ -s $file ]] || fail "backup file '$file' is missing or empty"
name=${file##*/}
log "✓ local copy $name ($(stat -c %s "$file") bytes, integrity_check ok)"

# 2 — off-site copy
if [[ -z $REMOTE ]]; then
  log "⚠ RCLONE_REMOTE is not set: this copy exists on this server only (deploy/DEPLOY_TH.md, off-site backups)" >&2
  exit 3
fi
command -v rclone >/dev/null 2>&1 || fail "rclone is not installed (sudo apt install rclone)"
rclone copyto "$file" "$REMOTE/$name" || fail "upload to $REMOTE failed"
rclone check "$(dirname -- "$file")" "$REMOTE" --one-way --include "$name" || fail "the uploaded copy of $name does not match"
log "✓ off-site copy $REMOTE/$name"

# 3 — prune the remote by the date in the file name (Bangkok time, like the names), keeping at least MIN_COPIES
cut="aircare-$(TZ=Asia/Bangkok date -d "-$KEEP_DAYS days" +%Y%m%d)-000000.sqlite"
listing=$(rclone lsf "$REMOTE" --files-only --include 'aircare-*.sqlite') || fail "could not list $REMOTE"
mapfile -t copies < <(grep -E '^aircare-[0-9]{8}-[0-9]{6}\.sqlite$' <<<"$listing" | sort)
removed=0
for (( i = 0; i < ${#copies[@]} - MIN_COPIES; i++ )); do
  [[ ${copies[i]} < "$cut" ]] || break
  rclone deletefile "$REMOTE/${copies[i]}" || fail "could not delete the old remote copy ${copies[i]}"
  removed=$((removed + 1))
done
log "✓ remote keeps $(( ${#copies[@]} - removed )) copies · removed $removed older than $KEEP_DAYS days"
hc ""
