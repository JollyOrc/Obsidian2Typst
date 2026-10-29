# TICKET-076 — The dropdown row kind and the six break rows (plugin)

**Status:** Done (2026-10-28)
**User story:** [US-025](../user-stories/US-025-page-breaks-by-heading.md)
**ACs addressed:** AC-7 (AC-10 checked again)
**Depends on:** TICKET-075 (the field and its messages)
**SCARs:** SCAR-002, SCAR-013, SCAR-014, SCAR-016, SCAR-017, SCAR-018,
SCAR-019, SCAR-023

---

## Description

A new row kind `dropdown` for a field with fixed values, in the rows module
shared by the Defaults section of the settings tab and the style panel, and
the six rows `Break before H1` … `Break before H6`. US-026 to US-028 reuse the
kind.

---

## Acceptance criteria (from user story)

- **AC-7:** six dropdown rows over `page.breakBefore.hN`, options `—` (not
  set), `none`, `page`, `right`, `left`; saved at once; the reset icon with
  `Reset "Break before H1"?` and the value at the click; a row the preset sets
  is disabled with `Set by preset "…"; change it in the preset note`; the
  details pop-up lists the rows as text; every screen redraws through the
  existing listeners.

---

## Implementation notes

- `src/plugin/settings/row-data.ts`: `FieldRow.kind` gains `'dropdown'` and
  `options?: readonly string[]`; the six rows go after `Link page word` (the
  US-018 test pins the three rows after `Running header level`, the US-021
  test wants the Defaults rows before the fonts).
- `src/plugin/settings/rows.ts` (`addDefaultRows`): a `dropdown` branch:
  `addDropdown`, first option `''` shown as `—`, then the options; value the
  shown value or `''`; disabled when owned; on change `save(value === '' ?
  undefined : value)` (a numeric option list is saved as a number — US-026's
  signature; written here once, tested there). The reset icon is the shared
  `addResetButton` (no new code path).
- `src/plugin/settings/details.ts`: rows as text already; no change (checked
  by the US-021 order test and a value shown as `right`).
- Every row drawer found by grep for `DEFAULT_ROWS` (SCAR-017): `rows.ts`
  (settings tab and style panel) and `details.ts`; nothing else.

### Guards searched before the ticket (SCAR-023)

- `tests/plugin/us-018-rows-preview.test.ts`, `us-019-folio-rows-preview.test.ts`
  slice the rows after `Running header level` and `Gutter (mm)`: unaffected by
  the placement above.
- `tests/plugin/us-021-groups-details.test.ts` (order, last three summaries):
  unaffected.
- `tests/plugin/us-012-rows.test.ts`, `us-012-panel-behavior.test.ts` count
  drawn settings only relative to before (`made.length` grows): unaffected.

---

## Tests

- `tests/plugin/us-025-break-rows.test.ts` (all).
- US-008, US-009, US-012, US-018, US-019, US-021 plugin tests stay green.
- Mutation checks (SCAR-018): `—` saved as `''`; the owned row enabled; the
  options out of order; the value captured at draw time in the reset question.

---

## SCAR check (2026-10-28, item by item against the Prevention lists)

- **SCAR-002** (1–5) the row kind drawn in both hosts (settings tab, style
  panel) and listed by the pop-up; owned and free rows.
- **SCAR-013** (1–6) no text field: the reset question is the existing dialog
  (Enter, Escape, IME already tested for it).
- **SCAR-014** (1–6) the reset asks first with the safe choice as default
  (existing); a dropdown choice is not destructive; worst misplaced click: a
  wrong level — the label names it.
- **SCAR-016** (1) the handler reads the value at change and at reset; (2) a
  redraw on preset change through the existing listeners; (3) draw, change,
  use example in the test; (4) the reset test changes the value after drawing;
  (5) M15 on a tab that stays open; (6) the new way to change the value lists
  every screen (settings tab, panel, pop-up); (7) n/a (no loader); (8) applies.
- **SCAR-017** (1) grep for `DEFAULT_ROWS` (above); (2) the class rule in the
  story (every row drawer); (3) one branch in the shared module; (4–8) n/a or
  pointers.
- **SCAR-018** (1–10) backups of `row-data.ts`, `rows.ts` with checksums for
  the mutation run; as in TICKET-075.
- **SCAR-019** (1–5) each option and `—`; a preset value and a Defaults value.
- **SCAR-023** (1–9) guards searched (above); the owned-row test asserts the
  free row next to it stays enabled (the other side in effect).
- Not applicable: SCAR-001, 007 to 012, 015, 020 to 022, 024 to 027 (no
  output text, no Typst, no layout, nothing replaced); SCAR-003 and SCAR-006
  as in TICKET-075.

---

## Definition of done

- [x] Tests named above green; the plugin tests of US-008 to US-021 green
- [x] Mutation checks run, results in the result
- [x] ESLint and Prettier clean; pass counts in the result

---

## Result (2026-10-28)

Changed: `src/plugin/settings/row-data.ts` (`FieldRow.kind` `'dropdown'`,
`options`; the six rows from `BREAK_LEVELS` and `BREAK_RULES` after `Link
page word`), `src/plugin/settings/rows.ts` (the dropdown branch of
`addDefaultRows`: `—` first, the stored or shown value, disabled when owned,
saved at once; a list of whole numbers saved as numbers, for US-026).
`details.ts` unchanged (rows as text).

- Gate (scratchpad `gate076.log`): typecheck, build (`main.js` sha256
  `a5c96785fdaf…`), lint green; `npm test` 1906 passed, 85 failed, 1 todo;
  integration 412 passed, 50 failed, 1 skipped. Every red test is of US-026
  to US-028 (and the US-017 message test narrowed for US-026); US-025's
  plugin tests 8/8.
- Mutants (scratchpad `mut076/run.py`; the US-025 rows test and the US-012,
  US-018, US-019, US-021 row tests; baseline 58 passed): 5, all caught — `—`
  saved as an empty text, an owned dropdown enabled, the options out of
  order, no `—` option, the stored value not shown. Restores checked with
  `shasum -a 256 -c` (2 files OK at the end). Two script edits first matched
  0 or 2 places (the formatter's indent; a second `d.setDisabled` in the trim
  dropdown); the run stopped, restored, and was repeated (SCAR-018).
- SCAR-017 grep after the code: `DEFAULT_ROWS` read by `rows.ts` and
  `details.ts` only; the numeric save is not yet used by any row (US-026's
  signature row will).
