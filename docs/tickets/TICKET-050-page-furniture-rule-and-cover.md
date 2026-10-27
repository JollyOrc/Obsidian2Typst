# TICKET-050 — Preamble rule `page-furniture`: folios, running header, cover numbering, helper names

**Status:** Done (2026-10-20)
**User story:** [US-019](../user-stories/US-019-folios-and-running-headers.md)
**ACs addressed:** AC-3 to AC-9, AC-11
**Depends on:** TICKET-049 (`ConvertSettings.pageFurniture`)
**SCARs:** SCAR-001, SCAR-002, SCAR-008, SCAR-009, SCAR-010, SCAR-015, SCAR-017, SCAR-018

---

## Description

Write the preamble rule `page-furniture` (order 45) with the two helpers
`running-text` and `running-title` and one `#set page(…)` line, as measured
and fixed in AC-3 of the story and in `tests/support/furniture.ts`; give the
cover pages `numbering: none` when folios are on; add the helpers to
`PLUGIN_NAMES`.

---

## Acceptance criteria (from user story)

- **AC-3:** rule 45; exact text for both on (facing pages); folios only;
  header only; the cover pages with `numbering: none` only with folios on; the
  counter reset after the cover as today.
- **AC-4:** footer `align(if calc.even(here().page()) { left } else { right },
  …)` on facing pages, `align(center, …)` on single pages; header and folio
  at 0.9em of the body font.
- **AC-5, AC-6, AC-7:** the helper text decides the title; footnotes are
  removed from it.
- **AC-8:** both off or unset: no rule, byte-identical output; the cover
  unchanged.
- **AC-9, AC-11:** content in the PDF and the fixture.

---

## Implementation notes

- New `src/core/emit/furniture.ts` (pure): `RUNNING_TEXT_HELPER`,
  `RUNNING_TITLE_HELPER` and `pageFurnitureRule(furniture, facingPages):
  string | null`; the only file in `src` that writes `running-title` or
  `running-text` (a text check like US-016 and US-017). The text equals
  `tests/support/furniture.ts` (a unit test compares them).
- `src/core/convert/preamble.ts`: rule `{id: 'page-furniture', order: 45}`
  reading `settings.pageFurniture` and `settings.page.facingPages`.
- `src/core/cover/emit.ts`, `emitCoverPages`: an option `numbering: boolean`
  (default false) that adds `, numbering: none` to the cover page head;
  `convert` passes `pageFurniture?.folios === true`. Existing US-009 and
  US-011 tests stay unchanged because the default keeps today's text
  (SCAR-001: one new transform, off by default, listed in the register).
- `src/core/template/plugin-names.ts`: `running-text`, `running-title`.
- Register (`docs/user-stories/README.md`): a row for the furniture emitter;
  the cover module row gains the `numbering` option; the template-scan row
  names US-019.
- `docs/technical/warning-codes.md`: no new code expected.

---

## Tests

- `tests/unit/us-019-folios-headers.test.ts`: all `US-019 AC-3`, `AC-4`,
  `AC-5`, `AC-8`, `AC-11` tests.
- `tests/unit/us-015-conversion-pipeline.test.ts` (registry list),
  `tests/unit/us-016-callouts-convert.test.ts` (PLUGIN_NAMES).
- `tests/integration/us-019-folios-pdf.test.ts`: all tests (the four helper
  tests are green already and must stay green).
- Mutation checks (SCAR-018): order 46; folios ignored; header ignored; level
  fixed at 2; `calc.even` → `calc.odd`; single pages not centred; cover
  `numbering: none` always; cover `numbering: none` never; `running-text` not
  applied to the last-title branch; size 1em.

---

## SCAR check (2026-10-20, item by item against the Prevention lists)

- **SCAR-001:** `emitCoverPages` gets one transform (`numbering: none`), off
  by default; its doc comment and the register list it; existing cover tests
  are the guard that the default is unchanged. The preamble registry gets a
  rule (US-015 AC-2 list extended).
