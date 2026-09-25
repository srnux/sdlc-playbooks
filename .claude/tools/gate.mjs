#!/usr/bin/env node
/**
 * gate.mjs — the precondition gate for every phase.
 *
 * A playbook is a procedure; this is the thing that decides whether the procedure is
 * allowed to start. It runs BEFORE any model reasoning: each command expands
 * `!`node .claude/tools/gate.mjs <phase> [id]`` , so a blocked gate aborts the command
 * outright rather than producing a paragraph about why it probably shouldn't continue.
 *
 *   node .claude/tools/gate.mjs design-system [--refresh]
 *   node .claude/tools/gate.mjs requirements  "<po text>" | --file <path> | REQ-###
 *   node .claude/tools/gate.mjs prototype     REQ-###
 *   node .claude/tools/gate.mjs approve       REQ-### --human-approved
 *   node .claude/tools/gate.mjs plan          ST-###  [--update]
 *   node .claude/tools/gate.mjs implement     ST-###
 *   node .claude/tools/gate.mjs review        ST-###
 *   node .claude/tools/gate.mjs status
 *
 * Exit codes
 *   0  proceed — stdout carries the resolved context as JSON
 *   2  BLOCKED — a named precondition failed; stderr carries the reason
 *   1  bad usage
 *
 * The context on stdout is not decoration. It pins the facts the playbook would
 * otherwise rediscover by guessing: resolved paths, the pinned snapshot version, the
 * AC ids, the review round. Pinned at expansion time beats looked up mid-reasoning.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadConfig, parseArgs } from './tracker.mjs';

const PROVIDERS = {
  files: () => import('./tracker/files.mjs'),
  jira: () => import('./tracker/jira.mjs'),
};

/** A blocked gate. The message is read by a human and by the model; be specific. */
class Blocked extends Error {
  constructor(reason, fix) {
    super(reason);
    this.fix = fix;
  }
}

const rel = (p) => resolve(ROOT, p);
const exists = (p) => existsSync(rel(p));
const nonEmpty = (p) => exists(p) && statSync(rel(p)).size > 0;

async function provider(cfg) {
  const name = cfg.tracker?.provider;
  const load = PROVIDERS[name];
  if (!load) throw new Blocked(`unknown tracker.provider "${name}"`, `set tracker.provider in .claude/sdlc.config.json to one of: ${Object.keys(PROVIDERS).join(', ')}`);
  return load();
}

async function item(cfg, id) {
  const p = await provider(cfg);
  try {
    return p.get(cfg, { _: [id], set: {} }).item;
  } catch {
    throw new Blocked(`${id} does not exist`, `node .claude/tools/tracker.mjs list`);
  }
}

function acIds(body = '') {
  return [...body.matchAll(/\[(AC-\d+)\]/g)].map((m) => m[1]);
}

