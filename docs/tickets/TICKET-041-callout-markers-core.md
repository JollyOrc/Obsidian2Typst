# TICKET-041 — Callout markers core: header, built-in styles, aliases, style resolution

**Status:** Done
**User story:** [US-016](../user-stories/US-016-callout-styles.md)
**ACs addressed:** AC-1 (header rule), AC-3 (default title text), AC-8 (field-by-field chain), AC-9
**Depends on:** —
**SCARs:** SCAR-009 (header in every position), SCAR-007, SCAR-017 (one header matcher), SCAR-001

---

## Description

The pure part of callouts in `src/core/markers` (new module; imports only
`core/parse`): recognise the header, know the built-in styles and aliases, and
resolve the style of a type field by field. Nothing is emitted here.

---

## Acceptance criteria (from user story)

- **AC-1:** header = first line of the first paragraph of a blockquote,
  `[!TYPE]` + optional `+`/`-` + optional title after at least one blank;
  `TYPE` one or more characters that are not `]` or blanks; type compared in
  lower case. Refused: `[!note]Title`, `**[!note]** T`, `[!] T`, `[!my type] T`.
- **AC-3:** default title = style `title.text`, else the type as typed with its
  first character upper case and the rest lower case (`[!EXAMPLE]` → `Example`).
- **AC-8:** style name = `T` if the preset or the built-ins have it, else its
  alias target, else `default` (unknown). Field order: preset `<name>`, built-in
  `<name>`, preset `default`, built-in `default`. A user style named like an
  alias wins over the alias.
- **AC-9:** 14 built-in styles (table in the story), fill = colour at 10 % on
  white (half up), border the colour at 0.75 pt, inset 8, title colour the
  colour, no font, no icon; 14 aliases.

---

## Implementation notes

- `src/core/markers/callout.ts`, exported through `src/core/markers/index.ts`:
  - `parseCalloutHeader(line): {type, typed, fold, title} | null` — the only
    place in `src` with a `\[!` pattern (text check in the convert test).
  - `findCallout(quote: BlockquoteNode): {header, line, title: InlineNode[], body: BlockNode[]} | null`
    — reads the first paragraph's inline nodes up to the first soft or hard
    break; the header must be one text node at the start (so `**[!note]**` is
    refused). The rest of that paragraph (after the break) becomes the first
    body paragraph; the title is the inline nodes after the header text, so
    markup, links and footnote references in the title stay nodes for
    `emitInline` (AC-3). A quote whose first child is not a paragraph is no
    callout.
  - `BUILTIN_CALLOUT_STYLES`, `CALLOUT_ALIASES` (frozen), the type
    `CalloutStyle` = `{fill: string | null; border: {color; width}; inset;
    title: {text: string | null; color}; font: {family: string | null; size:
    number | null}; icon: string | null}` (`null` fill = `none`).
  - `CalloutsSettings` = the preset field shape (`Record<string,
    CalloutPresetStyle>`, `fill`/`icon` may be `"none"`).
  - `resolveCalloutStyle(type, settings): {name, style, known}` and
    `defaultCalloutTitle(typed, style)`.
- Defaults live here as data, not in `emit` (CLAUDE.md: no formatting constants
  in `emit`).

---

## Tests

- `tests/unit/us-016-callouts-convert.test.ts` — the four `US-016 AC-1:` tests
  on `parseCalloutHeader` (fields, trimming, refused shapes, any type character).
- `tests/unit/us-016-callout-styles.test.ts` — `US-016 AC-9:` built-in table and
  aliases.
- The AC-8 chain is tested through `convert` (`US-016 AC-8:` tests in the
  styles file); they turn green with TICKET-043, which wires this function.
- Mutation checks: header without the blank rule, case-sensitive type, alias
  checked before the preset, tint rounded down.

---

## SCAR check (2026-10-18, item by item against the Prevention lists)

- **SCAR-001:** no shared utility gets a new call site here. `findCallout`
  becomes one (used by the emitter and the fixture check); its transforms
  (header removed, rest of the first paragraph kept as the first body block,
  type lower-cased) are listed in its comment and in the shared-utilities
  register row added by this ticket.
- **SCAR-002:** a header inside a nested quote is found by the same function on
  the nested node; composed cases are tested through `convert` (TICKET-043).
- **SCAR-003:** every AC part of this ticket has a named test above.
- **SCAR-006:** pass counts recorded when done.
- **SCAR-007:** every rule has its example in the story and the tests.
- **SCAR-008:** n/a (no drawing or third-party API).
- **SCAR-009:** header tested at the first line, after an empty quote line,
  in the middle of a quote, after a first paragraph, outside a quote, with
  blanks and tabs before the title, with a title of blanks.
- **SCAR-010:** n/a here (nothing concatenated).
- **SCAR-011:** n/a (no names generated; style names are user names, validated
  in TICKET-042).
- **SCAR-012:** n/a (no manual handover).
- **SCAR-013, SCAR-014, SCAR-016:** n/a (no dialog, destructive action or control).
- **SCAR-015:** n/a here (content checked end to end in TICKET-043).
- **SCAR-017:** one header matcher; the text check fails for a second `\[!`
  pattern anywhere in `src`.

---

## Definition of done

- [x] Tests named above green; the rest of US-016 red only on later tickets
- [x] `src/core/markers` imports nothing but `core/parse` (and types)
- [x] Shared-utilities register row for `findCallout` / `resolveCalloutStyle`
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)


## Result (2026-10-18)

New: `src/core/markers/callout.ts`, `src/core/markers/index.ts` (imports only
`core/parse` types). Nothing else in `src` changed.

- Tests: the four `US-016 AC-1:` header tests pass when run on their own (copied
  unchanged into a scratch file), because `us-016-callouts-convert.test.ts` cannot
  load until `src/core/emit/callout` (TICKET-043) and `PLUGIN_NAMES`
  (TICKET-044) exist; both `US-016 AC-9:` tests pass in place. Two other tests
  of the styles file pass vacuously (AC-7 "accepts none", AC-13 "unused style")
  and are not counted.
- `npm test`: 1426 passed, 1 todo; 22 failed, all US-016 tests of tickets 042 to
  045 (3 files). ESLint and Prettier clean; `tsc` errors only in US-016 test files.
- Mutants: 6, all caught (no-blank rule, case-sensitive type, untrimmed title,
  note tint `#e6f0fb`, border width 0.5, alias `cite` dropped). Mutants of
  `findCallout`, `resolveCalloutStyle` (alias before preset) and
  `defaultCalloutTitle` can only be caught through `convert`; they are added to
  the mutation list of TICKET-043.
- Shared-utilities register row added (SCAR-001).
