#!/usr/bin/env node
/**
 * Referenced-media sync — Mac → VPS.
 *
 * The VPS cockpit shows the same register as the Mac, but the assets are
 * files on the Mac. Mirroring everything is out of the question (~/Movies
 * alone is hundreds of GB), so this job ships ONLY the files the register
 * actually references right now: it reads the Cancello state from the LOCAL
 * cockpit (service-token bearer), collects every media/video path, and
 * rsyncs those files to the VPS under /srv/ggomed-media, preserving the
 * path structure the remap in lib/cancello/paths.ts expects.
 *
 * Runs from launchd every 10 minutes (uk.co.ggomed.content-manager.media-sync).
 * Requires in the environment (loaded from the cockpit's .env.local):
 *   COCKPIT_SERVICE_TOKEN
 * Optional overrides:
 *   COCKPIT_LOCAL_URL   (default http://127.0.0.1:3010)
 *   MEDIA_SYNC_DEST     (default root@85.215.37.39:/srv/ggomed-media)
 *   MEDIA_SYNC_SSH_KEY  (default ~/.ssh/ionos_ggo_xl)
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();
const COCKPIT = process.env.COCKPIT_LOCAL_URL || "http://127.0.0.1:3010";
const TOKEN = process.env.COCKPIT_SERVICE_TOKEN;
const DEST = process.env.MEDIA_SYNC_DEST || "root@85.215.37.39:/srv/ggomed-media";
const SSH_KEY = process.env.MEDIA_SYNC_SSH_KEY || path.join(HOME, ".ssh", "ionos_ggo_xl");

if (!TOKEN) {
    console.error("media-sync: COCKPIT_SERVICE_TOKEN missing — nothing synced");
    process.exit(2);
}

const res = await fetch(`${COCKPIT}/api/review-dashboard/state`, {
    headers: { authorization: `Bearer ${TOKEN}` },
});
if (!res.ok) {
    console.error(`media-sync: state read failed (HTTP ${res.status})`);
    process.exit(1);
}
const state = await res.json();

const pathParam = (url) => {
    const m = /[?&]path=([^&]+)/.exec(url || "");
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch { return null; }
};

const referenced = new Set();
for (const row of [...(state.wall ?? []), ...(state.desk ?? [])]) {
    for (const v of row.videos ?? []) {
        if (v.path) referenced.add(v.path);
        else if (v.url) { const p = pathParam(v.url); if (p) referenced.add(p); }
    }
}
for (const row of state.calendar ?? []) {
    for (const m of row.media ?? []) {
        const p = pathParam(m.url);
        if (p) referenced.add(p);
    }
}

// rsync -R with the /./ pivot keeps the tree under DEST aligned with the
// remap: /Users/jj-macstudio/./GGOMed/x → DEST/GGOMed/x.
const files = [...referenced]
    .filter((p) => p.startsWith(HOME + path.sep) && existsSync(p))
    .map((p) => HOME + "/." + p.slice(HOME.length));

if (files.length === 0) {
    console.log("media-sync: nothing referenced, nothing to ship");
    process.exit(0);
}

execFileSync("rsync", [
    "-azR", "--perms", "--chmod=a+rX",
    "-e", `ssh -i ${SSH_KEY} -o BatchMode=yes`,
    ...files,
    DEST + "/",
], { stdio: "inherit", timeout: 15 * 60 * 1000 });

// The prepared-patch specs travel too (tiny JSON): the VPS needs them to
// recognise already-applied patches and drop those cards from the register.
const PATCH_DIR = path.join(HOME, "Documents", "GitHub", "ernesto-agents-house", "docs", "edmondo-patches");
if (existsSync(PATCH_DIR)) {
    execFileSync("rsync", [
        "-az", "--delete", "--perms", "--chmod=a+rX",
        "-e", `ssh -i ${SSH_KEY} -o BatchMode=yes`,
        PATCH_DIR + "/",
        DEST + "/edmondo-patches/",
    ], { stdio: "inherit", timeout: 5 * 60 * 1000 });
}

// macOS rsync preserves Mac home permissions (750, uid 501) which the VPS
// service user cannot traverse — open read/traverse on the synced tree.
const [destHost, destPath] = DEST.split(":");
execFileSync("ssh", ["-i", SSH_KEY, "-o", "BatchMode=yes", destHost, `chmod -R a+rX ${destPath}`], {
    stdio: "inherit",
    timeout: 5 * 60 * 1000,
});

console.log(`media-sync: shipped ${files.length} file(s) to ${DEST}`);
