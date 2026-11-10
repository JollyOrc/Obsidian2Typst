# US-036 — The encounter sheet

**Status:** Done; amendment for #157 in progress, ticket #163 (2026-11-10: AC-7a, the key line's layout). Before: Done; amendment for #139 Done (0.13.0, released 2026-11-09; M25 passed 2026-11-09 and the user checked a real chapter of 30 spreads; AC-6 — the running header of the sheet page in the book). Before: Done (M21 to M24 passed 2026-11-07; M21's findings and M23's changes merged without a re-run, the user's decision; G1 2026-11-06; decisions 1 and 2 answered the same day, G1 re-check)
**Introduced:** v0.12.0 (planned, with US-030 to US-035)
**Implemented:** v0.12.0 (released 2026-11-07), epic #121 (tickets #122 to #137); test builds `0.12.0-m21.1` (M21 to M24) and `0.12.0-m21.2` (their follow-ups); the amendment for #139 in v0.13.0 (released 2026-11-09), tickets #140 to #145, test build `0.13.0-m25.1` (M25)
**Supersedes:** —

Epic #121, last of seven stories (see US-030). Draft D-21 in
`docs/drafts/entry-layouts-tickets.md`.

---

## Story

**As a** reader running a game with the book,
**I want** a printable sheet of blank tracker rows — a name, the attributes,
the tick boxes, the state track and three attacks per row — as a separate A4
page and as a page in the book,
**so that** I can track several creatures of one kind at the table without
writing in the book.

Decided by the user (D50, D56, 2026-11-05; the row template 2026-11-05 after
a print check; the A4 form 2026-11-06), summarised:

- **Two forms:** a standalone one-page A4 PDF next to the book's PDF, and a
  page of its own in the book after the quick reference. Each has as many
  blank rows as fit.
- **The row:** a name line and small boxes for the attributes; 30 tick boxes
  and every cell of the state track; two attack slots, each a name line and
  a dice field. Unused boxes are struck out by hand.
- **The A4 sheet:** rows two across; on the book page, one column (two across
  when the text width allows rows of at least 88 mm).
- **Print check (2026-11-05):** boxes of 2.0 mm were still fine for a pencil
  at 100 %.

Measured (SCAR-024), with the author's private mockup (a hand-set Typst file
with the same parts; its numbers only, SCAR-035), Typst 0.14.2 CLI:

- **A4** portrait, margins 12 mm at the sides and top, 10 mm at the bottom,
  rows 91 mm wide in two columns 4 mm apart, box column 46 mm (boxes about
  2.6 mm), attacks stacked: the row is 30 mm high; **8 lines × 2 = 16 rows**
  fit under the heading and key, with a 2 mm gap between rows.
- **A5** (105 × 165 mm text area), one column, box column 55 mm (boxes about
  3.2 mm), attacks side by side: **5 rows** fit.
- The row count was computed in the mockup by `measure()` of one row and the
  space left on the page; the same numbers came out under Typst 0.15.1.
- Not measured: the sheet as a second compile inside the plugin's export
  (worker, fonts, file writing), and its time.

---

## Acceptance criteria

Examples use US-030's preset (stats Might, Wits, Speed; box key `vigour`;
track Fine, Hurt, Down, Fading, Gone with SVG icons) with
`headingRules: {Menagerie: entries}`.

### Settings

- **AC-1 (fields):** In the `entries` group (US-030 AC-8's messages and
  Details view):

  | Field | Value | Built-in |
  |---|---|---|
  | `entries.encounterSheet` | switch: the page in the book | `false` |
  | `entries.encounterSheetFile` | switch: the A4 file | `false` |
  | `entries.encounterSheetBoxes` | 15, 30 or 45 | 30 |
  | `entries.encounterSheetText` | `{title, name, attack, dice, rule, credit}` | `{title: "Encounter Sheet", name: "NAME", attack: "ATTACK", dice: "DICE", rule: "", credit: ""}` |

  (Changed after M23, 2026-11-07, at the user's request: the `round` text and
  its write-in line are removed; three attack slots instead of two.)

  `rule` is the one-line marking rule under the icon key; `credit` is the
  icons' credit at the foot (the author's licence text). Both are printed as
  given (escaped, US-013); empty → left out. Example message:
  `encounterSheetBoxes: 20` → `entries.encounterSheetBoxes must be 15, 30 or
  45 (line 4)`.

- **AC-2 (when there is a sheet):** A sheet needs a state track or a box key
  (`entries.statblock.track` or `.boxes`); without either, a switched-on
  sheet is not made and `ENCOUNTER_SHEET_EMPTY` is given once. Both
  switches work independently.

### The row

