---
description: Record a human's approval — freeze the prototype as an immutable snapshot and cut the stories from it.
argument-hint: "REQ-### --human-approved   — the flag is only yours to pass if a person actually said yes"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(node .claude/tools/:*)
---

Gate — this runs before you read any further; a non-zero exit aborts the command:

!`node .claude/tools/gate.mjs approve $0 $1 2>&1`

**This command records a human decision. It does not make one.**

The gate refuses without `--human-approved`. Do not re-run it with the flag to get past the
refusal. Pass the flag only when you can point at the person, in this conversation, saying
the prototype is good — a finished prototype is not an approved one, and silence is not
approval. If you can't point at it, ask them to open the prototype and answer.

Run the **freeze-approval** playbook for `$0` with the context above. The gate already
resolved the next version, the snapshot path it will occupy, and the screens it found in
the file.

If the gate printed `BLOCKED`, stop and report its reason and fix verbatim.
