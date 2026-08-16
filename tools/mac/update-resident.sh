#!/bin/bash
# Auto-update for the resident service on the Mac — the pull-based mirror of
# the VPS's push deploy (GitHub cannot reach the Mac, so the Mac polls).
#
# Run by the LaunchAgent uk.co.ggomed.content-manager.update every 15 min:
# if origin/main moved, pull → npm ci → build → kickstart the web service.
# Silent no-op when there is nothing new. Aborts (loudly, in the log) when
# the working tree is dirty rather than stomping on local work.
#
# Install (once, from the repo root on the Mac):
#   sed "s|__REPO__|$(pwd)|g" tools/mac/uk.co.ggomed.content-manager.update.plist \
#     > ~/Library/LaunchAgents/uk.co.ggomed.content-manager.update.plist
#   launchctl bootstrap gui/$UID ~/Library/LaunchAgents/uk.co.ggomed.content-manager.update.plist
# Log: /tmp/ggo-cockpit-update.log
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SERVICE_LABEL="uk.co.ggomed.content-manager.web"
cd "$REPO_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

if [ -n "$(git status --porcelain)" ]; then
    log "working tree dirty — skipping auto-update (commit or stash first)"
    exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
    log "on branch '$BRANCH', not main — skipping auto-update"
    exit 0
fi

git fetch origin main --quiet
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0 # already current — say nothing
fi

log "updating $LOCAL -> $REMOTE"
git merge --ff-only origin/main --quiet
npm ci --no-audit --no-fund
npm run build
launchctl kickstart -k "gui/$(id -u)/$SERVICE_LABEL"
log "resident service restarted on $(git rev-parse --short HEAD)"
