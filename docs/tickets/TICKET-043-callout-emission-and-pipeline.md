# TICKET-043 — Callout emission, preamble rule `callouts`, fonts, icons, warnings

**Status:** Done
**User story:** [US-016](../user-stories/US-016-callout-styles.md)
**ACs addressed:** AC-1 (in the output), AC-2, AC-3, AC-4, AC-5, AC-6, AC-8 (through `convert`), AC-10, AC-11 (without the template part), AC-12, AC-13, AC-14, AC-15, AC-17
**Depends on:** TICKET-041, TICKET-042
**SCARs:** SCAR-001, SCAR-010, SCAR-011, SCAR-015, SCAR-017, SCAR-009, SCAR-008, SCAR-006

---

## Description

Turn a callout into `#callout("<style>", title: […])[…]`, write the preamble
rule `callouts` (order 85) with the used styles and the helper, resolve the
style fonts and icons, and report the two new warnings.

---

## Acceptance criteria (from user story)

- **AC-2:** call on its own line, body indented by 2, `]` alone; empty body
  `[⏎]`; style name through `typstString`; nothing after `]`.
- **AC-3:** title from the header (inline Markdown, `atBlockStart: true`), else
  `title.text`, else the capitalised type; `title.text: ""` → `title: none`.
- **AC-4:** fold signs ignored. **AC-5:** every block kind in the body.
- **AC-6:** nesting in callouts, list items and quotes; headings keep labels;
  footnotes numbered in order.
- **AC-10:** unknown type → `default`, one `CALLOUT_TYPE_UNKNOWN` per callout at
  the header line.
- **AC-11:** rule `callouts`, order 85, only with a callout; used styles sorted
  by name; exact helper text; number and colour formats.
- **AC-12:** style family through `resolveFonts`' lookup; missing → one
  `FONT_MISSING` per family, `font: none`.
- **AC-13:** icons through the asset resolver (US-003 destinations, one
  used-name set, copied once); only for used styles; `CALLOUT_ICON_MISSING`
  (not found / not an image) once per style at line 0.
- **AC-14:** breakable box, sticky title. **AC-15:** composed PDF content.
- **AC-17:** `compiledtext.md` gives no callout output.

---

## Implementation notes

- `src/core/emit/callout.ts` (the only file that writes `#callout(` and
  `callout-styles`; text check): `CALLOUT_HELPER`, `emitCallout(...)` for the
  block, `calloutStylesRule(entries)` for the dictionary. Numbers in pt
  through the formatter `length` of `core/fonts/resolve.ts` (`${Number(n)}pt`,
  module-private today: export it once, SCAR-001/017; `emit/image.ts` and
  `cover/crop.ts` format differently and are left as they are, listed in the
  result); colours lower-cased;
  family and icon path through `typstString`.
- `src/core/emit/blocks.ts`, case `blockquote`: `findCallout(block)` (TICKET-041)
  first; a callout renders `emitCallout` with the body from `renderBlocks(…,
  nested=true)` and is emitted even when the body is empty (a plain quote with
  an empty body still emits nothing). The title goes through `emitInline` with
  the paragraph context (`atBlockStart: true`), so links, marks and footnote
  calls behave as in a paragraph. `BlockOptions.callouts?: CalloutUse` = `{use(type,
  typed, line): {name, defaultTitle}}` supplied by the pipeline; it records the
  used names. The line mark (`mark`) goes in front of the call as for a quote.
- `src/core/convert`: build the `CalloutUse` from `settings.callouts` with
  `resolveCalloutStyle`, report `CALLOUT_TYPE_UNKNOWN` through the context,
  and after the body resolve each used style: font family via the same lookup
  as `resolveFonts` (one `FONT_MISSING` per family, role text `callout
  <name>`, body family named), icon via the pipeline's asset resolver
  (destination from `destination()`, so body images and icons share one
  used-name set; first-bytes check as for images). Register
  `{id: 'callouts', order: 85}` in `PREAMBLE_RULES`; `PreambleContext` gets
  `callouts: string | null`.
