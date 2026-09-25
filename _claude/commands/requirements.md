---
description: Capture PO requirements from free text into traceable requirement items with testable acceptance criteria.
argument-hint: "'<the PO's text>'   or   --file <path>   or   REQ-### (to refine an existing one)"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(node .claude/tools/:*)
---

Gate — this runs before you read any further; a non-zero exit aborts the command:

!`node .claude/tools/gate.mjs requirements $ARGUMENTS 2>&1`

Run the **capture-requirements** playbook on `$ARGUMENTS` with the context above.

Report back: the ids created, their titles, and — leading, if there are any — **every
ambiguity you found and did not resolve**. A question surfaced now costs a sentence; the
same question discovered during implementation costs a rebuild.

If the gate printed `BLOCKED`, stop and report its reason verbatim.
