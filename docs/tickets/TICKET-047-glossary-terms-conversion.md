# TICKET-047 — Glossary terms in the conversion: sections, terms, emission, rule `glossary`, warnings

**Status:** Done (2026-10-19)
**User story:** [US-017](../user-stories/US-017-heading-rules-glossary.md)
**ACs addressed:** AC-1 (applied in `convert`), AC-2 to AC-11, AC-13, AC-14
**Depends on:** TICKET-046 (`HeadingRulesSettings`, `BUILTIN_HEADING_RULES`, `headingRuleKey`)
**SCARs:** SCAR-001, SCAR-002, SCAR-009, SCAR-010, SCAR-011, SCAR-015, SCAR-017

---

## Description

Find the glossary sections of a note, turn the headings one level below the
matched heading into term entries (run-in or alone), print deeper headings in a
term without number and outline entry, and write the helper `glossary-term`
through the preamble rule `glossary` (order 86). Report sections without terms
and deeper headings in terms.

---

## Acceptance criteria (from user story)

- **AC-1 (applied):** the effective mapping is `BUILTIN_HEADING_RULES` plus
  the preset's entries, a preset key replacing a built-in key of the same
  comparison form; `none` switches a key off.
- **AC-2:** a top-level heading of level 1 to 5 matches when
  `headingRuleKey(visibleText(heading, {dropImages: true}))` equals a key's
  comparison form; headings inside a callout, quote or list item never match.
- **AC-3:** section = from the matched heading of level `n` to the next
  top-level heading of level ≤ `n`; terms = its headings of level `n + 1`;
  blocks before the first term unchanged.
- **AC-4, AC-5:** run-in form `#glossary-term[<term>] <label> <paragraph>`;
  lone form `#block(sticky: true)[#glossary-term(run-in: false)[<term>] <label>]`.
- **AC-6:** rule `glossary`, order 86, helper text of the story, only with at
  least one term; `glossary-term` in `PLUGIN_NAMES`.
- **AC-7:** labels from the US-002 index unchanged; terms are not headings;
  `HEADING_EMPTY` and `HEADING_LEVEL_SKIPPED` computed as today.
- **AC-8:** the ten composed cases; an image in a term heading placed after
  the run-in paragraph (decided 2026-10-19).
- **AC-9:** `HEADING_RULE_NO_TERMS` at the matched heading's line.
- **AC-10, AC-11:** page breaks and content in the PDF.
- **AC-13:** the fixture: 40 run-in terms, unchanged outside the section.
- **AC-14:** `#heading(level: k, numbering: none, outlined: false)[…] <label>`
  for a heading of level ≥ `n + 2` after the first term, with
  `HEADING_IN_TERM`.

---

## Implementation notes

