/**
 * files provider — work items are markdown files with YAML frontmatter under
 * sdlc.config.json -> tracker.files.dir (default work/items).
 *
 * The generic item shape every provider must return:
 *   { id, type, title, status, parent, screens, prototype, approvedVersion,
 *     created, updated, body, extra }
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ROOT } from '../tracker.mjs';

const rule = (m) => Object.assign(new Error(m), { code: 'RULE' });
const today = () => new Date().toISOString().slice(0, 10);

const KNOWN = ['id', 'type', 'title', 'status', 'parent', 'screens', 'prototype', 'approvedVersion', 'created', 'updated'];

function dir(cfg) {
  const d = resolve(ROOT, cfg.tracker?.files?.dir ?? 'work/items');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

function prefixFor(type) {
  return type === 'requirement' ? 'REQ' : 'ST';
}

// --- tiny frontmatter reader/writer (flat keys, [a, b] lists, no nesting) ---

function parseScalar(v) {
  const s = v.trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((x) => x.trim().replace(/^["']|["']$/g, ''));
  }
  return s.replace(/^["']|["']$/g, '');
}

function dumpScalar(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  if (typeof v === 'string' && (v.includes(': ') || v.includes('#') || v.trim() !== v)) {
    return JSON.stringify(v);
  }
  return String(v);
}

function parseItem(text, file) {
  if (!text.startsWith('---')) throw new Error(`${file}: missing frontmatter`);
  const end = text.indexOf('\n---', 3);
  if (end < 0) throw new Error(`${file}: unterminated frontmatter`);
  const fm = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n/, '');
  const item = { extra: {} };
  for (const line of fm.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = parseScalar(line.slice(i + 1));
    if (KNOWN.includes(k)) item[k] = v;
    else item.extra[k] = v;
  }
  item.body = body;
  return item;
}

function serializeItem(item) {
  const lines = [];
  for (const k of KNOWN) if (k in item) lines.push(`${k}: ${dumpScalar(item[k])}`);
  for (const [k, v] of Object.entries(item.extra ?? {})) lines.push(`${k}: ${dumpScalar(v)}`);
  return `---\n${lines.join('\n')}\n---\n\n${(item.body ?? '').replace(/^\n+/, '')}`;
}

function pathFor(cfg, id) {
  return join(dir(cfg), `${id}.md`);
}

function readAll(cfg) {
  const d = dir(cfg);
  return readdirSync(d)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseItem(readFileSync(join(d, f), 'utf8'), f))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
}

function write(cfg, item) {
  item.updated = today();
  writeFileSync(pathFor(cfg, item.id), serializeItem(item), 'utf8');
  return item;
}

function validateStatus(cfg, type, status) {
  const allowed = cfg.statuses?.[type];
  if (!allowed) throw rule(`no statuses configured for type "${type}"`);
  if (!allowed.includes(status)) {
    throw rule(`status "${status}" is not valid for ${type} — allowed: ${allowed.join(', ')}`);
  }
}

// --- verbs ---

export function list(cfg, args) {
  let items = readAll(cfg);
  if (args.type) items = items.filter((i) => i.type === args.type);
  if (args.status) items = items.filter((i) => i.status === args.status);
  if (args.parent) items = items.filter((i) => i.parent === args.parent);
  return { count: items.length, items: items.map(({ body, ...rest }) => rest) };
}

export function get(cfg, args) {
  const id = args._[0];
  if (!id) throw new Error('get needs an id');
  const p = pathFor(cfg, id);
  if (!existsSync(p)) throw new Error(`no such item: ${id}`);
  return { item: parseItem(readFileSync(p, 'utf8'), id) };
}

export function create(cfg, args) {
  const type = args.type;
  if (!type || !cfg.statuses?.[type]) throw new Error(`--type must be one of ${Object.keys(cfg.statuses ?? {}).join(', ')}`);
  if (!args.title) throw new Error('--title is required');

  const prefix = prefixFor(type);
  const existing = readAll(cfg).filter((i) => String(i.id).startsWith(prefix + '-'));
  const nextNum = existing.reduce((m, i) => Math.max(m, Number(String(i.id).split('-')[1]) || 0), 0) + 1;
  const id = `${prefix}-${String(nextNum).padStart(3, '0')}`;

  const status = args.status ?? cfg.statuses[type][0];
  validateStatus(cfg, type, status);

  if (type === 'story') {
    if (!args.parent) throw rule('a story needs --parent REQ-###');
    const parent = readAll(cfg).find((i) => i.id === args.parent);
    if (!parent) throw rule(`parent ${args.parent} does not exist`);
    if (cfg.artifacts?.gates?.prototypeApprovedBeforeStories && parent.status !== 'approved' && parent.status !== 'delivered') {
      throw rule(`${parent.id} is "${parent.status}" — stories may only be cut from an approved requirement (gate: prototypeApprovedBeforeStories)`);
    }
  }

  const body = args['body-file'] ? readFileSync(resolve(ROOT, args['body-file']), 'utf8') : defaultBody(type);

  const item = {
    id, type, title: args.title, status,
    parent: args.parent ?? null,
    screens: args.set.screens ? args.set.screens.split(/[,\s]+/).filter(Boolean) : [],
    prototype: args.set.prototype ?? null,
    approvedVersion: args.set.approvedVersion ?? null,
    created: today(), updated: today(),
    extra: Object.fromEntries(Object.entries(args.set).filter(([k]) => !KNOWN.includes(k))),
    body,
  };
  write(cfg, item);
  return { id, item };
}

export function set(cfg, args) {
  const id = args._[0];
  if (!id) throw new Error('set needs an id');
  const { item } = get(cfg, args);
  if (args.status) {
    validateStatus(cfg, item.type, args.status);
    item.status = args.status;
  }
  for (const [k, v] of Object.entries(args.set)) {
    const val = k === 'screens' ? v.split(/[,\s]+/).filter(Boolean) : (v === 'null' ? null : v);
    if (KNOWN.includes(k)) item[k] = val;
    else (item.extra ??= {})[k] = val;
  }
  write(cfg, item);
  return { id, item: { ...item, body: undefined } };
}

export function setBody(cfg, args) {
  const id = args._[0];
  if (!id) throw new Error('body needs an id');
  if (!args.file) throw new Error('--file is required');
  const { item } = get(cfg, args);
  item.body = readFileSync(resolve(ROOT, args.file), 'utf8');
  write(cfg, item);
  return { id };
}

export function comment(cfg, args) {
  const id = args._[0];
  const text = args._.slice(1).join(' ');
  if (!id || !text) throw new Error('usage: comment <ID> "text"');
  const { item } = get(cfg, args);
  const marker = '\n## Notes\n';
  const entry = `\n- **${today()}** — ${text}\n`;
  item.body = item.body.includes(marker) ? item.body.replace(marker, marker + entry) : item.body.trimEnd() + '\n' + marker + entry;
  write(cfg, item);
  return { id };
}

export function next(cfg, args) {
  const type = args.type ?? 'story';
  const order = cfg.statuses[type];
  const items = readAll(cfg).filter((i) => i.type === type && i.status !== 'blocked');
  const actionable = type === 'story'
    ? items.filter((i) => i.status === 'ready')
    : items.filter((i) => order.indexOf(i.status) < order.length - 1);
  return { item: actionable[0] ? { ...actionable[0], body: undefined } : null };
}

function defaultBody(type) {
  return type === 'requirement'
    ? `## Context\n\n_Why this exists, in the PO's words._\n\n## Acceptance criteria\n\n- [AC-1] \n\n## Out of scope\n\n- \n\n## Notes\n`
    : `## What to build\n\n_The screen, from the pinned prototype snapshot._\n\n## Acceptance criteria\n\n_Inherited from the parent requirement — list the AC ids this story satisfies._\n\n- [AC-1]\n\n## Notes\n`;
}
