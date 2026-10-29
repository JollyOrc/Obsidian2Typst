# TICKET-089 — The field `images.minScale` (core)

**Status:** Done (2026-10-29)
**User story:** [US-028](../user-stories/US-028-image-fit.md)
**ACs addressed:** AC-1; AC-12 (the field at its values)
**Depends on:** —
**SCARs:** SCAR-007, SCAR-017, SCAR-019, SCAR-023

---

## Description

The `images` group of a preset note and the Defaults with `minScale`, a whole
number from 10 to 100 (percent), built-in 100 (the rule off, decision 1). The
effective settings carry `images`; `ConvertSettings.images` is read by
TICKET-090.

**AC-1 (the field):** Preset field and Defaults row `images.minScale`, a whole
number from 10 to 100 (percent), built-in 100. Any other value makes the
preset invalid (US-008 AC-4): `images.minScale must be a whole number from 10
to 100 (line 4)`. With 100 the rule is off (decision 1).

---

## Implementation notes

- As TICKET-083 (the `toc` group): `ImagesSettings` and a frozen
  `DEFAULT_IMAGES` beside `DEFAULT_TOC` (the one place of the built-in
  value), `PresetFields.images`, `images` in `PRESET_FIELDS`, a `readImages`
  in `parse.ts` (preset notes and the Defaults), the merge field by field,
  `ConvertSettings.images?: Partial<ImagesSettings>` (missing = 100).
- A value written as text (`"70"`) is refused, as the unit test pins.

### Guards searched before the ticket (SCAR-023)

- `tests/unit/us-008-presets.test.ts`: `PRESET_FIELDS` and the effective keys
  (`US-008 AC-1: treats strict mode …`) and the whole effective object
  (`US-008 AC-12: inherits all other values …`) grow by `images` (reason: a
  new preset field and effective setting).
- Searched by function name (SCAR-023, 2026-10-29): `effectiveSettings`,
  `validateFields`, `parsePreset` — no other test pins their whole result
  beyond the two above and the US-027 AC-1 tests (`toMatchObject`).

---

## Tests

- `tests/unit/us-028-image-fit.test.ts` › `US-028 AC-1` (3; the third,
  the Defaults in effect and beaten by a preset, added at the mutation run
  of 2026-10-29: the Defaults mutant survived the first two).
- The US-008 tests above, extended.
- Mutation checks: 101 accepted; 70.5 accepted; text accepted; the Defaults
  ignored; the built-in changed.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** (1–4) no shared utility gets a call site beyond the parser's
  number readers, whose checks fit.
- **SCAR-002** (1–7) the field only; its composition is in TICKET-090 to 092.
- **SCAR-003** (1–3) red tests exist; AC-1 read again; map row.
- **SCAR-006** (1–4) full gate, counts in the result.
- **SCAR-007** (1–3) the exact message with its line in the test.
- **SCAR-008** n/a (no third-party API).
- **SCAR-009, 010, 011** n/a (no generated text).
- **SCAR-012** n/a here (TICKET-094).
- **SCAR-013, 014** n/a (no dialog).
- **SCAR-015** n/a (no output).
- **SCAR-016** n/a (no control; TICKET-093).
- **SCAR-017** (1–8) grep for `toc` in `presets/` and `convert/types.ts`:
  `images` follows every place the group pattern is wired (schema, parse,
  merge, types); rows in TICKET-093.
- **SCAR-018** (1–10) mutation run with backups by full path and checksums.
- **SCAR-019** (1–5) 10, 70, 100 accepted; 9, 101, 70.5, text, 0 refused;
  Defaults 50.
- **SCAR-020, 021, 022** n/a.
- **SCAR-023** (1–11) guards above; the Defaults test shows a value in
  effect.
- **SCAR-024 to 029** n/a (no dependency statement, render, search,
  replacement, reader or human step).
- **SCAR-030** (1–4) the unit tests parse short notes; no limit needed.

---

## Definition of done

- [x] Tests named above green; the US-008 tests extended and green
- [x] Mutation checks run; full gate counts in the result
- [x] Map row AC-1 names this ticket; index row `Done`

## Result (2026-10-29)

- Code: `DEFAULT_IMAGES` / `ImagesSettings` (`src/core/layout/page-setup.ts`),
  `ImagesPresetFields`, `PresetFields.images`, `images` in `PRESET_FIELDS`
  (`schema.ts`), `readImages` (`parse.ts`), the merge field by field
  (`merge.ts`, `EffectiveSettings.images`), `ConvertSettings.images`
  (`convert/types.ts`).
- Tests: US-028 AC-1 3/3 green; US-008 `PRESET_FIELDS`, effective keys and
  the whole effective object extended by `images`.
- Mutation run (scratchpad `mut089/run.py`, backups by full path with
  `SHA256SUMS`, checked after every restore): 7/7 caught — 101, 9, 70.5
  accepted; text converted to a number; the Defaults ignored; the built-in
  changed; `images` not a preset field. First run: "text accepted" survived
  as an equivalent mutant (`"70"` still fails `Number.isInteger`; replaced by
  "text converted"), "the Defaults ignored" survived (no test reached the
  merge with Defaults; the third AC-1 test added).
- Gate (scratchpad `gate089.log`): typecheck, build (`main.js` sha256
  `ffa4ebea1029…`), lint green; `npm test` 1987 passed, 38 failed, 1 todo
  (before: 1984, 40); integration 446 passed, 31 failed, 1 skipped
  (unchanged). Every red test is of US-028 (TICKET-090 to 093).
