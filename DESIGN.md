---
name: GGO Med Content Manager
description: Il Registro — the operator cockpit as a bound register of signed decisions, cut in security-engraving vocabulary.
colors:
  plate: "#0d1626"
  plate-deep: "#070e1a"
  plate-raised: "#16223a"
  plate-rule: "#24314c"
  plate-fg: "#dcd6c8"
  plate-fg-strong: "#f4eee2"
  plate-fg-soft: "#949cac"
  paper: "#efe7d6"
  paper-shade: "#e4dac5"
  paper-edge: "#c7bb9f"
  paper-fg: "#16202e"
  paper-fg-soft: "#57606e"
  engraving: "#1f6f63"
  engraving-bright: "#45b9a3"
  engraving-ink: "#15564c"
  seal: "#9e2b25"
  seal-bright: "#d9564c"
  seal-deep: "#6d1b17"
  stamp: "#5b3a8e"
  stamp-bright: "#a184d4"
  sepia: "#75591f"
  sepia-bright: "#d0a955"
  stub-torn-paper: "#f0dfd8"
typography:
  display:
    fontFamily: "Bodoni Moda, ui-serif, Georgia, serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Bodoni Moda, ui-serif, Georgia, serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 700
    letterSpacing: "0.18em"
  serial:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.14em"
rounded:
  none: "0px"
  seal: "9999px"
spacing:
  unit: "0.25rem"
components:
  act-seal:
    backgroundColor: "{colors.seal}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.625rem 1.125rem"
    height: "2.75rem"
  act-seal-hover:
    backgroundColor: "{colors.seal-bright}"
    textColor: "{colors.plate}"
  act-stamp:
    backgroundColor: "transparent"
    textColor: "{colors.stamp-bright}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.625rem 1.125rem"
    height: "2.75rem"
  act-void:
    backgroundColor: "transparent"
    textColor: "{colors.plate-fg}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.625rem 1.125rem"
    height: "2.75rem"
  act-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.plate-fg}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.5rem 0.875rem"
  mark:
    backgroundColor: "transparent"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.1875rem 0.5rem"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-fg}"
    rounded: "{rounded.none}"
    padding: "20px"
---

# Design System: Il Registro

## Overview

**Creative North Star: "Il Registro"** — security engraving, seals, and the bound register of signed decisions.

This cockpit is the register the house is signed into, not a dashboard about it. It refuses the sidebar-plus-KPI-tiles-plus-filterable-table arrangement. The chrome of the whole application is intaglio blue-black plate; safety paper appears only where a real document sits; oxblood is reserved for the act of sealing and for what awaits JJ; violet stamps mark state applied by hand; sepia marks the thing quietly going stale. Depth is an engraved hairline, never a blur. The world was chosen as candidate 3 of the grounded list, **seed key `9055bf41`** — the full direction contract survives the production build as an HTML comment in `app/layout.tsx`, and the CSS ground truth lives in `app/globals.css`. Product truth lives in `PRODUCT.md`; this file is strictly visual.

The story the interface tells: JJ reads which rooms want him from the counterfoil wall (the atrium, `app/page.tsx`), opens that room's register, sees the asset at document scale (Il Cancello, `app/review/page.tsx`), and seals it or sends it back. Approved comps are kept as references: `.impeccable/mocks/comp-b-counterfoil-wall.png` (atrium) and `.impeccable/mocks/comp-a-register-spread.png` (room interior); the atrium's surface brief is `.impeccable/surfaces/app-page-tsx.md`.

