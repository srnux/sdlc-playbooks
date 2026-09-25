---
name: build-prototype
description: >
  Build or refine the self-contained React prototype for a requirement — one HTML file,
  React 18 UMD + Babel standalone, design-system tokens inlined, every screen and every
  state, marked up for the coverage chain. Phase 2. Run at /prototype. Project-agnostic;
  the recipe and the template live here.
---

# Build the prototype

## Contract

| | |
|---|---|
| **Phase** | 2 — the artifact a human will actually look at |
| **Gate** | `node .claude/tools/gate.mjs prototype REQ-###` |
| **Inputs** | the requirement's ACs, `tokens.css`, `components.md`, prior feedback in Notes |
| **Produces** | `prototype/<slug>.html` — one file, and comments on the item |
| **Done when** | every AC lands on a screen, every screen draws all five states, `check-tokens.mjs` exits 0 |
| **Never** | approve it; invent a colour; invent a control no AC asks for; call a backend |

One file. Opens with a double-click. No build step, no `node_modules`.

Read `.claude/rules/prototype-rules.md` first — that is the contract for the artifact;
this is the method for producing it.

## Step 0 — the gate

```bash
node .claude/tools/gate.mjs prototype REQ-004
```

Exit 2 means stop and report the reason verbatim. This gate refuses when the design system
isn't locked, when the requirement is in the wrong status, and when the requirement has no
acceptance criteria — in that last case there is literally nothing to draw yet.

It prints the AC ids, the resolved prototype path, and whether this is a **scaffold** or a
**refine**. Take those from the gate rather than re-deriving them.

## Step 1 — read the inputs

```bash
node .claude/tools/tracker.mjs get REQ-004
```

- Every AC must land on a screen. Make that list before writing any JSX.
- Read `design-system/tokens.css` and `design-system/components.md`. Compose from the
  catalog; don't invent. If a screen needs something the catalog doesn't have, **stop and
  raise it** — that's a `lock-design-system` decision, not a component written inline.
- Read the item's `## Notes`. Prior feedback is there, and re-litigating a settled decision
  is the fastest way to lose the human's trust in this loop.

## Step 2 — plan the screens

Write the screen list onto the item as a comment before building:

| Screen id | What it is | ACs it covers |
|---|---|---|
| `SCR-contact-list` | The list with selection and the archive action | AC-1, AC-2 |
| `SCR-archive-confirm` | Confirmation naming the count | AC-2, AC-3 |

If an AC has no screen, you aren't done planning. If a screen has no AC, you're inventing
scope — raise it as a question on the item instead of drawing it.

## Step 3 — build from the template

`references/prototype-template.html` is the skeleton: React 18 UMD, Babel standalone, an
inlined token block, hash routing, and the screen-marking convention. Copy it and fill it.

Non-negotiable markup:

```jsx
<section data-screen="SCR-contact-list" data-req="REQ-004">…</section>
```

`check-coverage.mjs` and `gate.mjs approve` both read exactly this. A screen without it does
not exist as far as the flow is concerned — and the approve gate will refuse a prototype
that has none.

Inline the tokens by pasting the contents of `design-system/tokens.css` into the `<style>`
block. Don't `@import` it — the file has to work from a double-click.

## Step 4 — draw every state

Per screen, a state switcher in the dev toolbar so the human can see each one without
faking data:

- **empty** — and the action that fills it
- **loading** — skeletons in the real layout, not a spinner in the middle of nothing
- **populated** — enough rows that the layout has to cope; one very long value; one blank
  value; realistic names and volumes
- **error** — what went wrong and what to do about it
- **success** — the state *after* the action worked. This is the one everyone forgets and
  the one users notice when it's missing.

## Step 5 — verify

```bash
node .claude/tools/check-tokens.mjs        # must exit 0 — no raw hex anywhere
```

Then serve it (`sdlc.config.json → prototype.serveCmd`), open it, and click every route.
Check the browser console is clean, and check 375px / 768px / 1280px.

## Step 6 — hand over

```bash
node .claude/tools/tracker.mjs set REQ-004 --status prototyped --set prototype=prototype/bulk-archive.html
node .claude/tools/tracker.mjs comment REQ-004 "v-draft: screens SCR-contact-list, SCR-archive-confirm. Open question: undo window length."
```

Tell the human: the screens, the AC each one covers, what you were unsure about, and the
URL. Then **stop**.

Approval is not yours to give and not yours to infer from silence. `gate.mjs approve`
refuses without `--human-approved`, so there is no path from here to stories that doesn't
go through a person.

## Refining an existing prototype

The file exists → continue it. Apply the feedback, record it as a comment, and change only
what was asked plus what that change necessarily implies. A refinement pass that quietly
restyles three other screens is how a human stops trusting the loop.

Never start over. The human has already looked at it and their mental model is built on
what's there.

## Rules

- No raw colours, ever. A missing value goes back to `lock-design-system`.
- No fetch, no auth, no real endpoints. Mock data only.
- No control that no AC asks for.
- Never copy this file into the product.

## Not this playbook

- **Adding a token or a component** → `lock-design-system`.
- **Deciding the prototype is good** → a person, recorded by `freeze-approval`.
- **Changing what the product should do** → `capture-requirements`.
