# TICKET-075 — Page breaks by heading level (core)

**Status:** Done (2026-10-28)
**User story:** [US-025](../user-stories/US-025-page-breaks-by-heading.md)
**ACs addressed:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-8, AC-9 (AC-10
follows: the preview compiles the same document)
**Depends on:** —
**SCARs:** SCAR-001, SCAR-002, SCAR-007, SCAR-008, SCAR-009, SCAR-010,
SCAR-015, SCAR-017, SCAR-018, SCAR-019, SCAR-021, SCAR-023, SCAR-024

---

## Description

The pure core of US-025: the preset field `page.breakBefore`, the three lines
written before a breaking top-level heading (one break where headings meet,
the first block included), and the blank-page test `o2t-blank` in the page
furniture so that an added page prints its folio only.

---

## Acceptance criteria (from user story)

- **AC-1:** `page.breakBefore.h1` … `h6`, each `none`, `page`, `right`,
  `left`; messages `page.breakBefore.h1 must be none, page, right or left
  (line 5)` and `page.breakBefore has no key "h7" (line 6)`; merged key by key;
  missing = `none`.
- **AC-2:** before a breaking heading: `#metadata(none) <o2t-break-before>`,
  `#pagebreak(to: "odd", weak: true)` (`right`), `to: "even"` (`left`),
  `#pagebreak(weak: true)` (`page`, and every rule with facing pages off),
  `#metadata(none) <o2t-break-after>`, then the heading line.
- **AC-3:** only top-level headings of the body; not terms, in-term headings,
  callout, quote, list item, footnote, empty headings.
- **AC-4:** adjacent headings: one break before the first; a side beats
  `page`, `page` beats `none`, of two sides the first heading's.
- **AC-5:** the first block breaks too (decision 1), after the cover pages.
- **AC-6:** `o2t-blank(p)` in the furniture rule; the header prints nothing on
  an added page; `o2t-blank` joins `PLUGIN_NAMES`; without a rule the
  furniture is unchanged.
- **AC-8, AC-9:** the composed note; every value at levels 1, 2, 3, 6.

---

## Implementation notes

- `src/core/presets/schema.ts`: `PagePresetFields.breakBefore?:
  Partial<Record<BreakLevel, BreakRule>>`; `BreakRule = 'none' | 'page' |
  'right' | 'left'`, `BreakLevel = 'h1' … 'h6'` (in `core/layout`, which owns
  page rules; the presets import it).
- `src/core/presets/parse.ts` (`readPage`): read `breakBefore` as a group;
  the two messages; each problem carries the key's line (as the margins do).
- `src/core/presets/merge.ts`: `resolveFields` gives `breakBefore` with all
  six keys, preset over Defaults over `none`, key by key (as `pageFurniture`);
  kept out of the geometry (`PageSettingsInput`, SCAR-001: the furniture test
  of US-019 AC-1 is the model); `EffectiveSettings.breakBefore`.
- `src/core/convert/types.ts`: `ConvertSettings.breakBefore?` (missing = every
  level `none`; older callers unchanged).
- New `src/core/emit/breaks.ts`: `breakLines(rule, facingPages): string |
  null` (the three lines) and `mergeRules` (AC-4). The only file in `src` that
  writes `#pagebreak(` (SCAR-017; a text check in the US-025 tests, written
  with this ticket). US-026 adds its breaks here.
- `src/core/emit/blocks.ts`: at the top level only (`nested` false), before a
  heading that is not a term or in-term heading (`env.glossary.roles`) and not
  empty (`env.headings.byNode`), write the lines for the strongest rule of the
  run of adjacent headings; the decision is taken in the block loop (it sees
  the next block), not in the heading branch.
- `src/core/emit/furniture.ts`: `O2T_BLANK_HELPER` (`#let o2t-blank(p) = …`,
  true when a `<o2t-break-before>` and an `<o2t-break-after>` marker lie on
  different pages and `p` is strictly between them, or after the before-marker
  on a page that holds nothing but the break); the header and the footer ask
  it: on a blank page the header writes nothing, the footer only the folio.
  Written only when a rule other than `none` is set (`pageFurnitureRule`
  learns `breaks: boolean`). The exact helper is measured with the compiler
  before it is written (SCAR-024; the PDF tests of AC-2, AC-5, AC-6 decide).
- `src/core/template/plugin-names.ts`: `o2t-blank`.
- Register (`docs/user-stories/README.md`): a row "Page breaks
  (`core/emit/breaks.ts`)"; the furniture row gets `o2t-blank`.

### Guards searched before the ticket (SCAR-023)

