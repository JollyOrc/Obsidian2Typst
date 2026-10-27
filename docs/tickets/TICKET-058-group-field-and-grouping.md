# TICKET-058 — The field `group:`, the group of an invalid note, and `groupPresets`

**Status:** Done (2026-10-21)
**User story:** [US-021](../user-stories/US-021-preset-groups-and-details.md)
**ACs addressed:** AC-1, AC-2 (core and store)
**Depends on:** —
**SCARs:** SCAR-001, SCAR-007, SCAR-011, SCAR-017, SCAR-018, SCAR-019

---

## Description

Read the new preset field `group:`, read the group of an invalid note on its
own, give every store entry its group, and write the one function that groups
presets for every list. No screen changes in this ticket (TICKET-059).

---

## Acceptance criteria (from user story)

- **AC-1:** `group:` is text, trimmed; `group must be text (line N)` for a
  non-text value; `null`, `""` and blanks are no group; the Defaults ignore
  it.
- **AC-2:** five rules (key as `headingRuleKey`; heading of the first preset in
  settings order; alphabetical; ungrouped, empty and `other` last under
  `Other`; no headings while nothing is grouped); an invalid note keeps its
  group while its frontmatter is YAML.

---

## Implementation notes

- `src/core/presets/schema.ts`: `PresetFields.group?: string`; not in the
  Defaults (`readFields` reads it only with `fromNote`, as `cover`).
- `src/core/presets/parse.ts`: the reader (a string, trimmed; empty → not
  set; else `group must be text`); new `readGroup(text)`: the existing
  `frontmatter(text)` and `parseDocument`, then only the `group` key, by the
  same reader, null on any problem (not YAML, unclosed, non-text).
- New `src/core/presets/groups.ts`: `groupPresets(entries)` with the key from
  `headingRuleKey` (`core/markers`; SCAR-001: its transforms — runs of white
  space to one blank, trim, lower case — are the group rule exactly); exported
  from `core/presets`. `core/presets` importing `core/markers` is already the
  case (`HeadingRulesSettings`), no upward import.
- `src/plugin/presets/store.ts`: `PresetEntry.group: string | null` — from the
  parsed fields when valid, else `readGroup(text)`.
- Existing tests expected to change, each reported: the US-008 key lists of
  `PRESET_FIELDS` (one more name, `group`); any exact `PresetEntry` object.

---

## Tests

- `tests/unit/us-021-preset-groups.test.ts`: all tests.
- `tests/plugin/us-021-groups-details.test.ts`: the store test (`US-021 AC-2:
  entries carry group`).
- Mutation checks (SCAR-018): blanks not trimmed; empty accepted as a group;
  the Defaults read `group`; the key case-sensitive; runs of blanks kept;
  `other` not joined; `Other` first; headings when nothing is grouped;
  heading from the last preset; `readGroup` without the text check.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** (1) `headingRuleKey` gets a new call site; its transform list
  read (register row of US-017); (2) each fits the group rule; (3) no flag;
  (4) edge inputs: `Print  run `, `PRINT`, `other`.
- **SCAR-002** (1–3) composed: an invalid note in a group, all presets in one
  group, all `Other`; (4) the examples ran through today's parser for the
  invalid case (G2); (5) n/a (no generated text).
- **SCAR-003** (1) tests exist and are red; (2) AC list again before Done;
  (3) AC → test table in the result.
- **SCAR-006** (1) full gate; (2) no skip; (3) counts; (4) TICKET-059 to 061
  red tests tracked.
- **SCAR-007** (1) the table of AC-2 is exact; (2) n/a; (3) yes.
- **SCAR-008** (1–5) n/a (no third-party API but `yaml`, already used);
  (6–7) n/a.
- **SCAR-009** n/a: no generated text.
- **SCAR-010** n/a: no concatenated pieces.
- **SCAR-011** (1) invariant: one heading per key, and the generated `Other`
  is the only heading for the ungrouped; (2) a set of keys, not a count;
  (3) a natural group `Other`/`other` tested; (4) guard: all `Other` → no
  headings; (5) n/a.
