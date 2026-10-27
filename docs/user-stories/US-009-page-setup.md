# US-009 — Trim size, margins, gutter, bleed, and facing pages

**Status:** Done (2026-10-18, M2 step 14 passed on build `0.1.0-m5.7`)
**Introduced:** v0.1.0
**Implemented:** v0.1.0 (2026-10-18)
**Supersedes:** —

---

## Story

**As an** author preparing a printed book (and a digital edition),
**I want** to set trim size, margins, gutter, bleed, and whether pages face
each other in a preset,
**so that** the PDF matches what my printer requires or suits reading on a
screen.

---

## Acceptance criteria

- **AC-1 (fields in the preset note):** All values are millimetres. Example
  frontmatter of a preset (see US-008 AC-2):
  ```
  page:
    trimSize: A5          # named size; or trimWidth and trimHeight in mm
    margins:
      top: 18
      bottom: 22
      inside: 15
      outside: 15
    gutter: 5
    bleed: 3
    slug: 0               # optional, default 0 (see AC-9)
    facingPages: true
  ```
  Named sizes (width × height, mm): `A4` 210×297, `A5` 148×210, `A6` 105×148,
  `US Letter` 215.9×279.4. If `trimWidth`/`trimHeight` are present they win over
  `trimSize`. The settings tab offers the four names plus `Custom` (width and
  height fields).

- **AC-2 (validation):** Values must be numbers ≥ 0; trim width and height ≥
  50 mm; and the text block must stay at least 30 mm wide and 30 mm high, where
  text width = trim width − inside − outside − gutter (facing pages) or
  trim width − inside − outside (single pages), and text height = trim height −
  top − bottom. Example: A5 with inside 60, outside 60, and gutter 5 (facing pages) is
  rejected with `Text block would be only 23 mm wide (minimum 30 mm)`
  (148 − 60 − 60 − 5; the first draft said 8 mm, which did not add up). The settings tab keeps
  the previous value; in a preset note the preset is marked `invalid`
  (US-008 AC-4).

- **AC-3 (worked example, A5 with bleed, facing pages):** The AC-1 values
  produce
  ```
  #set page(width: 154mm, height: 216mm, margin: (top: 21mm, bottom: 25mm, inside: 23mm, outside: 18mm))
  ```
  Rule: page size = trim + 2 × bleed in both directions; `top`, `bottom`,
  `outside` = margin + bleed; `inside` = margin + gutter + bleed.

- **AC-4 (single pages, no bleed):** With `facingPages: false`, trim 210×297,
  margins top 20, bottom 20, inside 20, outside 20, bleed 0:
  ```
  #set page(width: 210mm, height: 297mm, margin: (top: 20mm, bottom: 20mm, left: 20mm, right: 20mm))
  ```
  Rule: `inside` becomes the left margin and `outside` the right margin on every
  page; the gutter is not applied (the settings tab disables the field); bleed
  is added to all four as in AC-3. Margins do not alternate.

- **AC-5 (facing pages in the PDF):** With the AC-3 settings, in a 4-page PDF
  the first text line starts 23 mm from the left page edge on pages 1 and 3
  (right-hand pages; `inside` is on the left) and 18 mm from the left page edge
  on pages 2 and 4 (`outside` is on the left), tolerance ±0.5 mm. With the AC-4
  settings it starts 20 mm from the left on all four pages. The integration test
  measures the x-position of the first text line on each page.

- **AC-6 (built-in presets):** `A5 print`: `trimSize: A5`, margins top 18,
  bottom 22, inside 15, outside 15, gutter 5, bleed 3, `facingPages: true`
  (the AC-3 values). `A4 digital`: `trimSize: A4`, margins 20/20/20/20, gutter 0,
  bleed 0, `facingPages: false` (the AC-4 values). Decided by the user.

- **AC-7 (number formatting):** The output uses `mm` with at most 2 decimal
  places, trailing zeros removed: `18.5mm`, `18mm`, `215.9mm`. Inputs with more
  decimals are rounded half up to 2 places before use (`18.456` → `18.46mm`).

- **AC-8 (composed: with a cover and with a preset that only sets bleed):** The
  cover page (US-011) uses the full page size including bleed and no margins,
  regardless of these margins (with a slug see AC-11). A preset that sets only `page.bleed: 5` on top of
  Defaults with `trimSize: A5` gets `width: 158mm, height: 220mm` (US-008
  AC-12).

- **AC-9 (slug for crop marks):** `page.slug` (mm, ≥ 0, default 0) is an extra
  margin outside the bleed that holds crop marks. Page size = trim +
  2 × (bleed + slug); `top`, `bottom`, `outside` = margin + bleed + slug;
  `inside` = margin + gutter + bleed + slug. Example: the AC-1 values with
  `slug: 5` give
  ```
  #set page(width: 164mm, height: 226mm, margin: (top: 26mm, bottom: 30mm, inside: 28mm, outside: 23mm))
  ```
  Full-page content (the cover, US-011) fills trim + bleed only and is centred;
  the slug area stays empty. With `slug: 0` every earlier AC is unchanged. The
  marks themselves are in the backlog item "Print output". Decided by the user
  2026-10-16.

- **AC-10 (trim size must be resolvable):** The trim size comes from
  `trimWidth` and `trimHeight` together, or else from `trimSize`; names match
  exactly (`A5`, not `a5`). Otherwise the preset is invalid (US-008 AC-4) with
  one error on field `trimSize`:
  - unknown name, e.g. `trimSize: A55`:
    `Unknown trim size "A55" (use A4, A5, A6, US Letter, or trimWidth and trimHeight)`
  - nothing set, or only one of `trimWidth`/`trimHeight` (a lone value does not
    override the named size): `Trim size missing (set trimSize, or both trimWidth and trimHeight)`

  When both `trimWidth` and `trimHeight` are given, an unknown `trimSize` is
  ignored (AC-1: they win). Decided by the user 2026-10-16.

