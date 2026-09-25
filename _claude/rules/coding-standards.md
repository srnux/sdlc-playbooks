# Coding standards

Two halves. The first is universal — keep it whatever your stack. The second is
stack-specific — **rewrite it for your target stack** when you retarget this procedure.

---

## Universal — keep these

**Token discipline.** No hardcoded colour, radius, shadow, font-size or spacing value in
product code or prototypes. Everything reads a `var(--ds-*)` token from
`design-system/tokens.css`. A value the tokens don't have is a design-system change, not
a literal. `hooks/check-hardcoded-colors.sh` warns; `tools/check-tokens.mjs` fails.

*Layout is not design, and is not in scope.* `width: 100%`, `grid-column: 1 / 7`,
`z-index`, `top: 0` and the breakpoint in a media query are yours to write. The gate scopes
itself to the properties that carry a design decision — `font-size`, `border-radius`,
`box-shadow`, `padding*`, `margin*`, `gap*` — plus any raw colour anywhere.

**Build from the catalog.** Compose `design-system/components.md` entries. A genuinely new
component is added to the catalog once, with its states, then reused — not invented twice
in two features.

**Thin components.** A component renders and delegates. Fetching, mapping, validation and
business rules live in hooks/services next to the feature, not in JSX.

**Feature folders, by sub-domain.** `contacts/list/table/`, not a flat `contacts/` that
accumulates 80 siblings. Decide the folder in the plan, before the first file.

**Every state, always.** Empty, loading, error, populated, **and success**. "The list
refreshes" is not a success state — the user has to be able to tell that their action
worked. A screen that can render blank or render silently is not done.

**Stable test hooks.** Every interactive element gets a `data-testid`. Selectors are never
derived from copy, class names or DOM position.

**No invented copy or endpoints.** Strings and API contracts come from the requirement or
the existing product. If the requirement doesn't say, ask the PO — don't write it and hope.

**Green before done.** The commands in `sdlc.config.json → verify.commands` pass before a
story leaves `in-progress`. A red build is not a review comment, it's an unfinished story.

**Plan before code.** `work/plans/<ID>.md` exists before the first implementation edit.
`gate.mjs implement` refuses without it and `hooks/require-plan.sh` blocks the edit anyway.

---

## Stack-specific — REWRITE THIS SECTION for your project

> Placeholder, written for React + TypeScript. Replace wholesale if you're on Angular,
> Vue, Svelte, or anything else. The universal half above does not change.

- TypeScript strict. No `any` that isn't justified in a comment.
- Function components + hooks. No class components.
- Interfaces `I`-prefixed, types for unions; one exported component per file.
- Server data through a query layer (TanStack Query or equivalent) with explicit cache
  keys and explicit invalidation on write. Never `useState` + manual reload.
- Routing: file- or config-based, one route per screen id from the prototype.
- Tests: one test per acceptance criterion, named after the AC id.
- Styling: utility classes or CSS modules reading the tokens; no inline style objects
  carrying design values.
