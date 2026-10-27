# TICKET-049 — Page fields `folios`, `runningHeader`, `runningHeaderLevel`: schema, built-ins, effective settings, Defaults rows

**Status:** Done (2026-10-20)
**User story:** [US-019](../user-stories/US-019-folios-and-running-headers.md)
**ACs addressed:** AC-1, AC-2
**Depends on:** —
**SCARs:** SCAR-007, SCAR-001, SCAR-013, SCAR-014, SCAR-016, SCAR-017

---

## Description

Read and check the three new `page` fields in preset notes and the Defaults,
give them built-in values, hand them to `convert` as
`ConvertSettings.pageFurniture`, and add the three Defaults rows (settings tab
and the panel's Page group, which draws the same rows). The Typst is written
in TICKET-050.

---

## Acceptance criteria (from user story)

- **AC-1:** `page.folios` and `page.runningHeader` (true or false),
  `page.runningHeaderLevel` (whole number 1 to 6); the three messages with the
  line of the field; `null` is unset; preset, then Defaults, then built-in
  (`true`, `true`, `2`), field by field.
- **AC-2:** rows `Page numbers` (toggle), `Running header` (toggle), `Running
  header level` (number, hint `1 to 6`) after `Gutter (mm)`; the existing save
  rule, reset question and redraw; a refused level keeps the saved value.

---

## Implementation notes

- `src/core/presets/schema.ts`: `PagePresetFields` gains `folios?`,
  `runningHeader?`, `runningHeaderLevel?`; `BUILTIN_DEFAULTS.page` gains
  `folios: true`, `runningHeader: true`, `runningHeaderLevel: 2`.
- `src/core/presets/parse.ts`, `readPage`: two booleans in the style of
  `facingPages` (`page.<key> must be true or false`) and the level
  (`Number.isInteger`, 1 to 6; `page.runningHeaderLevel must be a whole number
  from 1 to 6`). Defaults and preset notes both read them (no `fromNote`
  gate).
- `src/core/presets/merge.ts`: `overlayPage` already copies every page key;
  `effectiveSettings` builds `pageFurniture: {folios, runningHeader,
  runningHeaderLevel}` from the resolved page input and passes the rest to
  `resolvePageSetup` (geometry only, SCAR-001: `resolvePageSetup` gets no new
  transform). `EffectiveSettings.pageFurniture` is always set.
- `src/core/convert/types.ts`: `ConvertSettings.pageFurniture?:
  PageFurniture` (missing = both off; older callers and tests unchanged,
  AC-8). The type lives in `src/core/layout` (page concerns) or
  `src/core/presets/schema.ts`; decided when coding, named in the result.
- `src/plugin/settings/rows.ts`, `DEFAULT_ROWS`: three entries after `Gutter
  (mm)`. No new row code: toggles and numbers go through the existing paths
  (`addToggle`, `commitOnChange`, `addResetButton`).
- Remove the `field(…, 'pageFurniture')` cast in
  `tests/unit/us-019-folios-headers.test.ts` once the field exists (G2 note).
- Existing tests expected to change, each reported in the result: the exact
  effective settings of US-008 AC-12 and the key list of AC-1 gain
  `pageFurniture`; any row-count or row-order expectation in
  `tests/plugin/us-012-rows.test.ts` or `us-012-panel.test.ts`.

---

## Tests

- `tests/unit/us-019-folios-headers.test.ts`: all `US-019 AC-1:` tests.
- `tests/plugin/us-019-folio-rows-preview.test.ts`: the three `US-019 AC-2:`
  tests.
- Guard: US-008, US-009, US-012 tests green after the listed updates.
- Mutation checks (SCAR-018: path-mirrored backups, checksum after each
  restore): level bound 6 exclusive; level 0 accepted; 2.5 accepted;
  booleans accept strings; Defaults ignored in the effective settings; preset
  and Defaults order swapped; built-in level 1; rows in a different order.

---

## SCAR check (2026-10-20, item by item against the Prevention lists)

- **SCAR-001:** `readPage` and `overlayPage` get new fields, not new
  transforms; `resolvePageSetup` stays geometry only (the furniture is split
  off before it). The Defaults row helpers get three call sites; their
  transforms (commit on leaving the field, reset question, redraw) fit, and
  the reset test with a changed value is green.
- **SCAR-002:** the fields are flat inside `page`; the composed case is the
  three layers (preset, Defaults, built-in) field by field, tested.
- **SCAR-003:** each message and each row has a test.
- **SCAR-006:** pass counts in the result; remaining red tests belong to
  TICKET-050/051 and are in the map.
- **SCAR-007:** messages with lines and the row list are exact in the tests.
- **SCAR-008, SCAR-009, SCAR-010, SCAR-011:** n/a (no rendering, no generated
  text, no labels).
- **SCAR-012:** n/a (handover in TICKET-051).
- **SCAR-013:** the number row is a text field of the existing kind: Enter and
  leaving the field commit it through `commitOnChange`, which already handles
  the keyboard rule; no new dialog.
- **SCAR-014:** the worst misplaced click is the reset icon of a new row; it
  goes through the existing question (`Cancel` focused).
- **SCAR-015:** n/a here.
- **SCAR-016:** the reset reads the value at the click (green test); the
  toggles save on change and redraw like `Facing pages`.
- **SCAR-017:** no new row helper; the existing text check that every Defaults
  row goes through the shared helpers covers the three rows (named in the
  result).
- **SCAR-018:** the mutation run uses path-mirrored backups and a checksum
  check after each restore.

---

## Definition of done

- [x] Tests named above green; listed existing tests updated and reported
- [x] Cast removed from the US-019 unit tests
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)

