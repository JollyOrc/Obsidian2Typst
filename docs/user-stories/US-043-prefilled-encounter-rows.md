# US-043 — Prefilled encounter rows

**Status:** Done (released in 0.17.0, 2026-11-25; M34 passed). Before: Ready (G1 2026-11-25; D1, D2 decided by the user 2026-11-25)
**Introduced:** v0.17.0 (planned)
**Implemented:** —
**Supersedes:** —

Cross-plugin: control project `spec/Encounter Sheets Questions.md`, ES-1 to
ES-17 (answered by the user 2026-11-25: "Yes, all proposals"). Writer: Vault
Compiler US-9.6. Contract: [`docs/technical/encounter-block.md`](../technical/encounter-block.md).
Working model: the user's one-off bridge sheet (a hand-set Typst file, its
look only; print-checked by the user at 100 %, "looks good", 2026-11-25).

---

## Story

**As a** referee preparing a session,
**I want** every room of an adventure exported as encounter rows already
filled with its creatures — name, attributes, the right number of tick boxes,
the creature's own track and its attacks,
**so that** I can print the sheets beforehand and only tick boxes at the table.

---

## Today (measured 2026-11-25, Obsidian2Typst 0.16.0 core in Node)

- An `[!encounter]` callout is drawn as the default box titled `Encounter`
  with `CALLOUT_TYPE_UNKNOWN` (US-016).
- The encounter sheet of US-036 has blank rows only (its AC-4); it stays as
  it is.
- No `o2t-encounter` reader exists.

---

## Acceptance criteria

Examples use US-030's example preset (stats Might, Wits, Speed; traits Move,
Guard; box key `vigour`; track Fine, Hurt, Down, Fading, Gone with SVG icons;
`trackKey: states`; `trackDefault: [Fine, Hurt, Down, Gone]`) and the block
of the contract page, unless they say otherwise. All names are invented
(SCAR-035).

### Reading the block

