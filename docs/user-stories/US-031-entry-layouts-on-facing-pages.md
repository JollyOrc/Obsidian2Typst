# US-031 — Entry layouts on facing pages

**Status:** Ready (G1 2026-11-06; decisions 1 to 3 answered the same day, G1 re-check)
**Introduced:** v0.12.0 (planned, with US-030)
**Implemented:** —
**Supersedes:** —

Epic #121, second of seven stories (see US-030). Drafts D-06, D-07, D-08,
D-10 in `docs/drafts/entry-layouts-tickets.md`. Builds on US-030 (the entry
and its statblock); US-032 adds fit, overflow and the automatic choice;
US-033 adds section openers, navigation and the quick reference.

---

## Story

**As an** author of a catalogue chapter,
**I want** each entry laid out on its own page or across a facing-page
spread, with its illustration placed as the entry's `layout` says, and short
entries sharing a spread,
**so that** large entries get a full spread, short ones don't waste half of
one, and no entry is laid out by hand.

Decided by the user (G0 for #121, 2026-11-05; 2026-11-06), summarised:

- **Seven layouts** in two sizes: spread-sized (`full-image`,
  `spread-landscape`, `spread-portrait`, `spread-text`) and page-sized
  (`page-landscape`, `page-portrait`, `page-text`); `auto` lets US-032
  choose. An illustration is fitted, never cropped, and its slot shrinks to
  it (D21); a portrait illustration goes on the outer edge (D22).
- **Which chapter (G0-C2, revised 2026-11-06):** the entries chapter is a
  heading matched by a `headingRules` key with the rule `entries` (US-017);
  an entry outside it keeps its statblock but gets no chapter layout.
- **Blank pages** added for entries show the folio only (G0-C11).
- **Inside entries**, US-028's float and move of body images is off: the
  layout places the illustration (G0-C5).
- **Small headings and lists inside an entry** (D25, D26): sub-headings are
  small, outside the TOC and the running header, and never break a page;
  lists of up to 10 items are not split.

Measured (SCAR-024; `docs/technical/spike-entry-measure.md`, 2026-11-06,
Typst 0.14.2 CLI and the bundled WASM compiler, identical results; synthetic
A5 chapters, built-in fonts, text only, no illustrations):

- `measure()` of an entry at the text width predicts whether it fits one
  page exactly (66 of 66 entries that fit, every entry just over a page
  needs two; 2 000 entries).
- Placement with parity page breaks only (`pagebreak(to: "even")`,
  `pagebreak(weak: true, to: "odd")`), no `locate`/`query`, keeps every rule
  of this story and US-033 in one compile: 120 chapters (1 to 3 sections ×
  1 to 10 entries × 4 seeds), 1 320 entries, 0 compiles that did not
  converge, also after entries that overflow to a third page.
- Not measured: illustration slots (landscape, portrait, full page) and
  `justification-limits` in the portrait column (US-034).

---

## Acceptance criteria

The examples use a preset with `headingRules: {Menagerie: entries}`,
`page.facingPages: true` (US-009), folios on (US-019), and this outline
(entries are headings with an `o2t-entry` block, US-030; the layout in
brackets):

```
# Menagerie
## Beasts
### Fen Hare      [page-text]
### Marsh Owl     [page-landscape]
### Cave Wyrm     [spread-landscape]
### Reed Cat      [page-portrait]
## Horrors
### Bog Wight     [full-image]
```

### The chapter

- **AC-1 (the entries chapter):** US-017's `headingRules` gains the rule name
  `entries` next to `glossary` (US-017), `colophon` and `back-notes`
  (US-026). The message of an invalid value becomes `headingRules.<text>
  must be a rule name: glossary, colophon, back-notes, entries or none`
  (today `… glossary, colophon, back-notes or none`, in
  `src/core/presets/parse.ts` and asserted by four tests in
  `us-017-heading-rules.test.ts` and one in `us-026-book-parts.test.ts`;
  SCAR-027). A heading whose plain text matches a key with
  the rule `entries` (matched as US-017 AC-2) starts an entries chapter that
  runs to the next heading of the same or a higher level. There is no
  built-in key (G0-C1). Inside it:
  - a heading with an `o2t-entry` block is an **entry**; an entry inside
    another entry (a deeper heading with its own block, US-030 AC-20) is a
    **nested entry**: it gets its statblock inline in the parent's text and
    no page or spread of its own; its illustration is not placed, and a
    `layout` other than `auto` gives `ENTRY_NESTED_LAYOUT "<heading>":
    <value>` (decision 3);
  - any other heading that holds entries is a **section** (`## Beasts`);
  - pairing (AC-8) never crosses a section heading.

  A matched heading whose chapter holds no entry is ignored (no warning).
  Several keys give several entries chapters
  (`{Menagerie: entries, Relics: entries}`).

- **AC-2 (entries outside the chapter):** An entry outside every entries
  chapter keeps its heading, statblock and body (US-030) and gets none of
  this story's layout: no page or spread, no left-page start, no pairing, its
  illustration not placed (it stays out of the text). Warning:
  `ENTRY_OUTSIDE_CHAPTER "<heading>"` with its line. Example: `### Fen Hare`
  also embedded under `# Example Crypt` → laid out there as text with its
  statblock, `ENTRY_OUTSIDE_CHAPTER "Fen Hare"`.

### The layout value

- **AC-3 (values):** The block's key `layout` takes one of the seven layouts
  or `auto`; missing means `auto` (decision 1). `auto` and every replaced value are
  decided by US-032; until US-032, `auto` is `page-text` when the entry fits
  one page (`measure()`, AC-14) and `spread-text` otherwise. Any other value
  gives `ENTRY_LAYOUT_UNKNOWN "<heading>: <value>"` and is treated as `auto`.
  Example: `layout: sideways` → `ENTRY_LAYOUT_UNKNOWN "Fen Hare: sideways"`.

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

### Spread-sized entries

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

### Page-sized entries

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

### Inside an entry

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

- **AC-13 (images in the body):** Images in an entry's body (not the
  illustration) are drawn as US-003 draws them, without US-028's shrink,
  float or move (G0-C5).

### How it is placed

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

### Composed cases (SCAR-002)

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

---

## Decisions (answered by the user, 2026-11-06)

1. **`auto` before US-032:** the simple rule of AC-3 (`page-text` when the
   entry fits one page, `spread-text` otherwise); US-032 replaces it.
2. **Caption in the portrait column:** under the image, as in every slot
   (AC-7).
3. **Nested entries:** inline, no page or spread of their own; an explicit
   layout gives `ENTRY_NESTED_LAYOUT` (AC-1).

---

## Notes

- AC-7's portrait example is to be checked against the fixture at G2 (the
  slot sizes are computed, not measured).

---

## Related tickets

<!-- Filled in at step 3. Drafts: D-06, D-07, D-08, D-10. -->
