# Migration from `simple-sdlc`

What changed, why, and what to do with the original.

---

## The finding

`simple-sdlc` already kept its procedure in skills. The five files in `.claude/agents/`
(~10.5 KB) held almost nothing that wasn't also written somewhere else:

| Agent file | Its content | Already written in |
|---|---|---|
| `reviewer.md` § *What you check, in order* | six numbered checks | `review-change/SKILL.md` steps 1–6 |
| `engineer.md` § *The sequence* | pick → plan → build → green → hand over | `commands/build.md` + `plan-story` + `implement-story` |
| `prototyper.md` § *How you decide what to draw* | read ACs, compose from catalog, every state | `build-prototype/SKILL.md` steps 1–4 |
| `product-owner.md` § *The test for an AC* | the observable test, with examples | `capture-requirements/SKILL.md` step 3 |
| `design-owner.md` § *How you work* | read config → run skill → verify | `lock-design-system/SKILL.md` |

The guardrail sections were the same story: *"never copy the prototype into the product"*,
*"one test per AC"*, *"tokens and catalog only"*, *"you read; you don't fix"* — each already
present, verbatim in substance, in the matching skill.

**The only content with no counterpart was the ownership boundaries**: "you do not design
screens", "screen composition is the prototyper's job", "a missing component is a
design-owner decision". Those are real and worth keeping — they're just not facts about
people. They're facts about which *phase* owns which decision.

So the agent files were a second copy of the procedure plus five sentences of routing. Two
copies of a rule is one rule and one future contradiction.

There was also a subtler problem: the agents were never dispatched as subagents. The
commands said *"Adopt the **engineer** role: read `.claude/agents/engineer.md`"* — the main
thread read them as prose. That's the cost of a subagent file with none of the context
isolation that would justify one.

---

## What changed

### 1. `.claude/agents/` is gone

Its unique content became the **Not this playbook** section at the foot of each playbook:

```markdown
## Not this playbook

- **Deciding whether it's done** → `review-change`. Self-approval removes the only
  independent check in the flow.
- **Absorbing a prototype change** → back to `capture-requirements` as new scope.
- **Adding a token or component** → `lock-design-system`.
```

Same routing, stated as phases. Nothing to keep in sync with anything.

### 2. Every playbook opens with a contract

Phase · Gate · Inputs · Produces · Done when · Never. Six rows, at the top, before the
prose. That block is what a role definition was standing in for.

### 3. Skills became playbooks, and moved out of `.claude/`

`playbooks/` is harness-neutral and is the only place a procedure is written.
`tools/sync.mjs` projects it into `.claude/skills/` and `.agents/skills/` as generated
copies with a `.generated` marker holding the source hash. `sync.mjs --check` exits 2 on
drift and `/status` surfaces it.

One rename: `approve-prototype` → `freeze-approval`. The old name implied the playbook
approves something. It doesn't; a person does, and the playbook records it.

### 4. `tools/gate.mjs` — the new layer

Seven phases, each with preconditions that exit 2 with a named reason *before* any model
reasoning. The commands expand the gate inline, so a refusal aborts the command.

Two prose rules became mechanical:

- **`/approve` used to say** *"This command represents a human decision. Do not run it on
  your own judgment."* → `gate.mjs approve` now refuses without `--human-approved`.
- **The review loop bound used to be** a paragraph asking the reviewer to notice the round
  count → `gate.mjs review` counts the rounds in the item's notes and refuses the one past
  `loops.reviewRounds`.

The gate also emits the resolved context (paths, pinned version, AC ids, round number, and
`liveHasMovedPastThePin`), so the playbook works from pinned facts instead of re-deriving
them mid-reasoning.

### 5. Commands became thin

Every command is now: expand the gate → name the playbook → say what to report. The
procedure that used to be restated in `build.md` and `approve.md` lives in one place.

### 6. Codex support

`AGENTS.md` (2.5 KB — well inside Codex's 32 KiB cumulative budget), `.agents/skills/` from
the same source, and `.codex/hooks.json` wiring the same two shell scripts. The hooks now
read the edited file path from either a `file_path` or a `path` key and honour
`CODEX_PROJECT_DIR`, so one copy of each script serves both harnesses.

### 7. Unchanged

`tracker.mjs` and its providers, `approve.mjs`, `check-tokens.mjs`, `check-coverage.mjs`,
`status.mjs`, both hook scripts (beyond the two-key patch), `sdlc.config.json` structure,
the four rules files (role nouns swapped for phase names), and the whole Vinjerac example.

The tools layer was already the strongest part of `simple-sdlc`. Nothing there needed
changing to remove the agents, which is itself the evidence that the agents weren't
carrying the procedure.

---

## Verification performed

Run against the seeded example before shipping:

| Check | Result |
|---|---|
| `gate design-system` when locked | exit 2 — "already locked" |
| `gate design-system --refresh` | exit 0 |
| `gate requirements` with no input | exit 2 |
| `gate prototype REQ-001` / `REQ-003` | exit 0 — scaffold / refine, AC ids resolved |
| `gate approve REQ-003` without the flag | **exit 2 — "approval is a human decision and has not been recorded"** |
| `gate approve REQ-003 --human-approved` | exit 0 — v1, 9 screens found |
| `gate approve REQ-001 --human-approved` | exit 2 — wrong status |
| `gate plan ST-001` before/after the plan exists | exit 0, then exit 2 |
| `gate implement` when `ready` / `in-progress` | exit 2, then exit 0 |
| `gate review` at round 1 / past the cap | exit 0 (round 1 of 2), then **exit 2** |
| live prototype edited after the pin | `liveHasMovedPastThePin: true` + the divergence note |
| `sync.mjs --check` after hand-editing a projection | exit 2, clean after re-sync |
| `check-tokens.mjs` | exit 0 — 139 tokens defined, 134 used |
| `check-coverage.mjs` | exit 2 — 8 `screen-without-story` gaps (correct: one story cut from nine screens) |

The end-to-end walkthrough ran in a throwaway copy; the shipped repo is at its original
state — REQ-003 `prototyped`, no snapshots, no stories.

---

## What to do with `simple-sdlc`

Keep it. Run one real requirement through each and compare where you had to intervene —
that's the only measurement that settles whether the gate layer earns its keep.

The one thing worth porting back regardless, if you keep both: the `file_path|path` patch
in the two hook scripts. It costs nothing and makes them portable.