- **AC-1 (one reader, data only):** A fenced block with the info string
  `o2t-encounter` is found and taken out of the tree before any other step
  reads it, in the same pass as `o2t-entry` and `o2t-details` (US-030 AC-1,
  US-038; SCAR-034, SCAR-039); its YAML is never printed. Where it stood, the
  rows are drawn (AC-5): an emptied node of the same language keeps the
  place, read only by the encounter emitter (refined at #184).
- **AC-2 (rows from counts):** `count: "2"` → 2 rows; `"1d4"` → 4 rows;
  `"d6"` → 6; `"3d6"` → 18; `"0"` → no row, no warning. A count that is none
  of these forms (`"two"`, `"1d"`, `"-1"`, `2` as a number) → no rows for that
  line and `ENCOUNTER_COUNT_INVALID "Fen Hare": two (line 7)`. More than 99
  rows from one line → 99 rows and `ENCOUNTER_COUNT_CAPPED "Fen Hare": 3d100 → 99`.
- **AC-3 (labels):** one row → the name (`Lost Pilgrim`); more → the name and
  its number, `Fen Hare 1`, `Fen Hare 2`. Invariant (SCAR-011): **no two rows
  of one block have the same label**. A generated label that equals another
  row's label takes the next free number: a block with `Fen Hare 2` (count 1)
  and `Fen Hare` (count 3) gives `Fen Hare 2`, `Fen Hare 1`, `Fen Hare 3`,
  `Fen Hare 4`. A dice count adds `1d4 (up to 4)` before the note on the first
  row of that line only.
- **AC-4 (data):** `data` is read with the `o2t-entry` reader (US-030 AC-5 to
  AC-7: the same value rules and warnings, the note named by the row's `name`).
  No `data` → a **blank row** (AC-6). A `data` map with no stat, no box value
  and no attack → a blank row too, with its name.

### The row

- **AC-5 (the prefilled row; ES-14):** framed as US-036 AC-3 (0.4 pt, 2.5 mm
  padding, the statblock look of US-030 AC-15: fonts, sizes, colours,
  `colorMode`), four lines, 1.6 mm apart:
  1. the **label** in the band font, bold; under it the **note** (if any) in
     the text font, italic; to the right each stat of `entries.statblock.stats`
     with its label in upper case and its value inside a 7 × 4.5 mm box (a
     missing value → an empty box); then, on its own line, the **traits**
     present in `data` as `Move 5 · Guard 2` (none → no line);
  2. **exactly as many tick boxes as the value of the box key** (`vigour: 11`
     → 11), in rows of 15 in groups of 5 (US-030 AC-12), box size from the box
     column as US-036 AC-3; beside them **the creature's own track** (US-030
     AC-13: `trackKey` value, else `trackDefault`; `none` → no cells, the
     place left empty, decision D2);
  3. **every attack**, one per line, its text before the first `: ` in the
     text style and the rest in bold (the split of US-030's statblock line 4), nothing cut: a
     long rest wraps inside the row;
  4. a **notes line**: the label `NOTES` and a write-in line at least 4.5 mm
     high.
  Box values: `vigour: 0` → no boxes and no box line gap; `1` → one box;
  `15` → one full row; `16` → 15 + 1; `45` → three rows; `46` or more → 45
  boxes and `ENCOUNTER_BOXES_CAPPED "Bog Wight": 46 → 45`.
- **AC-6 (the blank row):** a row without data is US-036's row
  (`encounterSheetBoxes` boxes, every track cell, three attack slots) with the
  label written on its name line and the note under it, plus AC-5's notes line.
- **AC-7 (writing space, SCAR-048):** the tick boxes, the track cells (their
  icons are the track's own, faint as in US-036) and the notes line hold no
  text and no other mark; every label stands beside its box or line, never
  inside. Checked by program on the PDF: no glyph of the row inside a box, a
  cell or the 4.5 mm above the notes line.
- **AC-8 (layout):** at the text width; **two rows across** when two rows of
  at least 88 mm and the 4 mm gap fit (US-036 AC-6's rule), else one; rows do
  not break, the list breaks between rows; 2 mm between rows. A `title` is
  printed above the first row in the band font and kept on the page with it.
  Examples (measured at #185, 2026-11-25, the plugin's compiler and bundled
  fonts, US-030's example preset, margins 12/12/12/10 mm): A4 (186 mm) → two
  across, 91 mm each; A5 (124 mm) → one across at 124 mm. Row heights: a
  prefilled row with a traits line and one attack 29.7 mm, one with two
  attacks 29.1 mm, a blank row 40.7 mm; 16 prefilled rows on an A4 page (8
  lines of two), 6 on an A5 page.

### Placement and composed cases

- **AC-9 (composed, SCAR-002):**
  - two blocks under one heading → two lists, one after the other;
  - a block under an H2 with US-025's page break before H2 → each room on a
    new page (ES-15, the corrected level: the room heading is H2 in the
    compile, measured M1);
  - a block inside a quote, a callout or a list item → dropped with
    `ENCOUNTER_IN_CONTAINER (line 12)`, as US-038 does for `o2t-details`;
  - a block inside a glossary term (US-017) → the same;
  - in an entries chapter (US-031) → drawn where it stands; not an entry, not
    in the quick reference;
  - `colorMode: grayscale` → the row in grey as the statblock;
  - a preset without `entries.statblock` → blank rows only, with the names,
    and one `ENCOUNTER_NO_STATBLOCK` warning;
  - a row label with Typst-special text (`#Fen *Hare* [x]`, `$5`) → printed as
    written (escaped, US-013).
- **AC-10 (preview):** the preview panel shows the rows as the PDF (US-012
  AC-13). In Obsidian's own reading view the block is a code block (decision
  D1).

### Settings

- **AC-11:** no new preset field. The row reads `entries.statblock` and
  `entries.encounterSheetBoxes` (blank rows). Examples at more than the
  default (SCAR-019): `encounterSheetBoxes` 15, 30, 45 for blank rows; the
  box key's value 0, 1, 15, 16, 45, 46; track `none`, one cell, five, seven.

### Tests

- **AC-12 (SCAR-015, SCAR-046):** the tests read the PDF: per row the label,
  the number of boxes and of cells, the attack texts, the notes line; the
  warnings as an exact list; one test compiles 300 rows (the largest real
  room list has 18 from one line; a whole adventure about 280) and states its
  time. A manual check (own M-file, SCAR-029) prints a page at 100 % and
  writes on it with a pencil.

---

## Interface (G2, 2026-11-25)

What the tests call; fixed at G2, each name new (SCAR-017: one place each).

- `src/core/markers` exports `ENCOUNTER_BLOCK_LANG` (`'o2t-encounter'`),
  `scanEncounterBlocks(root)` → `{root, found, warnings}` (as
  `scanDetailsBlocks`) and `readEncounterBlock(found)` → `{title: string |
  null, lines: {name, count, note: string | null, data: map | null, line}[],
  warnings}`.
- `src/core/encounter/model.ts` exports `parseCount(value: unknown): number
  | null` (AC-2; uncapped) and `encounterModel(read, entries, {blankBoxes})`
  → `{title, rows: {label, note, blank, stats: string[], traits: string[],
  boxes, cells: string[], attacks: {name, dice}[], slots}[], warnings}`.
- Labels (AC-3), stated as the rule the tests pin: rows are labelled in
  block order; a line of one row takes the plain name, a line of more
  takes `name 1`, `name 2`, …; whenever a label is already taken (by any
  row's plain name in the block or an earlier label), the next free number
  of that name is used (counting from 1 for a numbered line, from 2 for a
  repeated one-row name). Two lines `Fen Hare` × 1 → `Fen Hare`, `Fen Hare 2`.
- Typst: one call `#o2t-encounter(…)` per block (`ENCOUNTER_HELPER`), its
  definition written only when the note has a block; each row records
  `<o2t-encounter-row>` (label, note, blank, stats, traits, boxes, cells,
  attacks as `(name, dice)`, slots, `zones` and `texts` as rectangles in mm
  from the row's corner: zones = each box, each cell, the notes line's clear
  height, last), each block `<o2t-encounter>` (title, rows, columns, rowMm,
  pages, heightsMm). Read by `tests/support/entries-pdf.ts`.
- Warning texts (code, then message):
  - `ENCOUNTER_YAML_INVALID` `The o2t-encounter block is not a map with a list of rows: <reason>`
  - `ENCOUNTER_KEY_UNKNOWN` `Unknown keys in the o2t-encounter block: colour, size`
  - `ENCOUNTER_COUNT_INVALID` `"Fen Hare": two`
  - `ENCOUNTER_COUNT_CAPPED` `"Fen Hare": 3d100 → 99`
  - `ENCOUNTER_BOXES_CAPPED` `"Bog Wight": 46 → 45`
  - `ENCOUNTER_IN_CONTAINER` `An o2t-encounter block inside a quote, callout, list item or glossary term is left out`
  - `ENCOUNTER_NO_STATBLOCK` `The preset has no entries.statblock; the encounter rows are blank`
  Each with the block's first source line (rule 8).
- Tests: `tests/unit/us-043-encounter-read.test.ts`, `…-row.test.ts`,
  `…-place.test.ts`, `tests/integration/us-043-encounter-pdf.test.ts`;
  support `tests/support/encounter.ts`.

---

## Decisions (answered by the user, 2026-11-25)

- **D1 Preview in Obsidian's reading view:** the compiled file shows the
  block as a code block (as `o2t-details` before its processor). **No
  processor in this story**; the sheets are read as PDF. The user wants a
  follow-up story: the rows usable in the vault like the encounter tracker
  (online play), noted in the control project as a later story.
- **D2 Text for a creature without a track:** the bridge printed
  `NO CONDITIONS`. **The place stays empty** ("empty is best").

---

## Notes

- US-036 (the blank sheet) is unchanged; its AC-4 ("no creature data") holds
  for the blank sheet only.
- Not measured (SCAR-024): the row heights and per-page counts (G2, with the
  plugin's compiler and bundled fonts).

---

## Related tickets

- #184 T1: read the block (AC-1 to AC-4, AC-5/6 model, AC-11)
- #185 T2: draw the rows (AC-5 to AC-10, AC-12)
- #186 T3: test build and manual check, end to end with Vault Compiler [#136](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/136)