- **AC-11 (the cover with a slug; found in the AC check 2026-10-18):** The cover
  page fills trim + bleed and not the slug (AC-9). With `slug: 0` the cover page
  is exactly as in US-011 AC-4: `#page(margin: 0pt, header: none, footer: none)`.
  With a slug the page margin is the slug: `#page(margin: 5mm, header: none,
  footer: none)` for `slug: 5` (number format of AC-7). Example, A5 print with
  `slug: 5`: the PDF page is 164 × 216+10 = 164 × 226 mm; the cover image is
  154 × 216 mm (436.5 × 612.3 pt, tolerance 0.5 mm) and starts 5 mm from the
  left and the top edge of the page; the strip of 5 mm around it is empty. The
  warning `COVER_CROPPED` (US-011 AC-6) measures the crop against 154 × 216 mm
  (trim + bleed), not against the whole page, and names that size.

- **AC-12 (trim size in the settings tab; asked 2026-10-18, decided by the
  user):** The row `Trim size` of the Defaults is a dropdown with the entries
  `(built-in)`, `A4`, `A5`, `A6`, `US Letter` and `Custom`. It shows `Custom`
  when the Defaults hold `trimWidth` or `trimHeight`, else the name of
  `trimSize`, else `(built-in)`. The rows `Trim width (mm)` and `Trim height
  (mm)` are always there (the tab does not change its height) and are
  disabled, with the description `Used only with a custom trim size`, unless
  `Custom` is shown. Choosing `Custom` removes nothing. Choosing a name stores `trimSize` and removes `trimWidth` and
  `trimHeight` in one save (they would win over the name, AC-1); choosing
  `(built-in)` removes all three. When the choice removes a width or a height
  that the Defaults hold, a question comes first (SCAR-014): title `Remove the
  custom trim size?`, text `The values "160 × 240 mm" are removed from the
  Defaults. Presets that do not set them use the trim size "A5".` (for
  `(built-in)`: `use the built-in trim size`), buttons `Remove` and `Cancel`
  (focus on `Cancel`); nothing is saved and the dropdown shows `Custom` again
  after `Cancel`. A missing value is written as `–` (`160 × – mm`). A change
  that removes no width or height (name to name, name to `(built-in)`,
  `Custom` with no sizes stored) is editing and asks nothing. The dropdown and
  the rows change at once, without closing the tab (SCAR-016).
  The two size fields are saved together (found by M2 step 14, 2026-10-18): a
  width alone or a height alone is never saved, because one value alone makes
  every preset invalid (AC-10) and each of them would show a notice. While one
  field is empty or not a number, nothing is saved and the description of the
  row says `Enter width and height; they are saved together`. When both hold a
  number, they are saved in one step (a number that fails AC-2 shows its
  message and is not saved). When both are emptied, both are removed (editing,
  no question). The two rows have no reset icon of their own: the dropdown
  removes them (with the question above).

- **AC-14 (the trim size is one group in the merge; found by M2 step 14,
  2026-10-18):** `trimSize`, `trimWidth` and `trimHeight` are taken from one
  layer together: a preset that sets any of the three replaces all three of the
  Defaults and the built-in value, so a preset keeps its own size whatever the
  Defaults hold (US-008 AC-1: preset before Defaults). Example: Defaults with
  `trimWidth: 160`, `trimHeight: 240` and a preset with `trimSize: A5` give A5
  (148 × 210 mm, not 160 × 240); Defaults with `trimSize: A4` and a preset with
  `trimWidth: 160`, `trimHeight: 240` give 160 × 240; a preset that sets none of
  the three inherits the Defaults' size (also a custom one). A preset that sets
  only `trimWidth` has no size (AC-10): the Defaults' `trimSize` is not
  filled in, and the preset is invalid with `Trim size missing`.

- **AC-13 (gutter in the settings tab; AC-4 says the tab disables it):** The
  field `Gutter (mm)` of the Defaults stands directly under the switch `Facing
  pages` (they belong together) and is disabled, with the description `Used
  only with facing pages`, while the Defaults do not have `Facing pages` turned
  on. The stored value stays; turning `Facing pages` on or off enables or
  disables the field at once, without closing the tab (SCAR-016). A preset
  note that sets `facingPages: true` itself uses the gutter of its own note or
  of the Defaults (US-008 AC-12) whatever the field shows; the field is only a
  help for the Defaults.

---

## Notes

- Decided by the user: millimetres only; the four named sizes; A5 print margins
  as above; mirroring is switchable and off for `A4 digital`.
- Crop marks, running headers, folios, and blank-page handling are in the
  backlog item "Print output".
- Bleed is applied uniformly on all four sides, including the spine side. This
  is accepted by printers as a simplification (approved by the user
  2026-10-16); separate spine bleed is not planned.
- A size such as 6×9 in is entered as `Custom` 152.4 × 228.6.

---

## Related tickets

- [TICKET-002](../tickets/TICKET-002-page-setup-core.md) — page setup core (AC-1 to AC-4, AC-6 to AC-10)
- [TICKET-036](../tickets/TICKET-036-page-setup-pdf-cover-slug-and-settings.md) — facing pages in the PDF (AC-5), cover with a slug (AC-11), trim size dropdown and gutter field (AC-12, AC-13)
