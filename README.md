# sdlc-playbooks

**A file-based software delivery procedure: design system → requirements → prototype →
human approval → product.**

Seven playbooks, seven gates, and a traceability chain a script can check. Runs in
[Claude Code](https://claude.com/claude-code) and in [Codex](https://learn.chatgpt.com/docs)
from one source.

There are no role definitions in this repo. Work is organised by **phase and artifact**,
never by persona — see [*Why there are no roles*](#why-there-are-no-roles) below.

---

## Why this exists

Agentic coding is fast at producing code and bad at producing *the right* code. The usual
failure isn't a bug; it's a feature nobody specified, built from a design nobody approved,
against a mock-up that moved after the work started.

This repo makes those failures mechanical to catch:

- **A design value can only be born in one place.** Nothing downstream invents a colour.
- **Nothing is built from an unapproved prototype.** A human clicks through it and says
  yes, and the gate refuses to proceed until they have.
- **Stories are built against the pinned snapshot**, not whatever the prototype looks like
  today. Drift becomes new scope instead of silent rework.
- **Completeness is a query, not a judgment call.** `check-coverage.mjs` walks
  requirement → screen → story → plan → code and names every break.

The design principle throughout: *a rule written only as prose for a model to honour will
eventually be skipped.* Every checkable rule here is a script that exits non-zero.

---

## The flow

```
  Claude design system          PO requirements (text)
          │                              │
          ▼                              ▼
   0 lock-design-system          1 capture-requirements
   tokens.css                    REQ-### + acceptance criteria
   components.md                          │
          └──────────────┬─────────────────┘
                         ▼
                 2 build-prototype
            self-contained React page
            every screen, every state
                         │
                         ▼
                  ◆ HUMAN APPROVES ◆
                   3 freeze-approval
            frozen snapshot v<N> + stories
                         │
                         ▼
        4 plan-story → 5 implement-story → 6 review-change
                         │
                         ▼
                    the product
```

Read **[`playbooks/FLOW.md`](playbooks/FLOW.md)** for the stage-by-stage reasoning. It is
the document to start with; this README is the map.

---

## Why there are no roles

A role definition encodes identity — *"you are a senior reviewer"* — and hopes behaviour
follows. A playbook encodes procedure: named inputs, a precondition that fails closed, a
fixed sequence, a done-condition.

Each playbook opens with a **contract**:

| | |
|---|---|
| **Phase** | 5 — the only phase that writes product code |
| **Gate** | `node .claude/tools/gate.mjs implement ST-###` |
| **Inputs** | the plan, the pinned snapshot, the catalog, the real component library |
| **Produces** | product code, one test per AC |
| **Done when** | every `verify.commands` entry is green and the story is `in-review` |
| **Never** | copy the prototype into the product; build against the live prototype |

…and closes with **Not this playbook**, pointing at the phase that owns each adjacent
decision. Between them, those two blocks carry everything a role definition used to —
ownership boundaries included — without a second copy of the procedure to drift against.

The test this repo is built to pass:

> **Delete every playbook. Does the procedure survive?**

Yes: the artifacts, the gates, the hooks and the checks are all still there, and a human
can finish the work from them. That is the intended direction of dependency. A repo where
deleting the agent files deletes the procedure had the procedure in the wrong place.

---

## The gate layer

Every phase begins by running its gate. It validates preconditions against the repo and
**exits 2 with a named reason before any model reasoning happens** — the commands expand
it inline, so a blocked gate aborts the command rather than producing a paragraph about
why it probably shouldn't continue.

| Phase | Refuses when |
|---|---|
| `design-system` | already locked and `--refresh` wasn't passed |
| `requirements` | no input, or `--file` doesn't exist |
| `prototype` | design system unlocked · wrong status · **no acceptance criteria** |
| `approve` | not `prototyped` · prototype missing · no `data-screen` markup · **no `--human-approved`** |
| `plan` | parent not approved · no version pin · **snapshot missing** · plan already exists |
| `implement` | **no plan** · story not `in-progress` · snapshot missing |
| `review` | story not `in-review` · no plan · **already at `loops.reviewRounds`** |

Two are worth naming:

**`approve` refuses without `--human-approved`.** That flag means a person said yes in the
conversation — not that the prototype looks finished. There is now no path from a finished
prototype to a cut story that doesn't pass through a person.

**`review` counts the rounds.** The third bounce cannot start; the story goes to `blocked`
and the human gets the actual disagreement instead of another lap.

The gate also prints the resolved context — paths, the pinned version, the AC ids, the
round number, and whether the live prototype has moved past the pin. Facts pinned at gate
time are facts the playbook doesn't rediscover by guessing.

---

## The commands

| Command | Playbook | Produces |
|---|---|---|
| `/design-system [refresh]` | `lock-design-system` | `tokens.css` + `components.md`, locked |
| `/requirements '<PO text>'` | `capture-requirements` | `REQ-###` with observable acceptance criteria |
| `/prototype REQ-### ['feedback']` | `build-prototype` | `prototype/<slug>.html` — every screen, every state |
| `/approve REQ-### --human-approved` | `freeze-approval` | immutable `…-v<N>.html` + one story per screen |
| `/build [ST-###]` | `plan-story` → `implement-story` → `review-change` | plan → code → green → verdict |
| `/status [--gaps]` | — | what needs a human, what's in flight, every gap |

In Codex the playbooks are invoked by name (`$build-prototype`); the gate is step 0 of each
playbook, so the procedure is identical without the command layer.

---

## Quick start

Requirements: **Node 18+** (the tools are plain ESM, zero dependencies), and a **bash**
shell for the two hooks (Git Bash is fine on Windows).

```bash
$EDITOR .claude/sdlc.config.json             # product.name, verify.commands, designSystem.source
$EDITOR .claude/rules/coding-standards.md    # rewrite the stack-specific half
node .claude/tools/sync.mjs                  # project playbooks/ into both harnesses

# then, one slice end to end
/design-system                          # lock tokens + catalog
/requirements 'PO text here…'           # -> REQ-001
/prototype REQ-001                      # -> prototype/<slug>.html, served for review
#   ... a human opens it and says yes ...
/approve REQ-001 --human-approved       # -> frozen v1 + one story per screen
/build                                  # -> the next ready story, built and reviewed
/status                                 # where everything stands
```

Run **one real requirement end to end before loading up the backlog.** If the procedure
survives one slice it will scale; if it doesn't, you'd rather find out on one.

Every tool also runs standalone, without any model in the loop:

```bash
node .claude/tools/gate.mjs prototype REQ-001   # exit 2 + the reason
node .claude/tools/status.mjs [--gaps] [--json]
node .claude/tools/check-coverage.mjs           # exit 2 on the first break in the chain
node .claude/tools/check-tokens.mjs             # exit 2 on a raw colour outside tokens.css
node .claude/tools/sync.mjs --check             # exit 2 if a projection is stale
node .claude/tools/tracker.mjs list --type story
node .claude/tools/approve.mjs REQ-004 [--dry-run]
```

---

## Layout

```
playbooks/                   THE SOURCE OF TRUTH — harness-neutral
  FLOW.md                      the flow, the gate table, the reasoning
  lock-design-system/          phase 0
  capture-requirements/        phase 1
  build-prototype/             phase 2  (+ references/prototype-template.html)
  freeze-approval/             phase 3
  plan-story/                  phase 4
  implement-story/             phase 5
  review-change/               phase 6

.claude/
  sdlc.config.json           the ONLY per-project file
  settings.json              permissions + hook wiring
  commands/                  thin gated triggers, no procedure (6)
  skills/                    GENERATED from playbooks/ — do not edit
  rules/
    artifacts.md               every artifact, who writes it, the chain
    tracker.md                 the adapter contract — files now, Jira later
    prototype-rules.md         what a prototype must and must not be
    coding-standards.md        universal half + a stack half you rewrite
  tools/
    gate.mjs                   the precondition gate for every phase
    sync.mjs                   projects playbooks/ into each harness
    tracker.mjs                the only way anything touches a tracker
    tracker/files.mjs          markdown-file provider
    tracker/jira.mjs           Jira provider — translation done, transport stubbed
    approve.mjs                freeze a prototype as an immutable snapshot
    check-tokens.mjs           the design-system gate
    check-coverage.mjs         the traceability gate
    status.mjs                 the report
  hooks/
    require-plan.sh            BLOCKS an implementation edit with no plan
    check-hardcoded-colors.sh  warns on a raw colour as you type

.agents/skills/              GENERATED from playbooks/ — Codex reads this
.codex/hooks.json            Codex wiring for the same two hook scripts
AGENTS.md · CLAUDE.md        entry points, one per harness

design-system/               tokens.css + components.md — locked, the first input
work/items/                  REQ-###.md and ST-###.md — the tracker, as files
work/plans/                  the plan gate artifact, one per story
prototype/                   the live prototypes
prototype/.approved/         immutable snapshots — never edited
docs/
```

**`playbooks/` is the only place a procedure is written.** `.claude/skills/` and
`.agents/skills/` are generated copies with a `.generated` marker recording the source
hash; `sync.mjs --check` exits 2 when someone edits one by hand, and `/status` surfaces it.

Copies rather than symlinks, deliberately: symlinks need developer mode or an elevated
shell on Windows, and an install step that fails for half the team isn't an install step.

---

## The three enforcement layers

**Gates** — may this phase start? `tools/gate.mjs`, exit 2, before any reasoning.

**Hooks** — may this edit land? `require-plan.sh` blocks an implementation edit with no
plan. `check-hardcoded-colors.sh` warns on a raw colour while it's still one line to fix.

**Checks** — is this finished? `check-tokens.mjs` fails on a raw design value;
`check-coverage.mjs` walks the chain and names every break.

---

## The coverage chain

```
requirement → AC → screen (in the approved snapshot) → story → plan → code → done
```

Every screen root in a prototype carries `data-screen="SCR-…"` and `data-req="REQ-###"`.
That markup isn't decoration — it's what makes the chain checkable, and `gate.mjs approve`
refuses a prototype without it.

A gap is a fact, not an invitation to widen a story until it goes away.

---

## Swapping the tracker

No playbook or command ever talks to a tracker directly — they all shell out to
`tools/tracker.mjs`, which dispatches to a provider. Today that's `files` (markdown in
`work/items/`). To move to Jira: set `tracker.provider: "jira"`, fill in `tracker.jira`,
and finish the `call()` transport in `tools/tracker/jira.mjs`. The field and status
translation is already written, and nothing above that file changes.

Even with Jira as the tracker, the *artifacts* stay in the repo and reference items by id.
The tracker holds status and conversation; the repo holds the work.

---

## What is deliberately not here

No board integration, no CI/deploy stage, no QA phase, no parallel fan-out, no worktree
isolation, no spec extraction from a legacy app. Those are real and sometimes necessary —
they're also where a procedure stops being legible.

Add one when a specific failure demands it, and write down which failure. **A gate with no
incident behind it is ceremony.**

---

## About this checkout

Ships the procedure *and* a worked example: `design-system/` is locked to the **Vinjerac /
Seaside Zadar** canvas, `prototype/seaside-zadar-landing.html` is a real prototype with
nine marked screens, and `work/items/` holds REQ-001 … REQ-003.

`sdlc.config.json → product.name` is still `CHANGE-ME`. Both are meant to be replaced when
you retarget — see [`.claude/README.md`](.claude/README.md) § *Retargeting*.

Ported from `simple-sdlc`; [`MIGRATION.md`](MIGRATION.md) records what changed and why.