- `tests/unit/us-016-callouts-convert.test.ts` "PLUGIN_NAMES are fit-image, …"
  pins the exact list. Its criterion (US-016 AC-11) is "every name the plugin
  defines is listed"; the list grows with `o2t-blank` in this ticket (the test
  text and title name US-025 AC-6).
- `tests/unit/us-019-folios-headers.test.ts` pins the furniture rule's text
  without break rules: unchanged (the helper is written only with a rule; the
  US-025 guard test asserts the same).
- `tests/unit/us-015-conversion-pipeline.test.ts` pins the `[id, order]` list
  of `PREAMBLE_RULES`: no new rule (the helper is in `page-furniture`).
- `src/core/template/std-names.ts` lists `pagebreak` as a Typst name: a
  template warning only; not affected.

---

## Tests

- `tests/unit/us-025-page-breaks.test.ts` (all), with a text check: only
  `core/emit/breaks.ts` writes `#pagebreak(` in `src`.
- `tests/integration/us-025-page-breaks-pdf.test.ts` (all).
- `tests/plugin/us-025-break-rows.test.ts` AC-10 (the preview) turns green
  here; the rows are TICKET-076.
- US-002, US-011, US-015 to US-019, US-023 tests stay green.
- Mutation checks (SCAR-018): `right` written as `to: "even"`; `weak` dropped;
  the first block skipped; breaks inside a callout; a term breaks; the
  weaker rule of a run wins; the second of two sides wins; facing pages off
  still writes sides; `o2t-blank` always false; the helper written without a
  rule; the merge takes the Defaults over the preset; a message text changed.

---

## SCAR check (2026-10-28, item by item against the Prevention lists)

- **SCAR-001** (1) `breakLines` and the marker labels documented in a new
  register row; (2) the furniture rule's new call site read: the helper only
  reads markers; (3) no flag on a shared function beyond `breaks`; (4) edge
  inputs: a heading as first block, after a cover, adjacent headings.
- **SCAR-002** (1–5) composed in AC-8 (cover and blank page, glossary, callout
  heading, footnote, page references, furniture, template hook); checked
  against US-002, US-011, US-016 to US-019, US-023; nested cases (callout,
  quote, list, terms) in AC-3.
- **SCAR-003** (1) red tests exist (G2); (2) the AC list read again; (3) map.
- **SCAR-006** (1–4) full gate, no skip, counts in the result; TICKET-076 and
  TICKET-077 tracked.
- **SCAR-007** (1–3) exact lines, page tables and messages in the tests.
- **SCAR-008** (1) the Typst facts measured with the bundled compiler (G1,
  G2 row 3); (2) no blank result accepted: texts and folios read by program;
  (3) by program; (4–5) n/a (no canvas); (6) pointer.
- **SCAR-009** (1–4) the break lines at the start of the body, after the
  cover pages, between headings, before the last heading.
- **SCAR-010** (1–6) the pieces are whole lines joined by line breaks; the
  join of the after-marker with the heading line is tested exactly; no inline
  concatenation.
- **SCAR-011** (1–5) the labels `o2t-break-before`, `o2t-break-after` cannot
  be heading labels (those start `h-`); used many times on purpose (queried,
  never referenced by `link`); no counter.
- **SCAR-012** n/a here (TICKET-077).
- **SCAR-013, SCAR-014** n/a (no dialog, no write into the vault).
- **SCAR-015** (1) AC-8 asserts texts, sides, refs, added pages; (2) guard:
  rules `none` give today's bytes; (3–5) M15 in TICKET-077.
- **SCAR-016** n/a (no control; TICKET-076).
- **SCAR-017** (1) grep for `pagebreak` in `src`: none today (only the Typst
  name list); (2) the rule for the class in the story (AC-3: only top-level
  headings); (3) one writer (`breaks.ts`) and a text check; (4) n/a; (5) n/a;
  (6) pointer; (7) these documents follow the same check; (8) applies.
- **SCAR-018** (1–10) backups of `schema.ts`, `parse.ts`, `merge.ts`,
  `types.ts`, `blocks.ts`, `furniture.ts`, `plugin-names.ts`, `breaks.ts` by
  full path with checksums; restores checked; one match per edit; arrays;
  baseline in the run; caught only on a verified tree; survivors read as
  inputs first; the backup holds the state before the run; the file list
  checked against files that change only with approval (none here).
- **SCAR-019** (1–5) each value at levels 1, 2, 3, 6, facing pages on and off;
  the Defaults and preset merge with a non-default value.
- **SCAR-020** (1–3) the alternatives of decisions 1 to 3 were measured or
  need no measurement (G1).
