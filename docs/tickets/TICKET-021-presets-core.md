# TICKET-021 — Presets core: schema, YAML parsing, merge, effective settings, names, numbering

**Status:** Done
**User story:** [US-008](../user-stories/US-008-presets-and-settings.md)
**ACs addressed:** AC-1, AC-2, AC-4 (messages), AC-5 (name rules), AC-6 (note texts), AC-13, AC-14
**Depends on:** TICKET-002 (`resolvePageSetup`), TICKET-020 (`ConvertSettings`)

---

## Description

Write the pure part of the presets: what a preset note says, how it is read,
how preset, Defaults and built-ins are merged into the input of `convert`, and
the rules for preset names. Nothing here reads the vault, the disk or Obsidian;
the store (TICKET-022) and the command (TICKET-023) call it.

Decided by the user on 2026-10-17: the `yaml` package (2.9.1, exact) reads the
frontmatter; the schema holds only the fields of finished stories
(`externalLinkFootnotes`, `headingNumbering`, `highlightColor`, `page`,
`template`); built-in defaults are the A5 print geometry with bleed 0.

---

## Acceptance criteria (from user story)

See US-008. This ticket covers:

- **AC-1:** field precedence preset → Defaults → built-in; a field is set when
  present and not `null`; nested `page` fields merge field by field.
- **AC-2:** a preset is a note; frontmatter is YAML; no frontmatter is a valid
  empty preset; unknown fields are ignored; `schemaVersion` rules.
- **AC-4:** the error text `<message> (line <n>)`, first error only, line
  counted in the note with the frontmatter fence as line 1.
- **AC-5:** name validation, `copyName`, alphabetical order, `planDelete`,
  `pickActive`.
- **AC-6:** the texts of the two built-in notes (`BUILTIN_PRESET_TEXTS`).
- **AC-13:** `isValidNumbering` and `COUNTING_SYMBOLS`.
- **AC-14:** `effectiveSettings(preset, defaults, templateExists)`.

---

## Implementation notes

- **`src/core/presets/`:** `schema.ts` (`PresetFields`, `PRESET_FIELDS`,
  `SCHEMA_VERSION`, `BUILTIN_DEFAULTS`), `parse.ts` (`parsePreset`,
  `validateFields`, `formatPresetError`), `merge.ts` (`resolveFields`,
  `effectiveSettings`), `names.ts` (`validatePresetName`, `copyName`,
  `sortPresetNames`, `planDelete`, `pickActive`), `numbering.ts`
  (`COUNTING_SYMBOLS`, `isValidNumbering`), `builtin.ts`
  (`BUILTIN_PRESET_TEXTS`, `emptyPresetText`), `index.ts`.
- `src/core/**` stays pure: the `yaml` import is allowed because it is a
  parser without I/O; the purity test lists it.
- yaml line numbers count inside the frontmatter text; the note line is the
  yaml line + 1 (measured). A frontmatter that is not closed is an error on
  line 1.
- `COUNTING_SYMBOLS` is taken from the measured list in US-008 AC-13 and
  checked against the compiler by `tests/integration/us-008-typst-facts.test.ts`
  (SCAR-008: verified by program, not by eye). `isValidNumbering` must agree
  with the compiler for the sample patterns of that test, including empty
  text, text with only punctuation and text with several symbols (SCAR-009:
  every position of the symbol in the pattern).
- A leading byte-order mark is dropped before the frontmatter is read (line numbers unchanged). Names are stored in NFC and compared after NFC and case folding; the Windows device names and a trailing dot are rejected (decided by the user 2026-10-17, SCAR-011).
- Names compare case-insensitively and by code point; the clash rule states
  the invariant "no two names are equal ignoring case" and checks against the
  whole set, so a natural name that looks like a copy (`A5 print copy`) is
  tested (SCAR-011).
- Messages for wrong types and values are those in `tests/unit/us-008-presets.test.ts`;
  the story's AC-4 example is aligned with them in this ticket
  (`page.bleed must be a number of at least 0 (line 5)`).

---

## Tests

All exist before the code (step 2) and are red until this ticket is done.

- `tests/unit/us-008-presets.test.ts` — AC-1, AC-2, AC-4, AC-5, AC-6, AC-9
  (template scan is TICKET-023), AC-13, AC-14, US-009 AC-1.
- `tests/integration/us-008-typst-facts.test.ts` — AC-13 (every counting
  symbol compiles, `isValidNumbering` equals the compiler).

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each rule of `core/presets` switched off alone is caught
      by a test.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story file updated (AC-4 example and messages aligned).
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

## Implementation result

- `core/presets`: `schema` (fields, `BUILTIN_DEFAULTS`), `parse` (`parsePreset`, `validateFields`, `formatPresetError`; `yaml` with `LineCounter`, `prettyErrors: false`, `uniqueKeys: true`), `merge` (`resolveFields`, `effectiveSettings`), `names` (NFC key, Windows names, `copyName`, `sortPresetNames`, `planDelete`, `pickActive`), `numbering` (`COUNTING_SYMBOLS`, `isValidNumbering`), `builtin` (texts of the two notes), `edit` (`getField`, `withField` for the settings tab).
- `core/template` was written here because the same unit test file covers it: `scan`, `warnings`, `std-names` (157 names generated from the compiler); TICKET-023 uses it. `TEMPLATE_MISSING` and `TEMPLATE_SHADOWS_BUILTIN` are `active` in `docs/technical/warning-codes.md`; the registry test of US-015 lists them no longer as reserved.
- Measured with the bundled compiler over U+0020 to U+27FFF: 24 counting symbols (the story wrote out 17; `Α α ١ ۱ १ ক ১` are also accepted, `Α` and `α` being the Greek letters). A test finds them again by bisection and compares the list with `COUNTING_SYMBOLS`, so a compiler update that adds one fails.
- Mutation check (55 mutants of `core/presets` and `core/template`): all caught. Gaps found and closed: a name that starts with another one (sort tie-break), a field written twice, a frontmatter that is not a mapping after a blank line, preset against Defaults for page fields, and the position of the symbols. Three mutants were equivalent (CR before a line break, `null` in the page merge, a redundant check in `use`) and the code was simplified instead.
