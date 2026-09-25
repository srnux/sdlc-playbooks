# Component catalog — Vinjerac / Seaside Zadar

Derived strictly from `docs/seaside-zadar-v3.html` (the `designSystem.source.ref`).
Every component below is **drawn in that canvas** — except those marked
**⊕ DECIDED**, which are not, and say why.

> **2026-09-13 — refresh + extension.** Re-derived from the canvas: nothing moved, every
> value in it was already tokenised. Then extended for REQ-003, which turns the canvas's
> static booking bar into a real enquiry form. That needed form controls, failure and
> success treatments, a focus ring and a mobile navigation — none of which a marketing
> page has. Those additions are marked ⊕ and their tokens sit in the
> `DECIDED, NOT DERIVED` block of `tokens.css`.

Tokens come from [`tokens.css`](tokens.css). No component may carry a literal colour,
radius, shadow, font-size or spacing value.

> **There is no component library yet.** The source is a Claude Design canvas, not a
> shadcn/house library, so no `Import:` line can be honest. The engineer builds these
> for real the first time a story needs them, under the feature folder, and records
> the real import path back here. Until then, the canvas is the reference.

## The brand in one paragraph

Photographs are the content; everything else gets out of their way. Square corners
everywhere, near-zero gutters between images, generous vertical air around text. Serif
for anything that *names* a thing, sans for anything that *instructs*. One navy that
means "press this", one gold that is purely decorative, and a lot of white.

---

## Focus and keyboard ⊕

Not in the canvas. It applies to **every** interactive element in this catalog, so it is
written once here rather than repeated in each entry.

- **The ring:** `--ds-focus-ring-width` solid, offset by `--ds-focus-ring-offset`, square
  (`--ds-radius-none`) except on the lightbox arrows, which take `--ds-radius-full` like
  the control they sit on.
- **Its colour depends on what is behind it**, and getting this wrong makes it invisible:
  `--ds-color-focus` on light surfaces, `--ds-color-focus-on-image` over photography and
  over the navy panel.
- **`:focus-visible`, not `:focus`** — a pointer click on a button must not leave a ring
  behind it.
- **Never remove the outline without replacing it.** `outline: none` with nothing after it
  is the single most common way a page becomes unusable by keyboard, and it is what the
  canvas effectively does everywhere.
- **Order follows the page.** Tab order is DOM order; nothing carries a positive
  `tabindex`.
- **Anything that overlays the page traps focus** while it is open and returns focus to
  whatever opened it when it closes. That is the Lightbox and the MobileNav.

---

## Layout primitives

### SectionIntro
The repeating header above every content section: a wide-tracked uppercase gold eyebrow,
a serif display heading, and — on two of the four — a short gold rule.

- Parts: `eyebrow` (`--ds-text-xs`, `--ds-tracking-eyebrow`, uppercase,
  `--ds-weight-semibold`) · `heading` (`--ds-font-display`, `--ds-weight-semibold`) ·
  optional `rule` (see **Rule**)
- **Eyebrow colour depends on the surface, and the two are not interchangeable:**
  `--ds-color-accent-text` on a light surface (welcome, gallery, reservations),
  `--ds-color-accent` on the navy location panel. Using either one on the other's
  background fails contrast — that is the whole reason there are two.
- Alignment: centred (welcome, gallery, reservations) · left (location panel)
- Heading size by section: welcome `--ds-display-2xl` · gallery `--ds-display-lg` ·
  location + reservations `--ds-display-xl`
- States: static. No interactive state.
- **Accessibility:** this is the component the two-gold split exists for. Get the pairing
  above right and every eyebrow passes AA; get it backwards and every one fails.

### Rule
The 48×2 gold underline beneath a heading. Decorative; never a semantic `<hr>` between
content.
- Tokens: `--ds-rule-width` × `--ds-border-width-thick`, `--ds-color-accent`
- Placement: centred under a centred heading, flush left under a left heading.

