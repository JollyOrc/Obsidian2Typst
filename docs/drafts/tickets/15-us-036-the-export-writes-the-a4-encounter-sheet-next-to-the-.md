<!-- Filed 2026-11-06 as #136 on the user's go (epic #121, ticket 15 of 16). -->

### User story

[US-036](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-036-encounter-sheet.md), ACs addressed AC-5

### Description

With `entries.encounterSheetFile: true`, the export compiles the A4 sheet as a second compile in its worker and writes `<name> - Encounter Sheet.pdf` and `.typ` next to the book's files; a failed sheet never stops the book.

### Acceptance criteria (from the user story)

Examples use US-030's preset (stats Might, Wits, Speed; box key `vigour`;
track Fine, Hurt, Down, Fading, Gone with SVG icons) with
`headingRules: {Menagerie: entries}`.

- **AC-5 (the A4 file, D56):** With `entries.encounterSheetFile: true`, the
  export also writes `<name> - Encounter Sheet.pdf` and
  `<name> - Encounter Sheet.typ` into the export folder (US-007 AC-1: an
  existing file is overwritten, no other file is touched), whatever the
  book's page size: one A4 portrait page, margins 12 mm (sides, top) and
  10 mm (bottom), rows 91 mm wide in two columns 4 mm apart, box column
  46 mm, as many lines as fit (16 rows with the preset above). With US-007
  AC-1b's rule, the names stay different from the note's files and
  `template.typ`, compared ignoring case (a note `Rules - Encounter Sheet`
  gives `Rules - Encounter Sheet - Encounter Sheet.pdf` for its sheet).
  The sheet is a second compile in the export's worker, after the book's;
  a failed sheet compile gives `ENCOUNTER_SHEET_FAILED` and the book's
  files are written as usual. The preview never shows the A4 file.

## Decisions (answered by the user, 2026-11-06)

1. **Heading level of the sheet page:** the chapter's section level, beside
   the sections and the quick reference in the contents (AC-6).
2. **Boxes under 2.0 mm:** the boxes shrink to fit, with
   `ENCOUNTER_SHEET_SMALL_BOXES` (AC-3); the layout of the row does not
   change.

### Implementation notes

- `src/plugin/run-export.ts` (and the worker): after the book's last compile, `encounterSheetTyp` (#135), one compile with the same fonts and the icon assets, then the two files written with US-007 AC-1's writer (overwrite, no other file touched).
- A failed sheet compile → `ENCOUNTER_SHEET_FAILED`, the book's files written as usual; the preview never compiles the A4 sheet.
- Notice text while compiling: as US-028's (`Compiling…`), no new wording.
- G2 addendum, written first in this ticket (before its code): `tests/plugin/us-036-export-sheet.test.ts` — the export run with the switch on writes the two files with their names; off writes none; a failing sheet compile gives `ENCOUNTER_SHEET_FAILED` and the book's files; the preview path does not compile it. The test map row for AC-5 names it.

### Tests

- `tests/plugin/us-036-export-sheet.test.ts` (new, written first in this ticket; G2 addendum)
- Guards: `tests/plugin/us-007-export-run.test.ts`, `tests/plugin/us-007-disk-writer.test.ts`, `tests/plugin/us-006-export-flow.test.ts`

### SCAR check

- SCAR-003: the export run's test is written before the code (a G2 addendum named in this ticket and in the ledger).
- SCAR-014: overwriting follows US-007 AC-1 (the export folder's files of the same name, nothing else).
- SCAR-012: a manual export into a scratch folder is part of the manual check, with the files listed.
- SCAR-022: the second compile runs where the worker and the fonts are; nothing new on the main thread.
- SCAR-030: the sheet's compile time measured and recorded (one A4 page).
- SCAR-011: names from `exportNames` only (#135).
- Not applicable: 016, 021.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
