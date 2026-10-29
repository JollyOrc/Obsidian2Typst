# TICKET-087 — The Contents rows, the details pop-up and the preview (plugin)

**Status:** Done (2026-10-29)
**User story:** [US-027](../user-stories/US-027-table-of-contents.md)
**ACs addressed:** AC-8; AC-7, AC-8 preview test
**Depends on:** TICKET-083 (the fields), TICKET-084 (the outline line),
TICKET-076 (the dropdown kind)
**SCARs:** SCAR-016, SCAR-017, SCAR-019, SCAR-023

---

## Description

Four Defaults rows after the book rows: `Contents depth` (dropdown 0 to 6,
saved as a number), `Contents title` (text), `Contents page numbers`,
`Contents dot leaders` (switches), each with the reset icon. The details
pop-up lists them (it draws `DEFAULT_ROWS`) and a last summary row
`Contents place` (`before "Rules"`, `after "Rules"`, or `default`).

---

## Acceptance criteria (from user story)

- **AC-8 (settings rows; SCAR-016, SCAR-017):** A group `Contents` in the
  Defaults section and the style panel: `Contents depth` (dropdown 0–6,
  US-025's row kind), `Contents title` (text), `Contents page numbers`,
  `Contents dot leaders` (switches), each with the reset icon (renamed at G2:
  `Page numbers` is already the folio switch of US-019, and rows are told
  apart by their labels). The details pop-up (US-021) lists them and a
  summary row `Contents place` (`before "Rules"`, or `default`).

---

## Implementation notes

- `src/plugin/settings/row-data.ts`: the four rows after `Back notes
  heading`, as the test pins them (paths `['toc', …]`; the depth options as
  text, saved as a number by the dropdown kind's numeric save).
- `src/plugin/settings/details.ts`: `summaryRow('Contents place', …,
  'default')` after `Heading rules`, from `toc.position` and `toc.heading`
  of the preset (`before "Rules"`); its header comment names the new summary.
- The style panel and the settings tab draw the rows through the shared
  module (no change).

### Guards searched before the ticket (SCAR-023)

- `tests/plugin/us-021-groups-details.test.ts` › `rows in the order of the
  Defaults rows, then fonts, then the three summaries` pins
  `labels.slice(-3)`: widened to the four summaries (reason: AC-8 adds
  `Contents place`, placed last at G2 2026-10-29).
- `tests/plugin/us-026-book-rows.test.ts`, `us-025-break-rows.test.ts`,
  `us-018-rows-preview.test.ts`, `us-019-folio-rows-preview.test.ts` slice
  their rows by the first label: unaffected by rows after them.
- `tests/plugin/us-012-panel.test.ts` reads `DEFAULT_ROWS`: searched for a
  count or a whole list; listed in the result.

---

## Tests

- `tests/plugin/us-027-contents-menu.test.ts` › AC-8 (4: the rows, drawn
  with the reset icon, the details rows, `Contents place`) and the preview
  test.
- The US-021 test above, widened.
- Mutation checks: the depth saved as text; a row out of order; `Contents
  place` before `Heading rules`; the place read from the Defaults.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** n/a (no shared utility with transforms).
- **SCAR-002** (1–6) the rows owned by a preset (shown, not editable) and
  free; the summary with a placed and an unplaced preset.
- **SCAR-003** (1–3) red tests exist (details added at G2 2026-10-29); map.
- **SCAR-006** (1–4) full gate.
- **SCAR-007** (1–3) exact labels and summary texts.
- **SCAR-008** n/a.
- **SCAR-009, SCAR-010, SCAR-011** n/a (no generated text).
- **SCAR-012** n/a here (TICKET-088).
- **SCAR-013** (1–6) the title field commits on change through the shared
  text row (`commitOnChange`, US-008); Enter and Escape as every text row.
- **SCAR-014** (1–6) the reset asks first (shared reset row).
- **SCAR-015** n/a.
- **SCAR-016** (1–8) the reset reads the value at the click (shared); the
  preview after a preset edit (draw, change, use test); the details pop-up
  is drawn when opened; M17 on an open tab; the menu items (TICKET-086) are
  a new way to change `toc.heading`: the screens that show it are the
  details pop-up (drawn on open) and the preview (reads the store at the
  next request) — both listed.
- **SCAR-017** (1–8) `DEFAULT_ROWS` read by `rows.ts` and `details.ts`
  only (grep in the result); one dropdown branch.
- **SCAR-018** (1–10) mutation run with backups and checksums.
- **SCAR-019** (1–5) each depth option; both switch values; title empty and
  custom; place before, after and default.
- **SCAR-020, SCAR-021, SCAR-022** n/a.
- **SCAR-023** (1–10) guards above.
- **SCAR-024, SCAR-025, SCAR-026, SCAR-027** n/a.
- **SCAR-028** n/a (no reader).
- **SCAR-029** n/a.

---

## Definition of done

- [x] Tests named above green; plugin tests of US-008 to US-026 green
- [x] Mutation checks run; full gate counts in the result
- [x] Map row AC-8 names this ticket; index row `Done`

---

## Result (2026-10-29)

Changed: `src/plugin/settings/row-data.ts` (the four rows after `Back notes
heading`; the depth options are whole numbers, so the dropdown kind's
numeric save of TICKET-076 saves a number); `src/plugin/settings/details.ts`
(`Contents place` after `Heading rules`: `before "Rules"` / `after "Rules"`
from the preset's `toc.position` and `toc.heading`, a missing position as
`before` (decision 6), else `default`, built-in); `rows.ts` unchanged: the
style panel and the settings tab draw the rows through the shared module.

- Tests: `tests/plugin/us-027-contents-menu.test.ts` 18/18 (the whole file
  is green); `tests/plugin/us-021-groups-details.test.ts` widened to the four
  summaries (the reason in a comment, the test's name no longer says
  "three"); all plugin tests 571 passed, the 4 red ones of US-028.
- Mutants (scratchpad `mut087/run.py`; the US-027, US-021, US-026 row and
  US-012 panel tests; baseline 83 passed): 6, all caught — a depth option
  not a number, the title row before the depth row, `Contents place` before
  `Heading rules`, the position ignored, a switch as a dropdown, the
  built-in place text changed. Restores checked with `shasum -a 256 -c`.
- SCAR-017 grep: `DEFAULT_ROWS` in `rows.ts`, `row-data.ts` (its home) and
  `details.ts` only.
- Decided by the user 2026-10-29 ("keep as is", US-027 decision 7): a text row saves an empty field as unset (US-008's
  `commitOnChange` rule for every text row), so `Contents title` in the
  Defaults cannot hold "no title"; an empty title is possible in a preset
  note (`title: ''`, AC-1). The story does not say which the row should do.
- Before this ticket (the user's "Yes"): `tests/integration/us-007-packaging
  .test.ts` got a 60 s limit on its AC-12 block (5018 ms against the 5000 ms
  default in the parallel gate of TICKET-086); green in this gate.
- Gate (scratchpad `gate087.log`): typecheck, build (`main.js` sha256
  `d9216accd333…`), lint green; `npm test` 1983 passed, 27 failed, 1 todo;
  integration 446 passed, 22 failed, 1 skipped. Every red test is of
  US-028.
