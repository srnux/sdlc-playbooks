#!/usr/bin/env node
/**
 * approve.mjs — freeze a prototype as an immutable, versioned snapshot.
 *
 *   node .claude/tools/approve.mjs REQ-004 [--dry-run]
 *
 * Copies prototype/<slug>.html -> prototype/.approved/<slug>-v<N>.html and
 * prints the version plus the screens it contains. It refuses to overwrite an
 * existing snapshot: a snapshot that can change is not a baseline.
 *
 * It does NOT decide that something is approved. A human does that; this only
 * records it.
 *
 * exit 0 = frozen · 2 = refused · 1 = couldn't run
 */
import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(resolve(ROOT, '.claude/sdlc.config.json'), 'utf8'));

const id = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!id) { console.error('usage: approve.mjs REQ-### [--dry-run]'); process.exit(1); }

// the requirement, via the tracker adapter — never by reading the file directly
let item;
try {
  const out = execFileSync('node', [resolve(ROOT, '.claude/tools/tracker.mjs'), 'get', id], { encoding: 'utf8' });
  item = JSON.parse(out).item;
} catch (e) {
  console.error(`could not read ${id}: ${e.message}`);
  process.exit(1);
}

if (!item.prototype) {
  console.error(`${id} has no prototype recorded. Run /prototype ${id} first.`);
  process.exit(2);
}

const src = resolve(ROOT, item.prototype);
if (!existsSync(src)) { console.error(`${item.prototype} does not exist on disk.`); process.exit(2); }

const approvedDir = resolve(ROOT, cfg.prototype?.approvedDir ?? 'prototype/.approved');
mkdirSync(approvedDir, { recursive: true });

const slug = basename(src).replace(/\.html$/, '');
const existing = readdirSync(approvedDir)
  .filter((f) => f.startsWith(`${slug}-v`) && f.endsWith('.html'))
  .map((f) => Number(f.match(/-v(\d+)\.html$/)?.[1] ?? 0));
const next = (existing.length ? Math.max(...existing) : 0) + 1;
const version = `v${next}`;
const dest = join(approvedDir, `${slug}-${version}.html`);

if (existsSync(dest)) { console.error(`${dest} already exists — snapshots are immutable.`); process.exit(2); }

const html = readFileSync(src, 'utf8');
const screens = [...html.matchAll(/data-screen\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
const uniqueScreens = [...new Set(screens)];

if (uniqueScreens.length === 0) {
  console.error(`${item.prototype} has no data-screen markers — nothing can be traced to it.`);
  console.error(`Every screen root needs data-screen="SCR-…" and data-req="${id}".`);
  process.exit(2);
}

const reqMarkers = [...new Set([...html.matchAll(/data-req\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]))];
const foreign = reqMarkers.filter((r) => r !== id);
if (foreign.length) {
  console.error(`${item.prototype} carries data-req for other requirements: ${foreign.join(', ')}`);
  console.error(`One prototype per requirement. Split it, or fix the markers.`);
  process.exit(2);
}

if (dryRun) {
  console.log(JSON.stringify({ ok: true, dryRun: true, version, dest: dest.replace(ROOT + '/', ''), screens: uniqueScreens }, null, 2));
  process.exit(0);
}

copyFileSync(src, dest);

console.log(JSON.stringify({
  ok: true,
  id,
  version,
  snapshot: dest.replace(ROOT + '/', ''),
  screens: uniqueScreens,
  next: [
    `node .claude/tools/tracker.mjs set ${id} --status approved --set approvedVersion=${version} --set screens="${uniqueScreens.join(' ')}"`,
    `then cut one story per screen (approve-prototype skill, step 3)`,
  ],
}, null, 2));
