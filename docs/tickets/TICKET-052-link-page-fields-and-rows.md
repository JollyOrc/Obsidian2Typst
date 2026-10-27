# TICKET-052 — Fields `linkPageNumbers`, `linkPageLevel`, `linkPageWord`: parsing, effective settings, Defaults rows, A4 digital

**Status:** Done (2026-10-21)
**User story:** [US-018](../user-stories/US-018-page-numbers-for-internal-links.md)
**ACs addressed:** AC-1; AC-8 (the rows and their messages)
**Depends on:** —
**SCARs:** SCAR-001, SCAR-007, SCAR-013, SCAR-014, SCAR-016, SCAR-017, SCAR-018, SCAR-019

---

## Description

Read the three new top-level preset fields with their messages, carry them
from preset, Defaults and built-ins to the settings `convert` takes, write
`linkPageNumbers: false` into the built-in `A4 digital` note, and add the
three Defaults rows. No output changes in this ticket (the emitter reads the
fields in TICKET-053).

---

## Acceptance criteria (from user story)

- **AC-1:** In preset notes and the Defaults, with the precedence of US-008
  AC-1: `linkPageNumbers: true` (built-in true), `linkPageLevel: 2` (whole
  number 1 to 6; built-in 2), `linkPageWord: "p."` (text, not empty;
  built-in `"p."`). Messages with the line of the field:
  `linkPageNumbers must be true or false`; `linkPageLevel must be a whole
  number from 1 to 6`; `linkPageWord must be text`. `linkPageLevel: 7` on line
  3 → `linkPageLevel must be a whole number from 1 to 6 (line 3)`;
  `linkPageWord: ""` → `linkPageWord must be text (line 3)`. `null` is unset.
  The built-in preset note `A4 digital` gains `linkPageNumbers: false`;
  existing preset notes in a vault are never changed (rule 2).
- **AC-8 (rows):** right after `Running header level`: `Page numbers in
  links` (toggle), `Link page level` (number, hint `1 to 6`), `Link page word`
  (text, hint `p.`), with the existing save rule, reset question and redraw.

---

## Implementation notes

- `src/core/presets/schema.ts`: `PresetFields` gains the three optional
  fields, `PRESET_FIELDS` the three names, `BuiltinDefaults` and
  `BUILTIN_DEFAULTS` the values `true`, `2`, `'p.'`.
- `src/core/presets/parse.ts`: three readers beside `externalLinkFootnotes`
  (same shape: a wrong type is a problem with the path, so the line comes
  from the existing path lookup). The whole-number check of
  `page.runningHeaderLevel` (US-019, inline in `parse.ts`) moves into one
  helper that both levels use, rather than a copy (SCAR-017);
  the word: a string with at least one character, else `linkPageWord must be
  text` (`""` and a number both).
- `src/core/presets/merge.ts`: `ResolvedFields` and `EffectiveSettings` gain
  `linkPageNumbers`, `linkPageLevel`, `linkPageWord` via `pick` (flat, like
  `externalLinkFootnotes`).
- `src/core/convert/types.ts`: `ConvertSettings` gains the three optional
  fields; missing `linkPageNumbers` means off, so older callers and tests are
  unchanged (AC-6).
- `src/core/presets/builtin.ts`: the `A4 digital` text gets the line
  `linkPageNumbers: false` after the `page:` block, before `---`; `A5 print`
  unchanged (SCAR-001: `pageText` gets one optional extra-lines argument, used
  by A4 digital only; its doc comment lists it).
- `src/plugin/settings/rows.ts`, `DEFAULT_ROWS`: three entries after `Running
  header level`. No new row code: toggles, numbers and texts go through the
  existing paths (`addToggle`, `commitOnChange`, `addResetButton`).
- Remove the `as never` casts and the untyped `field(…)` reads in
  `tests/unit/us-018-page-refs.test.ts` and
  `tests/plugin/us-018-rows-preview.test.ts` where the fields now exist.
- Existing tests expected to change, each reported in the result: the key
  list and the exact effective settings of US-008 AC-1/AC-12
  (`tests/unit/us-008-presets.test.ts`, lines with `pageFurniture`); any
  exact text of the built-in `A4 digital` note (`us-008-presets`,
  `us-009-page-setup`, `us-008-plugin-data`, `us-008-dialogs`); any row-count
  or row-order expectation of the US-012 panel and settings tests.

---

## Tests

- `tests/unit/us-018-page-refs.test.ts`: all `US-018 AC-1:` tests (7).
- `tests/plugin/us-018-rows-preview.test.ts`: the three `US-018 AC-8:` row
  tests (the reset question is green already and stays green).
- Mutation checks (SCAR-018): level range 1 to 7; level accepts a decimal;
  word accepts `""`; the Defaults layer skipped for the level; built-in level
  3; A4 digital without the line; A5 print with it; rows in another order.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** (1) `pageText` gets one new transform (extra lines), listed
  in its doc comment; (2) its two call sites read: A5 print without, A4
  digital with; (3) no flag that fits only one use: the argument is the lines
  themselves; (4) edge input at the new call site: the parsed A4 text is
  tested (`parsePreset` reads `false`), not only the string.
- **SCAR-002** (1–4) n/a: no structure; the fields reach structure in
  TICKET-053.
- **SCAR-003** (1) every AC of this ticket has tests (listed above, red now);
  (2) the AC list is gone through again before Done; (3) the result holds the
  AC → test table.
- **SCAR-006** (1) full gate before Done; (2) no skip; (3) pass counts in the
  result; (4) the red tests of TICKET-053/054 stay tracked in the map.
- **SCAR-007** (1) every message and value is exact in AC-1 and in the tests;
  (2) n/a (no composition); (3) yes, the notes name file and function.
