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

## Il Carico — media inbox on the server

`/carico` accepts footage straight from JJ's phone, so the Mac is out of the
ingest path. Uploads are chunked and resumable (5 MiB parts, retried with
backoff): a clip that dies halfway up on 4G resumes rather than restarts.

### Server setup (once)

Automated: run the **Carico setup (VPS)** workflow (Actions → Run workflow)
with `mode: inspect` to see the server as it is, then `mode: apply`. It goes
over the same SSH channel as the deploy, so no key is needed locally. The
whole procedure is `tools/vps/carico-setup.sh` — idempotent, safe to re-run,
and runnable by hand if you prefer:

```bash
scp -i ~/.ssh/ionos_ggo_xl tools/vps/carico-setup.sh root@85.215.37.39:/root/
ssh -i ~/.ssh/ionos_ggo_xl root@85.215.37.39 '/root/carico-setup.sh inspect'
ssh -i ~/.ssh/ionos_ggo_xl root@85.215.37.39 '/root/carico-setup.sh apply'
```

What `apply` does, should you want to do it yourself instead:

```bash
mkdir -p /srv/ggo-media/{inbox,staging}
chown -R jj:jj /srv/ggo-media
```

Add to `/etc/ggo-content-manager.env`:

```
COCKPIT_MEDIA_ROOT=/srv/ggo-media
```

nginx buffers request bodies by default and caps them at 1 MB, which would
reject every chunk. The script writes an additive drop-in,
`/etc/nginx/conf.d/00-carico-upload.conf`, rather than editing the existing
server block — nothing to corrupt, and undoing it is deleting one file:

```nginx
client_max_body_size 32m;      # one chunk (16 MiB ceiling) plus headroom
client_body_timeout  300s;     # a slow 4G chunk is not a dead client
proxy_request_buffering off;   # stream chunks through instead of spooling
```

`conf.d` is included inside `http{}`, so these are defaults for every vhost
on the box; a server block that sets its own `client_max_body_size` would
still win. The script runs `nginx -t` and reverts the drop-in if nginx
refuses it, so a bad config never survives to a reload.

### Layout and the handoff contract

```
/srv/ggo-media/staging/<id>/     chunks in flight (reclaimed on completion)
/srv/ggo-media/inbox/<id>.<ext>  the assembled media
/srv/ggo-media/inbox/<id>.json   the manifest
```

**The worker watches `inbox/*.json`, never the media glob.** The manifest is
written by rename only after the media file is complete, so its existence is
the guarantee that the file beside it is whole — which is what removes the
race where a watcher grabs a half-written video.

The manifest carries `storedAs`, `kind` (`dual-roll` | `talking-head` |
`b-roll` | `voce` | `altro` — routes the job to Titti or Greta), `note`,
`operator`, and byte counts. Ingest only: nothing in this path writes to
Sanity or Notion, and the three publish gates are untouched.

Retention is not automated yet — prune `inbox/` once outputs are approved.

**Keep the media root outside `/srv/ggo-content-manager`.** The deploy
rsyncs with `--delete`, so footage stored inside the app directory would be
erased by the next push to main. `/srv/ggo-media` is a sibling path for
exactly that reason.

## What stays on the Mac

- The local resident service (LaunchAgent on `localhost:3010`) continues
  to run in parallel.
- The video worker (Greta/Titti): ffmpeg still runs on the Mac. Footage no
  longer has to — Il Carico lands it in `/srv/ggo-media/inbox` on the
  server; the worker that consumes those manifests is the remaining half of
  Family C.
- Ernesto's skills stay in `~/.claude` on the Mac.

## Mirror retirement (Phase 2 tail)

Once the repointed jobs run clean for a week (no Failed in the 🤖 Agents
Activity Log): `npm run retire:mirrors -- --apply --views-live`. The
weekly `notion-integration` run is switched off by disabling
`weekly-full.yml` (stage 8-keywords stays until the cache tier owns it).
