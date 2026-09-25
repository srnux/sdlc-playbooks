---
description: Generate or refine the self-contained React prototype for a requirement.
argument-hint: "REQ-###  ['<feedback>']   — no feedback scaffolds or continues; with feedback, refines"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(node .claude/tools/:*), Bash(npx --yes serve:*)
---

Gate — this runs before you read any further; a non-zero exit aborts the command:

!`node .claude/tools/gate.mjs prototype $0 2>&1`

Run the **build-prototype** playbook for `$0` with the context above, obeying
`.claude/rules/prototype-rules.md`.

The gate resolved the AC ids, the prototype path, and whether this is a **scaffold** or a
**refine**. If it is a refine, apply `$1` if given and change only what was asked plus what
that change necessarily implies — never start over.

Record any feedback you were given on the item
(`node .claude/tools/tracker.mjs comment $0 "…"`) so the next session doesn't re-litigate
a settled decision.

When you finish: serve it, give the human the URL, and report the screens, the AC each
covers, and what you were unsure about. Then **stop**. Approving is not yours to do and
`/approve` refuses without a person.

If the gate printed `BLOCKED`, stop and report its reason verbatim.
