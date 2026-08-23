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

### The worker (Family C, second half)

`tools/worker/carico-worker.mjs` consumes the inbox. It ships with the app,
so a deploy updates it; what lives outside the repo is provisioned by
`tools/vps/worker-setup.sh inspect|apply` (ffmpeg static, whisper.cpp with
the `base` model, `ready/`, and the systemd unit + timer).

```bash
scp -i ~/.ssh/ionos_ggo_xl tools/vps/worker-setup.sh root@85.215.37.39:/root/
ssh -i ~/.ssh/ionos_ggo_xl root@85.215.37.39 '/root/worker-setup.sh inspect'
ssh -i ~/.ssh/ionos_ggo_xl root@85.215.37.39 '/root/worker-setup.sh apply'
```

`ggo-carico-worker.timer` fires `ggo-carico-worker.service` every 5 minutes
as `jj`. The service is `Type=oneshot` rather than a daemon: a pass that
wedges cannot wedge its successor, and the journal reads as discrete passes.
`Nice=10` and `IOSchedulingClass=idle` keep ffmpeg from starving the cockpit
JJ is using. One pass handles at most `COCKPIT_WORKER_BATCH` (3) manifests,
so a backlog drains in timer-sized bites.

What a pass does, by `kind`:

| kind | output in `ready/<id>/` |
|---|---|
| `dual-roll` | side-by-side (width ≥ 2×height) split into `roll-a.mp4` + `roll-b.mp4`; a single-camera clip is left whole and noted as needing Titti's transcript pairing |
| `talking-head` | `poster.jpg`, `audio.wav` (16 kHz mono), `transcript.srt` + `.txt` |
| `voce` | audio + transcript |
| `b-roll`, `altro` | probe + `poster.jpg` |

Every pass writes `ready/<id>/job.json` — created exclusively (`wx`), which
is also how a job is claimed, so an overlapping timer cannot double-run one.
A job left `running` for more than 6 hours is treated as abandoned and
reclaimed. Failures are recorded in `job.json` rather than thrown away.

Watching it:

```bash
journalctl -u ggo-carico-worker.service -n 50 --no-pager
systemctl list-timers ggo-carico-worker.timer
```

Transcription is optional equipment: if whisper-cli or the model is missing,
the job still delivers its media outputs and records the gap in `notes`.

**Keep the media root outside `/srv/ggo-content-manager`.** The deploy
rsyncs with `--delete`, so footage stored inside the app directory would be
erased by the next push to main. `/srv/ggo-media` is a sibling path for
exactly that reason.

## ernesto's scheduled jobs on the server

The night runs were failing because the Mac's connection goes soft after
dark. Il Carico took the Mac out of the ingest path; this takes it out of
the batch path — for the jobs whose whole world is Notion or HTTP.

Deployed to `/srv/ggo-ernesto` by rsync from the Mac (the repo is private
and the VPS holds no GitHub credentials), dependencies via pnpm:

```bash
cd ~/Developer/GitHub/ernesto-agents-house
rsync -az --exclude .git --exclude node_modules --exclude .env \
  --exclude secrets --exclude outputs --exclude snapshots \
  -e "ssh -i ~/.ssh/ionos_ggo_xl" ./ root@85.215.37.39:/srv/ggo-ernesto/
```

**`.env` and `secrets/` are excluded on purpose.** The server's credentials
are created on the server, in `/etc/ggo-ernesto.env` (root, 0600), with new
tokens — so either set can be revoked without taking the other down.

Provision with `tools/vps/ernesto-setup.sh inspect|apply|enable`; which jobs
move is `tools/vps/ernesto-jobs.txt`, copied to `/etc/ggo-ernesto-jobs.txt`.

### Wave 1 — moved

`nightly-review-due` (02:00), `evolution-review` (05:45),
`morning-sitemap-fetch` (06:00), `morning-orphan-check` (06:30),
`video-pressure` (06:55), `ingester-health-check` (07:47),
`weekly-natascia-summary` (Mon 08:00), `weekly-schema-check` (Sun 22:47).

Times are the launchd times unchanged — the VPS clock is already
Europe/London, so an hour still means what it meant.

### Staying on the Mac, and why

Not scheduling preferences, facts about what the jobs do:

| job | why it cannot move |
|---|---|
| `ernesto-headless`, `consiglio-headless`, `ettore-maintainer` | spawn the `claude` CLI and run skills from `~/.claude`; Ernesto also drives ffmpeg over footage in `~/GGOMed/pipeline` |
| `ambrogio-cartografina` | it *is* a scan of the Mac — `launchctl`, `~/.claude/skills`, the local git clones, the PIF Tick ecosystem JSON |
| `weekly-media-gc` | deletes footage under `~/GGOMed/pipeline/output` |
| `sibilla-la-veggente` (Wed 07:00) | her verdict is an LLM pass: the `claude` CLI (absent on the VPS) plus a Sanity MCP session authenticated interactively on the Mac. She is a morning job besides, so the after-dark failure this migration fixes never touched her |

`daily-throughput-ledger` is moveable but writes its ledger inside the
checkout, so running it here would split the ledger across two machines —
left on the Mac until that state lives somewhere that is not the repo.

### Enabling: the one dangerous step

**A job enabled here while launchd still runs it on the Mac writes to
Notion twice.** So `apply` installs the units *disabled*, and enabling one
is paired with unloading its Mac counterpart in the same sitting:

```bash
# 1. on the Mac — stop it there first
launchctl bootout gui/$UID/co.uk.ggomed.agents-house.nightly-review-due
launchctl disable gui/$UID/co.uk.ggomed.agents-house.nightly-review-due

# 2. on the server — start it here
ssh -i ~/.ssh/ionos_ggo_xl root@85.215.37.39 \
  'systemctl enable --now ggo-ernesto-nightly-review-due.timer'

# 3. prove it ran, the next morning
ssh -i ~/.ssh/ionos_ggo_xl root@85.215.37.39 \
  'journalctl -u ggo-ernesto-nightly-review-due -n 40 --no-pager'
```

Cross-check the 🤖 Agents Activity Log in Notion: one row per run, not two.

## What stays on the Mac

- The local resident service (LaunchAgent on `localhost:3010`) continues
  to run in parallel.
- Greta's and Titti's full edits: the first pass over the material now runs
  on the server (split, probe, poster, transcript), but the editing
  judgement — Titti pairing two rolls by transcript similarity, Greta's
  micro-cuts — stays on the Mac with the skills.
- Ernesto's skills stay in `~/.claude` on the Mac.

## Mirror retirement (Phase 2 tail)

Once the repointed jobs run clean for a week (no Failed in the 🤖 Agents
Activity Log): `npm run retire:mirrors -- --apply --views-live`. The
weekly `notion-integration` run is switched off by disabling
`weekly-full.yml` (stage 8-keywords stays until the cache tier owns it).
