---
name: lock-design-system
description: >
  Turn a Claude Design canvas, an existing component library, or a brand into the LOCKED
  design system — one tokens.css plus a component catalog with states — that every
  prototype and every implementation builds from. Phase 0. Run at /design-system, before
  any requirement is prototyped. Project-agnostic; paths resolve from sdlc.config.json.
---

# Lock the design system

## Contract

| | |
|---|---|
| **Phase** | 0 — the first input to everything else |
| **Gate** | `node .claude/tools/gate.mjs design-system [--refresh]` |
| **Inputs** | `sdlc.config.json → designSystem.source` |
| **Produces** | `design-system/tokens.css`, `design-system/components.md` — nothing else |
| **Done when** | `check-tokens.mjs` exits 0 and every catalog entry documents its states |
| **Never** | invent a value the source does not have; compose a screen |

**A token can only be born here.** That is the whole reason this phase exists and runs
first. Every later phase reads these two files and treats them as immutable input; a value
they need and cannot find is a decision that comes back to this playbook, not a literal
typed into a component.

## Step 0 — the gate

```bash
node .claude/tools/gate.mjs design-system          # first lock
node .claude/tools/gate.mjs design-system --refresh # deliberate re-derive
```

Exit 2 means stop. Report the reason verbatim and change nothing. The usual block here is
*already locked* — re-locking silently would move values under every screen ever built.

The gate prints the resolved token path, catalog path and configured source. Use those;
don't re-derive them.

## Step 1 — get the raw material

Branch on `designSystem.source.kind`:

**`claude-design`** — a Claude Design canvas or artifact is the source.
- If `ref` is a URL, fetch it; if it's a path, read it.
- Pull the actual values out of the design: colours in the order they appear in the
  palette, the type ramp, the spacing steps used, radii, shadows.
- Read the artboards for the component inventory — what is actually drawn, not what a
  generic design system would have.

**`library`** — an existing component library (shadcn, a house Angular/React library).
- Read its theme/token file for the values.
- Read its component index for the catalog. Record the **real import path** for each,
  because that's what the implement phase will type.

**`manual`** — brand guidelines, a screenshot, a Figma export, or the human describing it.
- Extract what's stated. Ask about what isn't.

## Step 2 — write the tokens

Semantic names, not literal ones. `--ds-color-danger`, not `--ds-color-red-600`. No later
phase should ever have to know which red it is.

```css
:root {
  /* colour — semantic */
  --ds-color-bg: #ffffff;
  --ds-color-surface: #f7f7f8;
  --ds-color-text: #16161a;
  --ds-color-text-muted: #6b6b76;
  --ds-color-border: #e3e3e8;
  --ds-color-primary: #701ef6;
  --ds-color-primary-contrast: #ffffff;
  --ds-color-danger: #d92d20;
  --ds-color-success: #067647;
  --ds-color-warning: #b54708;

  /* type */
  --ds-font-sans: Inter, system-ui, sans-serif;
  --ds-text-xs: 12px;  --ds-text-sm: 13px;  --ds-text-md: 14px;
  --ds-text-lg: 16px;  --ds-text-xl: 20px;  --ds-text-2xl: 28px;
  --ds-leading-tight: 1.25; --ds-leading-normal: 1.5;

  /* space — one scale, used everywhere */
  --ds-space-1: 4px;  --ds-space-2: 8px;  --ds-space-3: 12px;
  --ds-space-4: 16px; --ds-space-6: 24px; --ds-space-8: 32px;

  /* shape + depth */
  --ds-radius-sm: 4px; --ds-radius-md: 8px; --ds-radius-lg: 12px; --ds-radius-full: 999px;
  --ds-shadow-sm: 0 1px 2px rgba(16,16,26,.06);
  --ds-shadow-md: 0 4px 12px rgba(16,16,26,.10);
}
```

Optional themes go in `[data-theme="…"]` blocks that redefine **only** the colour tokens.
The structural scale stays shared — that's what makes them themes rather than two systems.

**Only put in what the source actually has.** If the source has three greys, the tokens
have three greys; don't round them up to a scale that "looks more systematic". A token
invented to complete a ramp is a design decision nobody made. If something is genuinely
missing — no error colour anywhere — say so and ask. Don't fill the gap silently.

## Step 3 — write the catalog

One section per component: what it's for, its variants, **its states**, and how it's
reached in code.

```markdown
## Button
Primary action in a region. One primary per region, at most.
- Variants: primary · secondary · ghost · danger
- Sizes: sm · md
- States: default · hover · active · disabled · loading
- Import: `import { Button } from '@app/ui'`

## DataTable
A list of records with selection, sort and paging.
- States: **empty** (with the action that fills it) · **loading** (skeleton rows) ·
  **error** (with retry) · **populated** · **partial selection**
- Notes: selection state lives above the table; the table never owns it.
```

A component with no documented empty and error state is a component that will ship without
one. Write them.

## Step 4 — verify and lock

```bash
node .claude/tools/check-tokens.mjs        # must exit 0
```

Then say explicitly that the system is locked, and that any new value from here is a
design decision routed back through this phase.

## On refresh

Show the diff **before** writing. A changed token touches every screen ever built — the
human gets to see what moves before it moves. List which existing prototypes and which
built screens use each changed token.

Never delete a token that shipped without naming what breaks.

## Not this playbook

- **Composing screens** → `build-prototype`. This phase produces the vocabulary; that one
  writes sentences with it.
- **Deciding what the product should do** → `capture-requirements`.
- **A missing value discovered later** → comes back here as a `/design-system refresh`,
  never as a literal in the file where it was noticed.
