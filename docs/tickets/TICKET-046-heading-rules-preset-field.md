# TICKET-046 — Preset field `headingRules`: schema, validation, effective settings, built-in mapping

**Status:** Done (2026-10-19)
**User story:** [US-017](../user-stories/US-017-heading-rules-glossary.md)
**ACs addressed:** AC-1 (field, messages, effective settings, built-in mapping as data)
**Depends on:** —
**SCARs:** SCAR-007 (every message with its line), SCAR-011 (key uniqueness), SCAR-017 (one key normaliser), SCAR-001

---

## Description

Read and check the `headingRules` group of a preset note, hand it to
`convert`, and define the built-in mapping and the one function that turns a
heading text or a key into its comparison form. The rule is applied in
TICKET-047; this ticket only carries the data.

---

## Acceptance criteria (from user story)

- **AC-1:** `headingRules` is a group of heading texts mapped to `glossary` or
  `none`; the three messages of the story with the line of the field
  (`headingRules must be a group of heading texts`; `headingRules.<text> must
  be a rule name: glossary or none`; `headingRules has the heading text
  "<text>" twice (compared without case and trailing blanks)`, at the line of
  the second key); `null` is unset (also for one entry); preset field only (the
  Defaults drop it, the settings tab and panel get no row); built-in mapping
  `Glossary: glossary`.

---

## Implementation notes

- New `src/core/markers/heading-rules.ts`: `type HeadingRule = 'glossary' |
  'none'`; `type HeadingRulesSettings = Readonly<Record<string, HeadingRule>>`;
  `BUILTIN_HEADING_RULES = Object.freeze({Glossary: 'glossary'})`;
  `headingRuleKey(text: string): string` = trim, collapse runs of white space
  to one blank, lower case with `toLowerCase()` (the same form that
  `visibleText` of US-002 gives a heading, see SCAR-001 below); re-exported
  from `src/core/markers/index.ts`.
- `src/core/presets/schema.ts`: `headingRules?: HeadingRulesSettings` in
  `PresetFields`, `'headingRules'` in `PRESET_FIELDS`.
- `src/core/presets/parse.ts`: `readHeadingRules` in the style of
  `readCallouts` (line keys `headingRules.<text>`); the duplicate check uses
  `headingRuleKey` and a `Map` of keys already seen (not a count), message with
  the second key as typed; values compared exactly (`Glossary` as a value is
  refused, AC-1 test).
- `validateFields` (Defaults): drop `headingRules` as it drops `callouts`.
- `src/core/presets/merge.ts`: `EffectiveSettings.headingRules:
  HeadingRulesSettings`, from the preset only (`{}` when unset).
- `src/core/convert/types.ts`: `ConvertSettings.headingRules?:
  HeadingRulesSettings` (missing = `{}`; the built-in mapping is added in
  `convert`, TICKET-047).
- Existing tests that change because the field list grows (as for
  `callouts`, TICKET-042): in `tests/unit/us-008-presets.test.ts` the
  `PRESET_FIELDS` list, the key list of the effective settings and the exact
  effective settings of AC-12 gain `headingRules`. US-008 AC-1 in the story gets
  "`headingRules` by US-017, preset notes only". No other expectation changes.
- Remove the `rulesOf` cast in `tests/unit/us-017-heading-rules.test.ts` once
  the fields exist (G2 note), so the tests read the typed field.

---

## Tests

- `tests/unit/us-017-heading-rules.test.ts`: `US-017 AC-1: reads the mapping
  with its lines`, `… null is unset`, `… refuses each invalid value with its
  message and line`, `… the effective settings carry the preset headingRules;
  the Defaults have none`, `… the built-in mapping is Glossary: glossary`.
- The two convert-based AC-1 tests (`without the field the built-in rule
  applies…`, `a preset entry adds to the built-in mapping…`) go green with
  TICKET-047.
- Guard: US-008, US-010, US-011 and US-016 preset tests stay green (after the
  field-list update above).
- Mutation checks: duplicate check by exact key (no `headingRuleKey`); trailing
  blanks not trimmed; values compared without case; Defaults not dropped;
  Defaults merged into the effective settings.

---

## SCAR check (2026-10-19, item by item against the Prevention lists)

