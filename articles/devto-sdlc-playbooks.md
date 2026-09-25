---
title: "Stop Asking Your Coding Agent to Behave: Gates, Not Prompts"
published: false
description: "A file-based delivery procedure for Claude Code and Codex where every rule that matters is a script that exits 2, not a paragraph a model is asked to honour."
tags: ai, productivity, architecture, webdev
cover_image:
canonical_url:
---

Agentic coding is fast at producing code and bad at producing *the right* code.

In my experience the usual failure isn't a bug. It's a feature nobody specified, built from a design nobody approved, against a mock-up that changed after the work started. The code is fine. It just answers the wrong question.

I built [**sdlc-playbooks**](https://github.com/srnux/sdlc-playbooks) to catch those failures mechanically. It's a file-based delivery procedure (design system → requirements → prototype → human approval → product) that runs in Claude Code and in Codex from one source. This post covers how it works and why it's shaped the way it is.

One idea runs through the whole thing:

> **A rule written only as prose for a model to honour will eventually be skipped.**

So every rule that can be checked is a script that exits non-zero.

---

## The flow

```
  design system                 PO requirements (text)
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

There are seven phases, each with one playbook and one gate. Everything the flow knows is stored in a file:

| Artifact | Written by |
|---|---|
| `design-system/tokens.css`, `components.md` | phase 0, then locked |
| `work/items/REQ-###.md` | phase 1 |
| `prototype/<slug>.html` | phase 2 |
| `prototype/.approved/<slug>-v<N>.html` | phase 3, **immutable** |
| `work/items/ST-###.md` | phase 3, one story per screen |
| `work/plans/ST-###.md` | phase 4 |

Nothing lives in a database or in model memory, and no state is hidden. **If you delete every playbook, a human can still finish the work from the artifacts.** That's the intended direction of dependency.

---

## Why there are no "roles"

Most agent setups I've seen start with personas: *"You are a senior reviewer."* *"You are the product owner."* This repo has none, and the project's `CLAUDE.md` says adding one would be a regression.

A role definition describes an identity and hopes the right behaviour follows. A playbook describes a procedure: named inputs, a precondition that fails closed, a fixed sequence, and a done-condition. Each playbook starts with a contract:

```markdown
## Contract

|                |                                                              |
|----------------|--------------------------------------------------------------|
| **Phase**      | 5 — the only phase that writes product code                  |
| **Gate**       | `node .claude/tools/gate.mjs implement ST-###`               |
| **Inputs**     | the plan, the pinned snapshot, the catalog, the component lib |
| **Produces**   | product code, one test per AC                                |
| **Done when**  | every `verify.commands` entry is green, story is `in-review` |
| **Never**      | copy the prototype into the product; build against the live prototype |
```

…and ends with a section that says which phase owns each neighbouring decision:

```markdown
## Not this playbook

- **Deciding whether it's done** → `review-change`. Self-approval removes the
  only independent check in the flow.
- **Absorbing a prototype change** → back to `capture-requirements` as new scope.
- **Adding a token or component** → `lock-design-system`.
```

Those two blocks cover everything a role file used to carry, including who owns what. The repo was ported from an earlier version that did have five agent files. When I audited them, nearly every line was already in a matching skill. The only content that existed nowhere else was five sentences of ownership routing, and those were really statements about phases, not people. Keeping two copies of a rule means you have one rule and one future contradiction.

A side effect: playbooks are named after what they produce (`freeze-approval`), not who would do the work ("product owner"). You can read the directory listing and know what the flow does.

---

## Layer 1: gates decide whether a phase may start

Every phase begins with:

```bash
node .claude/tools/gate.mjs <phase> [id] [flags]
```

The gate checks the phase's preconditions against the repo. If one fails, it **exits 2 with a named reason and a fix**. In Claude Code, each slash command expands the gate inline with the `` !`…` `` syntax, so the gate runs *when the command expands, before the model reads the rest of the prompt*:

```markdown
---
description: Record a human's approval — freeze the prototype and cut the stories.
---

Gate — this runs before you read any further; a non-zero exit aborts the command:

!`node .claude/tools/gate.mjs approve $0 $1 2>&1`
```

A blocked gate aborts the command outright. The model doesn't get to write a paragraph about why it probably shouldn't continue and then carry on anyway.

| Phase | Refuses when |
|---|---|
| `design-system` | already locked and `--refresh` wasn't passed |
| `requirements` | no input |
| `prototype` | design system unlocked · wrong status · **no acceptance criteria** |
| `approve` | not `prototyped` · no `data-screen` markup · **no `--human-approved`** |
| `plan` | parent not approved · no version pin · **snapshot missing** |
| `implement` | **no plan** · story not `in-progress` · snapshot missing |
| `review` | story not `in-review` · **already at `loops.reviewRounds`** |

### The gate that is a person

The old version of `/approve` said: *"This command represents a human decision. Do not run it on your own judgment."*

That's exactly the kind of rule that gets skipped on the twentieth run at 6pm. Now it looks like this:

```js
// The one gate that is a person. Prose asking a model not to approve on its own
// judgment is exactly the rule that gets skipped; this one cannot be.
if (!args['human-approved']) {
  throw new Blocked(
    `approval is a human decision and has not been recorded for ${id}`,
    `ask the person to open ${req.prototype} and say yes, then run: /approve ${id} --human-approved`
  );
}
```

Running it against the example requirement in the repo:

```text
$ node .claude/tools/gate.mjs approve REQ-003
BLOCKED — approve: approval is a human decision and has not been recorded for REQ-003

  ask the person to open prototype/seaside-zadar-landing.html and say yes,
  then run: /approve REQ-003 --human-approved

Nothing was changed. Report this reason verbatim and stop; do not work around it.
$ echo $?
2
```

Could a model just pass the flag? Technically, yes. But the flag is now a deliberate, visible act in the transcript, with a stated meaning ("a person said yes in this conversation"), and the command text tells the model not to re-run with the flag just to get past a refusal. There's no longer a path from "the prototype looks finished" to "stories are cut" that goes around a human without anyone noticing.

### The review loop is bounded

Review can approve a story or send it back. Without a limit, an agent and its reviewer can go back and forth forever. The gate counts `round N:` entries in the story's notes and refuses the round past the cap:

```js
const cap = cfg.loops?.reviewRounds ?? 2;
const round = reviewRound(story.body) + 1;
if (round > cap) {
  throw new Blocked(
    `${id} has already been bounced ${cap} times (loops.reviewRounds)`,
    `set ${id} --status blocked — then hand the human the actual disagreement. ` +
    `The third round is almost never the one that resolves it.`
  );
}
```

### Gates also hand over the facts

On success the gate prints the resolved context as JSON: paths, the pinned prototype version, the acceptance-criterion ids, the review round. Facts fixed at gate time are facts the model doesn't have to rediscover by guessing halfway through.

```json
{
  "ok": true,
  "gate": "prototype",
  "context": {
    "id": "REQ-003",
    "status": "prototyped",
    "acs": ["AC-1", "AC-2", "…", "AC-17"],
    "mode": "refine",
    "prototype": "prototype/seaside-zadar-landing.html",
    "tokens": "design-system/tokens.css"
  }
}
```

---

## Layer 2: hooks decide whether an edit may land

Gates only run when you go through a command. Hooks catch everything else. Two shell scripts are wired as `PreToolUse` hooks on `Edit|Write`:

**`require-plan.sh` blocks.** No product-code edit lands without `work/plans/<STORY-ID>.md`. It works out the story from the branch name (`story/ST-007-…`). If the branch name doesn't identify a story, it asks the tracker which story is `in-progress`, because working on `main` is exactly the case the gate exists for.

```text
BLOCKED — no plan for ST-007.

  expected: work/plans/ST-007.md
  editing:  src/contacts/list/ArchiveButton.tsx

Run the plan-story skill first. The plan is a gate, not paperwork.
```

The reasoning: a plan written after the code is just a summary, and a summary never catches the thing you'd have noticed before starting.

**`check-hardcoded-colors.sh` warns.** It flags a raw `#hex`, `rgb()` or `hsl()` at the moment it's written, while fixing it is still a one-line change. The blocking version of this rule runs at review time.

Both scripts read the edited path from either `file_path` (Claude Code) or `path` (Codex), so one copy serves both tools.

---

## Layer 3: checks decide whether something is finished

**`check-tokens.mjs`** fails on any raw design value outside `tokens.css`. It's scoped to properties that carry a design decision (`font-size`, `border-radius`, `box-shadow`, padding, margin, gap), plus any raw colour anywhere. `width: 100%` and `z-index` are layout, and layout is yours to write.

```text
$ node .claude/tools/check-tokens.mjs
ok — 139 tokens defined, 134 used, no raw design values in 1 files
```

The rule behind it: **a design value can only be created in phase 0.** If a screen needs a colour the tokens don't have, that's a design-system change, not a literal typed into a component.

**`check-coverage.mjs`** walks the traceability chain:

```
requirement → AC → screen (in the approved snapshot) → story → plan → code → done
```

It names every break: `screen-without-story`, `story-without-plan`, `stale-pin`, `done-story-screen-vanished`, and about a dozen more. Exit 2 on any gap.

What makes this possible is two attributes on every screen root in the prototype:

```html
<section data-screen="SCR-booking-enquiry" data-req="REQ-003">
```

This markup matters. Without it, a screen doesn't exist as far as the flow is concerned, and the approve gate refuses a prototype that has none.

**Completeness is a query, not a judgment call.** That's the whole reason for the ids.

---

## The prototype, and the pin

Phase 2 produces one self-contained HTML file per requirement: React 18 UMD plus `@babel/standalone` from a CDN, tokens inlined, catalog components only, hash routing, realistic mock data. It needs no build step and opens with a double-click. **Every state is drawn**: empty, loading, populated, error, *and success*. "The list refreshes" doesn't count as a success state, and a prototype that only shows the happy populated path is how silent failures ship.

When a person approves it, `approve.mjs` copies it to `prototype/.approved/<slug>-v<N>.html` and refuses to overwrite an existing snapshot. A baseline that can change isn't a baseline. One story is cut per screen, and each one records `prototypeVersion: v<N>`.

**Stories are built against the pinned snapshot, never against the live prototype.** Prototypes keep changing after approval, because someone always has "one more tweak". If the live file has moved on, `gate.mjs implement` says so:

```json
{
  "liveHasMovedPastThePin": true,
  "note": "prototype/bulk-archive.html has moved past v2. You build v2. The difference is new scope for the PO — record it under Divergence, do not absorb it."
}
```

Building the latest prototype when the story pinned v2 is scope drift, and you won't see it in the diff unless someone says so. This is how a two-week feature quietly becomes a four-week one without anyone deciding it should.

---

## One source, two harnesses

Procedures live in exactly one place: `playbooks/<name>/SKILL.md`, written without reference to any particular tool. `sync.mjs` copies that tree into `.claude/skills/` for Claude Code and `.agents/skills/` for Codex:

```bash
node .claude/tools/sync.mjs          # write the projections
node .claude/tools/sync.mjs --check  # exit 2 if one is stale (for CI)
```

Each generated directory has a `.generated` marker holding the source hash, so a hand-edit to a projection is detected, not silently kept.

They're copies rather than symlinks on purpose: symlinks need developer mode or an elevated shell on Windows, and an install step that fails for half the team isn't an install step.

In Claude Code you drive the flow with slash commands (`/requirements`, `/prototype`, `/approve`, `/build`, `/status`). In Codex you call playbooks by name (`$build-prototype`). Each playbook runs its own gate as step 0, so the procedure is identical even without the command layer.

---

## The tracker is an adapter

No playbook talks to a tracker directly. Everything goes through `node .claude/tools/tracker.mjs <verb>`, which prints JSON and dispatches to a provider:

```bash
node .claude/tools/tracker.mjs create --type requirement --title "Bulk archive contacts"
node .claude/tools/tracker.mjs set ST-007 --status in-review
node .claude/tools/tracker.mjs next --type story
```

Today the provider is `files`, with markdown and YAML front matter in `work/items/`. A Jira provider ships as a skeleton with the field and status mapping already written and only the transport stubbed. Switching is a one-line config change, and nothing above the adapter changes.

Two small rules prevent a surprising number of problems: **never hand-edit a work item, and never pick an id yourself.** `create` allocates the next free id, so two sessions can't both claim `REQ-004`.

Even with Jira as the tracker, the artifacts stay in the repo. The tracker holds status and conversation; the repo holds the work.

---

## Every tool runs without a model

None of the enforcement needs an LLM. You can check the state of the repo from a plain shell:

```bash
node .claude/tools/status.mjs --gaps
node .claude/tools/check-coverage.mjs
node .claude/tools/check-tokens.mjs
node .claude/tools/gate.mjs plan ST-001
```

```text
$ node .claude/tools/status.mjs

NEEDS A HUMAN
  REQ-003   prototype waiting for approval  →  open it, then /approve REQ-003

NEXT
  /prototype REQ-001   Web application scaffold: pnpm monorepo, Next.js web, NestJS API
```

Node 18+, zero dependencies, plain ESM. Bash for the two hooks (Git Bash works fine on Windows).

---

## What's deliberately missing

There's no CI/deploy stage, no QA phase, no parallel fan-out, no worktree isolation, and no board integration. Those are all real and sometimes necessary. They're also where a procedure stops being easy to read.

The rule for adding one: do it when a specific failure demands it, and write down which failure.

> **A gate with no incident behind it is ceremony.**

---

## Try it

```bash
git clone https://github.com/srnux/sdlc-playbooks
cd sdlc-playbooks
$EDITOR .claude/sdlc.config.json            # product name, verify commands
$EDITOR .claude/rules/coding-standards.md   # rewrite the stack-specific half
node .claude/tools/sync.mjs

/design-system
/requirements 'PO text here…'
/prototype REQ-001
#   … a human opens it and says yes …
/approve REQ-001 --human-approved
/build
```

The repo ships with a worked example: a locked design system for a seaside holiday-rental landing page, a real prototype with nine marked screens, and three requirements.

My one piece of advice: **run one real requirement end to end before you load up the backlog.** If the procedure survives one slice, it will scale. If it doesn't, you'd rather find out on one.

If you've built something similar, or tried to hold an agent to a process with prompts alone and watched it slip, I'd like to hear what broke first.
