# The harness

Mechanics. For the flow and the reasoning read [`../playbooks/FLOW.md`](../playbooks/FLOW.md);
for the overview read the [root README](../README.md).

## The separation

| Layer | Holds | Can it stop anything? |
|---|---|---|
| `../playbooks/` | **the procedure** — one contract + steps per phase | no |
| `commands/` | triggers: expand the gate, name the playbook | via the gate's exit code |
| `tools/gate.mjs` | preconditions per phase | **yes — exit 2, before reasoning** |
| `rules/` + `sdlc.config.json` | standards and values, each with one home | no |
| `tools/check-*.mjs` | is it finished? | **yes — exit 2** |
| `hooks/` | may this edit land? | **yes — exit 2** |
| `skills/` | generated copies of `../playbooks/` | no — do not edit |

There is no roles layer, and adding one is a regression. Ownership lives in each
playbook's **Not this playbook** section, stated as phases.

## Commands

All six expand their gate inline with the `` !`…` `` syntax, so a blocked gate aborts the
command before the model reads any further.

| Command | Gate | Playbook |
|---|---|---|
| `/design-system [refresh]` | `gate.mjs design-system` | `lock-design-system` |
| `/requirements '<text>'` | `gate.mjs requirements` | `capture-requirements` |
| `/prototype REQ-###` | `gate.mjs prototype` | `build-prototype` |
| `/approve REQ-### --human-approved` | `gate.mjs approve` | `freeze-approval` |
| `/build [ST-###]` | `gate.mjs plan` → `implement` → `review` | phases 4–6 |
| `/status [--gaps]` | — | — |

**If your Claude Code build doesn't expand `` !`…` ``** the command will show the backtick
line literally instead of the gate output. The playbooks each run their own gate as step 0,
so the procedure still holds — but fix the command layer rather than living with it, since
inline expansion is what makes a refusal abort rather than something to reason about.

## Keeping the projections in sync

```bash
node .claude/tools/sync.mjs          # write .claude/skills and .agents/skills
node .claude/tools/sync.mjs --check  # exit 2 if either is stale — use in CI
node .claude/tools/sync.mjs --list   # show state without writing
```

Edit `../playbooks/<name>/SKILL.md` and re-run sync. Never edit a file under `skills/`:
each generated directory carries a `.generated` marker with the source hash, `--check`
compares against it, and `/status` reports drift.

Adding a harness is one line in `sdlc.config.json → playbooks.targets`.

## Retargeting to another project

1. Copy `playbooks/`, `.claude/`, `.agents/`, `.codex/`, `AGENTS.md`, `CLAUDE.md`.
2. Edit `sdlc.config.json` — `product.name`, `verify.commands`, `designSystem.source`.
3. Rewrite the stack-specific half of `rules/coding-standards.md`.
4. `node .claude/tools/sync.mjs`.
5. Run one requirement end to end — `/requirements` → `/prototype` → `/approve` → `/build`
   — **before** loading up the backlog.

## Switching to Jira later

`sdlc.config.json → tracker.provider: "jira"`, fill in `tracker.jira`, finish the `call()`
transport in `tools/tracker/jira.mjs`. Field and status translation is already written. No
playbook or command changes — they only ever call `tools/tracker.mjs`. See `rules/tracker.md`.

## Things worth knowing

- **Nothing invents a design value.** Only `lock-design-system` adds a token.
- **Nothing is built from an unapproved prototype.** `gate.mjs approve` refuses without
  `--human-approved`, and the tracker refuses to cut the story.
- **Stories are built against a pinned snapshot.** `gate.mjs implement` reports
  `liveHasMovedPastThePin` so drift can't be missed.
- **Gaps are facts.** `check-coverage.mjs` names them; don't widen a story to absorb one.
- **The review loop is bounded, mechanically.** `gate.mjs review` refuses the round past
  `loops.reviewRounds`.
- **Every tool runs standalone.** No model is required to check the state of this repo.
