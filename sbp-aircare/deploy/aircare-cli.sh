#!/usr/bin/env bash
# SBP AirCare — run the admin command line (server/cli.mjs) with the site's own settings and data. Rev.10.
#   deploy/aircare-cli.sh staff add somchai "สมชาย ใจดี" admin      (asks for a password of 10+ characters)
#   deploy/aircare-cli.sh staff list | staff passwd <user> | staff disable <user> | staff enable <user>
#   deploy/aircare-cli.sh backup | verify-backup <file> | outbox | export <ticket id> | anonymize <ticket id>
#   deploy/aircare-cli.sh restore <file>      only while the site is stopped (deploy/DEPLOY_TH.md, restore)
# Docker install (deploy/.env exists): runs inside the app container (paths are container paths: /data/backups/…).
# Ubuntu + systemd: runs as the aircare user with /etc/aircare/aircare.env, like the service — never as root, so the
# database files stay owned by aircare.
set -euo pipefail
APP_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
CLI=(node --disable-warning=ExperimentalWarning server/cli.mjs)
if (( $# == 0 )); then sed -n '2,7p' "${BASH_SOURCE[0]}"; exit 2; fi
TTY=(); [[ -t 0 && -t 1 ]] || TTY=(-T)

if [[ -f $APP_DIR/deploy/.env ]] && command -v docker >/dev/null 2>&1; then
  DC=(docker compose -f "$APP_DIR/deploy/compose.yaml")
  if [[ -n $("${DC[@]}" ps -q --status running app) ]]; then
    if [[ $1 == restore ]]; then echo "✗ stop the site first: docker compose -f deploy/compose.yaml stop app" >&2; exit 1; fi
    exec "${DC[@]}" exec "${TTY[@]}" app "${CLI[@]}" "$@"
  fi
  exec "${DC[@]}" run --rm --no-deps "${TTY[@]}" app "${CLI[@]}" "$@"
fi

[[ -f /etc/aircare/aircare.env ]] || { echo "✗ no deploy/.env (Docker) and no /etc/aircare/aircare.env (systemd) — see deploy/DEPLOY_TH.md" >&2; exit 1; }
if [[ $1 == restore ]] && systemctl is-active --quiet aircare; then echo "✗ stop the site first: sudo systemctl stop aircare" >&2; exit 1; fi
PTY=(--pty); [[ -t 0 && -t 1 ]] || PTY=(--pipe)
exec sudo systemd-run --quiet --wait --collect "${PTY[@]}" --uid=aircare --gid=aircare \
  -p EnvironmentFile=/etc/aircare/aircare.env -p WorkingDirectory="$APP_DIR" -p UMask=0077 \
  /usr/bin/node --disable-warning=ExperimentalWarning server/cli.mjs "$@"
