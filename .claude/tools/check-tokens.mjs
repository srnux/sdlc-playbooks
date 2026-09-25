#!/usr/bin/env node
/**
 * check-tokens.mjs — the design-system gate.
 *
 * Asserts that nothing outside design-system/tokens.css carries a raw design
 * value — colour, radius, shadow, font-size or spacing. A literal in a
 * prototype or in product code means someone made a design decision where no
 * designer was looking.
 *
 * Deliberately NOT a ban on every number. Layout is not design: `width: 100%`,
 * `grid-column: 1 / 7`, `z-index`, `top: 0` and the breakpoint in a media query
 * are all fine. Only the properties that carry a design decision are scoped.
 *
 *   node .claude/tools/check-tokens.mjs [--fix-hint]
 *
 * exit 0 = clean · 2 = violations found · 1 = couldn't run
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative, extname } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfgPath = resolve(ROOT, '.claude/sdlc.config.json');
if (!existsSync(cfgPath)) { console.error('missing .claude/sdlc.config.json'); process.exit(1); }
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));

const TOKENS = resolve(ROOT, cfg.designSystem?.tokens ?? 'design-system/tokens.css');
const PREFIX = cfg.designSystem?.tokenPrefix ?? '--ds-';
const PROTO_DIR = resolve(ROOT, cfg.prototype?.dir ?? 'prototype');

const SCAN_EXT = new Set(['.html', '.css', '.scss', '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte']);
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.approved', '.claude']);

// raw colour literals: #abc, #aabbcc, rgb(), rgba(), hsl(), hsla()
const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/g;

// The non-colour half of the same rule (rules/coding-standards.md): no raw
// radius, shadow, font-size or spacing value outside the token file either.
//
// Scoped to the properties that carry a design decision — NOT to every length
// in the file. `width: 100%`, `grid-column: 1 / 7`, `top: 0` and a media-query
// breakpoint are layout, not design, and are none of this gate's business.
// Both spellings are matched: CSS `font-size` and JSX `fontSize`.
const DESIGN_PROPS = [
  'font-size', 'border-radius', 'box-shadow',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-inline', 'padding-block',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'margin-inline', 'margin-block',
  'gap', 'row-gap', 'column-gap',
];
const camel = (p) => p.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const DESIGN_DECL = new RegExp(
  `\\b(${[...DESIGN_PROPS, ...DESIGN_PROPS.map(camel)].join('|')})\\s*:\\s*([^;{}\\n]*)`,
  'g',
);

// An absolute length (14px, 1.5rem) is a design value. A bare non-zero number is
// one too in a JSX style object, where React appends px. Percentages, fr, vw/vh,
// `0`, `auto`, `none` and `inherit` are layout and pass.
const RAW_LENGTH = /(?<![\w.-])\d*\.?\d+(px|rem|em|pt|ch|ex)(?![\w-])|(?<![\w.#-])(?!0(?![\d.]))\d*\.?\d+(?![\w%.-])/;

/** The literal design value in a declaration, or null if it only composes tokens. */
function rawValue(value) {
  // strip every var(...) — including fallbacks — then see what is left
  let v = value;
  for (let i = 0; i < 6 && v.includes('var('); i++) v = v.replace(/var\([^()]*\)/g, ' ');
  v = v.replace(/['"]/g, ' ');
  const m = v.match(RAW_LENGTH);
  return m ? m[0] : null;
}

const problems = [];      // raw colours
const valueProblems = []; // raw radius / shadow / font-size / spacing
const notes = [];

// --- 1. the token file itself must exist and define tokens -----------------
if (!existsSync(TOKENS)) {
  console.error(`design system not locked: ${relative(ROOT, TOKENS)} does not exist.\nRun /design-system first.`);
  process.exit(2);
}
const tokenSrc = readFileSync(TOKENS, 'utf8');
const defined = new Set([...tokenSrc.matchAll(new RegExp(`(${PREFIX}[\\w-]+)\\s*:`, 'g'))].map((m) => m[1]));
if (defined.size === 0) {
  console.error(`${relative(ROOT, TOKENS)} defines no ${PREFIX}* custom properties.`);
  process.exit(2);
}

// --- 2. no raw colour outside the token file --------------------------------
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (SCAN_EXT.has(extname(name))) out.push(p);
  }
  return out;
}