- `src/core/markers/glossary.ts` (pure, no emit imports): `findGlossary(root:
  readonly BlockNode[], rules: HeadingRulesSettings, headings: HeadingIndex):
  GlossaryPlan` with, per heading node, its role: `term` (with the next block
  for the run-in decision) or `in-term` (with the term's visible text), and the
  warnings `HEADING_RULE_NO_TERMS` and `HEADING_IN_TERM` with lines. Walks only
  `root` (top-level blocks), so nested headings never match (AC-2, AC-8).
- `src/core/emit/glossary.ts`: `GLOSSARY_HELPER` (the story's text) and the
  writers `emitTermRunIn(term, label, paragraph)`, `emitTermAlone(term,
  label)`, `emitUnnumberedHeading(level, text, label)`. The only file in `src`
  that holds `#glossary-term` or `#let glossary-term` (text check, unit test
  "one place writes terms").
- `src/core/emit/blocks.ts`: in `case 'heading'`, ask the plan; a term takes
  the following paragraph (if any) into the run-in form, so the block loop
  skips it; the term text and the unnumbered heading text are emitted with the
  same `emitInline` options as a heading (`where: 'heading'`,
  `atBlockStart: false`, `breaks: 'space'`); the paragraph with its usual
  options (`atBlockStart: true`). Images of a term heading follow the run-in
  paragraph (AC-8).
- `src/core/convert/index.ts`: merge the mapping (built-in plus preset by
  `headingRuleKey`), call `findGlossary` after `indexHeadings`, pass the plan
  through the emit context, add `glossary: GLOSSARY_HELPER | null` to the
  preamble context.
- `src/core/convert/preamble.ts`: rule `{id: 'glossary', order: 86}`.
- `src/core/template/plugin-names.ts`: add `glossary-term`.
- `docs/technical/warning-codes.md`: rows `HEADING_RULE_NO_TERMS` (US-017
  AC-9) and `HEADING_IN_TERM` (US-017 AC-14), status `active`.
- Shared-utilities register in `docs/user-stories/README.md`: new rows for
  `findGlossary`, the glossary emitter and `headingRuleKey`; `visibleText`,
  `emitInline`, `escapeMarkup` rows gain US-017 call sites.
- Existing tests whose expectation changes because the built-in rule now
  applies to the fixture: none expected (G2 check: US-002 label count 655 is
  from the heading index, unchanged; numbering test counts level-1 headings,
  unchanged). Any other change is reported, not silently updated.

---

## Tests

- `tests/unit/us-017-heading-rules.test.ts`: all tests of AC-1 (the two
  convert-based ones), AC-2 to AC-9, AC-13, AC-14, the warning-code rows and
  "one place writes terms".
- `tests/unit/us-016-callouts-convert.test.ts`: `PLUGIN_NAMES are fit-image,
  callout, callout-styles and glossary-term`.
- `tests/integration/us-017-glossary-pdf.test.ts`: all tests (shapes, run-in
  line, AC-10 sweeps and guard, AC-11 content and guard, AC-14 and guard,
  fixture, joins).
- Mutation checks: section end at `<` instead of `≤`; terms at level `n + 2`;
  nested headings matched (walk all headings, not `root`); run-in for a lone
  first block; `sticky` removed; label dropped from a term; unnumbered heading
  keeps `outlined: true`; no-terms warning missing; rule order 87; helper
  separator ` - `; `dropImages` off in matching.

---

## SCAR check (2026-10-19, item by item against the Prevention lists)

- **SCAR-001:** new call sites, transforms checked: `visibleText` (text,
  code, emphasis children, link text, wikilink alias, image alt unless
  `dropImages`; footnotes, comments add nothing; blanks collapsed; trimmed) —
  used with `dropImages: true` so `## ![x](i.png) Glossary` still matches
  (alt text is not heading text); the collapse of inner blanks is the open
  point of TICKET-046. `emitInline` with heading options for the term text
  (markup, code, link, footnote; tests derive the expected text from today's
  heading). `escapeMarkup` through the paragraph (block-start escaping kept;
  tests with `\-`, `\#`, `\$`). The label of the US-002 index (no new label
  function). Each new call site gets its register row.
- **SCAR-002:** composed cases tested: level-2 glossary, two sections,
  inside a callout, inside a list item, callout after a term, footnotes,
  image, wikilink, deeper heading, introduction heading.
- **SCAR-003:** every AC has named tests (map rows AC-1 to AC-14).
- **SCAR-006:** full gate before Done; pass counts in the result.
- **SCAR-007:** the story's md/typ pairs are the expected strings.
- **SCAR-008:** the compiler output is checked by program (text, bookmarks,
  links, fonts) with readers measured against real PDFs (G2); no canvas.
- **SCAR-009:** the generated term sits in every position: start of the
  section, after an introduction, between terms, at the end of the note,
  before the next section; paragraph start characters (13 joins).
- **SCAR-010:** join table for the two piece types: run-in (term call, label,
  blank, paragraph first character × 13) and lone (sticky block × 10
  neighbours); guard: without the label `(` and `[` join the call (measured,
  green test); mutation: label dropped.
- **SCAR-011:** invariant "labels and link targets equal with and without
  the rule" tested over a mixed note and the fixture; natural clash
  `h-gambit-2`.
- **SCAR-012:** n/a here (handover in TICKET-048).
- **SCAR-013:** n/a: no dialog.
- **SCAR-014:** n/a: no destructive action; worst misplaced click: none.
- **SCAR-015:** AC-11 asserts content and has the guard `Glossary: none`;
  AC-14 guard `2.0.1`; the sweeps fail when no term is in the Typst.
- **SCAR-016:** n/a here (preview in TICKET-048).
- **SCAR-017:** one writer of `#glossary-term` (text check); one recogniser
  (`findGlossary`); one key normaliser (`headingRuleKey`); `PLUGIN_NAMES`
  text check covers the new `#let`. Grep for a second heading-to-term path
  (`glossary` in `src`) listed in the result.

---

## Definition of done

- [x] Tests named above green; all earlier tests green or each change reported
- [x] Warning-code rows and register rows written
- [x] Mutation checks run, results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)

## Result (2026-10-19)

Changed: new `src/core/markers/glossary.ts` (`findGlossary`,
`headingRuleTable`, `EMPTY_GLOSSARY_PLAN`, types), new
`src/core/emit/glossary.ts` (`GLOSSARY_HELPER`, `emitTermRunIn`,
`emitTermAlone`, `emitUnnumberedHeading`), both re-exported;
`src/core/emit/blocks.ts` (plan in the block env; heading case writes term,
lone term and unnumbered heading; a consumed paragraph is skipped; images of a
term follow the run-in paragraph); `src/core/convert/index.ts` (one heading
index for plan and emitter, merged mapping, plan warnings, helper for the
preamble); `src/core/convert/preamble.ts` (rule `glossary`, order 86);
`src/core/template/plugin-names.ts` (`glossary-term`);
`docs/technical/warning-codes.md` (two rows; `TEMPLATE_NAME_TAKEN` row names
`glossary-term`); register rows in `docs/user-stories/README.md`.

- Gate: typecheck, build (`main.js` sha256 `0d72bd803f1e…`), lint green;
  `npm test` 1547 passed, 1 todo; integration 332 passed, 1 skipped. The US-017
  preview tests (TICKET-048) are green already.
- Deviation found while coding, decided by the user (2026-10-19): the term text
  and the text of a heading in a term are emitted with `atBlockStart: true`
  (measured: with `false` the terms `- x`, `+ x`, `1. x`, `/ t: d`, `= x` become
  list, term list or heading inside the bold term; today's `== - x` headings are
  not affected). AC-4 and AC-14 amended; three tests added (unit term, unit
  deeper heading, PDF "prints as written").
- Rule made precise while coding: a term is run-in only when the next
  paragraph does not start with an image (an image is a block of its own,
  US-003 AC-1c), so AC-5's "image first" gives the lone form.
- Test corrected: the AC-13 unit test expected `A thing you can do.`; the
  fixture's text is `A move you can make in a round.` (a wrong assumption in
  the test, not in the code).