## Result (2026-10-20)

Changed: `src/core/layout/page-setup.ts` (type `PageFurniture`);
`src/core/presets/schema.ts` (`PagePresetFields.folios`, `runningHeader`,
`runningHeaderLevel`; `BUILTIN_DEFAULTS.page` `true`, `true`, `2`);
`parse.ts` (`readPage`: two flags and the level, with the three messages);
`merge.ts` (`FURNITURE_KEYS` kept out of the geometry input; `ResolvedFields`
and `EffectiveSettings` gain `pageFurniture`, preset, then Defaults, then
built-in); `src/core/convert/types.ts` (`ConvertSettings.pageFurniture?`,
missing = off); `src/plugin/settings/rows.ts` (three `DEFAULT_ROWS` entries
after `Gutter (mm)`, no new row code). The type lives in `core/layout`
(page concerns; TICKET-050's emitter may import it downward).

- Tests: all `US-019 AC-1:` tests (plus a new one: the furniture never reaches
  the page input of `resolvePageSetup`) and the three `US-019 AC-2:` tests
  green; the `rulesOf`-style cast removed.
- Gate: typecheck, build (`main.js` sha256 `daa04a05d7f8…`), lint green;
  `npm test` 1558 passed, 15 failed (11 US-019 unit of AC-3 to AC-11, 2 US-019
  preview of AC-10, the US-015 registry list, the US-016 PLUGIN_NAMES list;
  all owned by TICKET-050/051), 1 todo; integration 337 passed, 11 failed
  (all US-019, TICKET-050), 1 skipped.
- Existing tests changed (US-008 AC-1 text extended with the built-ins of
  US-019): in `tests/unit/us-008-presets.test.ts` the built-in defaults, the
  key list of the effective settings and the exact effective settings of
  AC-12 gained the furniture. `PRESET_FIELDS` is unchanged (`page` already is a
  field). No US-012 row test changed.
- Mutants: 9, all caught after one test was added (level bound 6 exclusive;
  level 0 accepted; 2.5 accepted; strings as flags; Defaults ignored; preset
  and Defaults swapped; built-in level 1; rows swapped; furniture keys into the
  geometry input). The last one survived at first: no test said that the
  geometry input stays geometry; the new AC-1 test does. Backups by full path,
  `shasum -c` after every restore: all OK.
- SCAR-017: no new row helper; the three rows are data in `DEFAULT_ROWS` and
  go through `addToggle`, `commitOnChange` and `addResetButton` like every
  Defaults row.