function screensIn(html) {
  return [...new Set([...html.matchAll(/data-screen\s*=\s*"([^"]+)"/g)].map((m) => m[1]))];
}

/** prototype/foo.html + v2 -> prototype/.approved/foo-v2.html */
function snapshotPath(cfg, protoPath, version) {
  const dir = cfg.prototype?.approvedDir ?? 'prototype/.approved';
  const slug = basename(protoPath ?? '', '.html');
  return `${dir}/${slug}-${version}.html`;
}

/** review-change writes "round N: ..." into Notes; the cap lives in config. */
function reviewRound(body = '') {
  const seen = [...body.matchAll(/round\s+(\d+)\s*:/gi)].map((m) => Number(m[1]));
  return seen.length ? Math.max(...seen) : 0;
}

function designLocked(cfg) {
  const tokens = cfg.designSystem?.tokens ?? 'design-system/tokens.css';
  const catalog = cfg.designSystem?.catalog ?? 'design-system/components.md';
  return { tokens, catalog, locked: nonEmpty(tokens) && nonEmpty(catalog) };
}

function requireDesignLocked(cfg) {
  const ds = designLocked(cfg);
  if (!ds.locked) {
    throw new Blocked(
      `the design system is not locked — ${ds.tokens} and ${ds.catalog} must both exist and be non-empty`,
      `/design-system`
    );
  }
  return ds;
}

// --- the phases -------------------------------------------------------------

const PHASES = {
  async 'design-system'(cfg, args) {
    const ds = designLocked(cfg);
    if (ds.locked && !args.refresh) {
      throw new Blocked(
        `the design system is already locked (${ds.tokens})`,
        `/design-system refresh — and a refresh shows the diff before writing, because a changed token touches every screen ever built`
      );
    }
    return { mode: ds.locked ? 'refresh' : 'lock', ...ds, source: cfg.designSystem?.source ?? null };
  },

  async requirements(cfg, args) {
    const input = args.file ?? args._[0];
    if (!input) throw new Blocked('no input — requirements needs the PO text, --file <path>, or an existing REQ-###', `/requirements '<the PO's words>'`);
    if (args.file && !exists(args.file)) throw new Blocked(`--file ${args.file} does not exist`, 'check the path');
    const refining = /^REQ-\d+$/.test(String(input)) ? (await item(cfg, input)).id : null;
    return { mode: refining ? 'refine' : 'capture', target: refining, itemsDir: cfg.requirements?.dir ?? 'work/items' };
  },

  async prototype(cfg, args) {
    const id = args._[0];
    if (!id) throw new Blocked('prototype needs a requirement id', '/prototype REQ-###');
    const ds = requireDesignLocked(cfg);
    const req = await item(cfg, id);
    if (req.type !== 'requirement') throw new Blocked(`${id} is a ${req.type}, not a requirement`, 'prototypes are cut per requirement');

    const allowed = ['specified', 'prototyped'];
    if (!allowed.includes(req.status)) {
      throw new Blocked(
        `${id} is "${req.status}" — a prototype is only built from ${allowed.join(' or ')}`,
        req.status === 'draft'
          ? `finish the acceptance criteria first: /requirements ${id}`
          : `${id} is already past prototyping; a design change after approval is a new /prototype pass and a re-approval`
      );
    }
    const acs = acIds(req.body);
    if (!acs.length) throw new Blocked(`${id} has no acceptance criteria`, `/requirements ${id} — every AC has to land on a screen, so there is nothing to draw yet`);

    const protoPath = req.prototype ?? `${cfg.prototype?.dir ?? 'prototype'}/${(req.title ?? id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.html`;
    return { id, title: req.title, status: req.status, acs, mode: exists(protoPath) ? 'refine' : 'scaffold', prototype: protoPath, ...ds };
  },

  async approve(cfg, args) {
    const id = args._[0];
    if (!id) throw new Blocked('approve needs a requirement id', '/approve REQ-###');
    const req = await item(cfg, id);

    if (req.status !== 'prototyped') {
      throw new Blocked(
        `${id} is "${req.status}" — only a prototyped requirement can be approved`,
        req.status === 'approved' ? `already approved at ${req.approvedVersion}` : `/prototype ${id}`
      );
    }
    if (!req.prototype || !exists(req.prototype)) {
      throw new Blocked(`${id} has no prototype file on disk (${req.prototype ?? 'unset'})`, `/prototype ${id}`);
    }
    // The one gate that is a person. Prose asking a model not to approve on its own
    // judgment is exactly the rule that gets skipped; this one cannot be.
    if (!args['human-approved']) {
      throw new Blocked(
        `approval is a human decision and has not been recorded for ${id}`,
        `ask the person to open ${req.prototype} and say yes, then run: /approve ${id} --human-approved`
      );
    }

    const html = readFileSync(rel(req.prototype), 'utf8');
    const screens = screensIn(html);
    if (!screens.length) {
      throw new Blocked(
        `${req.prototype} has no data-screen markup`,
        `every screen root needs data-screen="SCR-…" and data-req="${id}" — without it the screen does not exist to check-coverage.mjs, so there is nothing to cut stories from`
      );
    }
    const prev = Number(String(req.approvedVersion ?? 'v0').replace(/^v/, '')) || 0;
    const version = `v${prev + 1}`;
    return { id, prototype: req.prototype, screens, acs: acIds(req.body), version, snapshot: snapshotPath(cfg, req.prototype, version) };
  },

  async plan(cfg, args) {
    const id = args._[0];
    if (!id) throw new Blocked('plan needs a story id', '/build ST-###');
    const story = await item(cfg, id);
    if (story.type !== 'story') throw new Blocked(`${id} is a ${story.type}, not a story`, 'plans are per story');
    if (!story.parent) throw new Blocked(`${id} has no parent requirement`, 'a story cut without a parent has no acceptance criteria to satisfy');

    const req = await item(cfg, story.parent);
    if (!['approved', 'delivered'].includes(req.status)) {
      throw new Blocked(`${story.parent} is "${req.status}" — stories are only built from an approved requirement`, `/approve ${story.parent} --human-approved`);
    }
    const version = story.extra?.prototypeVersion ?? req.approvedVersion;
    if (!version) throw new Blocked(`${id} is not pinned to a prototype version`, 'a story built against no pin is a story built against whatever the prototype looks like today');

    const snapshot = snapshotPath(cfg, req.prototype, version);
    if (!exists(snapshot)) throw new Blocked(`the pinned snapshot ${snapshot} is missing`, 'the snapshot is immutable and is what the story is measured against — restore it from git rather than regenerating it');

    const plan = `${cfg.artifacts?.plansDir ?? 'work/plans'}/${id}.md`;
    if (exists(plan) && !args.update) throw new Blocked(`${plan} already exists`, `pass --update to revise it, or go straight to implement`);

    const screen = story.extra?.screen ?? (story.screens ?? [])[0] ?? null;
    return { id, title: story.title, parent: req.id, screen, version, snapshot, plan, acs: acIds(req.body), storyAcs: acIds(story.body) };
  },

  async implement(cfg, args) {
    const id = args._[0];
    if (!id) throw new Blocked('implement needs a story id', '/build ST-###');
    const story = await item(cfg, id);
    const plan = `${cfg.artifacts?.plansDir ?? 'work/plans'}/${id}.md`;
    if (!exists(plan)) {
      throw new Blocked(
        `no plan for ${id} (${plan})`,
        `run the plan-story playbook first — hooks/require-plan.sh will block the first implementation edit anyway, this just tells you now instead of three tool calls later`
      );
    }
    if (story.status !== 'in-progress') {
      throw new Blocked(`${id} is "${story.status}" — implement expects in-progress`, `node .claude/tools/tracker.mjs set ${id} --status in-progress`);
    }
    const req = await item(cfg, story.parent);
    const version = story.extra?.prototypeVersion ?? req.approvedVersion;
    const snapshot = snapshotPath(cfg, req.prototype, version);
    if (!exists(snapshot)) throw new Blocked(`the pinned snapshot ${snapshot} is missing`, 'restore it from git — it is the baseline the review compares against');

    const live = req.prototype;
    const drift = exists(live) && readFileSync(rel(live), 'utf8') !== readFileSync(rel(snapshot), 'utf8');
    return {
      id, plan, version, snapshot, parent: req.id,
      acs: acIds(req.body), storyAcs: acIds(story.body),
      verify: cfg.verify?.commands ?? [],
      liveHasMovedPastThePin: drift,
      ...(drift ? { note: `${live} has moved past ${version}. You build ${version}. The difference is new scope for the PO — record it under Divergence, do not absorb it.` } : {}),
    };
  },

  async review(cfg, args) {
    const id = args._[0];
    if (!id) throw new Blocked('review needs a story id', '/build ST-###');
    const story = await item(cfg, id);
    if (story.status !== 'in-review') throw new Blocked(`${id} is "${story.status}" — review expects in-review`, `the engineer sets it: node .claude/tools/tracker.mjs set ${id} --status in-review`);

    const plan = `${cfg.artifacts?.plansDir ?? 'work/plans'}/${id}.md`;
    if (!exists(plan)) throw new Blocked(`no plan for ${id} — there is nothing to review the build against`, 'this should be impossible; the plan gate was bypassed');

    const cap = cfg.loops?.reviewRounds ?? 2;
    const round = reviewRound(story.body) + 1;
    if (round > cap) {
      throw new Blocked(
        `${id} has already been bounced ${cap} times (loops.reviewRounds)`,
        `node .claude/tools/tracker.mjs set ${id} --status blocked — then hand the human the actual disagreement. The third round is almost never the one that resolves it.`
      );
    }
    const req = await item(cfg, story.parent);
    const version = story.extra?.prototypeVersion ?? req.approvedVersion;
    return { id, plan, round, cap, parent: req.id, version, snapshot: snapshotPath(cfg, req.prototype, version), acs: acIds(req.body), verify: cfg.verify?.commands ?? [] };
  },

  async status() {
    return { note: 'no preconditions — status is always safe to run' };
  },
};

async function main() {
  const argv = process.argv.slice(2);
  const phase = argv[0];
  if (!phase || !PHASES[phase]) {
    process.stderr.write(`usage: gate.mjs <${Object.keys(PHASES).join('|')}> [id] [flags]\n`);
    process.exit(1);
  }
  const args = parseArgs(argv.slice(1));
  const cfg = loadConfig();

  try {
    const context = await PHASES[phase](cfg, args);
    process.stdout.write(JSON.stringify({ ok: true, gate: phase, context }, null, 2) + '\n');
    process.exit(0);
  } catch (e) {
    if (e instanceof Blocked) {
      process.stderr.write(`BLOCKED — ${phase}: ${e.message}\n\n  ${e.fix}\n\nNothing was changed. Report this reason verbatim and stop; do not work around it.\n`);
      process.stdout.write(JSON.stringify({ ok: false, gate: phase, blocked: e.message, fix: e.fix }, null, 2) + '\n');
      process.exit(2);
    }
    process.stderr.write(`gate.mjs ${phase}: ${e.message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
