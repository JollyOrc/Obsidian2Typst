<!-- Filed 2026-11-06 as #127 on the user's go (epic #121, ticket 6 of 16). -->

### User story

[US-031](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-031-entry-layouts-on-facing-pages.md), ACs addressed AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-14, AC-15, AC-16, AC-17

### Description

Place each entry of an entries chapter on a page or a facing-page spread, inside one compile: `measure()` decides the size, parity page breaks place it, illustrations are fitted into their slots with a caption, page-sized entries pair up, sub-headings and lists inside entries follow their rules, and presets without facing pages lay out consecutively.

### Acceptance criteria (from the user story)

The examples use a preset with `headingRules: {Menagerie: entries}`,
`page.facingPages: true` (US-009), folios on (US-019), and this outline
(entries are headings with an `o2t-entry` block, US-030; the layout in
brackets):

```
# Menagerie
## Beasts

- **AC-4 (a layout the entry can't support, D23):** A layout is replaced by
  the `auto` choice, with `ENTRY_LAYOUT_CONFLICT "<heading>": <asked> →
  <used> (<reason>)`, when:
  - it needs an illustration (`full-image`, `*-landscape`, `*-portrait`) and
    the block has none or it was not found → reason `no illustration`;
  - `*-landscape` with a portrait image → `image is portrait`;
    `*-portrait` with a landscape image → `image is landscape`. An image
    whose width equals its height counts as landscape.

  Example: `Bog Wight` with `full-image` and no illustration →
  `ENTRY_LAYOUT_CONFLICT "Bog Wight": full-image → page-text (no
  illustration)` (it fits one page).

- **AC-5 (left-page start):** A spread-sized entry starts on a left (even)
  page (`pagebreak(to: "even")`). When that adds a page, the added page shows
  the folio only (US-025 AC-6's `o2t-blank`, no header) and gives
  `ENTRY_BLANK_PAGE "<heading>"`, unless US-033 places a section opener
  there. The next entry starts after the spread (AC-8, AC-5).

- **AC-6 (the four spread layouts):** The left page holds the heading, the
  opening paragraph beside the statblock (US-030 AC-16) and the body. Then:

  | Layout | Right page |
  |---|---|
  | `full-image` | only the illustration, fitted inside the margins, centred, no running header and no folio (`entries.fullImageHeader: false`, built-in); the page counts in the numbering; all text must fit the left page (US-032 otherwise) |
  | `spread-landscape` | the rest of the body, then the illustration at full text width in the lower half (at most half the text height) |
  | `spread-portrait` | two columns: the rest of the body in 45 %, the illustration in 55 % at full text height on the outer (right) edge |
  | `spread-text` | the rest of the body, no illustration |

  With `entries.fullImageHeader: true` a `full-image` page keeps its header
  and folio.

- **AC-7 (fit, never crop, D21):** An illustration is scaled to fit its slot
  with its aspect ratio kept and is never cropped; the slot shrinks to the
  scaled image and the space freed goes to the text. Examples, A5 text area
  105 × 165 mm:
  - `spread-landscape`, a 3:2 image → drawn 105 × 70 mm (half the height
    would be 82.5 mm; the text above it gets 165 − 70 mm minus the gap);
  - `spread-portrait`, slot 57.75 mm (55 %) × 165 mm; the scale is the
    smaller of (slot width ÷ image width) and (slot height ÷ image height):
    a 1:2 image (width : height) is drawn 57.75 × 115.5 mm (width-limited;
    the column keeps its width); a 1:4 image is drawn 41.25 × 165 mm
    (height-limited), the column narrows to 41.25 mm and the text column
    widens by 16.5 mm;
  - `full-image`, a 3:2 image → 105 × 70 mm, centred on the page.

  The illustration's credit (US-030 AC-7) is a small caption under the image,
  in every slot including the portrait column (decision 2), in the
  template's caption style; its height is part of the slot. No credit → no
  caption.

- **AC-8 (pairing, D16, D27):** Page-sized entries take one page each.
  Consecutive page-sized entries of one section pair up in document order:
  the first on a left page, the next on the facing right page. A spread-sized
  entry, a section heading or the chapter's end breaks the run. Example
  (the outline above):

  | Page | Content |
  |---|---|
  | left | Fen Hare (`page-text`) |
  | right | Marsh Owl (`page-landscape`) |
  | left + right | Cave Wyrm (`spread-landscape`) |
  | left | Reed Cat (`page-portrait`) |
  | right | US-033's opener of `Horrors`, or a blank page (folio only) with `ENTRY_UNPAIRED "Reed Cat"` until US-033 |

- **AC-9 (the three page layouts):**
  - `page-text`: heading, opening paragraph beside the statblock, body;
  - `page-landscape`: as `page-text`, the illustration at full text width on
    the lower part of the page, at most 40 % of the text height (fitted as
    AC-7);
  - `page-portrait`: below the statblock row, the body in a 45 % column and
    the illustration in a 55 % column on the outer edge — left on a left
    page, right on a right page (D22); fitted as AC-7.

- **AC-10 (unpaired, BL-C4 AC-5):** A page-sized entry without a partner
  takes a left page; its right page is blank (folio only) with
  `ENTRY_UNPAIRED "<heading>"`, unless US-033 places the next section's
  opener there (then no warning).

- **AC-11 (sub-headings, D25):** Headings below an entry's heading inside the
  entry (`#### Habits` under `### Fen Hare`) are set small (the heading font
  at the statblock's band size, tight spacing), are not in the TOC (US-027)
  or the running header (US-019), get no number, and never break a page:
  US-025's `page.breakBefore` rules do not apply to them. Each one stays with
  at least the first two lines (or first two list items) of what follows.