- `docs/technical/warning-codes.md`: rows `CALLOUT_TYPE_UNKNOWN` (US-016 AC-10)
  and `CALLOUT_ICON_MISSING` (US-016 AC-13), status `active`.
- Shared-utilities register (`docs/user-stories/README.md`): call sites added
  for `escapeMarkup`/`emitInline` (title), `typstString` (style name, family,
  icon path), `emitBlocks` (body), asset resolver (icons), font lookup (style
  families), and a row for `emit/callout`.
- Join hazards (SCAR-010) go into this ticket's result in the form of
  TICKET-013 (there is no separate join table): the measured neighbours and
  the guard tests.

---

## Tests

- `tests/unit/us-016-callouts-convert.test.ts` — every test except the four
  `parseCalloutHeader` tests (TICKET-041) and the `names the plugin defines`
  group (TICKET-044).
- `tests/unit/us-016-callout-styles.test.ts` — `US-016 AC-8:` (through
  `convert`), `AC-9:` alias test, all `AC-12:` and `AC-13:` tests.
- `tests/integration/us-016-callouts-pdf.test.ts` — all tests.
- Guards kept: the unmapped-key compile error, the sticky sweep without
  `sticky`, the plain-quote PDF without fills.
- Mutation checks (each must be caught): `sticky` removed; `breakable: false`;
  unknown type emitted under its own name; styles not sorted; unused styles
  written; icon copied for an unused style; second `FONT_MISSING` for the same
  family; title without `atBlockStart`; from TICKET-041: alias checked before
  the preset, title not split at the first break, `defaultCalloutTitle` without
  lower-casing the rest; empty-body callout dropped like an
  empty quote; colour not lower-cased; `8.0pt` with a trailing zero.

---

## SCAR check (2026-10-18, item by item against the Prevention lists)

- **SCAR-001:** new call sites: `emitInline`/`escapeMarkup` for the title (all
  transforms apply: it is block-start text inside `[…]`; edge inputs `- x`,
  `# 5 and $3`, `+ x`, `/ term: x`, `My_box`, `A*b` tested), `typstString`
  (quote and backslash in a family tested), `emitBlocks` (all block kinds
  inside, AC-5), asset resolver (`_external`, relative path, `-2` clash
  tested), font lookup (case-insensitive name, missing family tested). Each
  is entered in the shared-utilities register.
- **SCAR-002:** AC-6 composed cases (three levels, quotes both ways, heading,
  footnote) tested in the output and compiled.
- **SCAR-003:** every AC of this ticket has named tests (register rows).
- **SCAR-006:** the whole gate must be green after this ticket except the
  TICKET-044 tests; pass counts recorded.
- **SCAR-007:** exact strings in all tests.
- **SCAR-008:** the PDF is checked by program: fill operators (measured
  `r g b scn`), image objects (`/Subtype /Image`, one per file, measured),
  embedded font; the helper's Typst options (`breakable`, `sticky`, `below`,
  `baseline`) are read from the Typst 0.14 reference and compiled in the
  shapes test before use.
- **SCAR-009:** title escaping tested at block start; callouts at document
  start, end, after every neighbour kind, in list items.
- **SCAR-010:** join hazards of `#callout(…)[…]` = those of `#quote(block:
  true)[…]` (a call followed by `[`; `]` followed by text): one blank line on
  each side, nothing after `]` (as TICKET-013: blocks need no call separator). Cross product with 11 neighbours, start, end,
  list item in the integration test; guards for `sticky` and for the
  unmapped key; mutation checks above.
- **SCAR-011:** icons and body images share one used-name set (`quill.png` /
  `quill-2.png` test); no labels are made.
