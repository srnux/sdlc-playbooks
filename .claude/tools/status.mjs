#!/usr/bin/env node
/**
 * status.mjs — where everything stands, in one screen.
 *
 *   node .claude/tools/status.mjs [--gaps] [--json]
 *
 * Ordered by who has to act: the human first, then what's in flight, then
 * what's next. Never exits non-zero — this is a report, not a gate.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(resolve(ROOT, '.claude/sdlc.config.json'), 'utf8'));
const json = process.argv.includes('--json');
const gapsOnly = process.argv.includes('--gaps');

function items(type) {
  try {
    const out = execFileSync('node', [resolve(ROOT, '.claude/tools/tracker.mjs'), 'list', '--type', type], { encoding: 'utf8' });
    return JSON.parse(out).items ?? [];
  } catch { return []; }
}

const reqs = items('requirement');
const stories = items('story');

const dsLocked = existsSync(resolve(ROOT, cfg.designSystem?.tokens ?? 'design-system/tokens.css'));

const needsHuman = [
  ...reqs.filter((r) => r.status === 'prototyped').map((r) => ({ id: r.id, what: 'prototype waiting for approval', how: `open it, then /approve ${r.id}` })),
  ...stories.filter((s) => s.status === 'blocked').map((s) => ({ id: s.id, what: 'blocked — review rounds exhausted', how: 'read the notes and decide' })),
];
if (!dsLocked) needsHuman.unshift({ id: '—', what: 'design system not locked', how: '/design-system' });

const inFlight = stories.filter((s) => s.status === 'in-progress' || s.status === 'in-review');
const nextStory = stories.find((s) => s.status === 'ready') ?? null;
const nextReq = reqs.find((r) => r.status === 'specified') ?? null;

let gaps = [];
try {
  execFileSync('node', [resolve(ROOT, '.claude/tools/check-coverage.mjs'), '--json'], { encoding: 'utf8' });
} catch (e) {
  try { gaps = JSON.parse(e.stdout || '{}').gaps ?? []; } catch { /* ignore */ }
}

if (json) {
  console.log(JSON.stringify({ dsLocked, needsHuman, inFlight, nextStory, nextReq, counts: tally(), gaps }, null, 2));
  process.exit(0);
}

if (gapsOnly) {
  console.log(gaps.length ? gaps.map((g) => `  ${g.kind}: ${g.id} — ${g.detail}`).join('\n') : '  no gaps');
  process.exit(0);
}

const line = (s = '') => console.log(s);

line();
line(`${cfg.product?.name ?? 'product'} — ${reqs.length} requirements, ${stories.length} stories`);
line();

line('NEEDS A HUMAN');
if (needsHuman.length === 0) line('  nothing — the flow can keep moving on its own');
else for (const n of needsHuman) line(`  ${n.id.padEnd(9)} ${n.what}  →  ${n.how}`);
line();

line('IN FLIGHT');
if (inFlight.length === 0) line('  nothing in progress');
else for (const s of inFlight) line(`  ${s.id.padEnd(9)} ${s.status.padEnd(11)} ${s.title}`);
line();

line('NEXT');
if (nextStory) line(`  /build              ${nextStory.id} — ${nextStory.title}`);
if (nextReq) line(`  /prototype ${nextReq.id}   ${nextReq.title}`);
if (!nextStory && !nextReq) line('  nothing ready — add requirements with /requirements');
line();

line('PIPELINE');
for (const [type, counts] of Object.entries(tally())) {
  line(`  ${type}`);
  for (const [status, n] of Object.entries(counts)) if (n) line(`    ${String(n).padStart(3)}  ${status}`);
}
line();

if (gaps.length) {
  line(`GAPS (${gaps.length})`);
  for (const g of gaps) line(`  ${g.kind}: ${g.id} — ${g.detail}`);
  line();
}

function tally() {
  const out = {};
  for (const [type, statuses] of Object.entries(cfg.statuses)) {
    const list = type === 'requirement' ? reqs : stories;
    out[type] = Object.fromEntries(statuses.map((s) => [s, list.filter((i) => i.status === s).length]));
  }
  return out;
}
