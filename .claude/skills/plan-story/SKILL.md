---
name: plan-story
description: >
  Produce the implementation plan for one story before any code is written — files,
  states, fidelity to the pinned prototype snapshot, tests per acceptance criterion, and
  the questions. Phase 4. Run at /build, before implement-story. Required gate;
  hooks/require-plan.sh blocks editing without the plan file.
---

# Plan a story

## Contract

| | |
|---|---|
| **Phase** | 4 — the gate that costs an hour and saves a rebuild |
| **Gate** | `node .claude/tools/gate.mjs plan ST-### [--update]` |
| **Inputs** | the story, its parent's ACs, the **pinned** snapshot, the catalog, the surrounding code |
| **Produces** | `work/plans/<ID>.md` — and nothing else |
| **Done when** | every AC has a row, all five states have a row, Divergence is answered |
| **Never** | write code in this phase; build against the live prototype |

**No code changes in this playbook.** One file comes out of it.

This is a hard gate twice over: `gate.mjs plan` refuses to start when the preconditions are
wrong, and `hooks/require-plan.sh` blocks the first implementation edit until the plan file
exists. Both exist because a plan written after the code is a summary, and a summary never
catches the thing you'd have noticed before starting.

## Step 0 — the gate

```bash
node .claude/tools/gate.mjs plan ST-007
```

Exit 2 means stop and report the reason verbatim. This gate refuses when the parent isn't
approved, when the story has no version pin, when the pinned snapshot is missing from disk,
and when a plan already exists (pass `--update` to revise one deliberately).

It prints the parent id, the screen, the pinned version, the resolved snapshot path and the
AC ids. **Those are the facts of the story — use them rather than looking them up again.**

## Step 1 — read everything first

```bash
node .claude/tools/tracker.mjs get ST-007          # the story
node .claude/tools/tracker.mjs get REQ-004         # its parent — the ACs live here
```

Open the **pinned** snapshot at the path the gate printed — not the live prototype file —
and find the story's `data-screen` section. That markup is the layout you reproduce.

If the live prototype has moved past the pin, the gate's `implement` phase will tell you so
explicitly; note it here under *Divergence*. It is a fact to record, not a licence to build
head.

Also read: `design-system/components.md`, `.claude/rules/coding-standards.md`, and the
existing code around where this lands.

## Step 2 — write the plan

```markdown
# ST-007 — <title>

**Parent:** REQ-004 · **Screen:** SCR-contact-list · **Prototype:** v2

## Summary
One paragraph: what exists after this story that didn't before.

## Acceptance criteria this story satisfies
| AC | How it's satisfied | Test |
|----|--------------------|------|
| AC-1 | … | `contact-list.spec.ts > AC-1` |

## Files
| File | New? | Layer | Why |
|------|------|-------|-----|
| `src/features/contacts/list/ContactList.tsx` | new | feature | the screen |
| `src/features/contacts/list/useArchive.ts` | new | feature | the mutation + invalidation |

Decide the **sub-domain folder** here, not by where the cursor happened to be.
`contacts/list/`, not a flat `contacts/` that accumulates eighty siblings.

## States
| State | What renders | Source |
|-------|--------------|--------|
| empty | … | snapshot v2, state=empty |
| loading | … | |
| error | … | |
| populated | … | |
| **success** | … | |

Five rows. Always. "The list refreshes" is not a success state — that is the silent-success
defect, written down in advance.

## Components
From `design-system/components.md`. If something isn't there, **stop** — that's a
`lock-design-system` decision, not a component written inline.

## Data
Endpoints, request/response shapes, cache keys, and what each write invalidates. Server
data goes through the query layer; never `useState` + manual reload.

## Divergence from the pinned snapshot
Anything you will build differently from v2, and why. Empty is the expected answer.

## Questions
Anything the ACs don't settle. Ask before building, not after.
```

## Step 3 — save

`work/plans/ST-007.md`. Exact id prefix — both the gate and the hook match on it.

## Rules

- Every plan item traces to an AC or to a line in the snapshot. Something that traces to
  neither is scope you're adding.
- Don't invent copy or endpoints. If the requirement doesn't say, that's a question.
- A question in the plan is cheap. The same question during the build costs a rewrite.

## Not this playbook

- **Writing the code** → `implement-story`.
- **Deciding the story is done** → `review-change`.
- **A missing component or token** → `lock-design-system`; record it as a question here.
