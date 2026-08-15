#!/usr/bin/env bash
#
# Provision the VPS to run ernesto-agents-house's scheduled jobs.
#
# Why: the night runs live in launchd on the Mac, and the Mac's connection
# is what makes them flaky after dark. Il Carico took the Mac out of the
# ingest path; this takes it out of the batch path.
#
# Transport is rsync from the Mac, not a git clone — the repo is private and
# the VPS holds no GitHub credentials, and this matches how the cockpit is
# already deployed (/srv is copied files, not a checkout).
#
# SECRETS ARE NOT COPIED. The env file is created by JJ on the server, with
# NEW tokens, so the Mac's credentials stay on the Mac and the two sets can
# be revoked separately — the same rule the cockpit deploy follows.
#
# Usage (as root on the server):
#   ernesto-setup.sh inspect   read-only report — changes nothing
#   ernesto-setup.sh apply     install units for MOVEABLE jobs (see below)
#   ernesto-setup.sh enable    start the timers (deliberately separate)
#
# `apply` installs the units but leaves them disabled: a job that runs in
# two places at once writes to Notion twice. Enabling is the moment the
# Mac's launchd equivalent must be unloaded, so it is its own step.

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/ggo-ernesto}"
ENV_FILE="${ENV_FILE:-/etc/ggo-ernesto.env}"
RUN_AS="${RUN_AS:-jj}"
PREFIX="${PREFIX:-ggo-ernesto}"

# Jobs that run on the server, as: name|schedule(OnCalendar)|command
# Only jobs whose inputs and outputs are Notion/Sanity/HTTP belong here.
# Anything that reads the Mac's filesystem, drives the `claude` CLI, or
# needs ffmpeg on local footage stays on the Mac — see docs/DEPLOY-REMOTE.md.
JOBS_FILE="${JOBS_FILE:-$APP_DIR/tools/vps-jobs.txt}"

mode="${1:-inspect}"

rule() { printf '\n── %s ──\n' "$1"; }

inspect() {
    rule "app directory"
    ls -ld "$APP_DIR" 2>&1 || echo "not deployed yet"
    ls "$APP_DIR/cron" 2>/dev/null | head -5 || true

    rule "node + deps"
    node -v
    [ -d "$APP_DIR/node_modules" ] && echo "node_modules present" || echo "node_modules MISSING — run apply"

    rule "env file (presence only — values are secret)"
    if [ -f "$ENV_FILE" ]; then
        echo "present, $(grep -c '^[A-Z]' "$ENV_FILE" 2>/dev/null || echo 0) variables set"
    else
        echo "MISSING — JJ must create it (see the runbook)"
    fi

    rule "job list"
    cat "$JOBS_FILE" 2>/dev/null || echo "no job list at $JOBS_FILE"

    rule "installed timers"
    systemctl list-timers "$PREFIX-*" --no-pager 2>/dev/null | head -20 || true

    rule "recent runs"
    journalctl -u "$PREFIX-*" --since "24 hours ago" --no-pager 2>/dev/null | tail -20 || true
}

apply() {
    [ -d "$APP_DIR" ] || { echo "deploy the files first (rsync from the Mac)" >&2; exit 1; }
    [ -f "$JOBS_FILE" ] || { echo "no job list at $JOBS_FILE" >&2; exit 1; }

    rule "dependencies"
    if [ -f "$APP_DIR/pnpm-lock.yaml" ]; then
        command -v pnpm >/dev/null || npm install -g pnpm
        (cd "$APP_DIR" && pnpm install --frozen-lockfile)
    else
        (cd "$APP_DIR" && npm ci)
    fi

    rule "env file"
    if [ ! -f "$ENV_FILE" ]; then
        # A template with names only. JJ fills the values with NEW tokens.
        cat > "$ENV_FILE" <<'ENVEOF'
# ernesto-agents-house on the VPS — fill with NEW tokens, not the Mac's.
NOTION_TOKEN=
SANITY_PROJECT_ID=
SANITY_API_VERSION=
GGOMED_SITE_URL=
COCKPIT_VIEWS_URL=https://cockpit.ggo-suite.co.uk
COCKPIT_SERVICE_TOKEN=
ENVEOF
        chmod 600 "$ENV_FILE"
        chown root:root "$ENV_FILE"
        echo "template written to $ENV_FILE — JJ must fill it before enabling"
    else
        echo "already present — left untouched"
    fi

    rule "units"
    while IFS='|' read -r name schedule command; do
        case "$name" in ''|\#*) continue ;; esac
        unit="$PREFIX-$name"

        cat > "/etc/systemd/system/$unit.service" <<UNITEOF
[Unit]
Description=ernesto — $name
After=network-online.target

[Service]
Type=oneshot
User=$RUN_AS
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node $APP_DIR/$command
Nice=5
TimeoutStartSec=2h

[Install]
WantedBy=multi-user.target
UNITEOF

        cat > "/etc/systemd/system/$unit.timer" <<TIMEREOF
[Unit]
Description=ernesto — $name ($schedule)

[Timer]
OnCalendar=$schedule
# The VPS is UTC; the Mac's launchd ran on London time. Keep the house on
# one clock so a job does not drift an hour twice a year.
Persistent=true
RandomizedDelaySec=120

[Install]
WantedBy=timers.target
TIMEREOF
        echo "installed $unit ($schedule)"
    done < "$JOBS_FILE"

    systemctl daemon-reload
    echo
    echo "Units installed but NOT enabled. Enable them one at a time, and"
    echo "unload the matching launchd job on the Mac in the same breath:"
    echo "  ernesto-setup.sh enable"
}

enable_timers() {
    while IFS='|' read -r name schedule command; do
        case "$name" in ''|\#*) continue ;; esac
        systemctl enable --now "$PREFIX-$name.timer"
        echo "enabled $PREFIX-$name.timer"
    done < "$JOBS_FILE"
    systemctl list-timers "$PREFIX-*" --no-pager | head -20
}

case "$mode" in
    inspect) inspect ;;
    apply)   apply; echo; inspect ;;
    enable)  enable_timers ;;
    *) echo "usage: $0 inspect|apply|enable" >&2; exit 2 ;;
esac