- **AC-12 (lists, D26):** A list (numbered or bulleted, at any depth) of up to
  10 items is never broken across a page or column. A longer list may break
  between items, with at least 2 items in each part. Example: a 10-item list
  starting 4 lines above a page end moves whole to the next page; an
  11-item list there breaks, 2 or more items on each side.

- **AC-14 (one compile, measured):** The size of each entry is decided inside
  the compile with `measure()` at the entry's width; entries are placed with
  parity page breaks only; no read-back loop runs for entries. The real
  first and last page of each entry are recorded (`metadata`) and read after
  the compile for the warnings of this story and US-032.

- **AC-15 (presets without facing pages, D18):** With
  `page.facingPages: false`:
  - a spread-sized entry takes two consecutive pages with the same left and
    right content; no left-page start, no blank page, no `ENTRY_BLANK_PAGE`;
  - page-sized entries still pair as two consecutive pages;
  - a `page-portrait` illustration is on the right (no outer edge);
  - a `full-image` page still has no header and no folio (AC-6).

  Example: the outline above gives 6 consecutive pages (Fen Hare, Marsh Owl,
  Cave Wyrm ×2, Reed Cat, then Horrors) and no warning.

- **AC-16 (with other stories' rules):**
  - `page.breakBefore.h3: right` (US-025) with entries at level 3: inside an
    entries chapter the entry layout decides the breaks and US-025's rule
    for entry headings is not written (one break per entry, from this
    story); outside the chapter US-025 applies as today.
  - `toc.depth: 2` (US-027) with entries at level 3: the sub-headings of
    AC-11 are never listed; whether entries are listed is US-033 (always).
  - a cover (US-011) and a TOC before the chapter: the parity of AC-5 and
    AC-8 is the PDF page's (`to: "even"`), as US-025 measured for side
    rules.
  - an entries chapter right after a `# ` heading with `h1: right`: the
    chapter's own placement is US-033 (opener pages).

- **AC-17 (tests, SCAR-019):** Each layout on a left and on a right page;
  facing pages on and off; `entries.fullImageHeader` on and off; images of
  ratio 1:4, 1:2, 1:1, 3:2, 4:1 in each slot; lists of 10 and 11 items at a
  page end; pairing runs of 1, 2, 3 and 4 page-sized entries; a chapter with
  two sections. The PDF tests read page parity, each page's images (count,
  drawn size and position), header and footer text, and the body text per
  page (SCAR-015), on the generated fixture (US-024 amendment, D-03).

## Decisions (answered by the user, 2026-11-06)

1. **`auto` before US-032:** the simple rule of AC-3 (`page-text` when the
   entry fits one page, `spread-text` otherwise); US-032 replaces it.
2. **Caption in the portrait column:** under the image, as in every slot
   (AC-7).
3. **Nested entries:** inline, no page or spread of their own; an explicit
   layout gives `ENTRY_NESTED_LAYOUT` (AC-1).

### Implementation notes

- A Typst entry helper (a `PLUGIN_NAMES` entry) per layout: measures the composed entry at the text width (`measure()`), places with `pagebreak(to: "even")` / `pagebreak(weak: true, to: "odd")`, no `locate`/`query` in the placement (the measured approach of `docs/technical/spike-entry-measure.md`).
- Interim `auto` (decision 1): `page-text` if the entry fits one page, else `spread-text`; US-032 (#128) replaces it.
- Slots: landscape at full text width (half the text height on a spread's right page, 40 % on a page); portrait column 55 % on the outer edge (left on a left page, right on a right page); full-image fitted inside the margins on the right page, no header and no folio unless `entries.fullImageHeader: true`; scale = the smaller of the two ratios; the caption (credit, US-030 AC-7) under the image in every slot, its height part of the slot.
- Blank pages the layout adds: US-025's `o2t-blank` (folio only).
- Inside entries: sub-headings small, `outlined: false`, no number, no US-025 break, sticky; lists of up to 10 items `breakable: false`, longer ones split with at least 2 items each side.
- Test interface: `metadata` labelled `<o2t-entry>` (heading, layout used, size `page`/`spread`/`inline`, first page, `asked` and `reason` when replaced) and `<o2t-entry-end>` (heading, last page); `ENTRY_BLANK_PAGE`, `ENTRY_UNPAIRED` facts for the report (#129's `sectionWarnings`).
- `page.facingPages: false`: consecutive pages, no blank page.

### Tests

- `tests/integration/us-031-layouts-pdf.test.ts` (all)
- `tests/support/entries-pdf.ts` (the rig, unchanged)

### SCAR check

- SCAR-021 (self-referential output): placement decides from `measure()` only; one compile, no read-back (the sweep: 120 chapters settle); the tests assert no `layout did not converge`.
- SCAR-017: one blank-page mechanism (`o2t-blank`); one fit rule for every slot.
- SCAR-009, SCAR-010: the helper, the statblock and the body join as blocks; the tests read whole pages.
- SCAR-024, SCAR-032: the measured claims (fit prediction, one-compile placement) are the spike's, with its scope; illustration slots are computed and checked by the tests.
- SCAR-025, SCAR-015: page images, sizes and positions read from the PDF; a rendered check in the manual check.
- SCAR-019: facing pages on and off, `fullImageHeader` on and off, five image ratios, lists of 10 and 11.
- Not applicable: UI SCARs.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