- **SCAR-012:** n/a here (handover in TICKET-045).
- **SCAR-013, SCAR-014, SCAR-016:** n/a (no dialog, destructive action or
  control).
- **SCAR-015:** AC-15 checks texts, fills, font, icon and warnings; the guard
  shows the plain-quote result without fills or image.
- **SCAR-017:** one writer of `#callout(`/`callout-styles` (text check); one
  header matcher (TICKET-041); the one pt formatter exported and reused, not
  copied (grep list in the result).

---

## Definition of done

- [x] Tests named above green; full gate green except the TICKET-044 tests
- [x] Every mutation check listed above caught (count in the result)
- [x] Warning codes and shared-utilities register updated; join hazards in the result
- [x] `compiledtext.md` export without `callout` (AC-17) checked
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)


## Result (2026-10-18)

New: `src/core/emit/callout.ts`, `src/core/emit/length.ts` (`ptLength`, now also
used by `core/fonts/resolve.ts`). Changed: `emit/blocks.ts` (callout branch,
`BlockOptions.callouts`), `emit/index.ts`, `convert/index.ts` (recorder, style
fonts, icons, warnings), `convert/references.ts` (`calloutIconNames` for the
first pass), `convert/preamble.ts` (rule `callouts` 85).

- Tests: every US-016 test of this ticket green: unit and plugin 64 of 69
  (the 5 red are TICKET-044's), integration 37 of 37. `npm test` 1486 passed,
  1 todo; integration 272 passed, 1 skipped. Red only for TICKET-044: 5 unit
  tests and one missing export (`PLUGIN_NAMES`), which also stops typecheck,
  build and `build-output`. ESLint and Prettier clean.
- Existing tests changed because a story grew: `us-015-conversion-pipeline`
  registry list gained `['callouts', 85]` (US-015 AC-2 text amended).
- Test defects found and fixed while coding (from G2): the AC-12 font catalog
  lacked `DejaVu Sans Mono` (US-010 then reports the code family missing); the
  AC-5 image with alt text is a `#figure(fit-image(…))`, not `#fit-image(`; the
  template import of the AC-11 group was never added (an unchecked scripted
  edit in G2); the AC-14 sweep of whole paragraphs never reached the page
  bottom, so the guard failed — measured, then refined to 20 to 34 lines ×
  offsets 0 to 12 pt (without `sticky`: alone at `24/3` to `24/12`; with it:
  never); the guard now names `24/6`.
- Mutants: 14, all caught (sticky removed, breakable false, unknown type under
  its own name, styles not sorted, `default` always written, second
  `FONT_MISSING`, title not at block start, empty callout dropped, colour not
  lower-cased, trailing zero, alias before preset, title not split at the
  break, rest of default title not lower-cased, invalid icon accepted).
  **Slip:** the first run used an unquoted file list in zsh; backups never
  happened and the mutants piled up in the sources. Each mutation was reversed
  by exact text, the restored tree passed the same tests as before (64/69,
  37/37, one typecheck error), and the run was repeated with checksummed
  backups (`shasum -c` OK after every mutant).
- Join hazards (SCAR-010), in the form of TICKET-013: the call is a block of
  its own; nothing precedes it on its line and nothing follows `]`; one blank
  line on each side; no call separator needed. Measured neighbours: paragraph,
  heading, list, ordered list, table, code, image, quote, callout, rule,
  footnote reference, document start and end, list item followed by an item —
  text order kept in the PDF for all. Guards: unmapped style key fails to
  compile; sweep without `sticky` finds a lone title; plain quotes have none of
  the fills.
- SCAR-017 list: one writer of `#callout(`/`callout-styles` (text check green);
  one pt formatter (`ptLength`; `emit/image.ts` (`toFixed(4)` for px → pt) and
  `cover/crop.ts` (one decimal for messages) format other quantities and are
  left as they are).
- `compiledtext.md`: no callout in its output (AC-17 test); the existing export
  tests of it are green.
