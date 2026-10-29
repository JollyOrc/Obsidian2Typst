# TICKET-080 — The Book rows (plugin)

**Status:** Done (2026-10-28)
**User story:** [US-026](../user-stories/US-026-book-parts-and-signatures.md)
**ACs addressed:** AC-9 (the rows), AC-10 (the preview)
**Depends on:** TICKET-079 (the fields), TICKET-076 (the dropdown kind)
**SCARs:** SCAR-016, SCAR-017, SCAR-019, SCAR-023

---

## Description

Five Defaults rows in the order of the story: `Pages per signature`
(dropdown `0`, `4`, `8`, `16`, `32`, saved as a number), `Roman folios in
the front matter` (switch), `First chapter`, `Colophon heading`, `Back notes
heading` (dropdowns), after the break rows.

---

## Implementation notes

- `src/plugin/settings/row-data.ts`: the five rows after `Break before H6`;
  the numeric save of the dropdown kind (TICKET-076) is used for the first
  time.
- The style panel and the details pop-up draw the rows through the shared
  module (no change).

### Guards searched before the ticket (SCAR-023)

- `tests/plugin/us-025-break-rows.test.ts` slices the six break rows: the
  book rows follow them.
- `tests/plugin/us-021-groups-details.test.ts` order test: unaffected.

---

## Tests

- `tests/plugin/us-026-book-rows.test.ts` (all).
- Mutation checks: the signature saved as text; a row out of order; the
  toggle as a dropdown.

---

## SCAR check (2026-10-28, item by item against the Prevention lists)

- **SCAR-016** (1–8) the reset question at the click, the preview after an
  edit (tests); M16 on an open tab.
- **SCAR-017** (1–8) one rows module; the numeric save in the shared branch.
- **SCAR-019** (1–5) each value of each row.
- **SCAR-023** (1–10) guards above.
- Other SCARs: as in TICKET-076 (no output text, no Typst).

---

## Definition of done

- [x] Tests named above green; plugin tests of US-008 to US-025 green
- [x] Mutation checks run; gate counts in the result

---

## Result (2026-10-28)

Changed: `src/plugin/settings/row-data.ts` only: the five rows after `Break
before H6`, the option lists as text (`parse.ts` keeps its own lists; the
rows test pins the row lists). `rows.ts` and `details.ts` unchanged: the
numeric save of TICKET-076 is used for the first time (the signature). AC-9's
"group `Book`" read as the data group `book` (decision 1); the Defaults rows
have no section headings.

- Tests: `tests/plugin/us-026-book-rows.test.ts` 7/7 (the reset question and
  the two preview tests passed already with TICKET-079); plugin tests 555
  passed, the 15 red ones of US-027 and US-028.
- Gate (scratchpad `gate080.log`): typecheck, build (`main.js` sha256
  `77c39c19129c…`), lint green; `npm test` 1928 passed, 64 failed, 1 todo;
  integration 429 passed, 34 failed, 1 skipped. Every red test is of
  TICKET-081 (AC-11, one) or US-027, US-028; the two red US-026 PDF rows are
  the contents rows (US-027).
- Mutants (scratchpad `mut080/run.py`; the US-026, US-025, US-012, US-021,
  US-019, US-018 row tests; baseline 65 passed): 6, all caught — the
  signature saved as text, two rows' paths swapped, the switch as a dropdown,
  a signature option missing, a book row before the break rows, the first
  chapter options swapped. Restores checked with `shasum -a 256 -c` (2 files
  OK at the end).
- SCAR-017 grep after the code: `DEFAULT_ROWS` read by `rows.ts` and
  `details.ts` only.