- Existing tests changed: `tests/unit/us-015-conversion-pipeline.test.ts`
  registry list gained `['glossary', 86]` (US-015 AC-2 text extended);
  `tests/unit/us-016-callouts-convert.test.ts` PLUGIN_NAMES list (G2). No other
  expectation changed; the fixture tests of US-001, US-002, US-004 stay green.
- Mutants: 14, all caught (section end `<`; terms at `n + 2`; walking all
  headings; no image check; in-term before the first term; no-terms warning
  missing; table order swapped; sticky removed; label dropped; `outlined:
  true`; separator ` - `; order 87; `dropImages: false`; term not at block
  start). First run invalid: the backups were stored by base name, so
  restoring `markers/glossary.ts` copied `emit/glossary.ts` over it; `shasum
  -c` reported it, the file was rebuilt from the session's edits and matched
  the recorded checksum, and all 14 mutants were run again with path-mirrored
  backups and a checksum check after each restore.
- SCAR-017 grep (`glossary` in `src`): `convert/index.ts`, `convert/preamble.ts`,
  `emit/blocks.ts`, `emit/glossary.ts`, `emit/index.ts`, `markers/glossary.ts`,
  `markers/heading-rules.ts`, `markers/index.ts`, `presets/parse.ts`,
  `template/plugin-names.ts` — each is the one place of its job (pipeline,
  rule, block wiring, writer, re-export, recogniser, mapping, re-export, preset
  field, names list); `#glossary-term` is written only in `emit/glossary.ts`.
