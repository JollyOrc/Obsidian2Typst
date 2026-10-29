# TICKET-093 — The row `Smallest image size` (plugin)

**Status:** Done (2026-10-29)
**User story:** [US-028](../user-stories/US-028-image-fit.md)
**ACs addressed:** AC-9
**Depends on:** TICKET-089 (the field)
**SCARs:** SCAR-016, SCAR-017, SCAR-019, SCAR-023

---

## Description

A number row `Smallest image size` over `images.minScale` with the hint
`%, 10 to 100` and the reset icon, after the Contents rows; the style panel
shows a preset's value greyed out with the preset's name; the details pop-up
lists it (it draws `DEFAULT_ROWS`). A change reaches the next preview and
export.

---

## Implementation notes

- `src/plugin/settings/row-data.ts`: the row after `Contents dot leaders`
  (the US-027 test slices four rows from `Contents depth`); kind `number`,
  hint as the test pins. The number row's save and the AC-1 refusal are the
  shared ones (US-008).
- No change in `rows.ts` or `details.ts`.

### Guards searched before the ticket (SCAR-023)

- The row slices of US-025, US-026, US-027 and the US-021 order test: a row
  after them changes none.
- Searched by function name: `DEFAULT_ROWS` readers (`rows.ts`,
  `details.ts`), `detailRows`.

---

## Tests

- `tests/plugin/us-028-image-rows.test.ts` (4).
- Mutation checks: the row as text; another hint; the row before the
  Contents rows.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001 to 015** as TICKET-087 (a row, no output text): n/a or covered
  by the shared row module; SCAR-003 red tests exist; SCAR-006 full gate;
  SCAR-012 in TICKET-094.
- **SCAR-016** (1–8) the reset reads the value at the click (test); the
  preview after a preset edit (draw, change, use test).
- **SCAR-017** (1–8) one rows module; `DEFAULT_ROWS` read by `rows.ts` and
  `details.ts` only (grep in the result).
- **SCAR-018** (1–10) mutation run with backups.
- **SCAR-019** (1–5) 70, 60 (preset), 5 refused, 100.
- **SCAR-020 to 029** n/a.
- **SCAR-023** (1–11) guards above.
- **SCAR-030** (1–4) fakes only.

---

## Definition of done

- [x] Tests named above green; plugin tests of US-008 to US-027 green
- [x] Mutation checks run; full gate counts in the result
- [x] Map row AC-9 names this ticket; index row `Done`

## Result (2026-10-29)

- Code: the number row `Smallest image size` over `images.minScale`, hint
  `%, 10 to 100`, after `Contents dot leaders`
  (`src/plugin/settings/row-data.ts`). No change in `rows.ts` or
  `details.ts`: the shared number row saves and refuses (the AC-1 message),
  the style panel shows a preset's value greyed with its name, the details
  pop-up draws `DEFAULT_ROWS`.
- Test change on the user's answer (2026-10-29): the preview test's rig
  vault lists `Sample/map.png` besides the note; without it the image was
  missing (the placeholder, no call, AC-2) and the test could never pass.
  Checked first in a scratch copy (5/5).
- Mutation run (`mut093/run.py`; backups with `SHA256SUMS`, checked after
  every restore): 3/4 caught — the row as text, another hint, a wrong path.
  Survived: the row moved before the Contents rows. Recorded, no test: the
  settings tab draws no group headings, a story's "group" is a run of rows
  (US-026, US-027), and AC-9 names no place; the place after the Contents
  rows is this ticket's choice.
- Gate (scratchpad `gate093.log`): typecheck, build (`main.js`
  `6fcf530d1ffa…`), lint green; `npm test` 2029 passed, 1 todo;
  integration 478 passed, 1 skipped. Fully green.
