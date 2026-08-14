# Remote deployment — VPS runbook (live since 2026-08-08)

> The cockpit runs in production on an IONOS VPS. This document describes
> the deployment as it actually exists — provider, layout, and how to ship
> an update. (The original Hetzner/Caddy plan is superseded.)

## The server

| | |
|---|---|
| Provider | IONOS (XL instance) |
| IP | `85.215.37.39` |
| Domain | `cockpit.ggo-suite.co.uk` |
| OS | AlmaLinux 9 |
| Specs | 8 vCPU, 15 GB RAM, 479 GB disk |
| Node | v24.x (system install) |
| Access | `ssh -i ~/.ssh/ionos_ggo_xl root@85.215.37.39` |

## Application layout

- App lives in `/srv/ggo-content-manager` — **copied files, not a git
  clone**. Deploys are file syncs from the Mac, not `git pull`.
- Runs as user `jj` via systemd unit `ggo-content-manager.service`
  (enabled, `npm run start` on port 3010).
- Environment: `/etc/ggo-content-manager.env` (includes
  `COCKPIT_SERVICE_TOKEN`; server tokens are separate from the Mac's so
  they can be revoked independently).
- nginx reverse-proxies `cockpit.ggo-suite.co.uk` → `127.0.0.1:3010`
  (config: `/etc/nginx/conf.d/ggo-content-manager.conf`).
- TLS: Let's Encrypt via certbot; auto-renew via `certbot-renew.timer`.

## Shipping an update

From the Mac, in the repo root:

```bash
rsync -az --delete --exclude .git --exclude node_modules --exclude .env.local \
  ./ root@85.215.37.39:/srv/ggo-content-manager/ -e "ssh -i ~/.ssh/ionos_ggo_xl"
```

Then on the server:

```bash
ssh -i ~/.ssh/ionos_ggo_xl root@85.215.37.39 \
  'cd /srv/ggo-content-manager && npm ci && npm run build && systemctl restart ggo-content-manager && systemctl status ggo-content-manager --no-pager | head -5'
```

Verify: `curl -sI https://cockpit.ggo-suite.co.uk` should return a 307 to
`/login`, and `/api/views/<view>` should return 401 without a token.

## Ernesto integration (R9)

In `ernesto-agents-house`'s `.env` on the Mac:

```
COCKPIT_VIEWS_URL=https://cockpit.ggo-suite.co.uk
COCKPIT_SERVICE_TOKEN=<same value as on the server>
```

Check with `node operations/pif-tick-lookup.js <content-asset-id>` — it
should log "PIF TICK status (cockpit view)".

## What stays on the Mac

- The local resident service (LaunchAgent on `localhost:3010`) continues
  to run in parallel.
- The video worker (Greta/Titti): footage + ffmpeg live on the Mac. The
  server will queue jobs (Family C, still to build).
- Ernesto's skills stay in `~/.claude` on the Mac.

## Mirror retirement (Phase 2 tail)

Once the repointed jobs run clean for a week (no Failed in the 🤖 Agents
Activity Log): `npm run retire:mirrors -- --apply --views-live`. The
weekly `notion-integration` run is switched off by disabling
`weekly-full.yml` (stage 8-keywords stays until the cache tier owns it).
