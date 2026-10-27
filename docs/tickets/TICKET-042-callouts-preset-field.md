# TICKET-042 — Preset field `callouts`: schema, validation, effective settings

**Status:** Done
**User story:** [US-016](../user-stories/US-016-callout-styles.md)
**ACs addressed:** AC-7, AC-8 (preset notes only)
**Depends on:** TICKET-041 (types `CalloutsSettings`, `CalloutPresetStyle`)
**SCARs:** SCAR-007 (every message with its line), SCAR-017 (colour and range checks shared), SCAR-001

---

## Description

Read and check the `callouts` group of a preset note and hand it to `convert`.
Styles are preset fields only: the Defaults of the settings tab have none.

---

## Acceptance criteria (from user story)

- **AC-7:** `callouts` is a group of styles; style names match
  `^[a-z0-9][a-z0-9_-]*$`; fields `fill` (`#rrggbb` or `none`), `border.color`,
  `border.width` (0 to 10 pt), `inset` (0 to 50 pt), `title.text`,
  `title.color`, `font.family`, `font.size` (> 0, ≤ 200), `icon` (vault path or
  `none`); the 15 messages of the story with the line of the field; `null` is
  unset; unknown fields inside a style are ignored and kept.
- **AC-8:** the effective settings carry the preset's `callouts` (or `{}`); a
  `callouts` in the Defaults is dropped by `validateFields` and never reaches
  the effective settings.

---

## Implementation notes

- `src/core/presets/schema.ts`: `callouts?: CalloutsSettings` in
  `PresetFields`, `'callouts'` in `PRESET_FIELDS`.
- `src/core/presets/parse.ts`: a `callouts` validator in the style of the
  `cover` and `fonts` groups (messages and line keys `callouts.<name>.<field>`).
  Reuse the existing colour check of `highlightColor` and the family-name check
  of US-010 instead of new copies (SCAR-017: grep `#[0-9a-f]{6}` and
  `font family name` in `src/core/presets` and list each hit in the result).
- `validateFields` (Defaults): drop `callouts` as it drops `cover`.
- `src/core/presets/merge.ts`: `EffectiveSettings.callouts: CalloutsSettings`,
  from the preset only.
- `src/core/convert/types.ts`: `ConvertSettings.callouts?: CalloutsSettings`
  (missing = `{}`); `convert` does not validate it (US-015 AC-3).

---

## Tests

- `tests/unit/us-016-callout-styles.test.ts` — all `US-016 AC-7:` tests and
  `US-016 AC-8: the effective settings carry the preset callouts; the Defaults have none`.
- Guard: the existing US-008, US-010 and US-011 preset tests stay green.
- Mutation checks: range ends (`10`, `50`, `200` inclusive, `0` exclusive for
  size), name pattern without the first-character rule, `"none"` refused for
  `border.color`, Defaults not dropped.

---

## SCAR check (2026-10-18, item by item against the Prevention lists)

- **SCAR-001:** the colour check and the family-name check get new call sites.
  Their transforms: the colour check accepts upper case (`#8B5A2B`) — the
  emitter writes lower case (AC-11, TICKET-043); the family check trims
  nothing and refuses blank-only text. Both fit; edge inputs (`#12345`,
  upper-case hex, `""`) are in the tests.
- **SCAR-002:** nested groups (`border`, `title`, `font` inside a style inside
  `callouts`) each have a "must be a group" message and a test.
- **SCAR-003:** each of the 15 messages has a test case with its line.
- **SCAR-006:** pass counts recorded.
- **SCAR-007:** examples with lines in the story and the tests.
- **SCAR-008, SCAR-009, SCAR-010:** n/a (no rendering, no generated text).
- **SCAR-011:** style names are user keys; the pattern keeps them to
  characters that need no escaping; uniqueness is YAML's (duplicate keys are a
  YAML error, US-008 AC-4).
- **SCAR-012:** n/a.
- **SCAR-013, SCAR-014, SCAR-016:** n/a: no settings rows (decided 2026-10-18).
- **SCAR-015:** n/a here.
- **SCAR-017:** shared colour and family checks; the grep list goes into the
  result.

---

## Definition of done

- [x] Tests named above green; US-008, US-010, US-011 preset tests green
- [x] Grep list of colour and family checks in the result (SCAR-017)
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)


## Result (2026-10-18)

Changed: `src/core/presets/schema.ts` (`callouts` field, `PRESET_FIELDS`),
`parse.ts` (`readCallouts`, `readCalloutStyle`, helpers `readPt`, `readColour`,
`readSubgroup`; the flag `withCover` renamed `fromNote`), `merge.ts`
(`EffectiveSettings.callouts` from the preset only), `src/core/convert/types.ts`
(`ConvertSettings.callouts?`).

- Tests: all 5 `US-016 AC-7:` tests and `US-016 AC-8: the effective settings…`
  green. `npm test`: 1431 passed, 1 todo; 17 failed, all US-016 tests of tickets
  043 to 045. Integration: 235 passed, red only in the US-016 file (missing
  module) and `build-output` (by design until TICKET-043). ESLint, Prettier
  clean; `tsc` errors only in US-016 test files.
- Existing tests changed because the field list grew (US-008 AC-1 extended in
  the story: "`callouts` by US-016, preset notes only"): in
  `tests/unit/us-008-presets.test.ts` the `PRESET_FIELDS` list, the key list of
  the effective settings and the exact effective settings of AC-12 gained
  `callouts`. No other expectation changed.
- Mutants: 9, all caught (upper bound exclusive, size 0 accepted, width/inset 0
  refused, inset max 60, name without the first-character rule, `none` for
  `border.color`, Defaults not dropped, Defaults merged, empty `title.text`
  dropped). "Defaults merged" survived at first: the AC-8 test used the same
  style name in Defaults and preset; the test now has a second Defaults style.
- SCAR-017 grep: the colour pattern `COLOUR` is used by `highlightColor` and
  `readColour`; `src/core/convert/index.ts:43` has its own pattern, a contract
  check that throws a `TypeError` (US-015 AC-3), not a validator — left as is.
  `readText` serves fonts and callouts. The `fonts.<role>.size` check keeps its
  inline form (US-010 code, not touched); `readPt` holds the same rule for
  callouts — noted as a candidate to merge, not done in this ticket.
