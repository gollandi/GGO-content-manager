#!/usr/bin/env node
/**
 * Refresh the vendored house-board writer from ernesto-agents-house.
 *
 *   node tools/board/sync-vendor.mjs [path-to-ernesto-agents-house] [--ref origin/main]
 *
 * Copies the files listed in lib/board/vendor/SOURCE.json from the given git
 * ref (default origin/main, so a stale local checkout cannot be vendored) and
 * records the commit and hashes. Review the diff before committing it.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vendorDir = path.join(root, 'lib/board/vendor');
const sourcePath = path.join(vendorDir, 'SOURCE.json');
const args = process.argv.slice(2);
const refIndex = args.indexOf('--ref');
const ref = refIndex >= 0 ? args[refIndex + 1] : 'origin/main';
const positional = args.filter((arg, index) => index !== refIndex && index !== refIndex + 1);
const house = path.resolve(positional[0] ?? process.env.HOUSE_REPO ?? path.join(os.homedir(), 'Developer/GitHub/ernesto-agents-house'));

if (!fs.existsSync(path.join(house, '.git'))) throw new Error(`not a git checkout: ${house} (pass the path or set HOUSE_REPO)`);
const git = (...gitArgs) => execFileSync('git', ['-C', house, ...gitArgs], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const commit = git('rev-parse', ref).trim();
for (const file of Object.keys(source.files)) {
  const content = git('show', `${commit}:${file}`);
  fs.mkdirSync(path.dirname(path.join(vendorDir, file)), { recursive: true });
  fs.writeFileSync(path.join(vendorDir, file), content);
  source.files[file] = crypto.createHash('sha256').update(content).digest('hex');
}
source.commit = commit;
fs.writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`);
console.log(`vendored ${Object.keys(source.files).length} files from ${house} at ${commit}`);