### SplitPanel
Half photograph, half inverted navy text panel. Used once, for Location.
- Layout: 1fr / 1fr, `min-height: var(--ds-panel-min-h)`; stacks to one column at
  `--ds-bp-md` with the image half at `var(--ds-panel-image-min-h)`
- The text half is `--ds-color-primary` with `--ds-color-on-image-muted` body copy
- States: static. If the image fails to load the panel must not collapse — give the image
  half a background of `--ds-color-surface-alt`.

---

## Navigation

### SiteNav
Fixed top bar that begins transparent over the hero and settles into a light bar on scroll.

- **States:**
  - `transparent` (default, `scrollY <= 60`) — brand and links in `--ds-color-on-image*`,
    padding `--ds-space-6` / `--ds-page-x`
  - `scrolled` (`scrollY > 60`) — background `--ds-scrim-nav` with
    `backdrop-filter: blur(--ds-blur-nav)`, `--ds-shadow-hairline`, links drop to
    `--ds-color-text-muted`, padding tightens to `--ds-space-4`
  - Transition between the two: `--ds-duration-slow`
- Responsive: at `--ds-bp-sm` the inline links are **hidden entirely** and only the brand
  and the Book Now button remain. The canvas replaces them with nothing; **MobileNav** ⊕
  is what replaces them now.
- `data-testid`: `site-nav`

### MobileNav ⊕
Not in the canvas, which simply drops its navigation below `--ds-bp-sm` and leaves three
sections unreachable except by scrolling for them (REQ-003 AC-10).

- A toggle replaces the hidden links in the bar, beside the brand. It is a real button
  with an accessible name, `aria-expanded` and `aria-controls` — not a bare glyph.
- Open, it is a **full-width sheet directly beneath the bar**, not a side drawer: it needs
  no width token, no slide animation and no off-canvas transform, so it composes entirely
  from tokens this system already has. Background `--ds-scrim-nav` with
  `backdrop-filter: blur(--ds-blur-nav)`, matching the scrolled bar it hangs from.
- Links stack at `--ds-text-md`, `--ds-space-4` apart, `--ds-page-x-sm` inset; the Book
  Now button sits last and full width.
- **States:** `closed` · `open` · per-link `current` (as NavLink)
- Behaviour: focus is trapped while open and returns to the toggle on close; `Escape`
  closes; choosing a link closes it and moves to the section; body scroll locks while
  open — the same contract the Lightbox has, deliberately, so there is one overlay
  behaviour in this system and not two.
- `data-testid`: `mobile-nav-toggle`, `mobile-nav`, `mobile-nav-link-{id}`

### BrandMark
The wordmark. `--ds-font-display`, `--ds-weight-semibold`, `--ds-tracking-display`.
- Sizes: `--ds-display-md` default · `--ds-display-xs` at `--ds-bp-sm` ·
  `--ds-display-sm` in the footer
- States: inherits the nav's `transparent` / `scrolled` colour. Colour transition
  `--ds-duration-slow`.

### NavLink
- `--ds-text-md`, `--ds-weight-medium`, `--ds-tracking-normal`
- States: `rest` (`--ds-color-on-image-strong`, or `--ds-color-text-muted` when scrolled) ·
  `hover` (`--ds-color-on-image`, or `--ds-color-text` when scrolled), `--ds-duration-medium`
- `focus-visible` ⊕ — the global focus ring, in `--ds-color-focus-on-image` while the nav
  is `transparent` and `--ds-color-focus` once it is `scrolled`.
- `current` ⊕ — the link for the section currently in view takes the `hover` colour
  permanently and carries `aria-current="true"`. **Colour alone does not mark it**, since
  that is the same signal as hover; the accessible attribute is the real marker. A
  weight change would shift the row's width, so it is deliberately not used.

### SiteFooter
Centred, on `--ds-color-text`, with the brand mark over a line of meta text in
`--ds-color-on-image-faint` at `--ds-text-sm`.
- States: static.

---

## Actions

### Button
One action colour. A page has exactly one primary action per region.

**Variants — all four appear in the canvas:**

