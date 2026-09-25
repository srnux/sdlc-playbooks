---
name: review-change
description: >
  Review a finished story against the gates, its acceptance criteria, the pinned
  prototype snapshot and its plan — then approve it to done or bounce it once with
  specifics. Phase 6. Run at the end of /build. Bounded by loops.reviewRounds, counted
  by the gate.
---

# Review a change

## Contract

| | |
|---|---|
| **Phase** | 6 — the last gate before `done` |
| **Gate** | `node .claude/tools/gate.mjs review ST-###` |
| **Inputs** | the diff, the plan, the parent's ACs, the pinned snapshot |
| **Produces** | a status change to `done` or back to `in-progress`, plus one specific comment |
| **Done when** | every AC is pointed at code or a test, or a specific bounce is written |
| **Never** | fix the code; approve past a red gate; bounce vaguely; run a round past the cap |

**You read. You don't fix.** A review that patches the code deletes the only independent
check in the flow.

## Step 0 — the gate

```bash
node .claude/tools/gate.mjs review ST-007
```

Exit 2 means stop and report the reason verbatim. This gate refuses when the story isn't
`in-review`, when there's no plan to review against, and — importantly — when the story has
already been bounced `loops.reviewRounds` times.

That last refusal is the loop bound, made mechanical. When it fires, the correct action is:

```bash
node .claude/tools/tracker.mjs set ST-007 --status blocked
```

and hand the human the actual disagreement. The third round is almost never the one that
resolves it — what's needed is a decision, not another lap.

The gate prints the round number, the cap, the pinned snapshot path and the AC ids.

## Step 1 — the gates, mechanically

```bash
node .claude/tools/check-tokens.mjs
node .claude/tools/check-coverage.mjs
npm run lint && npm test          # sdlc.config.json -> verify.commands
```

Any red ends the review. Don't reason about whether it matters — bounce it with the output.

## Step 2 — every acceptance criterion

Open the parent requirement. Walk the AC list. For each one, **point at the code or the
test that satisfies it**. An AC you can't point at is not satisfied, however good the diff
looks. This is the step that catches the story that built a beautiful screen and missed the
third bullet.

## Step 3 — fidelity to the pinned snapshot

Open the snapshot at the path the gate printed — not the live prototype — and compare
region by region. Every difference is either written in the plan's *Divergence* section or
it's a defect.

Watch for the build tracking a **newer** prototype than the pin. That's drift, it's
invisible in the diff, and it means work nobody scoped.

## Step 4 — the five states

empty · loading · error · populated · **success**. Check each one renders something real.
"The list refreshes" is not a success state. A screen that can go blank, or that succeeds
silently, is not done.

## Step 5 — the plan

Did the build follow it? An unplanned file or dependency usually means something was
discovered mid-build and never written down — ask about it. That's where the next story's
surprise is hiding.

## Step 6 — decide

**Approve:**
```bash
node .claude/tools/tracker.mjs set ST-007 --status done
```
Say what you verified, not just "LGTM". The next reader of this item is a person trying to
work out whether to trust it.

**Bounce:** one comment, specific — the AC id or `file:line` it fails on, and what fixed
looks like. Write the round number into the comment; `gate.mjs review` counts them.

```bash
node .claude/tools/tracker.mjs comment ST-007 "round 1: AC-3 — the error state has no retry (ContactList.tsx:88). Needs the Retry button from snapshot v2 state=error."
node .claude/tools/tracker.mjs set ST-007 --status in-progress
```

Vague comments are how a two-round loop becomes a five-round one. "Feels off" is not a
review finding.

## Tone

Be direct about defects and specific about fixes. Don't pad a real finding with praise, and
don't invent findings to look thorough — an empty review on a clean story is a legitimate
outcome, and saying so is more useful than nitpicking.

## Not this playbook

- **Fixing what you found** → back to `implement-story`, by the person or session that owns
  the story.
- **Resolving a disagreement at the round cap** → a human. Hand them the contested point,
  not a third lap.
- **Deciding the requirement was wrong** → `capture-requirements`.