- **SCAR-002:** composed cases tested in the PDF: cover with and without blank
  page, facing and single pages, headings in callouts, glossary terms,
  footnotes inside bold in a title, level 3.
- **SCAR-003:** every AC has tests (map rows).
- **SCAR-006:** full gate before Done, pass counts in the result.
- **SCAR-007:** the expected Typst is exact (story AC-3, support file).
- **SCAR-008:** the helper text was measured with the bundled compiler; the
  PDF is checked by program (header text, folio text and position, fonts,
  labels); four green tests compile the helper itself.
- **SCAR-009:** the header text is checked in the header position (markup,
  code, link, footnote in and outside bold, long title).
- **SCAR-010:** the rule is one preamble block; join hazards: a `#let` after
  `#set text` and before `#set highlight` (tested by place); no body piece.
- **SCAR-011:** n/a.
- **SCAR-012:** n/a here.
- **SCAR-013, SCAR-014:** n/a (no control).
- **SCAR-015:** AC-9 content tests with the green guard (both off).
- **SCAR-016:** n/a here (preview in TICKET-051).
- **SCAR-017:** one writer of the helpers (text check); `PLUGIN_NAMES` text
  check covers the two `#let`.
- **SCAR-018:** path-mirrored backups, checksum after each restore, the run
  stops on a failed restore.

---

## Definition of done

- [x] Tests named above green; the four helper tests still green
- [x] Register rows written
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)

## Result (2026-10-20)

Changed: new `src/core/emit/furniture.ts` (`RUNNING_TEXT_HELPER`,
`RUNNING_TITLE_HELPER`, `pageFurnitureRule`), re-exported;
`src/core/convert/preamble.ts` (rule `page-furniture`, order 45);
`src/core/cover/emit.ts` (option `numberingNone`, off by default) and
`src/core/convert/cover.ts` (passes it); `src/core/convert/index.ts` (the
rule from `pageFurniture` and `page.facingPages`; `numberingNone` when folios
are on); `src/core/template/plugin-names.ts` (`running-text`,
`running-title`); register rows in `docs/user-stories/README.md`.

- Gate: typecheck, build (`main.js` sha256 `1e6110b99f69…`), lint green;
  `npm test` 1575 passed, 1 todo; integration 348 passed, 1 skipped. The US-019
  preview tests (TICKET-051) are green already.
- New tests: the emitter text equals `tests/support/furniture.ts`; only
  `src/core/emit/furniture.ts` writes the helpers (text check).
- Existing tests changed: `tests/plugin/us-008-export-command.test.ts`, the
  cover text of the plugin export path: the plugin's effective settings carry
  the built-in `folios: true`, so the cover pages now have `numbering: none`
  there (the intended behaviour of AC-3); the "no cover" checks now look for
  the head `#page(margin: 0pt` so they stay as strict. The US-009 and US-011
  cover unit tests are unchanged (they call `convert` without furniture).
- Test and story corrected while coding: the worked example of AC-5 used
  `# Glossary`, whose `##` headings are glossary terms (US-017), so `Late
  chapter` was never a title; the section is now `# Appendix` in the story
  and the test. The test now finds pages relative to the heading starts and
  asserts that each rule has a page of its own (sections lengthened).
- Mutants: 11, all caught (order 46; no numbering; header ignored; level fixed
  at 2; even → odd; single pages not centred; cover numbering always; never;
  last-title branch without `running-text`; folio size 1em; both off not
  null). Note: the folio side (even → odd) is caught by the exact-text unit
  test only; the PDF side test compiles the helper text itself. Backups by
  full path, `shasum -c` after every restore: all OK.
- SCAR-017 grep (`running-` in `src`): `emit/furniture.ts` (9 hits, the
  writer) and `template/plugin-names.ts` (3 hits, the names list) only; the
  re-export in `emit/index.ts` and the call in `convert/index.ts` use the
  constant and function names, not the helper text.
