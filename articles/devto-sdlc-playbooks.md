---
title: "Stop Asking Your Coding Agent to Behave: Gates, Not Prompts"
published: false
description: "A file-based delivery procedure for Claude Code and Codex that turns workflow preconditions into executable checks, with explicit limits."
tags: ai, productivity, architecture, webdev
cover_image:
canonical_url:
---

Agentic coding is fast at producing code and bad at producing *the right* code.

In my experience the usual failure isn't a bug. It's a feature nobody specified, built from a design nobody approved, against a mock-up that changed after the work started. The code is fine. It just answers the wrong question.

I built [**sdlc-playbooks**](https://github.com/srnux/sdlc-playbooks) to catch those failures mechanically. It's a file-based delivery procedure (design system → requirements → prototype → human approval → product) that runs in Claude Code and in Codex from one source. This post covers how it works and why it's shaped the way it is.

**The repo defines playbooks instead of specialised agents.** Each playbook describes a phase: what it needs, which checks must pass, what work happens, and what artifact it produces. The coding agent executes that procedure. Moving from requirements to implementation means changing the playbook, without needing a separate "product owner" or "engineer" agent definition.

One idea runs through the whole thing:

> **A rule written only as prose for a model to honour will eventually be skipped.**

So I move checkable preconditions into scripts that exit non-zero. The scripts catch missing artifacts and inconsistent state; people still decide whether the requirements and the result are right.

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
             single-file React page
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
| `prototype/.approved/<slug>-v<N>.html` | phase 3, versioned baseline |
| `work/items/ST-###.md` | phase 3, one story per screen |
| `work/plans/ST-###.md` | phase 4 |

With the default file tracker, the workflow state lives in the repo. **If you delete every playbook, a human can still finish the work from the artifacts.** That's the intended direction of dependency.

---

## Why playbooks instead of agents

Most agent setups I've seen start with personas: *"You are a senior reviewer."* That describes an identity, but leaves the working procedure to be specified elsewhere. Here, the playbook is the unit of organisation. It names the inputs, gate, outputs, and done-condition for a phase. For example:

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

Each playbook also routes neighbouring decisions: new tokens go to `lock-design-system`, changed scope goes to `capture-requirements`, and finished work goes to `review-change`.

The earlier version had separate agent definitions. Most of their instructions already existed in the matching playbooks; the remaining ownership rules belonged at phase boundaries. Removing those files left one place to maintain each procedure. Keeping two copies of a rule means you have one rule and one future contradiction.

Handoffs happen through saved artifacts. Requirements supply acceptance criteria to prototyping; an approved snapshot supplies the baseline for planning and implementation; the plan and resulting code supply the inputs to review. The next phase can run in a fresh session because its inputs are in the repo. It doesn't need the previous agent's persona or conversation history to reconstruct what was agreed.

---

## Layer 1: gates decide whether a phase may start

Every phase begins with:

```bash
node .claude/tools/gate.mjs <phase> [id] [flags]
```

The gate checks the phase's preconditions against the repo. If one fails, it **exits 2 with a named reason and a fix**. The Claude Code command files invoke it through inline shell expansion:

```markdown
---
description: Record a human's approval — freeze the prototype and cut the stories.
---

Gate — this runs before you read any further; a non-zero exit aborts the command:

!`node .claude/tools/gate.mjs approve $0 $1 2>&1`
```

That puts a concrete check at the command entry point. The playbook instructs the agent to stop on failure. Direct script calls and other editing paths still need their own controls.

| Phase | Refuses when |
|---|---|
| `design-system` | already locked and `--refresh` wasn't passed |
| `requirements` | no input |
| `prototype` | design system unlocked · wrong status · **no acceptance criteria** |
| `approve` | not `prototyped` · no `data-screen` markup · **no `--human-approved`** |
| `plan` | parent not approved · no version pin · **snapshot missing** |
| `implement` | **no plan** · story not `in-progress` · snapshot missing |
| `review` | story not `in-review` · **already at `loops.reviewRounds`** |

### Making the approval assertion explicit

The old version of `/approve` said: *"This command represents a human decision. Do not run it on your own judgment."*

The gate now requires an explicit flag:

```js
if (!args['human-approved']) {
  throw new Blocked(
    `approval is a human decision and has not been recorded for ${id}`,
    `ask the person to open ${req.prototype} and say yes, then run: /approve ${id} --human-approved`
  );
}
```

The bundled seaside example illustrates the check: even with a prototype ready to inspect, an approval gate call without the flag is refused:

```text
$ node .claude/tools/gate.mjs approve REQ-003
BLOCKED — approve: approval is a human decision and has not been recorded for REQ-003

  ask the person to open prototype/seaside-zadar-landing.html and say yes,
  then run: /approve REQ-003 --human-approved

Nothing was changed. Report this reason verbatim and stop; do not work around it.
$ echo $?
2
```

The flag means "a person said yes in this conversation." It makes that assertion explicit and reviewable, but does not verify it independently: the agent can supply the flag, and the snapshot utility can be called directly. Respecting human approval still depends on following the procedure.

### The review loop is bounded

Review can approve a story or send it back. The gate reads the highest `round N:` recorded in the story's notes and refuses a round beyond `loops.reviewRounds` (two by default). That bound depends on the reviewer recording each round. When the cap is reached, the procedure calls for handing the disagreement to a person.

On success, gates print resolved context as JSON: paths, the pinned prototype version, acceptance-criterion ids, and the review round where relevant. The agent gets concrete inputs for its next step.

---

## Layer 2: hooks decide whether an edit may land

Hooks add checks at supported edit entry points. In Claude Code, two shell scripts are wired as `PreToolUse` hooks on `Edit|Write`:

**`require-plan.sh` blocks a guarded edit when it identifies a story with no plan.** It finds the story from the branch name (`story/ST-007-…`) or, failing that, from exactly one `in-progress` story in the tracker. For example:

```text
BLOCKED — no plan for ST-007.

  expected: work/plans/ST-007.md
  editing:  src/contacts/list/ArchiveButton.tsx

Run the plan-story skill first. The plan is a gate, not paperwork.
```

The reasoning: a plan written after the code is just a summary, and a summary never catches the thing you'd have noticed before starting.

**`check-hardcoded-colors.sh` warns.** It flags a raw `#hex`, `rgb()` or `hsl()` at the moment it's written, while fixing it is still a one-line change. The blocking version of this rule runs at review time.

The hooks have limits: shell writes fall outside Claude's `Edit|Write` matcher, some file types are excluded, and the plan hook allows an edit when no story can be identified. Both scripts accept `file_path` or `path`; actual coverage also depends on the harness invoking them with a supported payload.

---

## Layer 3: checks expose gaps before handover

**`check-tokens.mjs`** scans prototypes and configured product directories for raw hex/RGB/HSL colours and literal values in selected properties: font size, radius, shadow, padding, margin, and gap. It also checks for undefined token references. `width: 100%` and `z-index` are outside those design-property checks.

```text
$ node .claude/tools/check-tokens.mjs
ok — 139 tokens defined, 134 used, no raw design values in 1 files
```

The procedure's rule is that **a design value can only be created in phase 0**. The scanner catches common violations; it is not a complete CSS validator. It permits token-definition blocks for inlined prototypes without verifying that their values match the locked file.

**`check-coverage.mjs`** checks structural links:

```
requirement → approved snapshot → screen → story → plan file
```

It reports gaps such as `screen-without-story`, `story-without-plan`, `stale-pin`, and `done-story-screen-vanished`, exiting 2 when it finds one. It checks that acceptance criteria exist, but does not map each AC to a screen or inspect implementation and test coverage.

The prototype convention puts two attributes on every screen root:

```html
<section data-screen="SCR-booking-enquiry" data-req="REQ-003">
```

The checker discovers screens through `data-screen`; the approve gate refuses a prototype with no screen markers. `data-req` records the intended requirement association.

**Structural gaps become queryable.** Whether the product satisfies the requirements still needs tests and review.

---

## The prototype, and the pin

Phase 2 calls for one HTML file per requirement: React 18 UMD plus `@babel/standalone` from a CDN, tokens inlined, catalog components, hash routing, and realistic mock data. It needs no build step and opens with a double-click, but loading its CDN dependencies requires network access. The playbook requires **every state to be drawn**: empty, loading, populated, error, *and success*. "The list refreshes" doesn't show a person what success looks like.

After human approval, the procedure uses `approve.mjs` to create `prototype/.approved/<slug>-v<N>.html`, then cuts one story per screen with a `prototypeVersion: v<N>` pin. These are versioned snapshots treated as immutable by the procedure. The utility checks for an existing destination before copying; the resulting files remain editable on disk.

**The implementation playbook directs the agent to build against the pinned snapshot.** If someone makes "one more tweak" to the live file, `gate.mjs implement` reports the difference:

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

Copies avoid the extra permissions or developer-mode setup that symlinks can require on Windows.

Claude Code has slash commands such as `/requirements`, `/prototype`, and `/build`. The projected skills expose the same playbooks, including `build-prototype`, with a gate invocation as step 0. The shared procedure does not make the harnesses' enforcement identical.

---

## The tracker is an adapter

No playbook talks to a tracker directly. Everything goes through `node .claude/tools/tracker.mjs <verb>`, which prints JSON and dispatches to a provider:

```bash
node .claude/tools/tracker.mjs create --type requirement --title "Bulk archive contacts"
node .claude/tools/tracker.mjs set ST-007 --status in-review
node .claude/tools/tracker.mjs next --type story
```

The default provider is `files`, storing Markdown with YAML front matter in `work/items/`. Jira support is unfinished: mapping and REST code exist, but the gate's asynchronous provider handling and the coverage checker's direct file reads still need integration work.

Two procedural rules keep updates consistent: **never hand-edit a work item, and never pick an id yourself.** `create` allocates IDs centrally so agents don't choose them manually. Allocation is not protected against concurrent writers.

The adapter is intended to let status and conversation move to another tracker while design, prototype, and plan artifacts stay in the repo.

---

## Every tool runs without a model

None of the enforcement needs an LLM. You can check the state of the repo from a plain shell:

```bash
node .claude/tools/status.mjs --gaps
node .claude/tools/check-coverage.mjs
node .claude/tools/check-tokens.mjs
node .claude/tools/gate.mjs plan ST-001
```

The local tools use Node 18+ and plain ESM, with no npm dependencies. The hooks require Bash; on Windows, that means a Bash installation such as Git Bash.

---

## What's deliberately missing

There's no CI/deploy stage, no QA phase, no parallel fan-out, no worktree isolation, and no board integration. Those are all real and sometimes necessary. They're also where a procedure stops being easy to read.

The rule for adding one: do it when a specific failure demands it, and write down which failure.

> **A gate with no incident behind it is ceremony.**

---

## Try it

Clone the repo and generate the skill projections in your terminal:

```bash
git clone https://github.com/srnux/sdlc-playbooks
cd sdlc-playbooks
node .claude/tools/sync.mjs
```

Edit `.claude/sdlc.config.json` for your product and verification commands, and rewrite the stack-specific half of `.claude/rules/coding-standards.md`.

The repo includes a locked seaside-rental design system, a prototype with nine marked screens, and three requirements. You can inspect that example first. For your own design, update the configured design source and run `/design-system --refresh` in Claude Code. A bare `/design-system` refuses because the bundled system is already locked.

Then, in Claude Code:

```text
/requirements 'PO text here…'
```

Use the requirement ID returned by that command in `/prototype <returned-id>`. Open the result and review its screens and states. Only after you approve it, run `/approve <returned-id> --human-approved`, then `/build`.

My one piece of advice: **run one real requirement end to end before you load up the backlog.** That gives you a concrete way to find gaps in the procedure while the scope is still small.

If you've built something similar, or tried to hold an agent to a process with prompts alone and watched it slip, I'd like to hear what broke first.
