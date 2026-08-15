#!/usr/bin/env bash
#
# Provision the VPS for the Carico worker — the second half of Family C.
#
# Il Carico lands footage in /srv/ggo-media/inbox; this installs the thing
# that consumes it: ffmpeg, whisper.cpp, and a systemd timer that runs one
# worker pass every few minutes as `jj`.
#
# The worker script itself ships with the app (tools/worker/carico-worker.mjs),
# so a deploy updates it; this script only provisions what lives outside the
# repo.
#
# Usage (as root on the server):
#   worker-setup.sh inspect   read-only report — changes nothing
#   worker-setup.sh apply     provision; idempotent, safe to re-run
#
# Run inspect first, as with carico-setup.sh.

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/ggo-content-manager}"
MEDIA_ROOT="${MEDIA_ROOT:-/srv/ggo-media}"
RUN_AS="${RUN_AS:-jj}"
UNIT="${UNIT:-ggo-carico-worker}"
WHISPER_DIR="${WHISPER_DIR:-/opt/whisper.cpp}"
WHISPER_MODEL_NAME="${WHISPER_MODEL_NAME:-base}"
FFMPEG_URL="${FFMPEG_URL:-https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz}"
INTERVAL="${INTERVAL:-5min}"

mode="${1:-inspect}"

rule() { printf '\n── %s ──\n' "$1"; }

inspect() {
    rule "ffmpeg / ffprobe"
    /usr/local/bin/ffmpeg -version 2>/dev/null | head -1 || echo "ffmpeg NOT installed"
    /usr/local/bin/ffprobe -version 2>/dev/null | head -1 || echo "ffprobe NOT installed"

    rule "whisper.cpp"
    if [ -x "$WHISPER_DIR/build/bin/whisper-cli" ]; then
        echo "whisper-cli present"
    else
        echo "whisper-cli NOT built"
    fi
    ls -la "$WHISPER_DIR/models/ggml-$WHISPER_MODEL_NAME.bin" 2>/dev/null || echo "model NOT downloaded"

    rule "worker script (ships with the app)"
    ls -la "$APP_DIR/tools/worker/carico-worker.mjs" 2>&1 || true

    rule "media directories"
    ls -ld "$MEDIA_ROOT/inbox" "$MEDIA_ROOT/ready" 2>&1 || true

    rule "systemd"
    systemctl status "$UNIT.timer" --no-pager 2>&1 | head -5 || true
    systemctl list-timers "$UNIT.timer" --no-pager 2>&1 | head -3 || true

    rule "last pass"
    journalctl -u "$UNIT.service" -n 15 --no-pager 2>&1 || true
}

apply() {
    rule "ffmpeg"
    if [ -x /usr/local/bin/ffmpeg ] && [ -x /usr/local/bin/ffprobe ]; then
        echo "already installed — skipping"
    else
        tmp=$(mktemp -d)
        curl -sL -o "$tmp/ffmpeg.tar.xz" "$FFMPEG_URL"
        tar xf "$tmp/ffmpeg.tar.xz" -C "$tmp"
        install -m755 "$tmp"/ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ffmpeg
        install -m755 "$tmp"/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ffprobe
        rm -rf "$tmp"
        echo "installed $(/usr/local/bin/ffmpeg -version | head -1)"
    fi

    rule "whisper.cpp"
    if [ -x "$WHISPER_DIR/build/bin/whisper-cli" ]; then
        echo "already built — skipping"
    else
        dnf install -y -q cmake gcc-c++ make git
        rm -rf "$WHISPER_DIR"
        git clone -q --depth 1 https://github.com/ggml-org/whisper.cpp "$WHISPER_DIR"
        cmake -S "$WHISPER_DIR" -B "$WHISPER_DIR/build" -DCMAKE_BUILD_TYPE=Release -DWHISPER_BUILD_TESTS=OFF >/dev/null
        cmake --build "$WHISPER_DIR/build" -j"$(nproc)" --config Release >/dev/null
        echo "built whisper-cli"
    fi
    if [ ! -f "$WHISPER_DIR/models/ggml-$WHISPER_MODEL_NAME.bin" ]; then
        (cd "$WHISPER_DIR" && bash ./models/download-ggml-model.sh "$WHISPER_MODEL_NAME" >/dev/null)
        echo "downloaded model $WHISPER_MODEL_NAME"
    else
        echo "model already present"
    fi

    rule "media directories"
    mkdir -p "$MEDIA_ROOT/inbox" "$MEDIA_ROOT/ready"
    chown -R "$RUN_AS:$RUN_AS" "$MEDIA_ROOT"
    ls -ld "$MEDIA_ROOT/inbox" "$MEDIA_ROOT/ready"

    rule "systemd unit + timer"
    # Type=oneshot with a timer, not a daemon: a pass that wedges cannot
    # wedge the next one, and the log reads as a series of discrete passes.
    cat > "/etc/systemd/system/$UNIT.service" <<UNITEOF
[Unit]
Description=Il Carico worker — consume the media inbox (Family C)
After=network-online.target

[Service]
Type=oneshot
User=$RUN_AS
WorkingDirectory=$APP_DIR
Environment=COCKPIT_MEDIA_ROOT=$MEDIA_ROOT
Environment=COCKPIT_FFMPEG=/usr/local/bin/ffmpeg
Environment=COCKPIT_FFPROBE=/usr/local/bin/ffprobe
Environment=COCKPIT_WHISPER=$WHISPER_DIR/build/bin/whisper-cli
Environment=COCKPIT_WHISPER_MODEL=$WHISPER_DIR/models/ggml-$WHISPER_MODEL_NAME.bin
ExecStart=/usr/bin/node $APP_DIR/tools/worker/carico-worker.mjs
# ffmpeg and whisper are the point of the machine at night, but they must
# never starve the cockpit that JJ is using.
Nice=10
IOSchedulingClass=idle
TimeoutStartSec=6h

[Install]
WantedBy=multi-user.target
UNITEOF

    cat > "/etc/systemd/system/$UNIT.timer" <<TIMEREOF
[Unit]
Description=Run the Carico worker every $INTERVAL

[Timer]
OnBootSec=2min
OnUnitInactiveSec=$INTERVAL
# A pass that overruns must not stack up behind itself.
AccuracySec=30s

[Install]
WantedBy=timers.target
TIMEREOF

    systemctl daemon-reload
    systemctl enable --now "$UNIT.timer"
    systemctl list-timers "$UNIT.timer" --no-pager | head -3
}

case "$mode" in
    inspect) inspect ;;
    apply)   apply; echo; inspect ;;
    *) echo "usage: $0 inspect|apply" >&2; exit 2 ;;
esac
