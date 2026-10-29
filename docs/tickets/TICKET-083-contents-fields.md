# TICKET-083 — The contents fields (core)

**Status:** Done (2026-10-29)
**User story:** [US-027](../user-stories/US-027-table-of-contents.md)
**ACs addressed:** AC-1; AC-10 (the fields at their values)
**Depends on:** —
**SCARs:** SCAR-007, SCAR-017, SCAR-019, SCAR-023

---

## Description

The `toc` group of a preset note and the Defaults: `depth` (0 to 6, built-in
0), `title` (text, built-in `Contents`), `pageNumbers` and `dotLeaders`
(switches, built-in `true`), and in preset notes only `heading` (text) and
`position` (`before`, `after`). The effective settings carry `toc`;
`ConvertSettings.toc` is read by TICKET-084 and 085.

---

## Acceptance criteria (from user story)

- **AC-1 (the fields):** Preset fields and Defaults: `toc.depth` (0 to 6,
  built-in 0), `toc.title` (text, built-in `Contents`, empty = no title),
  `toc.pageNumbers` and `toc.dotLeaders` (switches, built-in `true`). Preset
  notes only (like `cover`, US-011): `toc.heading` (the visible text of an H1)
  and `toc.position` (`before`, `after`), written by the menu items (AC-7).
  Invalid values make the preset invalid (US-008 AC-4): `toc.depth must be a
  whole number from 0 to 6 (line 3)`, `toc.position must be before or after
  (line 5)`.

---

## Implementation notes

- `src/core/presets/schema.ts`: `TocPresetFields`, `PresetFields.toc`, `toc`
  in `PRESET_FIELDS`.
- `src/core/presets/parse.ts`: a `readToc` beside `readBook`; the messages of
  the unit test (`toc.depth must be a whole number from 0 to 6`, `toc.position
  must be before or after`, `toc.pageNumbers must be true or false`,
  `toc.dotLeaders must be true or false`, `toc.title must be text`), each at
  the line of its key. `heading` and `position` are read from preset notes
  only (`fromNote`, as `cover`); `validateFields` (the Defaults) drops them
  without an error, as the unit test pins.
- `src/core/layout/page-setup.ts` (or a new `toc` settings module beside
  `DEFAULT_BOOK`): `TocSettings` and `DEFAULT_TOC` (frozen), the one place of
  the built-in values (no constant in `emit`).
- `src/core/presets/merge.ts`: `toc` field by field (preset, Defaults,
  built-in), as `book`; `heading` and `position` from the preset only.
