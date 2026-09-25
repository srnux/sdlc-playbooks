---
name: capture-requirements
description: >
  Turn a product owner's free text — a paragraph, an email, meeting notes — into one or
  more traceable requirement items with observable acceptance criteria, explicit
  out-of-scope, and every unresolved ambiguity written down as a question. Phase 1. Run
  at /requirements. Project-agnostic; the tracker is reached only via tools/tracker.mjs.
---

# Capture requirements

## Contract

| | |
|---|---|
| **Phase** | 1 — the second input; runs independently of phase 0 |
| **Gate** | `node .claude/tools/gate.mjs requirements '<text>'` · `--file <path>` · `REQ-###` |
| **Inputs** | whatever the PO wrote, verbatim |
| **Produces** | one or more `REQ-###` at status `specified`, via `tools/tracker.mjs` only |
| **Done when** | every AC passes the observable test and every ambiguity is written down |
| **Never** | design the solution; guess and write the guess as an AC |

## Step 0 — the gate

```bash
node .claude/tools/gate.mjs requirements '<the PO text>'
```

Exit 2 means stop and report the reason verbatim. The gate tells you whether this is a
fresh capture or a refinement of an existing item, and where items live.

## Step 1 — split

One coherent want per requirement. The test: could this be prototyped, approved and
shipped on its own? If yes, it's its own item.

Split "users should be able to archive contacts and also restore them later" into two.
The second one is a different screen, a different decision, and probably a different week.

Don't split into tasks. "Add a button" is not a requirement; it's an implementation step
that belongs in a plan.

## Step 2 — write each item

```markdown
## Context
<The PO's words. Verbatim where they're clear. This is the "why", and it survives every
rewrite of the "what".>

## Acceptance criteria
- [AC-1] <observable statement>
- [AC-2] …

## Out of scope
- <the nearby thing you decided not to do, and one clause on why>

## Notes
```

## Step 3 — make the ACs observable

The test: **could a tester holding only this sentence and the product say yes or no,
without asking you anything?**

| Not yet | Observable |
|---|---|
| "Archiving is fast" | "Archiving up to 200 contacts completes without a full-page reload" |
| "The user gets feedback" | "A toast names how many records were archived and offers Undo for 10s" |
| "It should handle errors" | "If the archive call fails, the rows stay selected and an inline error offers Retry" |
| "Works on mobile" | "At 375px the list keeps the name and status columns; the rest collapse behind a row expander" |

Cover the unhappy paths. An AC list with no failure case describes a demo.

Each AC gets an id (`AC-1`, `AC-2`…). Screens cover AC ids, stories reference them, tests
are named after them. That is the entire traceability mechanism and it costs one bracket.

## Step 4 — don't design

The requirement says what must be true. It does not say which control does it.

- "A button in the top right of the list" — you just took `build-prototype`'s decision.
- "The user can trigger archiving from the list without opening a record" — correct: it
  constrains the design without making it.

## Step 5 — write down what you don't know

Every ambiguity you couldn't resolve goes in `## Notes` as a question, and into your
report. This is the highest-value output of the phase. A question raised here costs one
sentence; the same question found during implementation costs a rebuild, and found after
release costs an argument.

Do not guess and write the guess as an AC. That converts your assumption into someone
else's commitment.

Write **out of scope** explicitly. The nearby things deliberately not done are the single
most useful line in the item, and the cheapest to write while it's fresh.

## Step 6 — write it

```bash
# new
node .claude/tools/tracker.mjs create --type requirement \
  --title "Bulk archive contacts from the list" --body-file /tmp/req.md
node .claude/tools/tracker.mjs set REQ-004 --status specified

# refining an existing one
node .claude/tools/tracker.mjs get REQ-004
node .claude/tools/tracker.mjs body REQ-004 --file /tmp/req.md
node .claude/tools/tracker.mjs comment REQ-004 "PO clarified: undo window is 10s, not 30s"
```

Never hand-edit a work item file, and never pick an id by hand. The tracker adapter is the
only writer — which is what lets the backend swap to Jira later without touching this
playbook, and what stops two sessions allocating the same id.

## Report

Ids created, one line each, then **the questions**. Lead with the questions if there are
any — they're what the human has to act on.

## Not this playbook

- **Drawing the screens** → `build-prototype`.
- **Cutting stories** → `freeze-approval`, and only from an approved prototype.
- **A new design value the requirement implies** → `lock-design-system`.