- **SCAR-021** (1–3) the helper reads markers and changes no layout; a sweep
  across a page edge in the AC-6 test (filler 30 before each chapter).
- **SCAR-022** n/a (no callback).
- **SCAR-023** (1) each test states its criterion; (2) the AC-8 test counts the
  added pages; (3) whole lines compared; (4) inputs the parser gives; (5)
  guards searched (above); (6) the green-before-code page-reference test is
  paired with the "breaks hold" test that shows the rule in effect; (7) the
  mutation run; (8) the determinism tests of US-015 cover the new lines; (9)
  applies.
- **SCAR-024** (1–5) the helper `o2t-blank` is measured before it is written;
  every Typst statement in the story is measured; none added here unmeasured.
- **SCAR-025** n/a here (TICKET-077).
- **SCAR-026** (1–4) the grep for `pagebreak` classified: one hit, a Typst
  name list, not a writer.
- **SCAR-027** n/a (nothing replaced).

---

## Definition of done

- [x] Tests named above green; US-002, US-011, US-015 to US-019, US-023 green
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)
- [x] Register rows updated; the US-016 names test extended

---

## Result (2026-10-28)

Changed: `src/core/layout/page-setup.ts` (`BreakRule`, `BreakLevel`,
`BREAK_LEVELS`, `BREAK_RULES`, `BreakRules`, `NO_BREAKS`),
`src/core/presets/schema.ts` (`PagePresetFields.breakBefore`),
`src/core/presets/parse.ts` (`readBreakBefore`), `src/core/presets/merge.ts`
(`breakBefore` level by level, kept out of the geometry,
`EffectiveSettings.breakBefore`), `src/core/convert/types.ts`
(`ConvertSettings.breakBefore`), new `src/core/emit/breaks.ts`
(`breakLines`, `mergeRules`, `ruleOf`, the labels), `src/core/emit/blocks.ts`
(`addBreaks` at the top level of the body; option `breaks`),
`src/core/emit/furniture.ts` (`O2T_BLANK_HELPER`, `pageFurnitureRule(…,
breaks)`), `src/core/emit/index.ts` (exports), `src/core/convert/index.ts`
(breaks only when a level has a rule), `src/core/template/plugin-names.ts`
(`o2t-blank`). Register rows "Page furniture" and "Page breaks".

- Gate (scratchpad `gate075.log`): typecheck, build (`main.js` sha256
  `c223399a8ca8…`), lint green; `npm test` 1902 passed, 89 failed, 1 todo;
  integration 412 passed, 50 failed, 1 skipped. All US-025 unit (58) and PDF
  (18) tests green, and the two preview tests of AC-10. The red tests: 4 of
  TICKET-076 (the rows), the rest of US-026 to US-028 (and the US-017 message
  test narrowed for US-026).
- AC → tests: AC-1 to AC-6, AC-8 to AC-10 green; AC-7 TICKET-076.
- Measured before written (SCAR-024): `o2t-blank` on the page tables of AC-2,
  AC-5 and AC-6 (scratch `p075/blank.test.ts`): blank pages folio only, the
  headers `A` and `C` kept on continued pages.
- Tests changed while coding (reported): the AC-8 "added pages" test asserted
  over the composed note with `h2: page`, which needs no added page (each H1
  already falls on a right page): its input could not reach the rule
  (SCAR-023); it now uses `h2: right`. A sweep test added: the text before
  `Two` over a page edge (n = 10 to 30), no added page with a header.
- Guards missed at G3 (SCAR-023, reported): `tests/unit/us-008-presets.test.ts`
  pins the effective settings' keys (AC-1) and the whole object (AC-12); their
  criterion is "every setting reaches the pipeline", so both were extended
  with `breakBefore` (all `none`). US-026 to US-028 add keys there too (noted
  for their tickets). The US-016 plugin-names list extended with `o2t-blank`.
- Mutants (scratchpad `mut075/run.py`, `run.log`; US-025 unit and PDF,
  US-019 and US-016 unit tests; baseline 142 passed, 0 failed): 14 run, 13
  caught. The survivor — `o2t-blank` without its "before-marker at the page
  top" clause — was read as an input question first: a zero-height marker
  stays at the end of the page before, so a page starts with one only before
  any heading, where the header is empty anyway; the page-top sweep did not
  reach it either. The clause was removed (no reachable effect), the helper
  is the plain "strictly between" test, and the sweep stays as a guard. Every
  restore checked with `shasum -a 256 -c` (5 files OK at the end).
- SCAR-017 grep after the code: `#pagebreak(` only in `core/emit/breaks.ts`
  (the text check); `breakBefore` in presets, convert and the tests.
