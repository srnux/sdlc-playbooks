# The flow

Seven playbooks, seven gates, one chain a script can check.

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

Everything the flow knows is a file. **Delete every playbook and a human can still finish
the work from the artifacts; delete the artifacts and the playbooks know nothing.** That is
the intended direction of dependency, and it is why there are no role definitions here.

---

## Why playbooks and not roles

A role encodes identity and hopes behaviour follows. A playbook encodes procedure: named
inputs, a precondition that fails closed, a fixed sequence, and a done-condition.

Each playbook opens with a **contract** — phase, gate, inputs, produces, done-when, never —
and closes with **Not this playbook**, which points at the phase that owns the adjacent
decision. Those two blocks replace everything a role definition used to carry. What is left
over — "you are a senior engineer", "you are the last gate" — carried no information that
the procedure didn't already state, and having it in two places is how two places drift.

The practical consequence: a playbook is named for the artifact it produces, not for who
would produce it. `freeze-approval`, not "product owner". You can read the directory listing
and know what the flow does.

---

## The gate layer

Every phase begins by running `tools/gate.mjs <phase> [id]`. It validates the phase's
preconditions against the repo, and **exits 2 with a named reason** before any model
reasoning happens. A blocked gate aborts the command outright.

| Phase | Refuses when |
|---|---|
| `design-system` | already locked and `--refresh` wasn't passed |
| `requirements` | no input, or `--file` doesn't exist |
| `prototype` | design system unlocked · requirement in the wrong status · **no acceptance criteria** |
| `approve` | not `prototyped` · prototype file missing · no `data-screen` markup · **no `--human-approved`** |
| `plan` | parent not approved · no version pin · **pinned snapshot missing** · plan already exists |
| `implement` | **no plan** · story not `in-progress` · snapshot missing |
| `review` | story not `in-review` · no plan · **round count already at `loops.reviewRounds`** |

Two of those deserve naming, because they used to be prose asking an agent to behave:

**`approve` refuses without `--human-approved`.** The old procedure said *"This command
represents a human decision. Do not run it on your own judgment."* That is exactly the kind
of rule that gets skipped on the twentieth run at 6pm. Now there is no path from a finished
prototype to a cut story that doesn't pass through a person saying yes.

**`review` counts the rounds.** The bound on the bounce loop used to be a paragraph asking
the reviewer to notice. Now the third round cannot start.

The gate also **prints the resolved context** — paths, the pinned version, the AC ids, the
round number. That isn't decoration. Facts pinned at gate time are facts the playbook
doesn't rediscover by guessing halfway through.

---

## The stages

### 0 — `lock-design-system` · `/design-system`

A Claude Design canvas, an existing component library, or a brand becomes two committed
files: `design-system/tokens.css` and `design-system/components.md`.

Once locked, nothing downstream may invent a value. A missing colour is a design decision
routed back here, not a literal typed into a component. `check-tokens.mjs` enforces it.

Runs once per product, plus a deliberate `refresh` when the design genuinely changes — and
a refresh shows the diff first, because a changed token touches every screen ever built.

### 1 — `capture-requirements` · `/requirements`

The PO's text, as written. Out comes one `REQ-###` per coherent want, with acceptance
criteria that pass one test — *could a tester holding only this sentence say yes or no,
without asking you anything?*

This phase does not design. "The user can archive from the list without opening a record"
constrains the design; "a button in the top right" takes the decision.

The most valuable output is the list of questions it couldn't answer.

### 2 — `build-prototype` · `/prototype`

One self-contained React page per requirement. Tokens inlined, catalog components only,
mock data, hash routing, and **every state**: empty, loading, populated, error, success.

Every screen root carries `data-screen="SCR-…"` and `data-req="REQ-###"`. That markup is
not decoration — it's what makes the chain checkable, and the approve gate refuses a
prototype without it.

Idempotent: run it again with feedback and it refines; it doesn't restart.

### 3 — `freeze-approval` · `/approve`

**This stage is a person.** The playbook only records the decision.

The prototype is frozen to `prototype/.approved/<slug>-v<N>.html`. That file is immutable.
The version is pinned onto the requirement, and one story is cut per screen, each carrying
its `prototypeVersion`.

### 4–6 — `plan-story` → `implement-story` → `review-change` · `/build`

Plan (`work/plans/<ID>.md`, gated twice), implement against the pinned snapshot using the
real component library, get the verify commands green, then review against the ACs and the
snapshot. Approve to `done`, or bounce once with specifics; at `loops.reviewRounds` the gate
stops the loop and the story goes to the human.

### Any time — `/status`

What needs a human, what's in flight, what's next, and every gap in the chain.

---

## The three enforcement layers

**Gates** (`tools/gate.mjs`) decide whether a phase may start. Exit 2, before reasoning.

**Hooks** (`hooks/*.sh`) decide whether an edit may land. `require-plan.sh` blocks an
implementation edit with no plan; `check-hardcoded-colors.sh` warns on a raw colour as you
type.

**Checks** (`tools/check-*.mjs`) decide whether something is finished. `check-tokens.mjs`
fails on a raw colour; `check-coverage.mjs` walks the chain and names every break.

All three exist for the same reason: *a rule written only as prose for a model to honour
will eventually be skipped.* Every checkable rule in this repo is a script that exits
non-zero.

---

## The chain

    requirement → AC → screen (in the approved snapshot) → story → plan → code → done

`check-coverage.mjs` walks it and names every break: an AC with no screen, a screen with no
story, a story with no plan, a story pinned to a version the requirement has moved past, a
done story whose screen has since left the snapshot.

Completeness is a query, not a judgment call. That's the whole reason for the ids.

---

## The pin, and why it matters

A story records the prototype version it was cut from, and is built against that version.

If the prototype has moved on, the difference is **new scope for the PO** — not something a
later phase quietly absorbs. `gate.mjs implement` reports the drift explicitly
(`liveHasMovedPastThePin`) so it cannot be missed, and `check-coverage.mjs` reports a stale
pin as a gap so the decision gets made by a person.

---

## What is deliberately not here

No board integration, no CI/deploy stage, no QA phase, no parallel fan-out, no worktree
isolation, no spec extraction from a legacy app. Those are real and sometimes necessary —
they are also where a procedure stops being legible.

Add one when a specific failure demands it, and write down which failure. **A gate with no
incident behind it is ceremony.**

The tracker is the one seam already built for growth: swapping `files` for Jira changes
`sdlc.config.json` and nothing else (`.claude/rules/tracker.md`).
