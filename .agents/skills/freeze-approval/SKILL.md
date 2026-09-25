---
name: freeze-approval
description: >
  Record a human's approval of a prototype — freeze it as an immutable versioned
  snapshot, pin the version onto the requirement, and cut one story per screen. Phase 3.
  Run at /approve, and only after a person has looked at the prototype and said yes.
  The gate refuses without --human-approved.
---

# Freeze an approval

## Contract

| | |
|---|---|
| **Phase** | 3 — the only phase whose decision is made by a person |
| **Gate** | `node .claude/tools/gate.mjs approve REQ-### --human-approved` |
| **Inputs** | the prototype file, its `data-screen` markup, the requirement's ACs |
| **Produces** | `prototype/.approved/<slug>-v<N>.html` (immutable), the version pin, one story per screen |
| **Done when** | `check-coverage.mjs` exits 0 — every AC on a screen, every screen on one story |
| **Never** | run without a person having said yes; edit a snapshot; widen a story to absorb a gap |

**This playbook does not approve anything. It records that a person did.**

The decision is theirs. Everything here is bookkeeping that turns that decision into work
which can be checked.

## Step 0 — the gate

```bash
node .claude/tools/gate.mjs approve REQ-004 --human-approved
```

Exit 2 means stop and report the reason verbatim.

`--human-approved` is not a formality and is not yours to supply on inference. Pass it only
when you can point at the person, in this conversation, saying the prototype is good. A
finished prototype is not an approved one; silence is not approval; "looks right to me" from
you is not approval.

If you can't point at it, the correct action is to ask them to open the prototype and
answer — not to re-run the gate with the flag.

The gate also refuses a prototype with no `data-screen` markup, because there would be
nothing to cut stories from.

It prints the next version, the snapshot path it will occupy, and the screens it found.

## Step 1 — freeze

```bash
node .claude/tools/approve.mjs REQ-004
```

Copies `prototype/<slug>.html` → `prototype/.approved/<slug>-v<N>.html` and refuses to
overwrite an existing snapshot.

That file is **immutable**. Never edit it, never regenerate it, never "just fix the typo in
it". It is the reference every story is measured against, and the moment it can change,
every story loses its baseline.

## Step 2 — pin and record the screens

```bash
node .claude/tools/tracker.mjs set REQ-004 --status approved --set approvedVersion=v2
node .claude/tools/tracker.mjs set REQ-004 --set screens="SCR-contact-list SCR-archive-confirm"
```

Take the screen list from the gate output — it read them out of the file that was actually
frozen.

## Step 3 — cut one story per screen

```bash
node .claude/tools/tracker.mjs create --type story \
  --title "Contact list with bulk archive" \
  --parent REQ-004 \
  --set screen=SCR-contact-list --set prototypeVersion=v2 \
  --body-file /tmp/story.md
```

The body names the AC ids this story satisfies **and nothing else**. The acceptance
criteria live on the requirement and are not restated, so they cannot drift apart.

A story that spans two screens is two stories. A screen that needs two stories usually
means the screen is doing two jobs — say so rather than splitting silently.

`tracker.mjs` refuses to cut a story from a requirement that isn't approved
(`gates.prototypeApprovedBeforeStories`). Know why: a story cut from an unapproved screen
is work that may be thrown away.

## Step 4 — prove the chain

```bash
node .claude/tools/check-coverage.mjs
```

Every AC on at least one screen. Every screen on exactly one story.

Report any gap **as a gap**. An AC that didn't make it onto a screen is the headline, not
a footnote: it means the prototype the human approved doesn't do something they asked for.
Do not quietly widen a story until the gap goes away.

## Step 5 — report

The snapshot path and version, the stories created, and anything coverage flagged.

## After approval

A design change later is a new `/prototype` pass and a re-approval, producing `v3`. Existing
stories keep their pin at `v2` and are built as pinned. The difference between `v2` and `v3`
is new work for the PO to scope — never something a later phase absorbs.

## Not this playbook

- **Deciding whether the prototype is good** → a person. This phase only records it.
- **Changing the prototype** → `build-prototype`, then come back here for `v<N+1>`.
- **Working out how to build a story** → `plan-story`.
