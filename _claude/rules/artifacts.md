# Artifacts — what exists on disk, who writes it, what reads it

Everything the flow produces is a file. There is no hidden state, no model memory, no
database. If you delete every playbook and keep these files, a human can finish the work.

Paths resolve from `.claude/sdlc.config.json`; the values below are the defaults.

| Path | Written by | Read by | Frozen? |
|------|-----------|---------|---------|
| `design-system/tokens.css` | `lock-design-system` (`/design-system`) | phases 2 and 5, `check-tokens.mjs` | yes, once locked |
| `design-system/components.md` | `lock-design-system` | phases 2 and 5 | yes, once locked |
| `work/items/REQ-###.md` | `capture-requirements` (`/requirements`) | everyone | no — the living requirement |
| `work/items/ST-###.md` | `freeze-approval` (`/approve`) | phases 4-6 | no |
| `prototype/<slug>.html` | `build-prototype` (`/prototype`) | the human, phase 5 | no — refined until approved |
| `prototype/.approved/<slug>-v<N>.html` | `freeze-approval` | phase 5 (**this** is what gets built) | **yes — immutable** |
| `work/plans/ST-###.md` | `plan-story` | `require-plan.sh`, `gate.mjs`, `review-change` | no |
| `docs/<slug>.md` | `implement-story` | humans | no |

## The item file (files tracker provider)

One markdown file per work item, YAML frontmatter + body. `tools/tracker.mjs` is the only
thing that parses or writes it — never hand-edit from a playbook, never `Edit` it directly.

```markdown
---
id: REQ-004
type: requirement          # requirement | story
title: Bulk archive contacts from the list
status: approved           # see statuses in sdlc.config.json
parent: null               # story → its requirement
screens: [SCR-contact-list, SCR-archive-confirm]
prototype: prototype/bulk-archive.html
approvedVersion: v2        # set by /approve; stories build against this snapshot
created: 2026-09-13
updated: 2026-09-14
---

## Context
Why this exists, in the PO's words. Verbatim where possible.

## Acceptance criteria
- [AC-1] Selecting rows in the contact list enables an Archive action.
- [AC-2] Archiving asks for confirmation and names how many records are affected.
- [AC-3] Archived contacts leave the default list and are reachable under a filter.

## Out of scope
- Restoring archived contacts (separate requirement).

## Notes
```

A **story** carries `parent`, one `screen`, and `prototypeVersion` — the snapshot it was cut
from. It is built against that snapshot, not against head. If head has moved on, that
difference is a new requirement, not a licence to build something else.

## ID allocation

`tools/tracker.mjs create` allocates the next free id under the configured prefix. Never
pick an id by hand — two sessions will pick the same one.

## The coverage chain

    requirement → screen (in the approved prototype) → story → plan → code → done

`tools/check-coverage.mjs` walks it and exits 2 on the first break. A requirement with no
screen, a screen with no story, a story with no plan, or a done story whose screen vanished
from the approved snapshot are all gaps — not judgment calls. Run it before you believe
anything is finished.
