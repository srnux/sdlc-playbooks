#!/usr/bin/env node
/**
 * check-coverage.mjs — the traceability gate.
 *
 * Walks the chain and reports every break:
 *
 *   requirement → AC → screen (in the approved snapshot) → story → plan → done
 *
 * "Completeness is a query, not a judgment call." Everything asserted here is
 * read off disk; nothing is inferred and nothing is asked of an agent.
 *
 *   node .claude/tools/check-coverage.mjs [--json]
 *
 * exit 0 = chain intact · 2 = gaps · 1 = couldn't run
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(resolve(ROOT, '.claude/sdlc.config.json'), 'utf8'));

const ITEMS = resolve(ROOT, cfg.tracker?.files?.dir ?? 'work/items');
const APPROVED = resolve(ROOT, cfg.prototype?.approvedDir ?? 'prototype/.approved');
const PLANS = resolve(ROOT, cfg.artifacts?.plansDir ?? 'work/plans');

const gaps = [];
const gap = (kind, id, detail) => gaps.push({ kind, id, detail });

/* ---- read items (mirrors tracker/files.mjs, deliberately read-only) ---- */
function parse(text) {
  const end = text.indexOf('\n---', 3);
  const item = { extra: {} };
  for (const line of text.slice(4, end).split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (v === 'null' || v === '') v = null;
    else if (v.startsWith('[')) v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    item[k] = v;
  }
  item.body = text.slice(end + 4);
  return item;
}

if (!existsSync(ITEMS)) { console.log('ok — no work items yet'); process.exit(0); }
const items = readdirSync(ITEMS).filter((f) => f.endsWith('.md'))
  .map((f) => parse(readFileSync(join(ITEMS, f), 'utf8')));

const reqs = items.filter((i) => i.type === 'requirement');
const stories = items.filter((i) => i.type === 'story');

/* ---- screens present in each approved snapshot ---- */
function screensIn(file) {
  const html = readFileSync(file, 'utf8');
  return [...html.matchAll(/data-screen\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
}
function snapshotFor(req) {
  if (!req.approvedVersion || !existsSync(APPROVED)) return null;
  const hit = readdirSync(APPROVED).find((f) => f.endsWith(`-${req.approvedVersion}.html`) &&
    (!req.prototype || f.startsWith(basename(String(req.prototype)).replace(/\.html$/, ''))));
  return hit ? join(APPROVED, hit) : null;
}

/* ---- 1. requirements ---- */
for (const r of reqs) {
  const acs = [...String(r.body).matchAll(/\[(AC-\d+)\]/g)].map((m) => m[1]);
  const stage = cfg.statuses.requirement.indexOf(r.status);

  if (stage >= cfg.statuses.requirement.indexOf('specified') && acs.length === 0) {
    gap('no-acceptance-criteria', r.id, `status "${r.status}" but the body has no [AC-n] items`);
  }

  if (stage >= cfg.statuses.requirement.indexOf('prototyped')) {
    if (!r.prototype) gap('no-prototype-file', r.id, `status "${r.status}" but no prototype recorded`);
    else if (!existsSync(resolve(ROOT, r.prototype))) gap('prototype-missing', r.id, `${r.prototype} does not exist on disk`);
  }

  if (stage >= cfg.statuses.requirement.indexOf('approved')) {
    const snap = snapshotFor(r);
    if (!snap) {
      gap('no-approved-snapshot', r.id, `approved at ${r.approvedVersion ?? '(no version)'} but no frozen file in ${cfg.prototype.approvedDir}`);
      continue;
    }
    const screens = screensIn(snap);
    if (screens.length === 0) gap('snapshot-has-no-screens', r.id, `${basename(snap)} has no data-screen markers`);

    // every AC must appear against at least one screen, via the requirement body
    const covered = new Set(screens);
    for (const s of (r.screens ?? [])) if (!covered.has(s)) {
      gap('screen-not-in-snapshot', r.id, `recorded screen ${s} is not in ${basename(snap)}`);
    }

    // every screen needs exactly one story
    for (const s of screens) {
      const own = stories.filter((st) => st.parent === r.id && st.screen === s);
      if (own.length === 0) gap('screen-without-story', r.id, `${s} has no story`);
      if (own.length > 1) gap('screen-with-many-stories', r.id, `${s} has ${own.length} stories: ${own.map((o) => o.id).join(', ')}`);
    }

    if (acs.length && stories.filter((st) => st.parent === r.id).length === 0) {
      gap('approved-without-stories', r.id, 'approved but no stories were cut');
    }
  }
}

/* ---- 2. stories ---- */
for (const s of stories) {
  const parent = reqs.find((r) => r.id === s.parent);
  if (!parent) { gap('orphan-story', s.id, `parent ${s.parent} does not exist`); continue; }

  if (!s.screen) gap('story-without-screen', s.id, 'no screen recorded');
  if (!s.prototypeVersion) gap('story-without-pin', s.id, 'no prototypeVersion — it has no design baseline');

  const idx = cfg.statuses.story.indexOf(s.status);
  if (idx >= cfg.statuses.story.indexOf('in-progress') && idx < cfg.statuses.story.indexOf('blocked')) {
    const plan = join(PLANS, `${s.id}.md`);
    if (!existsSync(plan)) gap('story-without-plan', s.id, `status "${s.status}" but ${cfg.artifacts.plansDir}/${s.id}.md does not exist`);
  }

  // a done story whose screen left the approved snapshot
  if (s.status === 'done' && s.screen) {
    const snap = snapshotFor(parent);
    if (snap && !screensIn(snap).includes(s.screen)) {
      gap('done-story-screen-vanished', s.id, `${s.screen} is no longer in ${basename(snap)} — the design moved after the story shipped`);
    }
  }

  // built against a stale pin
  if (parent.approvedVersion && s.prototypeVersion && s.prototypeVersion !== parent.approvedVersion) {
    gap('stale-pin', s.id, `pinned ${s.prototypeVersion}, requirement is now at ${parent.approvedVersion} — the delta is new scope, not something to absorb`);
  }
}

/* ---- report ---- */
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ok: gaps.length === 0, gaps }, null, 2));
  process.exit(gaps.length ? 2 : 0);
}

if (gaps.length === 0) {
  console.log(`ok — ${reqs.length} requirements, ${stories.length} stories, chain intact`);
  process.exit(0);
}

console.error(`\n${gaps.length} gap${gaps.length > 1 ? 's' : ''} in the chain:\n`);
const byKind = gaps.reduce((m, g) => ((m[g.kind] ??= []).push(g), m), {});
for (const [kind, list] of Object.entries(byKind)) {
  console.error(`  ${kind}`);
  for (const g of list) console.error(`    ${g.id} — ${g.detail}`);
  console.error('');
}
console.error('A gap is a fact, not an opinion. Fix the chain or change the status — don\'t widen a story to absorb one.\n');
process.exit(2);
