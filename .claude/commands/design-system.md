---
description: Lock (or refresh) the design system — tokens + component catalog. The first input to everything else.
argument-hint: "[refresh]   — no args locks it for the first time; 'refresh' re-derives from the configured source"
allowed-tools: Read, Write, Edit, Glob, Grep, WebFetch, Bash(node .claude/tools/:*)
---

Gate — this runs before you read any further; a non-zero exit aborts the command:

!`node .claude/tools/gate.mjs design-system $0 2>&1`

Run the **lock-design-system** playbook with the context above.

The gate resolved the token path, the catalog path, the configured source and whether this
is a first lock or a refresh. Take them from its output rather than re-deriving them.

If the gate printed `BLOCKED`, stop. Report its reason and its fix verbatim, change
nothing, and do not work around it.
