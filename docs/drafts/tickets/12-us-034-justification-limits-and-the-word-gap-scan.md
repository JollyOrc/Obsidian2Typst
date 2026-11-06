<!-- Filed 2026-11-06 as #133 on the user's go (epic #121, ticket 12 of 16). -->

### User story

[US-034](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-034-print-checks-resolution-and-word-gaps.md), ACs addressed AC-5, AC-6, AC-7, AC-8, AC-10, AC-11, AC-12, AC-13

### Description

Set narrow columns (the portrait column and the lede column) with the preset's `justification-limits`, and after the export's last compile scan the PDF for justified lines whose widest gap is over `entries.maxWordGap`, quoting the line.

### Acceptance criteria (from the user story)



- **AC-5 (settings):** Two `entries` fields (US-030 AC-8's messages and
  Details view):

  | Field | Value | Built-in |
  |---|---|---|
  | `entries.narrowJustification` | `{spacing: {min, max}, tracking: {min, max}}` (percent; em) | `{spacing: {min: 80, max: 150}, tracking: {min: -0.01, max: 0.03}}` |
  | `entries.maxWordGap` | whole percent, 100 to 1000; `0` = no scan | 200 |

  Example message: `maxWordGap: 50` → `entries.maxWordGap must be 0 or a
  whole number from 100 to 1000 (line 4)`.

- **AC-6 (narrow columns):** Text in a column narrower than 60 % of the text
  width (a named constant; today the 45 % columns of `page-portrait` and
  `spread-portrait`, US-031, and the 45 % lede column beside the statblock,
  US-030 AC-16, decision 2) is set with
  `par(justification-limits: (spacing: (min: 80%, max: 150%), tracking:
  (min: -0.01em, max: 0.03em)))` from `entries.narrowJustification`;
  full-width text is not.

- **AC-7 (the scan):** After the export's last compile (US-028's settle loop
  included), in the compile worker, the plugin reads the PDF: every text line
  (text runs on one baseline in one column) whose spaces carry `TJ`
  adjustments is measured; each gap is computed as in the measured formula
  above; a line whose widest gap is over `entries.maxWordGap` gives
  `TEXT_WIDE_GAP "<where>": "<line text>" (<gap> %)`. `<where>` is the
  entry's heading when the line is on an entry's pages (US-031's real
  positions), else `p. <folio>`. Runs on one baseline separated by a gap wider
  than the column gutter are different lines (two columns are never joined).
  Header and footer artifacts are skipped. Examples:
  `TEXT_WIDE_GAP "Reed Cat": "Reed cats are quiet" (264 %)`;
  `TEXT_WIDE_GAP "p. 41": "Every rule has" (231 %)`.

- **AC-8 (export only, G0-C10):** The preview never scans; the export always
  does unless `entries.maxWordGap: 0`. `TEXT_WIDE_GAP` never stops an
  export, also in strict mode (as decision 1). A failed scan (an unreadable PDF part)
  gives one `TEXT_GAP_SCAN_FAILED` and the export completes.

- **AC-10 (measurement is pinned):** An integration test compiles a line set
  with `text(spacing: 200%)` and one with `text(spacing: 300%)` with the
  bundled compiler and expects 200 % and 300 % (±2 %). A Typst upgrade that
  changes how the PDF is written fails this test.

- **AC-11 (time):** The scan of a generated 400-page text PDF takes less than
  2 s in the test (measured 173 ms; the bound is generous on purpose,
  SCAR-030), and runs in the worker so Obsidian's main thread is never
  blocked longer than 100 ms by it (governance limit).

- **AC-12 (composed, SCAR-002):**
  - a line in a callout box (US-016) or a quote: measured like body text;
    `<where>` as AC-7;
  - a table cell (US-005): cells are columns of their own; a cell's line is
    measured within its cell;
  - footnotes: measured; `<where>` is the page;
  - the statblock (US-030), the quick reference (US-033) and the encounter
    sheet (US-036): not justified, so no adjustments and no warning;
  - an image drawn by US-028's float: its drawn width is the floated one.

- **AC-13 (tests, SCAR-019):** `images.minDpi` 0, 1, 120, 300, 2400;
  `entries.maxWordGap` 0, 100, 200, 1000; `narrowJustification` built-in and
  one other; the calibration pin; a generated narrow-column line known to gap
  (invented words, D-03) warns, full-width fixture text does not at 200 %;
  two columns on one baseline never joined; the warnings as an exact list
  (SCAR-038), on the generated fixture.

## Decisions (answered by the user, 2026-11-06)

1. **Strict mode:** neither `IMAGE_LOW_DPI` nor `TEXT_WIDE_GAP` stops an
   export (AC-4, AC-8); print checks are fixed at the author's pace.
2. **The lede column:** gets the narrow-column limits like every column
   under 60 % (AC-6); the scan shows whether it helps.

### Implementation notes

- Settings: `entries.narrowJustification` (spacing and tracking limits; min not above max) and `entries.maxWordGap` (0 or 100 to 1000, built-in 200), with their messages.
- Narrow columns (under 60 % of the text width, a named constant): `par(justification-limits: …)` from the preset; the lede column included (decision 2).
- `src/core/checks/print.ts`: `scanWordGaps(pdf, {maxWordGap})` on the core reader (#131): justified lines (space glyph followed by a `TJ` adjustment), gap % = (advance − adjustment) / advance × 100; runs on one baseline split by a gap wider than the column gutter; header and footer artifacts skipped; `TEXT_WIDE_GAP "<where>": "<line>" (<n> %)` with `<where>` the entry (by its page range) or `p. <folio>`; unreadable input → one `TEXT_GAP_SCAN_FAILED`, never a throw.
- Plugin: export only, after the last compile (US-028's loop included), in the compile worker; never in the preview; never stops an export.
- The fixture's fixed gap paragraph (US-024 decision 1, #122) gets its guard test here: it must still gap.

### Tests

- `tests/unit/us-034-print-checks.test.ts`: the AC-5 and AC-8 tests
- `tests/integration/us-034-print-pdf.test.ts`: the AC-6, AC-7, AC-10, AC-11 and AC-12 tests
- New in this ticket (the fixture exists after #122): a test that the fixture's gap paragraph warns (US-034 AC-13, US-024 decision 1)

### SCAR check

- SCAR-028: the scanner has two independent oracles: the calibration pin (known spacing) and two columns never joined.
- SCAR-030: the scan's time bound (2 s on 400 pages, measured 173 ms) is generous on purpose; it runs in the worker (100 ms main-thread limit).
- SCAR-001: the scanner's arithmetic documented with the reader.
- SCAR-032: the proof's 7 → 2 lines is one column; the tests do not rely on it.
- SCAR-019: `maxWordGap` 0, 100, 200, 1000 and refused values; `narrowJustification` built-in and another.
- SCAR-022: the scan runs where the PDF bytes are (the worker), after the last compile.
- Not applicable: UI SCARs, 021.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
