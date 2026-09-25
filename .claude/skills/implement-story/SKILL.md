---
name: implement-story
description: >
  Build one story against its plan and its pinned prototype snapshot, using the real
  component library and the locked tokens — every state, one test per acceptance
  criterion, green before handover. Phase 5. Run at /build, after plan-story.
---

# Implement a story

## Contract

| | |
|---|---|
| **Phase** | 5 — the only phase that writes product code |
| **Gate** | `node .claude/tools/gate.mjs implement ST-###` |
| **Inputs** | `work/plans/<ID>.md`, the pinned snapshot, the catalog, the real component library |
| **Produces** | product code, one test per AC, optionally `docs/<feature>.md` |
| **Done when** | every `verify.commands` entry is green and the story is `in-review` |
| **Never** | copy the prototype into the product; build against the live prototype; invent copy or endpoints |

The plan is written. Build what it says.

## Step 0 — the gate

```bash
node .claude/tools/gate.mjs implement ST-007
```

Exit 2 means stop and report the reason verbatim. This gate refuses without a plan, refuses
when the story isn't `in-progress`, and refuses when the pinned snapshot is missing.

It also reports **`liveHasMovedPastThePin`**. If that is true, the live prototype has changed
since this story was cut. You build the pinned version. The difference is new scope for the
PO — record it under *Divergence* and say so in the handover. Building head where the story
pinned v2 is drift, it is invisible in the diff, and it is how a two-week feature becomes a
four-week one without anyone deciding it should.

## Step 1 — set up

```bash
git checkout -b story/ST-007-contact-list-archive   # sdlc.config.json -> product.branchPattern
node .claude/tools/tracker.mjs set ST-007 --status in-progress
```

Open three things side by side: the plan, the pinned snapshot at the path the gate printed,
and `design-system/components.md`.

## Step 2 — build, in this order

1. **The component shell and its states** — all five, before any data. A screen that can
   render blank is easier to prevent than to retrofit.
2. **The data layer** — the hook or service from the plan, with the cache key and the
   invalidations the plan named.
3. **Wire them.**
4. **The tests** — one per AC, named after the AC id.

## Reading the snapshot

You read it; you never copy from it. Copying imports its mock data, its inline styles and
its shortcuts, and they will outlive the prototype by years.

What transfers: layout and hierarchy, what's grouped with what, what's emphasised, the
copy, the interaction sequence, the state treatments.

What doesn't: the markup itself, the mock data, the dev toolbar, any styling that isn't a
token.

## Fidelity

Compare region by region against the pinned snapshot. Where you deviate, it's either in the
plan's *Divergence* section or it's a defect. "Close enough" is what a review discovers
three stories later, when the pattern has already been copied twice.

## Non-negotiables

- **Tokens only.** No hex, no `rgb()`, no literal px for design values.
  `node .claude/tools/check-tokens.mjs` must pass. Layout properties are yours; the gate
  scopes itself to the ones that carry a design decision.
- **Catalog only.** A missing component goes back to `lock-design-system`.
- **Every state renders something.** Especially success.
- **`data-testid` on every interactive element.** Never select by copy, class or position.
- **No invented copy or endpoints.** If the requirement doesn't say, ask — don't write it
  and hope.

## Step 3 — green

```bash
npm run lint && npm test      # sdlc.config.json -> verify.commands
```

All green. A red build isn't a review comment, it's an unfinished story.

## Step 4 — document and hand over

If the story adds something a future reader would need explained, write `docs/<feature>.md`
— short, one screen's worth. Not a README nobody asked for.

```bash
node .claude/tools/tracker.mjs set ST-007 --status in-review
```

Report: what you built, which ACs and how, **what you left out and why**, and anything
where the snapshot and the requirement disagreed. That last one is the most useful sentence
you'll write all story — it's the thing a review can't see from the diff.

## Not this playbook

- **Deciding whether it's done** → `review-change`. Self-approval removes the only
  independent check in the flow.
- **Absorbing a prototype change** → back to `capture-requirements` as new scope.
- **Adding a token or component** → `lock-design-system`.
