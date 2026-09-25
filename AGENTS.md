# sdlc-playbooks

A file-based delivery procedure: design system → requirements → prototype → human
approval → product. The procedure lives in `playbooks/`; this file is the entry point.

**There are no role definitions in this repo, and adding one is a regression.** Work is
organised by phase and by artifact, never by persona. See `playbooks/FLOW.md`.

## Before any phase, run its gate

```
node .claude/tools/gate.mjs <phase> [id] [flags]
```

Exit 2 means **stop**: report the reason and the fix verbatim, change nothing, and do not
work around it. Exit 0 prints the resolved context — paths, the pinned prototype version,
the acceptance-criterion ids, the review round. Use those facts; don't rediscover them.

| Phase | Playbook | Gate |
|---|---|---|
| 0 | `lock-design-system` | `gate.mjs design-system [--refresh]` |
| 1 | `capture-requirements` | `gate.mjs requirements '<text>'` |
| 2 | `build-prototype` | `gate.mjs prototype REQ-###` |
| 3 | `freeze-approval` | `gate.mjs approve REQ-### --human-approved` |
| 4 | `plan-story` | `gate.mjs plan ST-###` |
| 5 | `implement-story` | `gate.mjs implement ST-###` |
| 6 | `review-change` | `gate.mjs review ST-###` |

In Codex, invoke a playbook by name: `$build-prototype`. The playbooks are projected into
`.agents/skills/` from `playbooks/` by `node .claude/tools/sync.mjs`.

## The rules that are not negotiable

- **A design value can only be born in `lock-design-system`.** No later phase invents a
  colour, radius or spacing value. `tools/check-tokens.mjs` fails on a raw one.
- **Nothing is built from an unapproved prototype.** `gate.mjs approve` refuses without
  `--human-approved`, and that flag means a person said yes in the conversation — not that
  the prototype looks finished.
- **Stories are built against the pinned snapshot**, never the live prototype. Drift is new
  scope for the PO.
- **Plan before code.** `work/plans/<ID>.md` exists before the first implementation edit;
  `hooks/require-plan.sh` blocks it otherwise.
- **All tracker access goes through `node .claude/tools/tracker.mjs`.** Never hand-edit a
  work item, never pick an id.

## Detail

- `playbooks/FLOW.md` — the flow, the gate table, and why it is shaped this way
- `.claude/rules/artifacts.md` — every artifact, who writes it, the chain
- `.claude/rules/prototype-rules.md` — what a prototype must and must not be
- `.claude/rules/coding-standards.md` — universal half + a stack half to rewrite
- `.claude/rules/tracker.md` — the adapter contract
- `.claude/sdlc.config.json` — the only per-project file