- **AC-3 (the row, D56):** Every row, framed with a 0.4 pt line in the frame
  colour and 2.5 mm padding, has three lines, 1.6 mm apart:
  1. the `name` label and a write-in line, then for each stat of
     `entries.statblock.stats` its label in upper case and a write-in box of
     7 × 4.5 mm (`NAME ____ MIGHT [ ] WITS [ ] SPEED [ ]`);
  2. `encounterSheetBoxes` tick boxes in rows of 15 (groups of 5, as US-030
     AC-12; 30 → two rows) in the box column, and beside them **every** cell
     of `entries.statblock.track` with its icon (US-030 AC-13);
  3. three attack slots (M23, 2026-11-07), each the `attack` label, a
     write-in line, the `dice` label and a 10 mm write-in line: two side by
     side and the third below when the row is at least 100 mm wide, one
     above the other (1.2 mm apart) otherwise.

  The look (frame, fills, fonts, `colorMode`) is the statblock's (US-030
  AC-15). Box size follows from the box column's width as in US-030 AC-12
  and should be at least 2.0 mm (the print-checked minimum). When the box
  column is too narrow for that, the boxes shrink to fit and the warning
  `ENCOUNTER_SHEET_SMALL_BOXES "<form>": <size> mm (min 2.0)` is given once
  per form (`book` or `A4`), with the size rounded to 0.1 mm (decision 2).
  Example (corrected at #135 to the rule above, measured): a 40 mm text
  area in one column → boxes of about 1.9 mm,
  `ENCOUNTER_SHEET_SMALL_BOXES "book": 1.9 mm (min 2.0)`; a 60 mm area keeps
  the 55 mm box column less the padding (boxes about 3.2 mm, no warning).

- **AC-4 (what is not on the sheet):** No creature data: every row is blank.
  Which cells a creature uses is shown by the quick reference's Track column
  (US-033 AC-10).

### The two forms

- **AC-5 (the A4 file, D56):** With `entries.encounterSheetFile: true`, the
  export also writes `<name> - Encounter Sheet.pdf` and
  `<name> - Encounter Sheet.typ` into the export folder (US-007 AC-1: an
  existing file is overwritten, no other file is touched), whatever the
  book's page size: one A4 portrait page, margins 12 mm (sides, top) and
  10 mm (bottom), rows 91 mm wide in two columns 4 mm apart, box column
  46 mm, as many lines as fit (14 rows with the preset above since M23's
  change; 16 before). With US-007
  AC-1b's rule, the names stay different from the note's files and
  `template.typ`, compared ignoring case (a note `Rules - Encounter Sheet`
  gives `Rules - Encounter Sheet - Encounter Sheet.pdf` for its sheet).
  The sheet is a second compile in the export's worker, after the book's;
  a failed sheet compile gives `ENCOUNTER_SHEET_FAILED` and the book's
  files are written as usual. The preview never shows the A4 file.

- **AC-6 (the page in the book):** With `entries.encounterSheet: true`, each
  entries chapter (US-031 AC-1) gets one sheet page right after its quick
  reference (US-033 AC-9), or after its last entry when the quick reference
  is off; it starts on a new page (any side), its heading
  (`encounterSheetText.title`, at the chapter's section level, decision 1) is in the
  contents. One column at the text width with a 55 mm box column; two
  across, like the A4 file, when the text width allows two rows of at least
  88 mm with a 4 mm gap. As many rows as fit on that one page (5 on the A5
  of the example). The preview shows it (US-012 AC-13: preview = export).
  Amended for #139: the page's running header shows the sheet's title
  (`encounterSheetText.title`; empty title → empty header) at every
  `page.runningHeaderLevel`, never the name of an entry or of the quick
  reference before it (US-033 AC-7 as amended: one rule for the pages an
  entries chapter writes after its last entry). Example: with
  `runningHeaderLevel: 3`, the sheet page after a chapter whose last entry
  is `Bog Wight` shows `Encounter Sheet`, not `Bog Wight` or `Quick
  Reference`.

- **AC-7 (header and key):** Both forms start with the title (no round line
  since M23, 2026-11-07), then a key line: each track cell's icon
  with its label, in track order, then `rule` (if set) on the next line,
  centred, between two rules. `credit` (if set) sits at the foot of the
  page. Example key line: `[Fine-icon] Fine  [Hurt-icon] Hurt  …  [Gone-icon]
  Gone`.

- **AC-7a (the key line's layout; amendment for #157):** The same rule in the
  book page and the A4 file:
  - **An icon never leaves its label:** each cell's icon (4 mm high), a 1 mm
    space and its label form one unbreakable item.
  - **The gap shrinks before the line wraps:** between items the gap is
    4 mm; when the items do not fit the text width with 4 mm, the gap
    becomes `(text width − items' widths) / (n − 1)`, at least 1.5 mm. Only
    when even 1.5 mm does not fit does the key wrap, between items, each
    line starting at the left edge (no gap at a line start).
  - **The icon is centred on the label's x-height**, not standing on the
    baseline: its middle sits half an x-height above the baseline (7 pt
    text: x-height 1.06 mm, the icon reaches 1.47 mm below the baseline).
    The key line stays 4.00 mm high, so AC-8's row counts do not change.
  - Examples (7 pt labels; measured 2026-11-10 with the plugin's compiler
    and bundled fonts; invented labels):
    - `Fine Hurt Down Fading Gone` (5 cells), 105 mm: one line, gap 4 mm
      (as before).
    - `Fine Hurt Down Fading Broken Gone` (6 cells), 95 mm: before, `Gone`'s
      icon at the end of line 1 and its label on line 2; now one line, gap
      4 mm.
    - `Healthy Wounded Staggered Unconscious Dying Dead` (6 cells), 105 mm:
      before, two lines; now one line, gap 3.43 mm.
    - `Fine Hurt Down Fading Broken Dying Lost Gone` (8 cells), 105 mm:
      before, two lines; now one line, gap 1.69 mm; at 95 mm two lines with
      gap 1.5 mm, the second line starting at the left edge.
    - A4 file (186 mm), any of these: one line, gap 4 mm.
  - Row counts with the change (AC-8): A4 14, A5 5, the US-036 integration
    tests unchanged (measured with the change in place).
  - **The sheet records its key** in its `<o2t-sheet>` fact, beside the
    form, rows, columns and box size (AC-3): `key: (gapMm, lines, shiftMm)`
    — the gap used, the number of key lines and how far the icon is moved
    below the baseline. Read by the tests (`us-036-sheet-key.test.ts`,
    through the plugin's compiler); no warning is made from it.

- **AC-8 (row count):** The number of rows is computed inside the compile:
  `measure()` of one row at its width, then the most rows (or lines of two)
  that fit the space below the key and above the credit with a 2 mm gap.
  Measured examples: A4 16 rows, A5 5 rows (with the example's three stats and
  five track cells). Re-measured after M23's change (three attack slots, no
  round line, 2026-11-07): A4 14 rows (12 with a rule and a credit), A5 5
  rows.

### Composed cases and tests

- **AC-9 (composed, SCAR-002):**
  - no stats in the preset: line 1 has only the name line;
  - a track of 7 cells: line 2's cells share the remaining width, each at
    least 4.5 mm wide; with less room the cells wrap to a second line under
    the boxes;
  - `page.facingPages: false`: the book page is just the next page;
  - two entries chapters: each has its own sheet page; the A4 file is one
    file for the whole export, its key from the preset (not per chapter);
  - `colorMode: grayscale`: the sheet in gray as the statblock.

- **AC-10 (tests, SCAR-019, SCAR-015):** `encounterSheetBoxes` 15, 30, 45;
  each switch on and off; text fields set and empty; facing pages on and
  off; A4 and A5 and a wide text area (two across in the book). The tests
  read from the PDFs: the page size, the number of rows and of boxes and
  cells per row, the smallest box size, the key's labels and the A4 file's
  name and its one page; and the warnings as an exact list. A manual check
  prints the A4 file at 100 % (its own `M`-file, SCAR-029).

---

## Decisions (answered by the user, 2026-11-06)

1. **Heading level of the sheet page:** the chapter's section level, beside
   the sections and the quick reference in the contents (AC-6).
2. **Boxes under 2.0 mm:** the boxes shrink to fit, with
   `ENCOUNTER_SHEET_SMALL_BOXES` (AC-3); the layout of the row does not
   change.

Amendment for #157 (answered by the user, 2026-11-10), after the measured
options were put:

3. **Breaking of the key line:** unbreakable icon-and-label items; the gap
   shrinks from 4 mm to 1.5 mm before the line wraps between items (not a
   fixed 2.5 mm gap; measured over 16 cases: wraps in 2 against 3).
4. **The icon's height and place:** 4 mm, centred on the x-height (option
   A; not 4 mm on the cap height, 3 mm, 2.5 mm or the details row's 0.95 em,
   which shorten the key line and could change AC-8's counts).
5. **Checks:** automated PDF and compile tests only, no manual check for
   this amendment.

---

## Notes

- The author's mockup lives in the private spec repository; this story uses
  its sizes only.

---

## Related tickets

<!-- Filled in at step 3. Draft: D-21. -->
- #143 (AC-6), #145; amendment for #139.
- Amendment for #157 (AC-7a): bug #157, ticket #163.