- **SCAR-001:** `headingRuleKey` is a new shared function; its doc comment
  lists all three transforms (trim, collapse blanks, lower case). It is meant
  to equal the form `visibleText` gives a heading, which also collapses inner
  runs of blanks: so `Tidal   Basin` as a key matches `## Tidal Basin`. The
  story states only "trailing blanks"; the inner collapse is surfaced to the
  user at G3 (see the G3 entry) before code. Edge inputs (`"GLOSSARY  "`,
  `"  glossary "`) are in the tests.
- **SCAR-002:** the field is one level (texts to names); no nested group. A
  nested value (`{a: 1}`) has its message and a test.
- **SCAR-003:** each message has a test with its line; null for the whole
  field and for one entry.
- **SCAR-006:** pass counts recorded in the result.
- **SCAR-007:** the story's examples with lines are the tests.
- **SCAR-008:** n/a (no third-party drawing API).
- **SCAR-009:** n/a (no generated text); key forms covered under SCAR-001.
- **SCAR-010:** n/a (no concatenated output).
- **SCAR-011:** invariant "no two keys have the same comparison form"; checked
  against every key already seen (a set), and the natural clash
  (`Glossary`, `GLOSSARY  `) is a test.
- **SCAR-012:** n/a (no handover in this ticket).
- **SCAR-013:** n/a: no dialog.
- **SCAR-014:** n/a: no destructive action. Worst misplaced click: none.
- **SCAR-015:** n/a (no output judged by eye).
- **SCAR-016:** n/a: no settings row; the preview redraw is TICKET-048.
- **SCAR-017:** one key normaliser (`headingRuleKey`), used by the parser and
  by TICKET-047's matcher; a text check in TICKET-047 shows no second
  normaliser (grep `toLowerCase` in `src/core/markers` and
  `src/core/presets/parse.ts`, hits listed in the result).

---

## Definition of done

- [x] Tests named above green; US-008, US-010, US-011, US-016 preset tests green
- [x] `rulesOf` cast removed from the US-017 unit tests
- [x] US-008 AC-1 text in the story extended
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)

## Result (2026-10-19)

Changed: new `src/core/markers/heading-rules.ts` (`HeadingRule`,
`HeadingRulesSettings`, `HEADING_RULE_NAMES`, `BUILTIN_HEADING_RULES`,
`headingRuleKey`), re-exported from `src/core/markers/index.ts`;
`src/core/presets/schema.ts` (field, `PRESET_FIELDS`), `parse.ts`
(`readHeadingRules`, preset notes only), `merge.ts`
(`EffectiveSettings.headingRules` from the preset only),
`src/core/convert/types.ts` (`ConvertSettings.headingRules?`).

- Tests: the five field tests of US-017 AC-1 green (`reads the mapping with
  its lines`, `null is unset`, `refuses each invalid value…`, `the effective
  settings…`, `the built-in mapping…`). The two convert-based AC-1 tests stay
  red until TICKET-047.
- Gate: typecheck, build (`main.js` sha256 `30d1f26535b9…`), lint green;
  `npm test` 1508 passed, 37 failed (34 US-017 unit, 2 US-017 preview, 1
  US-016 PLUGIN_NAMES; all owned by TICKET-047/048), 1 todo; integration 277
  passed, 53 failed (all `us-017-glossary-pdf`, TICKET-047), 1 skipped.
- Existing tests changed because the field list grew (US-008 AC-1 extended):
  in `tests/unit/us-008-presets.test.ts` the `PRESET_FIELDS` list, the key
  list of the effective settings and the exact effective settings of AC-12
  gained `headingRules`. No other expectation changed.
- Mutants: 7, all caught after two tests were strengthened (duplicate check
  by exact key; no trim; no lower case; value compared without case; Defaults
  not dropped; Defaults merged; null entry stored as `none`). "Defaults merged"
  and "null becomes none" survived at first: the AC-1 tests now check
  effective settings with `headingRules` only in the Defaults, and that
  `Glossary: null` gives `{}` (a stored `none` would switch the built-in rule
  off). Sources restored and compared by sha256 after the run.
- SCAR-017 grep (`toLowerCase` in `src/core/markers` and
  `src/core/presets/parse.ts`): `heading-rules.ts:39` (the normaliser);
  `callout.ts:46`, `:122` (callout type, US-016 AC-1) and `:305` (default
  callout title, US-016 AC-3) are other rules, not heading-text comparison —
  not affected. No second heading-key normaliser.