| Variant | Where | Fill | Label |
|---|---|---|---|
| `solid` | nav Book Now, booking Search, Inquire Now | `--ds-color-primary` | `--ds-color-primary-contrast` |
| `outline-on-image` | hero Explore | transparent, `--ds-border-width-thick` `--ds-color-on-image-border` | `--ds-color-on-image` |
| `outline-on-primary` | location Get Directions | transparent, `--ds-border-width-thick` `--ds-color-on-image-border-soft` | `--ds-color-on-image` |
| `icon-on-image` | lightbox prev/next | `--ds-color-on-image-fill`, `--ds-radius-full` | `--ds-color-on-image-muted` |

- **Always uppercase**, `--ds-weight-semibold`, tracked out. Tracking is per variant:
  nav Book Now `--ds-tracking-wider`, hero `--ds-tracking-label`, everything else
  `--ds-tracking-button`.
- **Square.** `--ds-radius-none`. The canvas sets `border-radius: 0` explicitly on the nav
  button — that is a decision, not an oversight. The only round control is the lightbox arrow.
- **Sizes:** `sm` `--ds-text-sm` / `--ds-space-3` × `--ds-space-7` ·
  `md` `--ds-text-md` / `--ds-space-4` × `--ds-space-12`
- **States:**
  - `rest` — as above
  - `hover` — `solid`: fill → `--ds-color-primary-hover` (`--ds-duration-base`).
    `outline-*`: **inverts** — fill becomes `--ds-color-on-image`, label becomes
    `--ds-color-text` (on image) or `--ds-color-primary` (on the navy panel),
    border goes solid white (`--ds-duration-medium`).
    `icon-on-image`: fill → `--ds-color-on-image-fill-hover`, label → `--ds-color-on-image`
  - `focus-visible` ⊕ — the global focus ring (see **Focus**). On `outline-on-image` and
    `icon-on-image` the ring uses `--ds-color-focus-on-image`, because a navy ring over a
    dark photograph is invisible.
  - `disabled` ⊕ — `--ds-opacity-disabled`, `cursor: not-allowed`, no hover transition.
    The fill and label keep their colours; only the opacity moves, so a disabled primary
    still reads as the primary action rather than as a grey slab.
  - `loading` ⊕ — label stays in place and the control keeps its width (it must not
    resize and shift the row); the button is non-interactive and announces its busy state
    to assistive technology. **No spinner glyph is specified** — the canvas has no icon
    system beyond the four feature icons, so the prototyper picks the treatment and it
    comes back here once chosen.
  - `active` — still not in the source, and still not invented. A pressed state is a
    design decision nobody has needed yet.
- `data-testid` required on every instance.

---

## Forms ⊕

None of this is in the canvas. It exists because REQ-003 turns the booking bar into a real
enquiry form. Every control is square (`--ds-radius-none`), `--ds-field-height` tall, and
sits on `--ds-color-bg` with a `--ds-border-width` `--ds-color-border` edge — the same
hairline the feature grid and the field dividers use, so a form looks like it belongs to
this design rather than like a form dropped onto it.

### Field
The base text control every other one is built from.

- Label above, uppercase `--ds-text-2xs` `--ds-tracking-label` `--ds-color-text-muted`.
  **Always a real `<label>` bound to the control** — placeholder text is not a label and
  disappears exactly when the user needs it.
- Value `--ds-text-base` `--ds-color-text`; placeholder `--ds-color-text-muted`.
- Padding `--ds-space-3` × `--ds-space-4`.
- **States:** `empty` (placeholder) · `filled` · `focus-visible` (the global ring) ·
  `invalid` (`--ds-border-width-thick` `--ds-color-danger` edge **plus** a FieldError —
  never colour alone, which no colour-blind user and no screen reader can read) ·
  `disabled` (`--ds-opacity-disabled`, not editable) · `read-only`
- `data-testid` required; `aria-invalid` and `aria-describedby` point at the FieldError.

### DateField
A Field taking a calendar date.

- **Two validation rules, and both are checked as the value is entered, not on submit**
  (REQ-003 AC-11): an arrival date may not be in the past, and a departure date may not
  be on or before the arrival date.
