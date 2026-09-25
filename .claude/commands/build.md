---
description: Implement the next ready story — plan, build against the pinned snapshot, get green, then review.
argument-hint: "[ST-###]   — no args takes the next ready story"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(node .claude/tools/:*), Bash(npm run:*), Bash(npm test:*), Bash(git:*)
---

The story:

!`node .claude/tools/tracker.mjs next --type story 2>&1`

Three phases, in sequence. Each one gates itself; a blocked gate stops the command.

**4 — plan** · `node .claude/tools/gate.mjs plan <ID>` → run the **plan-story** playbook.
Output is `work/plans/<ID>.md` and nothing else. `hooks/require-plan.sh` blocks the first
implementation edit until that file exists.

**5 — implement** · `node .claude/tools/gate.mjs implement <ID>` → run the
**implement-story** playbook against the pinned snapshot the gate names — **not** the live
prototype file. If the gate reports `liveHasMovedPastThePin`, that difference is new scope
for the PO; record it under *Divergence* and say so in the handover.

**6 — review** · `node .claude/tools/gate.mjs review <ID>` → run the **review-change**
playbook. Approve to `done`, or bounce once with a specific comment naming the AC id or
`file:line`. The gate counts the rounds and refuses the one past `loops.reviewRounds` — when
it does, set the story `blocked` and hand the human the actual disagreement.

Use `$0` as the story id if given; otherwise the one printed above.

Report at the end: which ACs are satisfied and how, what you left out and why, and anything
the review flagged that you disagreed with.
