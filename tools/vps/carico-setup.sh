#!/usr/bin/env bash
#
# Provision the VPS for Il Carico — the media inbox behind /carico.
#
# The app ships itself (deploy-vps.yml), but the inbox needs three things
# that live outside the repo: the media root, the env var pointing at it,
# and an nginx willing to accept a chunk. This script is the whole of that,
# kept as a real file rather than inlined in YAML so it can be read, linted
# and run by hand over plain ssh when that is easier.
#
# Usage (as root on the server):
#   carico-setup.sh inspect   read-only report — changes nothing
#   carico-setup.sh apply     provision; idempotent, safe to re-run
#
# Run inspect first. Editing a production nginx config blind is how sites
# go down; looking costs one minute.

set -euo pipefail

MEDIA_ROOT="${MEDIA_ROOT:-/srv/ggo-media}"
DROPIN="${DROPIN:-/etc/nginx/conf.d/00-carico-upload.conf}"
ENV_FILE="${ENV_FILE:-/etc/ggo-content-manager.env}"
SERVICE="${SERVICE:-ggo-content-manager}"
SITE_CONF="${SITE_CONF:-/etc/nginx/conf.d/ggo-content-manager.conf}"
APP_URL="${APP_URL:-http://127.0.0.1:3010}"

mode="${1:-inspect}"

rule() { printf '\n── %s ──\n' "$1"; }

# ─────────────────────────────────────────────────────────────────────────
# inspect — read-only.
#
# Deliberately never cats the env file: it holds COCKPIT_SERVICE_TOKEN,
# AUTH_SECRET and the Notion key, and CI logs are visible to every
# collaborator. Presence, never value.
# ─────────────────────────────────────────────────────────────────────────
inspect() {
    rule "media root"
    ls -ld "$MEDIA_ROOT" "$MEDIA_ROOT/inbox" "$MEDIA_ROOT/staging" 2>&1 || true

    rule "COCKPIT_MEDIA_ROOT set? (name only — values are secret)"
    if grep -q "^COCKPIT_MEDIA_ROOT=" "$ENV_FILE" 2>/dev/null; then
        echo "yes — already set"
    else
        echo "no — not set"
    fi

    rule "does nginx include conf.d inside http?"
    grep -n "include.*conf\.d" /etc/nginx/nginx.conf || echo "NO — a drop-in there would not be read"

    rule "body/buffering directives already set anywhere?"
    grep -rn "client_max_body_size\|proxy_request_buffering\|client_body_timeout" \
        /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>/dev/null || echo "none set"

    rule "the cockpit server block"
    cat "$SITE_CONF" 2>&1 || true

    rule "services"
    systemctl is-active nginx "$SERVICE" || true
}

# ─────────────────────────────────────────────────────────────────────────
# apply — idempotent provisioning.
# ─────────────────────────────────────────────────────────────────────────
apply() {
    rule "media root"
    # Kept OUTSIDE /srv/ggo-content-manager on purpose: the deploy rsyncs
    # --delete over the app directory, which would erase unprocessed footage.
    mkdir -p "$MEDIA_ROOT/inbox" "$MEDIA_ROOT/staging"
    chown -R jj:jj "$MEDIA_ROOT"
    chmod 750 "$MEDIA_ROOT"
    ls -ld "$MEDIA_ROOT/inbox" "$MEDIA_ROOT/staging"

    rule "env"
    if grep -q "^COCKPIT_MEDIA_ROOT=" "$ENV_FILE"; then
        echo "COCKPIT_MEDIA_ROOT already present — left untouched"
    else
        {
            echo ""
            echo "# Il Carico — media inbox. Outside the app dir by design:"
            echo "# the deploy rsyncs --delete over /srv/ggo-content-manager."
            echo "COCKPIT_MEDIA_ROOT=$MEDIA_ROOT"
        } >>"$ENV_FILE"
        echo "COCKPIT_MEDIA_ROOT added"
    fi

    rule "nginx"
    # An additive drop-in rather than an edit of the existing server block:
    # nothing to parse, nothing to corrupt, and undoing it is deleting one
    # file. conf.d is included inside http{}, so these are defaults that a
    # server block may still override.
    # if-statements, not "[ … ] && x": under set -e a false test is a failed
    # statement, so the common case (no drop-in yet) would abort the run.
    local restore=0
    if [ -f "$DROPIN" ]; then
        restore=1
        cp -a "$DROPIN" "$DROPIN.prev"
    fi

    cat >"$DROPIN" <<'NGINX'
# Il Carico - chunked uploads from the phone (managed by carico-setup.sh).
# Without these nginx rejects every chunk at its 1 MB default and spools
# whole request bodies to disk before the app sees a byte.
client_max_body_size 32m;
client_body_timeout  300s;
proxy_request_buffering off;
NGINX

    if nginx -t; then
        systemctl reload nginx
        rm -f "$DROPIN.prev"
        echo "nginx reloaded"
    else
        echo "nginx rejected the drop-in — reverting, server left as it was" >&2
        if [ "$restore" = "1" ]; then
            mv "$DROPIN.prev" "$DROPIN"
        else
            rm -f "$DROPIN"
        fi
        nginx -t
        exit 1
    fi

    rule "restart the app so it reads the new env"
    systemctl restart "$SERVICE"
    verify
}

verify() {
    rule "the service answers"
    local code=000
    for i in $(seq 1 12); do
        sleep 5
        code=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/login") || code=000
        echo "attempt $i → HTTP $code"
        # An if, not "&& break": under set -e a failed test would end the
        # run on the first non-200, which is what the retry exists for.
        if [ "$code" = "200" ]; then break; fi
    done
    if [ "$code" != "200" ]; then
        journalctl -u "$SERVICE" --since "-3 min" --no-pager | tail -30
        exit 1
    fi

    rule "the service user can actually write the inbox"
    if sudo -u jj test -w "$MEDIA_ROOT/inbox"; then
        echo "inbox writable by jj"
    else
        echo "inbox NOT writable by jj" >&2
        exit 1
    fi

    rule "/carico is served"
    curl -s -o /dev/null -w "carico → %{http_code} (307 to /login = auth gate holding)\n" \
        "$APP_URL/carico"
}

case "$mode" in
    inspect) inspect ;;
    apply) inspect; apply ;;
    *)
        echo "usage: $0 [inspect|apply]" >&2
        exit 2
        ;;
esac