- Selecting an arrival date later than the current departure date clears the departure
  rather than leaving an impossible pair on screen.
- **The picker itself is not specified.** A native date input and a custom calendar are
  very different amounts of work and look nothing alike; the canvas has neither. The
  prototyper chooses, and whatever is chosen comes back here with its states.
- **States:** Field's, plus `invalid` carrying which of the two rules failed.
- `data-testid`: `field-checkin`, `field-checkout`

### GuestField
A count, not free text.

- Bounded: minimum 1. **The maximum is not set here** — REQ-003 Q6 has not confirmed
  whether "4+ guests" is a real capacity, and a cap invented in a component becomes a
  promise about the property.
- **States:** Field's, plus `at-minimum` / `at-maximum`, where the control that would go
  out of range takes Button `disabled` rather than vanishing.
- `data-testid`: `field-guests`

### FieldError
The message bound to one invalid field.

- `--ds-text-sm` `--ds-color-danger`, directly beneath its field, `--ds-space-1` above it.
- **Its space is reserved whether or not it is showing**, so a form does not jump as
  messages appear — the single most common cause of a mis-click on a validating form.
- Says what is wrong and what to do, never just "invalid".
- Bound to its field by `aria-describedby`, and announced politely on appearance.
- `data-testid`: `field-error-{field}`

---

## Feedback ⊕

### Callout
How the page tells the visitor what happened. Not in the canvas, which has nothing
asynchronous in it and therefore nothing that can succeed or fail.

- Layout: a `--ds-color-surface-alt` panel with a `--ds-border-width-thick` left edge in
  the tone's colour, `--ds-space-4` padding, square.
- **Tones:**

  | Tone | Edge + heading | When |
  |---|---|---|
  | `success` | `--ds-color-success` | the enquiry was sent |
  | `error` | `--ds-color-danger` | it failed, or could not be attempted |

- **Never tone alone.** Each carries an icon and a heading that states the outcome in
  words, because a coloured stripe is not readable to everyone and is invisible in a
  screen reader.
- **The `error` tone always offers a way forward** — retry, or the property's other
  contact channel. An error that only reports is a dead end (REQ-003 AC-15).
- **It preserves what the visitor typed.** A failed enquiry that also clears the form
  loses their work and they do not try again.
- Announced assertively on appearance and focus moves to it, so a keyboard or screen
  reader user learns the outcome without hunting for it.
- **States:** `success` · `error` · `dismissed`
- `data-testid`: `callout`, `callout-retry`

---

## Content

### Hero
Full-bleed photograph, gradient scrim, centred stack: eyebrow / serif title / subtitle /
outline button.

- Height `--ds-hero-height`, floor `--ds-hero-min` (`--ds-hero-min-sm` at `--ds-bp-sm`)
- Image `object-fit: cover`; scrim `--ds-scrim-hero` — the scrim is what keeps white text
  legible over an unknown photograph, so it is not optional
- Eyebrow uses the widest tracking in the system, `--ds-tracking-eyebrow-hero`
- Content sits at `--ds-z-raised`, max `--ds-measure-hero`
- **States:**
  - `populated` — drawn in the canvas
  - `loading` ⊕ — the scrim and a `--ds-color-text` ground are painted **before** the
    photograph arrives, so the white text is legible from the first frame. The hero holds
    `--ds-hero-height` throughout; nothing below it moves (REQ-003 AC-8).
  - `error` ⊕ — the photograph fails and the scrim ground remains. The failure mode this
    prevents is the specific one worth naming: white text on white, i.e. a hero that
    renders as a blank screen (AC-7).

### BookingBar
A white bar that overlaps the bottom of the hero by `--ds-space-10`, holding three fields
and a Search button. `--ds-shadow-raised`, `--ds-measure-bar`.

- **The fields are display-only in the canvas** — static divs reading "Select date" and
  "2 Adults". REQ-003 makes them real, so each is now a **Field** (below) wearing the
  canvas's dressing: uppercase `--ds-text-2xs` `--ds-tracking-label`
  `--ds-color-text-muted` label over a `--ds-font-display` `--ds-text-base` value,
  `--ds-border-width` right divider suppressed on the last field.
