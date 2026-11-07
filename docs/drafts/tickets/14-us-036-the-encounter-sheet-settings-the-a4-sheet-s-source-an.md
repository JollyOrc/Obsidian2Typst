<!-- Filed 2026-11-06 as #135 on the user's go (epic #121, ticket 14 of 16). -->

### User story

[US-036](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-036-encounter-sheet.md), ACs addressed AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8, AC-9, AC-10

### Description

Generate the encounter sheet: its settings and messages, the Typst source of the A4 sheet (two across, as many rows as fit) and the page in the book after the quick reference (one column, two across when wide enough), with the row of the story, the header and key, and the small-boxes warning.

### Acceptance criteria (from the user story)

Examples use US-030's preset (stats Might, Wits, Speed; box key `vigour`;
track Fine, Hurt, Down, Fading, Gone with SVG icons) with
`headingRules: {Menagerie: entries}`.

- **AC-1 (fields):** In the `entries` group (US-030 AC-8's messages and
  Details view):

  | Field | Value | Built-in |
  |---|---|---|
  | `entries.encounterSheet` | switch: the page in the book | `false` |
  | `entries.encounterSheetFile` | switch: the A4 file | `false` |
  | `entries.encounterSheetBoxes` | 15, 30 or 45 | 30 |
  | `entries.encounterSheetText` | `{title, round, name, attack, dice, rule, credit}` | `{title: "Encounter Sheet", round: "Round", name: "NAME", attack: "ATTACK", dice: "DICE", rule: "", credit: ""}` |

  `rule` is the one-line marking rule under the icon key; `credit` is the
  icons' credit at the foot (the author's licence text). Both are printed as
  given (escaped, US-013); empty → left out. Example message:
  `encounterSheetBoxes: 20` → `entries.encounterSheetBoxes must be 15, 30 or
  45 (line 4)`.

- **AC-2 (when there is a sheet):** A sheet needs a state track or a box key
  (`entries.statblock.track` or `.boxes`); without either, a switched-on
  sheet is not made and `ENCOUNTER_SHEET_EMPTY` is given once. Both
  switches work independently.

- **AC-3 (the row, D56):** Every row, framed with a 0.4 pt line in the frame
  colour and 2.5 mm padding, has three lines, 1.6 mm apart:
  1. the `name` label and a write-in line, then for each stat of
     `entries.statblock.stats` its label in upper case and a write-in box of
     7 × 4.5 mm (`NAME ____ MIGHT [ ] WITS [ ] SPEED [ ]`);
  2. `encounterSheetBoxes` tick boxes in rows of 15 (groups of 5, as US-030
     AC-12; 30 → two rows) in the box column, and beside them **every** cell
     of `entries.statblock.track` with its icon (US-030 AC-13);
  3. two attack slots, each the `attack` label, a write-in line, the `dice`
     label and a 10 mm write-in line: side by side when the row is at least
     100 mm wide, one above the other (1.2 mm apart) otherwise.

  The look (frame, fills, fonts, `colorMode`) is the statblock's (US-030
  AC-15). Box size follows from the box column's width as in US-030 AC-12
  and should be at least 2.0 mm (the print-checked minimum). When the box
  column is too narrow for that, the boxes shrink to fit and the warning
  `ENCOUNTER_SHEET_SMALL_BOXES "<form>": <size> mm (min 2.0)` is given once
  per form (`book` or `A4`), with the size rounded to 0.1 mm (decision 2).
  Example: a 60 mm text area in one column → boxes of about 1.7 mm,
  `ENCOUNTER_SHEET_SMALL_BOXES "book": 1.7 mm (min 2.0)`.

- **AC-4 (what is not on the sheet):** No creature data: every row is blank.
  Which cells a creature uses is shown by the quick reference's Track column
  (US-033 AC-10).

- **AC-6 (the page in the book):** With `entries.encounterSheet: true`, each
  entries chapter (US-031 AC-1) gets one sheet page right after its quick
  reference (US-033 AC-9), or after its last entry when the quick reference
  is off; it starts on a new page (any side), its heading
  (`encounterSheetText.title`, at the chapter's section level, decision 1) is in the
  contents. One column at the text width with a 55 mm box column; two
  across, like the A4 file, when the text width allows two rows of at least
  88 mm with a 4 mm gap. As many rows as fit on that one page (5 on the A5
  of the example). The preview shows it (US-012 AC-13: preview = export).

- **AC-7 (header and key):** Both forms start with the title, a `round` label
  and a write-in line on the right, then a key line: each track cell's icon
  with its label, in track order, then `rule` (if set) on the next line,
  centred, between two rules. `credit` (if set) sits at the foot of the
  page. Example key line: `[Fine-icon] Fine  [Hurt-icon] Hurt  …  [Gone-icon]
  Gone`.

- **AC-8 (row count):** The number of rows is computed inside the compile:
  `measure()` of one row at its width, then the most rows (or lines of two)
  that fit the space below the key and above the credit with a 2 mm gap.
  Measured examples: A4 16 rows, A5 5 rows (with the example's three stats and
  five track cells).

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

## Decisions (answered by the user, 2026-11-06)

1. **Heading level of the sheet page:** the chapter's section level, beside
   the sections and the quick reference in the contents (AC-6).
2. **Boxes under 2.0 mm:** the boxes shrink to fit, with
   `ENCOUNTER_SHEET_SMALL_BOXES` (AC-3); the layout of the row does not
   change.

### Implementation notes

- Settings: `entries.encounterSheet`, `entries.encounterSheetFile` (switches), `entries.encounterSheetBoxes` (15, 30, 45; built-in 30), `entries.encounterSheetText` (title, round, name, attack, dice, rule, credit; English built-ins, rule and credit empty), with their messages; no sheet and `ENCOUNTER_SHEET_EMPTY` without a track and a box key.
- `src/core/entries/sheet.ts` (new): `encounterSheetTyp(entries, {colorMode})` → `{typ, warnings}` for the A4 sheet; the row helper shared with the book page and with the statblock's box and cell drawing (#125).
- The row: name line and 7 × 4.5 mm stat boxes; boxes in rows of 15 and every track cell; two attack slots, side by side from 100 mm row width, stacked below; row count by `measure()` of one row against the page's room; 2 mm gap.
- The book page: after the quick reference (or the last entry), its heading at the chapter's section level (decision 1), in the contents.
- Test interface: `<o2t-sheet>` (form, rows, columns, boxMm) and `<o2t-sheet-row>` (boxes, cells, stats, attacks).
- `src/core/entries/report.ts`: `sheetWarnings(sheets)` → `ENCOUNTER_SHEET_SMALL_BOXES "<form>": <size> mm (min 2.0)` (decision 2).
- `src/core/compile` `exportNames`: `sheetTyp`, `sheetPdf` (`<base> - Encounter Sheet.*`), pairwise different from the others ignoring case.

### Tests

- `tests/unit/us-036-sheet.test.ts` (all)
- `tests/integration/us-036-sheet-pdf.test.ts` (all)

### SCAR check

- SCAR-017: one row drawing for both forms, and one box/cell drawing with the statblock.
- SCAR-011: the sheet's file names checked pairwise with the book's and the template copy, ignoring case.
- SCAR-019: box counts 15/30/45; switches; text set, empty and translated; colour and grayscale.
- SCAR-021: the row count is measured, not computed from fixed heights; placed after the entries, it does not move them.
- SCAR-024: the counts (A4 16, A5 5) are the mockup's, re-measured under Typst 0.14.2.
- SCAR-027: `exportNames` gains fields; its callers keep the existing ones.
- Not applicable: UI SCARs.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