**Key Characteristics:**
- Intaglio plate chrome (#0d1626) with runtime-generated guilloche watermarks (`Guilloche` in `components/Registro.tsx` — a real hypotrochoid lathe, parameter-driven, never a texture image).
- Safety paper (#efe7d6, laid-line textured) only under genuine document content.
- Square corners everywhere; circles exist only for genuinely circular seals and sockets.
- No drop shadows, no gradients (one exception: the wax of `.socket-sealed`), no pill badges.
- Bodoni Moda for document titles, Archivo Narrow for tracked-uppercase labels/acts/serials, Archivo for text.
- Tabular lining numerals in every register.

## Colors

An engraved-ink palette: one dark plate, one light paper, and four inks whose meanings are enforced, not decorative.

### Primary
- **Seal Oxblood** (`--seal` #9e2b25, bright #d9564c, deep #6d1b17): the act of committing and the things that await JJ. Used on the seal press (`.act-seal`), sealed wax sockets, torn attention stubs, Il Cancello's gate in the sidebar, the confirmation toast, and text selection. Nothing else may borrow it.

### Secondary
- **Engraving Green** (`--engraving` #1f6f63, bright #45b9a3, ink #15564c): structure, rules, guilloche lines, the settled state, and *all* interaction chrome that is not sealing — navigation active states, filter underlines, hover borders, focus rings, links on paper (`--engraving-ink`). `--engraving-wash` (rgba(31,111,99,0.12)) is the row-hover and selection tint.

### Tertiary
- **Stamp Violet** (`--stamp` #5b3a8e, bright #a184d4): aniline ink for a state applied by hand — the "Timbra e rimanda" (send back for rework) act and correction notes.
- **Sepia** (`--sepia` #75591f, bright #d0a955): age and drift — overdue reviews, stale warnings, the `ageing` mark tone.

### Neutral
- **Plate** (`--plate` #0d1626; deep #070e1a; raised #16223a): the intaglio ink ground — application chrome, sidebar, page headers, overlays (deep at 80–95% opacity).
- **Plate Rule** (`--plate-rule` #24314c): the engraved hairline on the plate; every border, rule and divider in the chrome.
- **Plate Foreground** (#dcd6c8; strong #f4eee2; soft #949cac): warm-grey text carried on the plate.
- **Safety Paper** (`--paper` #efe7d6; shade #e4dac5; edge #c7bb9f): the only light material. Edge is the paper's hairline border and perforation dot colour.
- **Paper Foreground** (#16202e; soft #57606e): ink on paper.
- **Torn-Stub Paper** (#f0dfd8): the oxblood-tinted sheet of an atrium stub whose room wants attention.

### Named Rules
**The Oxblood Rule.** `--seal` is reserved for the act of sealing and for what awaits JJ. Navigation, filters and selection states use engraving green. One decided exception: the login Sign-in act keeps `.act-seal` — signing into the register is itself a sealing act.

**The Paper Rule.** Safety paper appears only under real document content — a register table, an open document, a counterfoil stub. Chrome (sidebar, headers, filters, footers) stays on the plate. A mute stub is plate-coloured and dashed: it never pretends to be paper it does not have.

## Typography

**Display Font:** Bodoni Moda (with ui-serif, Georgia fallback) — `--font-serif`
**Body Font:** Archivo (with ui-sans-serif, system-ui fallback) — `--font-sans`
**Label/Condensed Font:** Archivo Narrow (falls back to Archivo) — `--font-condensed`

**Character:** A didone struck against a tracked industrial condensed — the letterhead of a certificate against the rubber stamps and serial numbers pressed onto it. Body text stays small, plain and unromantic.

### Hierarchy
- **Display / page title** (`.page-title`, `.document-title` at page scale: Bodoni Moda 700, 30–34px, line-height 1.05, letter-spacing −0.015em): the masthead of each room, on the plate in `--plate-fg-strong`.
- **Title / document title** (`.document-title`: Bodoni Moda 700, 17–22px, letter-spacing −0.01em, line-height 1.1): entry and section titles, on paper or plate.
- **Body** (Archivo 400, 12–14px): notes, captions, prose. Content prose links are `--engraving-ink`, underlined, hover to `--seal`.
- **Column label** (`.column-label`: Archivo Narrow 700, 0.625rem, tracking 0.18em, uppercase): every table header, section label and eyebrow. On plate it is `--plate-fg-soft`; add `.column-label-paper` (`--engraving-ink`) on paper.
- **Serial** (`.serial`: Archivo Narrow 600, 0.6875rem, tracking 0.14em, tabular lining numerals): counterfoil serials, counts, dates-as-record.
- **Acts** (Archivo Narrow 700, 0.75rem, tracking 0.14em, uppercase): all button labels.

### Named Rules
**The Tabular Rule.** Numerals in registers are tabular lining: `font-variant-numeric: tabular-nums lining-nums` is applied globally to `table` and `.tabular`, and belongs on any column of figures.

## Layout

The shell (`components/AppShell.tsx`) is a two-column plate grid: a 264px sticky sidebar and a fluid main column, collapsing to a single column with a horizontal nav strip below `lg`. The sidebar (`components/Sidebar.tsx`) is the register's left margin, in three ranks: the gate (Il Cancello — the only oxblood in the margin, carrying the live pending count fetched from `/api/review-dashboard/state`, degrading to no count on failure), the rooms (live surfaces), and the old archive (mirror-database pages, demoted to 70% opacity, labelled "in pensionamento"). On the phone, the registrar's acts (Settings / Sign out) ride the horizontal nav so they never disappear with the hidden footer.

Page anatomy: an engraved masthead (`border-b border-plate-rule`, padding 28px 40px 16px desktop, 18px 16px 12px under 640px) with column-label eyebrow, Bodoni headline that states a verdict ("La casa è in ordine" / "3 stanze ti aspettano"), then the content section (24px 40px 48px). Guilloche watermarks bleed off-canvas behind headers (opacity 0.10–0.20, pointer-events none, aria-hidden).

The atrium wall is a stub grid: 4 columns, dropping to 3 (`max-2xl`), 2 (`max-lg`), 1 (`max-sm`), gaps 20px × 32px. Il Cancello is a register spread: ruled register page on the left (capped at 26rem when a document is open), a vertical perforation strip between the leaves, the open document filling the right. On the phone the document opens over the register as a full-screen sheet with the three acts pinned at the foot, under the thumb. Base spacing unit is 0.25rem.

## Elevation & Depth

There are no shadows anywhere: every `--shadow-*` token is `none`, and the legacy glow tokens are re-cut as 1px inset rings. Depth is conveyed by material and hairline alone — a paper sheet sits "in" the plate because its edge (`--paper-edge`) meets the plate's rule (`--plate-rule`), and importance is a double rule (`border: 3px double`), never elevation. Overlays dim with `--plate-deep` at 80–95% opacity, not with blur or shadow. The two surface textures are printed, not lit: the plate carries a faint 3px vertical laid pattern, the paper a 4px horizontal one.

### Named Rules
**The Hairline Rule.** Depth is an engraved hairline, never a blur. If a boundary needs more weight, it becomes a 3px double rule — the register's way of ruling off a section.

## Shapes

Every radius token is zeroed globally (`--radius-*: 0px`), which alone ends the dashboard look. The only permitted circles are genuinely circular objects: seal sockets, the wax seal, and `rounded-full` survives solely for them. Borders are 1px solid hairlines in the material's own edge colour; dashed borders mean absence (empty socket centre, mute stub, "no assets" notice). The world's signature silhouettes are paper artefacts drawn as geometry, not masks: the perforation strip (`.perforation-y` / `.perforation-x`, a 2px dotted tear line in `--paper-edge`), the torn edge of an attention stub (`TornEdge`, a jagged SVG polygon), and the vertical counterfoil serial (writing-mode vertical-rl, rotated).

## Components

All primitives live in `components/Registro.tsx`; their CSS in `app/globals.css`.

### Acts (buttons)
The commit vocabulary. All are square, condensed-uppercase, 0.14em tracked, min-height 2.75rem, 0.12s linear transitions, `opacity: 0.4` when disabled.
- **`.act-seal`** — the press. Solid oxblood on `--seal` with a `--seal-deep` border, paper text; hover brightens to `--seal-bright` with plate text; active goes `--seal-deep`. Nothing else may look like this; it is the one irreversible act.
- **`.act-stamp`** — send back for rework. Transparent with a violet border and violet text; hover fills with `--stamp-wash`.
- **`.act-void`** — cancellation. Transparent, plate-rule border; hover strikes the label through (`text-decoration: line-through`).
- **`.act-quiet`** — secondary act on the plate. Transparent, hairline border; hover turns border and text `--engraving-bright`.
- Legacy `.btn-pill` ≈ act-quiet; `.btn-gradient` ≈ act-seal (re-cuts, no gradient despite the name).

### Socket (the seal)
`Socket` — a circular socket, 1px `--paper-edge` border (`.socket-on-plate` swaps to `--plate-rule`). Empty: a dashed inner circle — it is waiting for JJ. Sealed: the one permitted gradient, a radial oxblood wax (`--seal-bright` → `--seal` → `--seal-deep`) carrying an engraved star device. `justSealed` fires `animate-press-seal` (260ms scale 1.6 → 0.94 → 1). Always labelled (`role="img"`, aria-label "Sealed" / "Awaiting your seal").

### Marks (state)
`Mark` / `.mark` — a rubber stamp, not a pill: transparent, 1px `currentColor` border, condensed uppercase 0.625rem. Tones: `sealed` (engraving), `pending` (seal), `stamped` (violet), `ageing` (sepia), `quiet` (soft grey); `onPaper` swaps to the darker on-paper inks. Legacy `.status-badge` and `.pill` are re-cut identically.

### Tally & AgeBar
`Tally` — volume counted in fives, struck through, as SVG strokes; zero is an em-dash, overflow is `+N` in serial type. `AgeBar` — eight ascending bars filling with wait (21 days = full); colour follows `ageTone`: quiet under 5 days, sepia from 5, seal from 14.

### Counterfoil & Document
`Counterfoil` — the 36px left margin of a register entry: vertical serial on `--seal` (or plate-raised when quiet), then a perforation strip. `Document` — a sheet of safety paper set into the plate (`.paper` + `--paper-edge` border). `RegisterHeading` — a ruled section heading on the plate with `[count]` in soft type.

### Guilloche
`Guilloche` / `GuillocheField` — runtime hypotrochoid rosettes (0.4px `--engraving` strokes, 1–4 rings, each ring a different lathe setting). Decorative and inert: `pointer-events-none`, `aria-hidden`, opacity 0.10–0.20, bled off-canvas behind mastheads.

### Stubs (atrium wall)
`.stub` — a 15rem-min paper counterfoil: condensed room name, ruled divider, tally, one plain-fact note, and a foot of up to five sockets (empty first — what waits leads). `.stub-torn` — attention: torn-stub paper, seal border, `TornEdge` polygon on top, all inks shifted to `--seal-deep`. `.stub-mute` — no reporting line: transparent, dashed plate-rule border, and the words "nessun riporto" — a count is never invented.

### Tables (the register)
`.table` and the on-paper registers: column-label headers in `--engraving-ink` over a 3px double rule, 1px `--paper-edge` row rules, faint even-row tint, `--engraving-wash` row hover, tabular numerals throughout.

### Inputs
Transparent fields with hairline borders (no fill, no radius): `.search-box` on the plate focuses to `--engraving-bright`; textareas on paper focus to `--engraving-ink`. Placeholder text in the material's soft foreground.

### Navigation
Sidebar rows: 13px text, 2px left border as the active device — `--engraving-bright` border + `--plate-raised` fill + strong text when active, transparent border and soft text otherwise, hover previews the engraving border. Filters (`.filter-pill` / `FilterLink`) are cut into the plate as underline tabs: transparent, condensed uppercase, 2px bottom border in `--engraving-bright` when active. No oxblood anywhere in navigation or filters.

### Icons
Engraved line, never filled shapes: `.ggo-icon` strokes at 1.25–1.5px, `currentColor` structure, `--engraving-bright` accent, `--seal-bright` danger, dashed strokes for pathology lines.

## Do's and Don'ts

### Do:
- **Do** keep oxblood for sealing and for what awaits JJ — the seal press, sealed wax, torn stubs, Il Cancello's gate, the toast — and give every other interaction to engraving green (The Oxblood Rule; the login Sign-in act is the one decided exception).
- **Do** put safety paper only under real document content and keep all chrome on the plate (The Paper Rule).
- **Do** set every count in tabular lining numerals (The Tabular Rule) and every label in Archivo Narrow tracked uppercase.
- **Do** write "nessun riporto" on a surface with no reporting line — a mute stub is dashed and plate-coloured, and a number is never invented to fill it.
- **Do** use hairlines for depth and 3px double rules for section weight (The Hairline Rule); overlays dim with `--plate-deep` opacity.
- **Do** respect `prefers-reduced-motion`: the global override collapses all animation and transitions to 0.001ms.
- **Do** keep guilloche decorative: pointer-inert, aria-hidden, sub-0.2 opacity.

### Don't:
- **Don't** round a corner: radius tokens are zeroed globally; `rounded-full` exists only for genuinely circular seals and sockets.
- **Don't** cast a shadow — every shadow token is `none`; use an inset 1px ring or a hairline instead.
- **Don't** use a gradient anywhere except the radial wax of `.socket-sealed`.
- **Don't** make a pill badge: state is a bordered stamp (`.mark`), transparent with a 1px `currentColor` border.
- **Don't** let anything that is not the commit act imitate `.act-seal` — solid oxblood is the press alone.
- **Don't** ship filled-shape icons; icons are engraved line work at 1.25–1.5px strokes.

## Open Items

Known polish recorded at the finish review, not yet built:
- Focus trap and Escape handling on the stamp dialog and the phone document sheet (`app/review/page.tsx`).
- `role="status"` on the confirmation toast (`app/review/page.tsx`).
- Drawn icons to replace the remaining unicode glyphs (▾ ▸ in La Soffitta).
- A perforation strip on the quiet stubs of the atrium wall (`app/page.tsx`).
- Eleven legacy pages (the "vecchio archivio") are styled only through the re-cut legacy classes (`.card`, `.table`, `.status-badge`, `.filter-pill`, …) and await full register conversion.
