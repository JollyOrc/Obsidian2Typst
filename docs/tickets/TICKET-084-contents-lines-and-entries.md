# TICKET-084 — The contents lines and what they list (core)

**Status:** Done (2026-10-29)
**User story:** [US-027](../user-stories/US-027-table-of-contents.md)
**ACs addressed:** AC-2, AC-3; AC-10 (depths, switches, titles, numbering)
**Depends on:** TICKET-083 (the fields)
**SCARs:** SCAR-001, SCAR-002, SCAR-009, SCAR-010, SCAR-017, SCAR-019,
SCAR-023, SCAR-024

---

## Description

One emitter writes the contents: the title block (escaped), the two scoped
switches and `#outline(title: none, depth: n)`. With the contents on, a
heading inside a callout, quote or list item is written
`#heading(level: n, outlined: false, bookmarked: true)[…] <label>`. This
ticket writes the contents at the default place before the first chapter
(enough for the unit tests of AC-2, AC-3, AC-10); the pages, the colophon
and the picked place are TICKET-085.

---

## Acceptance criteria (from user story)

- **AC-2 (what is written):** With `toc.depth: 2` and the defaults:
  ```
  #block(below: 1em)[#text(size: 1.4em, weight: "bold")[Contents]]
  #outline(title: none, depth: 2)
  ```
  The title text goes through the escaping of US-013; an empty title writes no
  block. `toc.dotLeaders: false` adds `#set outline.entry(fill: none)` before
  the outline; `toc.pageNumbers: false` adds the show rule of O3. Both are
  scoped to the contents (inside a block with the outline) so that nothing
  else changes (measured, S1).
- **AC-3 (what is listed; measured):** Headings of the body down to
  `toc.depth`, in order, with the numbers of US-002 when numbering is on.
  Not listed: glossary terms (no headings), headings inside a glossary term
  (already `outlined: false`), headings inside a callout, quote or list item
  — with the contents on, these are written `#heading(level: 2, outlined:
  false, bookmarked: true)[Boxed] <h-boxed>` so they stay in the bookmarks
  (decision 4) — and a hidden colophon or back-notes heading (US-026).

---

## Implementation notes

- New `src/core/emit/toc.ts`: `contentsLines(toc: TocSettings): string`
  (US-027 AC-2), the only writer of the outline. Title through
  `escapeMarkup(title, {atBlockStart: true})` (SCAR-001: a new call site of
  the escaping; its transforms are those of a block-start text, the title
  stands at the start of a content block — the case the call documents);
  the switches inside `#block[…]` with the outline (S1), each only when off.
- `src/core/emit/blocks.ts`, case `heading`: a new env flag
  (`unlistedNested: boolean`, set by `convert` when `toc.depth > 0`) makes a
  heading nested in a callout, quote or list item write the `#heading(…)`
  form with its label. The nesting is known from the emitter's block scope
  (the same scope that writes `#quote` and list items); the glossary-term
  form (`numbering: none, outlined: false`) is unchanged.
- `src/core/convert/index.ts`: the contents lines before the first chapter
  (`arranged.chapter`) when `toc.depth > 0`; nothing changes at depth 0
  (the byte-identical guard).
- A hidden part heading is a label marker (US-026), never a heading: it is
  not listed without extra code. A printed part heading is a heading and is
  listed (AC-3, measured O4).

### Guards searched before the ticket (SCAR-023)

- US-016 and US-017 tests that pin the callout and glossary heading forms
  (`== Boxed`, `#heading(level: 3, numbering: none, outlined: false`): they
  run with the contents off and keep passing; the US-027 off guard pins the
  same.
