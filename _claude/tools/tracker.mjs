#!/usr/bin/env node
/**
 * tracker.mjs — the ONLY way the flow touches a tracker.
 *
 * Every agent, command and skill shells out to this. It reads
 * sdlc.config.json -> tracker.provider and dispatches to a provider module that
 * speaks the generic vocabulary (id/type/title/status/parent/screens/...).
 * Swapping `files` for `jira` therefore changes nothing above this file.
 *
 *   node .claude/tools/tracker.mjs list [--type requirement|story] [--status S] [--parent ID]
 *   node .claude/tools/tracker.mjs get <ID>
 *   node .claude/tools/tracker.mjs create --type story --title "..." [--parent REQ-004]
 *                                         [--body-file F] [--set k=v ...]
 *   node .claude/tools/tracker.mjs set <ID> [--status S] [--set k=v ...]
 *   node .claude/tools/tracker.mjs body <ID> --file F
 *   node .claude/tools/tracker.mjs comment <ID> "text"
 *   node .claude/tools/tracker.mjs next [--type story]
 *
 * Always prints JSON. Exit 0 = ok, 1 = bad usage / not found, 2 = rule violation.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..', '..');

export function loadConfig() {
  const p = resolve(ROOT, '.claude/sdlc.config.json');
  if (!existsSync(p)) die(1, `missing .claude/sdlc.config.json (looked in ${ROOT})`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function die(code, message) {
  process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 2) + '\n');
  process.exit(code);
}

export function ok(data) {
  process.stdout.write(JSON.stringify({ ok: true, ...data }, null, 2) + '\n');
}

/** Minimal flag parser: positionals + --flag value + repeatable --set k=v */
export function parseArgs(argv) {
  const out = { _: [], set: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    if (key === 'set') {
      const kv = argv[++i] ?? '';
      const eq = kv.indexOf('=');
      if (eq < 0) die(1, `--set expects k=v, got "${kv}"`);
      out.set[kv.slice(0, eq)] = kv.slice(eq + 1);
    } else {
      out[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return out;
}

const PROVIDERS = {
  files: () => import('./tracker/files.mjs'),
  jira: () => import('./tracker/jira.mjs'),
};

const VERBS = ['list', 'get', 'create', 'set', 'body', 'comment', 'next'];

async function main() {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  if (!verb || !VERBS.includes(verb)) {
    die(1, `usage: tracker.mjs <${VERBS.join('|')}> [...]`);
  }
  const args = parseArgs(argv.slice(1));
  const cfg = loadConfig();
  const name = cfg.tracker?.provider;
  const load = PROVIDERS[name];
  if (!load) die(1, `unknown tracker.provider "${name}" — known: ${Object.keys(PROVIDERS).join(', ')}`);

  const provider = await load();
  const fn = { list: 'list', get: 'get', create: 'create', set: 'set', body: 'setBody', comment: 'comment', next: 'next' }[verb];
  if (typeof provider[fn] !== 'function') die(1, `provider "${name}" does not implement ${fn}()`);

  try {
    const result = await provider[fn](cfg, args);
    ok(result);
  } catch (e) {
    die(e.code === 'RULE' ? 2 : 1, e.message);
  }
}

// pathToFileURL, not `file://` + argv[1]: the documented invocation is a relative path
// (`node .claude/tools/tracker.mjs ...`), and on Windows the path is backslashed. Naive
// concatenation matches neither, so main() never ran and every verb exited 0 in silence.
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