- **It starts an enquiry; it does not search availability.** ⊕ The action's label must say
  so — REQ-003 AC-17. "Search" is the canvas's word for something the product cannot do.
- Composition: `checkin` and `checkout` are **DateField**, `guests` is a **GuestField**,
  and the action is a `solid` Button at `md`.
- Responsive: fields wrap to 45% at `--ds-bp-md` and to full width at `--ds-bp-sm`; the
  action goes full width. Each field keeps `--ds-field-height` so the row stays aligned.
- **States:**
  - `empty` — what the canvas draws; the placeholder text *is* the empty state
  - `filled` ⊕ — value replaces the placeholder in `--ds-color-text`
  - `invalid` ⊕ — see **DateField** for the two rules; the bar grows a **FieldError**
    beneath the offending field and the row does not resize (the message occupies
    reserved space, so nothing below it jumps)
  - `submitting` ⊕ — the action takes Button `loading`; the fields go `disabled`
  - `sent` / `failed` ⊕ — the bar itself does not report the outcome. A **Callout**
    does, adjacent to it. A bar that reports its own success has nowhere to put the
    failure text.
- `data-testid`: `booking-bar`, `booking-field-checkin` / `-checkout` / `-guests`,
  `booking-submit`

### FeatureGrid / Feature
Four cells in a hairline grid — stroke icon, serif value, sans caption. Cells overlap
borders by `-1px` so the grid reads as one table, not four cards.

- Icon: 36px stroke SVG, `stroke-width: 1.5`, `stroke: --ds-color-primary`, no fill
- Value `--ds-font-display` `--ds-display-md`; caption `--ds-text-sm`
  `--ds-color-text-muted` `--ds-tracking-normal`
- Responsive: 4 columns → 2 at `--ds-bp-md`
- **States:** static, non-interactive. No empty state — the grid is always fully populated
  from fixed content.

### Icon
Line icons only. `viewBox="0 0 24 24"`, `stroke-width: 1.5`, `fill: none`, currentColor or
`--ds-color-primary`. Drawn in the canvas: bed, guests, eye/view, climate.
- Any icon beyond those four is a design decision — bring it here first.

---

## Photography

### PhotoStrip
Four thumbnails in a tight row under the booking bar, opening the lightbox on click.
- `--ds-gutter-strip` gap (→ `-sm` / `-xs` at the breakpoints),
  `aspect-ratio: var(--ds-aspect-strip)`, `--ds-measure-bar`
- **States:** `rest` · `hover` (image scales 1.05 over `--ds-duration-image`
  `--ds-ease-image`, plus a `--ds-scrim-image-hover` wash)
- `loading` ⊕ — each thumbnail holds its `--ds-aspect-strip` box and shows a
  `--ds-color-surface-alt` block; the strip does not assemble as images arrive.
- `error` ⊕ — a failed thumbnail keeps its box, shows nothing but the alt text, and is
  not clickable. It must not open an empty lightbox.

### Gallery
Deliberately asymmetric 12-column grid on the `--ds-color-surface-alt` band —
one tall hero tile, four small, three wide. `--ds-gutter-gallery` gap.

- Three tile shapes, not eight one-off boxes — each floored by a token, because a
  photograph has no intrinsic height in a grid:

  | Shape | desktop | `--ds-bp-md` | `--ds-bp-sm` |
  |---|---|---|---|
  | tall (tile 1) | `--ds-tile-h-tall` | `--ds-tile-h-tall-md` | `--ds-tile-h-tall-sm` |
  | wide (tiles 6–8) | `--ds-tile-h-wide` | `--ds-tile-h-md` | `--ds-tile-h-wide-sm` (tile 6) |
  | small (tiles 2–5) | `--ds-tile-h-small` | `--ds-tile-h-md` | `--ds-tile-h-sm` |

- Reflows at `--ds-bp-md` to 6 columns and at `--ds-bp-sm` to 2, where the first and sixth
  tiles span full width