- **SCAR-012** n/a here.
- **SCAR-013, SCAR-014** n/a: no control.
- **SCAR-015** n/a: no output.
- **SCAR-016** (1–6) n/a here (the lists in TICKET-059); (7) the store gives
  `group` at every load, so a `group:` edit reaches every reader.
- **SCAR-017** (1) grep before coding: `sortPresetNames(`, `entries()` in
  `src` (the lists that will call `groupPresets`, TICKET-059); (2) the class is
  every list of presets; (3) one function; (4) n/a; (5) n/a; (6) the inventory
  was made by grep (G0).
- **SCAR-018** (1) path-mirrored backups of `schema.ts`, `parse.ts`,
  `groups.ts`, `store.ts` with a checksum list; (2) check after every
  restore, stop on failure; (3) one match per mutant; (4) arrays; (5) baseline
  in the same run; (6) verified trees; (7) a survivor is read first as an
  input that cannot reach the rule.
- **SCAR-019** (1) the field at unset, null, empty, blanks, text, number,
  list; the grouping at none, one, several, all one, all `Other`; (2) n/a;
  (3) yes; (4) M11 (TICKET-061).

---

## Definition of done

- [x] Tests named above green
- [x] Existing tests that changed listed with the reason
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)
- [x] Register row for `groupPresets` and `readGroup`

## Result (2026-10-21)

Changed: `src/core/presets/schema.ts` (`PresetFields.group`, `group` in
`PRESET_FIELDS`); `src/core/presets/parse.ts` (`readGroupValue`, used for
preset notes only; new exported `readGroup(text)`); new
`src/core/presets/groups.ts` (`groupPresets`, `UNGROUPED_HEADING`,
`PresetGroup`); `src/core/presets/index.ts` (exports);
`src/plugin/presets/store.ts` (`PresetEntry.group`: the parsed field when the
note reads, `readGroup(text)` when it does not). Register row "Preset groups".

- Gate (scratchpad `gate058.log`): typecheck, build (`main.js` sha256
  `8cbdaaa01ee7…`), lint green; `npm test` 1679 passed, 19 failed, 1 todo;
  integration 370 passed, 1 skipped. All 19 red tests are TICKET-059's and
  TICKET-060's (the lists, the pop-up).
- AC → tests: AC-1 — the four field tests, green (two of them green guards
  from G2); AC-2 — the six grouping tests, the two `readGroup` tests and the
  store test, green.
- Existing tests changed: `tests/unit/us-008-presets.test.ts`, the
  `PRESET_FIELDS` list gains `group` (the effective-settings key list is
  unchanged: the pipeline does not read the group).
- Decision in the code (reported): a preset that reads but is refused by the
  effective settings (for example a broken page geometry) takes its group
  from the parsed fields, like a valid one; only a note that does not read
  uses `readGroup`. Groups are sorted by code-point order of the key (no
  locale), so the order is the same on every machine (rule 7).
- Mutants (scratchpad `mut058/run.py`; US-021 unit and plugin, US-008 presets
  tests; baseline 19 failed, 84 passed): 12, all caught on the first run:
  blanks not trimmed; empty accepted; the Defaults read `group`; key
  case-sensitive; runs of blanks kept; `other` not joined; `Other` first;
  headings when nothing is grouped; heading from the last preset; groups not
  sorted; `readGroup` without the text check; the store without `readGroup`.
  Backups by full path, `shasum -a 256 -c` after every restore and at the end:
  all 4 files OK.
- SCAR-017 greps: `sortPresetNames(` — `names.ts` (definition and two
  internal uses), the store (its order of entries); `entries()` callers —
  `main.ts` (ribbon), `settings-tab.ts`, `panel.ts`, `prepare-note.ts` (a name
  list for `pickActive`, not shown, not affected); the three shown lists move
  to `groupPresets` in TICKET-059.