- `src/core/convert/types.ts`: `ConvertSettings.toc?: Partial<TocSettings>`;
  missing means off (today's output).

### Guards searched before the ticket (SCAR-023)

- `tests/unit/us-008-presets.test.ts` `US-008 AC-1: treats strict mode …`
  pins `PRESET_FIELDS` and the effective keys: both grow by `toc` (reason:
  the new group is a preset field and an effective setting).
- `tests/unit/us-008-presets.test.ts` `US-008 AC-12: inherits all other
  values …` pins the whole effective object: gains the built-in `toc`
  (`depth: 0, title: 'Contents', pageNumbers: true, dotLeaders: true`).
- No test forbids a new key in `parse.ts`; the US-021 groups test reads
  `group` only.

---

## Tests

- `tests/unit/us-027-table-of-contents.test.ts` › `US-027 AC-1` (4 tests).
- The two US-008 tests above, extended as listed.
- Mutation checks: depth 7 accepted; `heading` kept in the Defaults; the
  built-in title changed; a switch read as text.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** (1–4) no shared utility gets a call site; the field readers
  are the existing helpers of `parse.ts` (whole number, switch, text), whose
  checks fit the new keys.
- **SCAR-002** (1–6) fields only; their composition is in TICKET-085 (AC-9).
- **SCAR-003** (1–3) red tests exist (G2); the AC-1 list read again; map row.
- **SCAR-006** (1–4) full gate, no skip, counts in the result.
- **SCAR-007** (1–3) exact messages with lines, in the tests.
- **SCAR-008** n/a (no third-party API).
- **SCAR-009** n/a (no generated text).
- **SCAR-010** n/a (no concatenation).
- **SCAR-011** n/a (no generated names).
- **SCAR-012** n/a here (TICKET-088).
- **SCAR-013, SCAR-014** n/a (no dialog, nothing written).
- **SCAR-015** n/a (no output).
- **SCAR-016** n/a (no control).
- **SCAR-017** (1) grep for `book` in `presets/` to find every place a group
  is wired (schema, parse, merge, details, owner, row-data); `toc` follows
  each one this ticket owns; details and rows in TICKET-087. (2–8) one
  default object; one reader per group.
- **SCAR-018** (1–10) mutation run with backups by full path and checksums.
- **SCAR-019** (1–5) depth at 0, 1, 2, 3, 6 and out of range; switches at
  both values; title empty, default, custom.
- **SCAR-020** n/a (no option offered).
- **SCAR-021** n/a (no layout read).
- **SCAR-022** n/a (no callback).
- **SCAR-023** (1–10) guards above; the Defaults test shows the dropped keys
  and the kept ones (both sides in effect).
- **SCAR-024** n/a (no dependency statement).
- **SCAR-025** n/a (nothing rendered).
- **SCAR-026** n/a (no search result acted on).
- **SCAR-027** n/a (nothing replaced).
- **SCAR-028** n/a (no new reader; the tests read parse results).
- **SCAR-029** n/a (no human step).

---

## Definition of done

- [x] Tests named above green; the US-008 tests extended and green
- [x] Mutation checks run; full gate counts in the result
- [x] Map row AC-1 names this ticket; index row `Done`

---

## Result (2026-10-29)

Changed: `src/core/layout/page-setup.ts` (`TocSettings`, `DEFAULT_TOC`, the
one place of the built-in values), `src/core/presets/schema.ts`
(`TocPresetFields`, `PresetFields.toc`, `toc` in `PRESET_FIELDS`),
`src/core/presets/parse.ts` (`readToc`: the messages of the tests at the
line of each key; `heading` and `position` read in preset notes only, the
Defaults drop them without a problem), `src/core/presets/merge.ts` (`toc`
field by field, preset over Defaults over built-in; the place from the
preset only; `ResolvedFields.toc`, `EffectiveSettings.toc`),
`src/core/convert/types.ts` (`ConvertSettings.toc`). `convert` does not
read `toc` yet (TICKET-084): the output is unchanged.

- Tests: `US-027 AC-1` 4/4 and one new test (below); the two US-008 tests
  extended by `toc` (the `PRESET_FIELDS` and effective-keys lists, the AC-12
  object with the built-in contents settings); `tests/unit/us-008-presets`
  70/70.
- Mutants (scratchpad `mut083/run.py`; the US-027 and US-008 unit tests):
  first run 7 — 3 caught, 1 did not match (the text was formatted; fixed), 3
  survived: the Defaults ignored for `toc`, an empty title dropped, the place
  dropped in the merge. Read as test gaps (SCAR-023): no test took the AC-1
  fields through `effectiveSettings`. Added `US-027 AC-1: preset over
  Defaults over built-in, field by field; an empty title is kept; the place
  comes from the preset` (the preset wins on depth, the Defaults are in
  effect on the dot leaders, the built-in on the page numbers). Second run:
  7 of 7 caught. Restores checked with `shasum -a 256 -c` after every
  mutant (3 files OK at the end).
- SCAR-017 grep for the `book` group's wiring outside the core presets:
  only `src/plugin/settings/row-data.ts` (TICKET-087).
- Gate (scratchpad `gate083.log`): typecheck, build (`main.js` sha256
  `85b446f197f5…`), lint green; `npm test` 1943 passed, 62 failed, 1 todo;
  integration 430 passed, 36 failed, 1 skipped. Every red test is of US-027
  (TICKET-084 to 087), US-028 or the two US-026 contents rows.