- `tests/unit/us-016-callouts-convert.test.ts` `PLUGIN_NAMES`: no helper is
  added (the outline is Typst's own).
- US-013 escaping tests: no change of `escapeMarkup`.

---

## Tests

- `tests/unit/us-027-table-of-contents.test.ts` › AC-2 (4), AC-3 (4, with the
  quote and list item added 2026-10-29), AC-10 (9), AC-4 `without a
  colophon, before the first chapter`.
- `tests/integration/us-027-table-of-contents-pdf.test.ts` › AC-2, AC-3 (6)
  where they need no page rule (the entries, links, switches, title,
  bookmarks of the callout, quote and list-item headings).
- Mutation checks: a switch outside the block; the title unescaped; the
  nested form also with the contents off; the nested form for a top-level
  heading; depth written as 2 always.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** (1–4) `escapeMarkup` gets a call site (the title); its
  transforms read and fit (block start, markup characters); an edge input
  `Rules #1 *and* [more]` in the tests.
- **SCAR-002** (1–6) nested headings in each of the three containers and in
  a glossary term; numbering on and off; checked against US-002 (numbers),
  US-016 (callout), US-017 (terms), US-019 (running title reads headings: a
  `#heading` with `outlined: false` is still a heading — the running title
  is checked in the PDF tests of TICKET-085), US-026 (hidden parts).
- **SCAR-003** (1–3) red tests exist; AC list read again; map rows.
- **SCAR-006** (1–4) full gate, counts in the result.
- **SCAR-007** (1–3) exact lines in the tests.
- **SCAR-008** (1–5) `outline`, `outline.entry`, `heading` options read from
  the Typst docs at G1 and measured (O1 to O5, B1, S1); output checked by
  program (PDF text, links, bookmarks).
- **SCAR-009** (1–4) the title at a block start (escaping); the nested
  heading in a list item (`- #heading(…)`) and in a quote body: a new
  container for the heading text, its start checked by the compile.
- **SCAR-010** (1–6) the contents are whole lines between blocks (blank
  lines); the `#heading(…)[…] <label>` join of label and content bracket is
  US-002's form; list-item join `- #heading` measured in the PDF test.
- **SCAR-011** n/a (labels unchanged; one heading index).
- **SCAR-012** n/a here (TICKET-088).
- **SCAR-013, SCAR-014** n/a (no dialog).
- **SCAR-015** (1–5) the PDF tests name the entries, absences and links; the
  depth-0 guard shows today's output.
- **SCAR-016** n/a (no control).
- **SCAR-017** (1) grep for the heading forms in `emit/` (`'='.repeat`,
  `#heading(`): one writer per form; the nested form joins the glossary-term
  writer in one function. (2–8) the class rule (every nested heading) is in
  AC-3.
- **SCAR-018** (1–10) mutation run with backups and checksums.
- **SCAR-019** (1–5) depths 0, 1, 2, 3, 6; the four switch pairs; three
  titles; numbering off.
- **SCAR-020** n/a.
- **SCAR-021** n/a here (the outline reads the layout; the sweep is in
  TICKET-085, where the pages are made).
- **SCAR-022** n/a (no callback).
- **SCAR-023** (1–10) guards above; the nested-form test counts its two
  places and asserts the off side in the same test.
- **SCAR-024** (1–4) every statement of the story about Typst is measured
  (O1 to O5, B1, S1); the list-item heading form is not in the probe and is
  measured by the new PDF test before it is relied on.
- **SCAR-025** n/a (judged by program).
- **SCAR-026** n/a.
- **SCAR-027** n/a.
- **SCAR-028** (1–4) the PDF readers were checked on a hand-written outline
  at G2 (scratchpad `p028/toc.test.ts`).
- **SCAR-029** n/a.

---

## Definition of done

- [x] Tests named above green (the PDF rows that need the contents pages
      wait for TICKET-085, below); US-016, US-017, US-013 tests green
- [x] Mutation checks run; full gate counts in the result
- [x] Map rows AC-2, AC-3, AC-10 name this ticket; index row `Done`

---

## Result (2026-10-29)

Changed: new `src/core/emit/toc.ts` (`contentsLines`, the one writer of
`#outline(`; the title through `escapeMarkup` at a block start; the switches
and the outline in one `#block[…]` only when a switch is off);
`src/core/emit/glossary.ts` (the `#heading(…)` call forms in one private
`headingCall`: `emitUnnumberedHeading` as before, new `emitUnlistedHeading`
with `outlined: false, bookmarked: true`); `src/core/emit/blocks.ts` (option
`unlistNested`: a heading in a callout, quote or list item is written with
`emitUnlistedHeading`, its text escaped at a block start);
`src/core/emit/index.ts` (exports); `src/core/convert/index.ts`
(`DEFAULT_TOC` under `settings.toc`; at depth 1 to 6 the contents lines
before the first chapter with a blank line (`withContents`, after the
colophon's lines when there is one), `unlistNested` while the contents are
on; depth 0 changes nothing). The furniture's part ranges still read the
book's own lines only (`bookPages`): the contents pages are TICKET-085.

- Tests: `tests/unit/us-027-table-of-contents.test.ts` 26 of 31 green (the 5
  red are AC-5, TICKET-085); one test added (below). PDF tests green: the
  entries link to their heading pages, the escaped and the empty title, the
  callout heading in the bookmarks. Red until TICKET-085: the rows that read
  the contents page alone (the body still starts on that page) and the page
  rows (AC-4, AC-6, AC-5, AC-9). The US-027 preview test (TICKET-087's file)
  turned green: the preview source holds the outline.
- SCAR-024: the list-item and quote forms measured with the bundled compiler
  before they were relied on (scratchpad `p027b/nested.test.ts`, a page break
  added by hand): they compile; none is in the contents; the bookmarks read
  `1 Rules | 1.1 Quoted | 1.2 Listed | 1.3 Boxed | 2 Lore`.
- SCAR-009 gap → closed: no test showed that the nested heading's text is
  escaped at a block start (it moved into a content block). Added `US-027
  AC-3, SCAR-009: the text of a nested heading starts a content block and is
  escaped there` (`## + Plus` in a quote).
- Mutants (scratchpad `mut084/run.py`; the US-027 unit and PDF tests, US-016
  and US-017 units; baseline 15 failed, 127 passed): 9, all caught —
  switches outside the block, title unescaped, nested form with the
  contents off, nested form for a top-level heading, depth always 2, nested
  text not at block start, `bookmarked` dropped, title kept when empty, dot
  leaders never removed. Restores checked with `shasum -a 256 -c` (4 files
  OK at the end).
- SCAR-017: `#outline(` is written only in `toc.ts`; `#heading(level:` only
  in `glossary.ts`'s `headingCall` (grep in the result run); the one other
  reader of the book lines (`parts:` of the furniture) keeps reading the
  book's own lines.
- Gate (scratchpad `gate084.log`): typecheck, build (`main.js` sha256
  `31f03a1919a5…`), lint green; `npm test` 1962 passed, 44 failed, 1 todo;
  integration 432 passed, 34 failed, 1 skipped. Every red test is of US-027
  (TICKET-085 to 087), US-028 or the two US-026 contents rows.
