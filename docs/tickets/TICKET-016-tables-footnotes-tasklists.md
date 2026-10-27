# TICKET-016 — Tables, footnotes and task lists

**Status:** Done
**User story:** [US-005](../user-stories/US-005-tables-footnotes-tasklists.md)
**ACs addressed:** AC-1, AC-1b, AC-2, AC-2b, AC-3, AC-3b, AC-4, AC-4b (rule only), AC-4c, AC-4d, AC-5, AC-6
**Depends on:** TICKET-015 (links, `LinkEnv`), TICKET-014 (`indexHeadings`), TICKET-012 (`emitInline`), TICKET-011 (`callSeparator`)

---

## Description

Convert tables to `#table(...)`, footnotes (definitions, references and inline `^[…]`) to `#footnote[…]`, and task lists to glyph or plain notation, with the warnings `TABLE_ROW_LONG`, `FOOTNOTE_UNDEFINED`, `FOOTNOTE_UNUSED`, `FOOTNOTE_UNCLOSED`, `FOOTNOTE_NESTED` and `FONT_GLYPH_MISSING`.

---

## Acceptance criteria (from user story)

See US-005 (exact examples are in the story and the tests). Decided by the user on 2026-10-17 (AC-4d and AC-6): the parser reports what it drops through per-node flags (no warnings list); a footnote inside footnote text is omitted with `FOOTNOTE_NESTED`; a heading inside a footnote definition is a plain paragraph and not indexed; of two definitions with one label the first wins and the later is reported as unused; with no `FontInfo` the plain task notation is used silently.

---

## Implementation notes

- **Parser (`core/parse`):** `RowNode.extraCells` (only when > 0), set by a wrapper around the markdown-it table rule that counts the cells of each body row with the same splitting as markdown-it (unescaped `|`, outer pipes ignored); `TextNode.unclosedNote` (only when true) for an unclosed `^[`, produced by a rule that runs where the footnote plugin's inline rule fails. `indexHeadings` skips `footnote-def`.
- **`emitBlocks`:** a first pass indexes the footnote definitions (first wins). A `NoteEnv` is passed to every `emitInline` call; it renders the body of a definition once (cached, so warnings in a note appear once), marks it used, and reports `FOOTNOTE_UNDEFINED`. After rendering, unused and repeated definitions are reported. A definition emits nothing at its own place.
- **Footnote body:** one line → `#footnote[text]`; several blocks, a list or a line break → block form with two-blank indent. Text starts as a block start. Headings in a note are plain paragraphs. A reference or inline note inside a note (`where: 'footnote'`) is omitted with `FOOTNOTE_NESTED`.
- **Tables:** `#table(` / `columns: n,` / `align: (...),` / `table.header(...),` / one body row per line / `)`, the layout of AC-1; alignment `null` is `left`; one-column alignment is `(left,)`; short rows are padded with `[]`; cells go through `emitInline` with `breaks: 'call'` (a hard break is `#linebreak()`, a call that `callSeparator` handles).
- **Task lists:** `BlockOptions.fonts?: FontInfo` and `bodyFamily` (default `"Libertinus Serif"`); the glyphs are checked once per export (`EmitContext.warnOnce`); the plain notation is `\[ \]` / `\[x\]`.
- **`FOOTNOTE_RESTART_RULE`** (exported from `core/emit`): the show rule of AC-4b. The preamble that contains it is built by the pipeline (US-015).
- Measured (probes `s30`, `s31`): a table and a footnote with a multi-block body compile inside list items, quotes and table cells; `counter(footnote)` restarts at a level-1 heading with the rule and not at deeper levels; a numbering pattern is not needed for footnotes.
- Register: add the footnote note renderer and the table emitter to `docs/user-stories/README.md`; add `FOOTNOTE_NESTED` to `docs/technical/warning-codes.md` (done).

---

## Tests

- `tests/unit/us-005-tables-footnotes-tasks.test.ts` — exact strings and warnings for every example of the ACs
- `tests/integration/us-005-tables-roundtrip.test.ts` — every cell content × table shape × container against the compiler, alignment and columns, ragged and wide tables, the 261 tables of the real file
- `tests/integration/us-005-footnotes-roundtrip.test.ts` — a footnote followed by every join hazard, note bodies, every container, nested notes, task lists in both forms, the real file
- `tests/integration/us-005-footnote-numbers-pdf.test.ts` — the printed numbers per chapter (including external-link footnotes), the guard without the rule

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each rule switched off alone is caught by a test.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story file updated if ACs were refined during implementation.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

## Implementation result

- Parser: `RowNode.extraCells` (wrapper around the markdown-it table rule), `TextNode.unclosedNote` (rule after `footnote_inline`); `indexHeadings` skips footnote definitions. US-014 trees are unchanged where neither occurs (the 68 US-014 tests pass unchanged).
- Emitters: `emitTable` (`table.ts`), `Notes` and `footnoteCall` (`footnote.ts`), `TaskMarkers` and `FontInfo` (`tasks.ts`); `emitInline` options `notes` and `breaks: 'call'`; `emitBlocks` options `fonts` and `bodyFamily`.
- Measured on the real file: all 261 tables, 59 cell line breaks, the 1 footnote definition and 15 inline notes convert; no `TABLE_ROW_LONG`, `FOOTNOTE_*` or table `NODE_UNSUPPORTED` warning; the whole file compiles with zero errors.
- Mutation check N1 to N30 (separator after a note, default alignment, padding, extra cells, one-column comma, `#linebreak()` option, block form, duplicate rule, nested omission, body cache, headings in notes, heading index, unclosed flag and warning, extra-cell threshold, glyph decision, once-per-export, glyph order, body family, task lead, restart rule, undefined and unused warnings, note context, call flag, header column count, centre alignment, nested use, header form, plain notation): all caught; N25 (column count from the header) first survived and led to the hand-built tree test.
- The stubs that waited for this story were turned into tests: US-001 AC-2b (link rows), US-001 AC-14 (tags in cells), US-002 AC-4c (address in heading), US-004 AC-5 (link in a table cell). The story examples that were stale were corrected: US-001 AC-2b (the delimiter form is used around a link call), US-002 AC-4c, US-005 AC-4 (call separator).
- Left for other stories: the image in a cell (US-003), the preamble that contains `FOOTNOTE_RESTART_RULE` (US-015), the `FontInfo` implementation and the body font role (US-010).