- Tile states: `rest` · `hover` (scale 1.04 over `--ds-duration-image-slow`, plus
  `--ds-scrim-image-hover-strong`) · `clickable` (cursor pointer, opens Lightbox)
- Loading: the canvas sets `loading="lazy"` past the third tile — keep that
- **The count rule** ⊕ — the canvas sizes tiles by `nth-child` and therefore only works at
  exactly 8. The rule that replaces it: the composition is a **repeating block of 8** in
  the shapes above. A remainder is placed by the same order — tall, small, small, small,
  small, wide, wide, wide — and any trailing row of `wide` tiles divides the full width
  between however many it has. Below 8, the tall tile is kept and the rest fall back to
  equal `small` tiles, which degrades rather than breaks.
- **States:**
  - `populated` — drawn in the canvas
  - `loading` ⊕ — each tile holds its final height (the shape tokens above) and shows a
    `--ds-color-surface-alt` block. The grid must not assemble itself as images arrive
    (REQ-003 AC-8).
  - `error` ⊕ — a tile whose photograph fails keeps its height and shows its alt text on
    `--ds-color-surface-alt`. It never collapses, and it is not clickable (AC-7).
  - `empty` ⊕ — the section is not rendered at all. A gallery heading over nothing is
    worse than no gallery.
- `data-testid`: `gallery`, `gallery-tile-{index}`

### Lightbox
Full-screen photo viewer over `--ds-scrim-lightbox` at `--ds-z-lightbox`.

- Parts: image (`--ds-lightbox-max-w` × `--ds-lightbox-max-h`, `object-fit: contain`,
  `--ds-shadow-overlay`) · close × (`--ds-glyph-lg`) · prev/next circular buttons
  (`--ds-radius-full`, `backdrop-filter: blur(--ds-blur-control)`) · counter
  ("3 / 8", `--ds-text-md`, `--ds-color-on-image-faint`, `--ds-tracking-wide`)
- **States:** `closed` (opacity 0, `pointer-events: none`) · `open` (fades over
  `--ds-duration-medium`, image scales 0.95 → 1)
- Behaviour that is part of the component, not the screen: `Escape` closes,
  `←` / `→` step, index wraps at both ends, body scroll is locked while open, a click on
  the backdrop closes but a click on the image does not.
- `loading` ⊕ — the overlay opens immediately and the image area holds its box while the
  full-size photograph arrives; the counter is correct from the moment it opens.
  `error` ⊕ — the alt text on `--ds-scrim-lightbox`, with the arrows still working, so one
  broken photograph does not strand the visitor in the viewer.
- **Accessibility** ⊕ — the canvas has no focus trap, no `role="dialog"`, no `aria-modal`
  and does not restore focus to the tile that opened it, which makes it a keyboard trap.
  It now takes the overlay contract in **§ Focus and keyboard**: `role="dialog"`,
  `aria-modal`, focus trapped while open, focus returned to the originating tile on close,
  and a visible ring on all four controls.
- `data-testid`: `lightbox`, `lightbox-close`, `lightbox-prev`, `lightbox-next`,
  `lightbox-counter`

---

## Gaps — what the source does not have

The canvas is a marketing landing page. These are not oversights to be quietly filled in
by whoever hits them first; each is a real design decision that belongs at
`/design-system`.

**2026-09-13.** Six of the original eleven are now closed, because REQ-003 turned the
static booking bar into a real enquiry form and that is exactly the condition the original
list said to come back on. Closed entries are kept, struck through, with what was decided
— a gap that vanishes without a record is a decision nobody can audit later.

### Closed

