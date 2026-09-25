# Prototype rules

A prototype here is **a self-contained React page that the human clicks through and
approves**. It is the design decision made visible. It is not the product, and it is not
a picture of the product.

## What it is

- **One file.** `prototype/<slug>.html`, no build step, no node_modules, opens with a
  double-click. React 18 UMD + `@babel/standalone` from CDN, one `<script type="text/babel">`.
- **Built only from the design system.** Every colour, radius, spacing and font comes from
  a `var(--ds-*)` token defined in `design-system/tokens.css`, pasted inline at the top of
  the file. Every visual element is a component from `design-system/components.md` or a
  composition of them. `check-tokens.mjs` enforces this and exits 2 on a raw hex.
- **Realistic, not real.** Mock data shaped like the actual domain — plausible names,
  plausible volumes, at least one long value and one empty value per list. Enough rows
  that the layout has to cope.
- **Every state drawn.** For each screen: empty, loading, populated, error, and *success* —
  the state after the user's action worked. A prototype that shows only the happy populated
  state is how a silent success ships.
- **Navigable.** Hash routing (`#/contacts`, `#/contacts/archive`). Every screen reachable
  by clicking, not only by editing the URL.
- **Marked up for the chain.** Each screen's root element carries
  `data-screen="SCR-<name>"` and `data-req="REQ-###"`. This is what `check-coverage.mjs`
  reads; without it a screen does not exist as far as the flow is concerned.

## What it is not

- Not wired to a backend. No fetch, no auth, no real endpoints.
- Not a place to invent brand. If the design it needs isn't in the token file, that is a
  design-system change — go back to `lock-design-system`, don't add a colour here.
- Not a place to invent requirements. A control that no acceptance criterion asks for is
  scope the PO never approved. Either it traces to an AC, or you raise it and let the PO
  decide before drawing it.
- Not production code, and **never** copied into the product. `implement-story` reads it and
  rebuilds against the real component library. Copying a prototype into `src/` imports its
  mock data and its shortcuts.

## Approval and pinning

`/approve` freezes the current file to `prototype/.approved/<slug>-v<N>.html` and writes
`approvedVersion: v<N>` onto the requirement. Every story cut from it records that version.

**Stories build against the pinned snapshot, not the live file.** If the prototype has
moved on since a story was cut, that difference is a new requirement or a re-approval —
not something a later phase silently absorbs. Reproducing head where the story pinned v2 is
scope drift, and it is invisible in review unless someone says so.

## Refining

`/prototype REQ-###` is idempotent. If the file exists it continues and refines it from
the feedback you give; if not, it scaffolds from the recipe. Feedback lives in the item's
comments (`tracker.mjs comment`) so the next session can see what was already asked for.
