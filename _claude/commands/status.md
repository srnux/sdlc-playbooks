---
description: Where everything stands — requirements, prototypes, stories, and every gap in the chain.
argument-hint: "[--gaps]   — --gaps shows only what's broken"
allowed-tools: Read, Bash(node .claude/tools/:*)
---

!`node .claude/tools/status.mjs $ARGUMENTS 2>&1; echo; node .claude/tools/check-coverage.mjs 2>&1; echo; node .claude/tools/sync.mjs --check 2>&1 | tail -3`

Read the output back in plain language, in this order:

1. **What needs a human** — prototypes waiting on approval, blocked stories. These are the
   only things the flow cannot move on its own; say them first.
2. **What's in flight** — stories in progress or in review.
3. **What's next** — the next ready story, the next requirement without a prototype.
4. **Gaps** — anything `check-coverage.mjs` flagged. A gap is a fact, not a judgment.
5. **Drift** — if `sync.mjs --check` reported a stale projection, say so: a harness is
   running a playbook that no longer matches `playbooks/`.

Don't editorialise about velocity and don't summarise the whole board when only three
things moved. If nothing needs the human, say so in one line.