1. ~~**The gold fails contrast on white — 2.24:1, at 12px.**~~ **CLOSED.** There is no
   single gold that works: `#c9a96e` passes on navy (4.67:1) and fails on white (2.24:1),
   and a gold dark enough for white fails on navy (2.16:1). So a second token was added
   rather than the first one changed — `--ds-color-accent-text` (#8a6d3b, 4.85:1) for
   eyebrow text on light surfaces, `--ds-color-accent` unchanged for decoration and for
   the navy panel. No existing token moved.

2. ~~**No focus-visible state anywhere.**~~ **CLOSED.** See **§ Focus and keyboard** —
   one cross-cutting rule, two tokens (`--ds-color-focus`, `--ds-color-focus-on-image`)
   because a ring has to be visible over photography as well as on white.

3. ~~**No disabled state.**~~ **CLOSED.** `--ds-opacity-disabled` (0.45), applied as
   opacity rather than as a new grey, so no fourth grey entered the palette.

4. ~~**No real form control.**~~ **CLOSED.** See **§ Forms**: Field, DateField,
   GuestField, FieldError. Two things inside them are deliberately still open — the date
   picker treatment (native input vs custom calendar are different work and look nothing
   alike) and the guest maximum (REQ-003 Q6 has not confirmed the property's real
   capacity, and a cap invented here becomes a promise about the property).

5. ~~**No mobile navigation.**~~ **CLOSED.** See **§ MobileNav** — a full-width sheet
   under the bar rather than a side drawer, chosen because it needs no new width or
   transform token and reuses the overlay contract the Lightbox already has.

6. ~~**No current/active page treatment.**~~ **CLOSED.** See **NavLink** `current`.

7. ~~**No loading, error or success states.**~~ **CLOSED**, with one exception.
   `--ds-color-danger` (#b3261e, 6.54:1) and `--ds-color-success` (#2d6a4f, 6.39:1) were
   added; loading and error states are now documented on Hero, Gallery, Lightbox and the
   BookingBar, and **§ Feedback → Callout** carries the outcome of an enquiry.
   *Still missing: `--ds-color-warning`.* Nothing needs one yet, so nothing was invented.

8. ~~**The gallery grid is hard-coded to exactly 8 photographs.**~~ **CLOSED.** See
   **Gallery → the count rule**: a repeating block of 8, with the remainder placed in the
   same shape order and a trailing row dividing the width between whatever it has.

### Still open

9. **Two near-duplicate heading sizes were collapsed.** The source has
   `clamp(26px, 3vw, 38px)` for the reservations heading and `clamp(28px, 3vw, 38px)` for
   the location heading — same maximum, 2px apart at the minimum. One token,
   `--ds-display-xl`, is locked at the 26px minimum. Flagged because it is the one place
   the source was not reproduced byte for byte. Harmless unless someone is comparing
   pixel to pixel.

10. ~~**`Cormorant Garamond` is imported and never used.**~~ **CLOSED 2026-09-13.**
    The canvas imports eight faces and uses three: all four weights of Cormorant, which no
    rule references, plus a Playfair italic that nothing sets. `tokens.css` now carries the
    authoritative `@import` — Playfair Display 400/600/700 only, no italic axis — and that
    is what downstream copies. **The canvas was deliberately not edited**: it is the
    `designSystem.source.ref` and the byte-identical record of what these tokens were
    derived from, it ships to nobody, and changing it would break that provenance to fix a
    file no visitor ever loads. The waste was only ever going to reach production by being
    copied out of it, so the fix belongs in the file that gets copied.

11. ~~**`brand-spec.md` describes a different, abandoned direction.**~~ **MOOT** — that
    file was deleted along with the rest of `design-system/vinjerac-design-system/` in
    commit `05561c1`. Nothing points at it any more.

12. **No pressed/active state on Button.** ⊕ *New.* Deliberately not invented while adding
    the others — nothing has needed it, and the canvas gives no basis for one.

13. **No icon system.** ⊕ *New.* The canvas has exactly four feature icons drawn as inline
    SVG and nothing else. Button `loading` therefore has no spinner specified, and Callout
    has no success or error glyph specified, though both entries say one is required. The
    first prototype that draws them chooses the treatment and brings it back here.

14. **No skeleton or shimmer treatment.** ⊕ *New.* The loading states above all say "hold
    the height and show `--ds-color-surface-alt`", which is a flat block. Whether that
    block animates is undecided, and animating it is a design choice with an accessibility
    consequence (`prefers-reduced-motion`) that should be taken once, here, not per screen.