const targets = [
  ...walk(PROTO_DIR),
  ...(cfg.verify?.scanDirs ?? ['src', 'app', 'apps', 'packages', 'libs']).flatMap((d) => walk(resolve(ROOT, d))),
].filter((p) => resolve(p) !== TOKENS);

const DEFINITION = new RegExp(`^\\s*${PREFIX}[\\w-]+\\s*:`);

for (const file of targets) {
  const src = readFileSync(file, 'utf8');
  // A custom-property DEFINITION is fine wherever it appears: prototypes inline
  // the whole token block, and that block is the token file's content, not a
  // literal someone typed into a component. A definition can also span lines —
  // a gradient or a two-part shadow — so skip until its declaration closes,
  // otherwise the continuation lines read as raw colours.
  let inDefinition = false;

  src.split('\n').forEach((line, i) => {
    const opens = DEFINITION.test(line);
    if (opens) inDefinition = true;
    if (inDefinition) {
      if (line.includes(';')) inDefinition = false;
      return;
    }

    const hits = line.match(COLOR);
    if (hits) problems.push({ file: relative(ROOT, file), line: i + 1, found: hits.join(' '), text: line.trim().slice(0, 100) });

    for (const [, prop, value] of line.matchAll(DESIGN_DECL)) {
      const raw = rawValue(value);
      if (raw) valueProblems.push({ file: relative(ROOT, file), line: i + 1, found: `${prop}: ${value.trim()}`, hit: raw, text: line.trim().slice(0, 100) });
    }
  });
}

// --- 3. tokens referenced but never defined ---------------------------------
const used = new Set();
for (const file of targets) {
  for (const m of readFileSync(file, 'utf8').matchAll(new RegExp(`var\\(\\s*(${PREFIX}[\\w-]+)`, 'g'))) used.add(m[1]);
}
const undefinedTokens = [...used].filter((t) => !defined.has(t));

// --- report -----------------------------------------------------------------
if (problems.length === 0 && valueProblems.length === 0 && undefinedTokens.length === 0) {
  console.log(`ok — ${defined.size} tokens defined, ${used.size} used, no raw design values in ${targets.length} files`);
  process.exit(0);
}

if (problems.length) {
  console.error(`\nRaw colour values outside ${relative(ROOT, TOKENS)} (${problems.length}):\n`);
  for (const p of problems.slice(0, 40)) console.error(`  ${p.file}:${p.line}  ${p.found}\n      ${p.text}`);
  if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`);
  console.error(`\n  Fix: use an existing var(${PREFIX}…). If the value you need isn't in the`);
  console.error(`  token file, that is a design decision — run /design-system, don't inline it.`);
}

if (valueProblems.length) {
  console.error(`\nRaw radius / shadow / font-size / spacing outside ${relative(ROOT, TOKENS)} (${valueProblems.length}):\n`);
  for (const p of valueProblems.slice(0, 40)) console.error(`  ${p.file}:${p.line}  ${p.found}\n      ${p.text}`);
  if (valueProblems.length > 40) console.error(`  … and ${valueProblems.length - 40} more`);
  console.error(`\n  Fix: same rule as colour — compose a var(${PREFIX}…). A length the token`);
  console.error(`  file doesn't have is a design decision, not a number to type here.`);
}

if (undefinedTokens.length) {
  console.error(`\nTokens used but never defined (${undefinedTokens.length}):`);
  for (const t of undefinedTokens) console.error(`  var(${t})`);
  console.error(`\n  Either a typo, or a token the design system owes you. Ask the design-owner.`);
}

process.exit(2);