- **SCAR-008** (1–5) n/a: no third-party API.
- **SCAR-009** (1–4) n/a: no generated text.
- **SCAR-010** (1–5) n/a: no concatenated pieces.
- **SCAR-011** (1–5) n/a: no generated names.
- **SCAR-012** (1–5) n/a here (handover in TICKET-054).
- **SCAR-013** (1) the level and the word rows are text inputs: Enter = the
  existing commit (`commitOnChange`), Escape and IME composition as every
  Defaults row; (2) the composing case is in the shared key function; (3) the
  text check of US-008 AC-20 (`tests/plugin/us-008-text-commit.test.ts`:
  every `addText(` goes through `commitOnChange(`) covers the new rows; (4) keyboard-only step in M9 (TICKET-054); (5) n/a.
- **SCAR-014** (1) the worst misplaced click is a new row's reset icon; it
  uses the existing question (names the value, `Cancel` focused); (2) safe
  default unchanged; (3) n/a (nothing refused); (4) the existing reset test
  pattern is applied to the word row (green guard); (5) worst click listed
  here and in the story Notes; (6) n/a.
- **SCAR-015** (1–5) n/a: no output change.
- **SCAR-016** (1) the reset helper reads the value at the click (reader
  function); (2) a preset edit redraws the panel as today; (3) the AC-8 test
  has the order draw, change (`S.`), use; (4) mutable holder in the test;
  (5) M9 step on an open tab.
- **SCAR-017** (1) grep before coding: `runningHeaderLevel` readers in
  `parse.ts` (the level check to share) and `externalLinkFootnotes` in
  `src` (8 files: presets schema, parse, merge; convert types and index; emit
  blocks and inline; settings rows; each gets its sibling here, in
  TICKET-053 (convert index, emit) or is n/a, listed in the result); (2) the class is "every
  Defaults row" (AC-8 names the three); (3) rows are data for the existing
  helpers, the US-008 AC-20 text check covers them; (4) n/a (no defect).
- **SCAR-018** (1) path-mirrored backups of `schema.ts`, `parse.ts`,
  `merge.ts`, `builtin.ts`, `rows.ts` with a checksum list; (2) `shasum -a 256
  -c` after every restore, stop on failure; (3) scripted mutants assert one
  match; (4) arrays for file lists; (5) baseline counts in the same run;
  (6) caught only on a verified tree.
- **SCAR-019** (1) the level: tests at 1, 6, 0, 7 (refused), 3 (middle) and
  the default 2; the switch at true and false; the word at `p.`, `S.`, `""`;
  (2) n/a (decisions asked with every level in the AC-2 table); (3) the
  effective-settings test uses non-default values (3, 4, `S.`); (4) M9 dry
  run (TICKET-054).

---

## Definition of done

- [x] Tests named above green
- [x] Existing tests that changed listed with the reason
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)
- [x] Map rows AC-1 and AC-8 (rows part) updated

## Result (2026-10-21)

Changed: `src/core/presets/schema.ts` (three fields, names, built-ins `true`,
`2`, `'p.'`); `src/core/presets/parse.ts` (three readers; the level check of
`page.runningHeaderLevel` moved into `isHeadingLevel`, used by both);
`src/core/presets/merge.ts` (`ResolvedFields`, `EffectiveSettings`, flat);
`src/core/convert/types.ts` (`ConvertSettings`, optional, unread until
TICKET-053); `src/core/presets/builtin.ts` (`pageText(name, extra)`, A4
digital gets `linkPageNumbers: false`); `src/plugin/settings/rows.ts` (three
rows after `Running header level`); register row "Preset field checks and
built-in notes" in `docs/user-stories/README.md`.

- Gate (scratchpad `gate052.log`): typecheck, build (`main.js` sha256
  `e6a82a85b6e8…`), lint green; `npm test` 1589 passed, 43 failed, 1 todo;
  integration 366 passed, 4 failed, 1 skipped. Every red test belongs to
  TICKET-053/054 (39 US-018 unit, 2 US-018 preview, US-015 registry, US-016
  PLUGIN_NAMES, 4 US-018 PDF); none of the AC-1 or AC-8 row tests.
- AC → tests: AC-1 — the seven `US-018 AC-1:` tests, green; AC-8 rows — the
  three row tests, green (the reset test was a green guard before).
- Existing tests changed, each the three new fields with their built-in
  values and nothing else: `tests/unit/us-008-presets.test.ts` — the exact
  `BUILTIN_DEFAULTS`, the `PRESET_FIELDS` list and the effective-settings key
  list (one test), the exact effective settings of AC-12. No test compared the
  A4 digital text exactly; no row-count test changed.
- Tests sharpened: the US-018 unit and plugin tests read the fields typed
  now (15 untyped reads and 4 casts removed); the effective-settings test
  gains a case where the preset sets no level and the Defaults' 4 counts
  (added after the mutant "Defaults layer skipped" survived).
- Mutants (scratchpad `mut052/run.py`, test files of US-018, US-008, US-019;
  baseline 41 failed, 109 passed): 10, all caught after the added case: level
  range to 7; decimals accepted; `""` accepted; Defaults layer skipped for the
  level (survived first, caught after the new case); built-in level 3; A4
  digital without the line; A5 print with it; a row dropped; switch type not
  checked; word not passed on. Backups by full path, `shasum -a 256 -c` after
  every restore and at the end: all 5 files OK.
- SCAR-017 grep: `externalLinkFootnotes` in 8 files — presets schema, parse,
  merge, convert types and settings rows got their siblings here; convert
  index and emit blocks/inline get theirs in TICKET-053 (the emitter); the
  `runningHeaderLevel` check is now one function.
- Found by the tooling test while working (not code): my rewrite of
  `99_next_action.md` had dropped the `SCAR gate due` line; restored.
