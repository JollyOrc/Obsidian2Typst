# TICKET-085 — The place of the contents and their pages (core)

**Status:** Done (2026-10-29)
**User story:** [US-027](../user-stories/US-027-table-of-contents.md)
**ACs addressed:** AC-4, AC-5, AC-6, AC-9; the two US-026 AC-3 rows with
contents
**Depends on:** TICKET-084 (the lines), TICKET-079 (the book pages)
**SCARs:** SCAR-002, SCAR-011, SCAR-017, SCAR-019, SCAR-021, SCAR-023

---

## Description

The contents as a part of the book: at the default place they are front
matter (after the colophon, or on the next right page without one) and the
first chapter's spread rule follows them; at a picked place they stand
before an H1 or after its whole section, and after the first chapter they
belong to the body. The contents pages start and end with a new page, run
on, print no running header and their folio (roman in roman front matter).
`TOC_HEADING_MISSING` when the picked heading is not there.

---

## Acceptance criteria (from user story)

- **AC-4 (the default place):** Without `toc.heading`, the contents are front
  matter (US-026): after the colophon, on the page after it (p. 4 after a
  cover and a colophon); without a colophon on the next right page, like the
  colophon (decision 2: after a cover p. 3 with p. 2 blank, without a cover
  p. 1). The first chapter then follows by US-026's spread rule (contents
  ending on p. 4: chapter on p. 6, or p. 5 with `book.firstChapter: right`).
- **AC-5 (a picked place; decisions 1 and 5):** With `toc.heading: Rules` and
  `toc.position: before`, the contents stand right before the top-level H1
  whose visible text compares equal (as heading rules compare, US-017 AC-2);
  with `after`, after that heading's whole section, before the next top-level
  H1 (decision 1); when it is the last H1, after the end of the body and
  before the back notes (US-026). The first such heading counts. If none is
  found, the contents go to the default place and warning
  `TOC_HEADING_MISSING` (`The table of contents heading "Rules" is not in the
  note; the contents are at the default place`, line 0) is reported.
  Contents placed before the first chapter are front matter (roman folios
  when on); placed later, they are part of the body (decision 5).
- **AC-6 (the contents pages):** The contents start on a new page and what
  follows starts on a new page; a long table of contents runs on over several
  pages. No contents page prints a running header; each prints its folio
  (roman in the front matter when on, arabic in the body). Page breaks of
  US-025 do not apply to the title (it is no heading).
- **AC-9 (composed; SCAR-002):** The composed note of US-015 with a cover, a
  printed colophon, back notes, a glossary section, a callout with a heading,
  numbering `1.1`, roman front matter, page breaks (US-025) and a signature
  (US-026), with `toc.depth: 3`: compiles; the contents list exactly the
  expected headings with the folios they are printed on; every entry links
  to its heading; the callout heading is in the bookmarks and not in the
  contents; the preview (US-012) shows the same.

---

## Implementation notes

- `src/core/convert/parts.ts`: `arrangeParts` also returns where the
  contents go: the block they precede (the picked H1, the next top-level H1
  after the picked section, the first back-notes block, or the end), and
  whether they are front matter (before `chapter`). The picked heading is
  found among the body's top-level H1 (not a glossary term, not a part) by
  the heading-rule comparison of US-017 AC-2 (`headingRuleTable`'s key
  normalisation, SCAR-017: one comparison), first match.
- `src/core/convert/index.ts`, `bookLines`: the contents at the default
  place open the front matter like a colophon (a colophon makes them follow
  on a new page; without a colophon `partStartLine` on the next right page,
  decision 2), and the first chapter's spread lines follow them (round 10:
  front matter = a colophon or the contents). Contents in the body get a new
  page before and after and the no-header range of US-026 (the part markers),
  their folio continuing the body. The cover's pages read `frontMatter`
  (US-026 AC-3): it becomes "a colophon or contents in the front matter".
- `TOC_HEADING_MISSING` in `ctx.warn` (line 0) and a row in
  `docs/technical/warning-codes.md` (US-015 registry).
- The US-025 break rule of the H1 that follows the contents merges with the
  contents' own new page (one break, the strongest side; US-025 AC-4).

### Guards searched before the ticket (SCAR-023)

- `tests/unit/us-015-warning-registry.test.ts`: every code `src/core` can
  produce has a row: `TOC_HEADING_MISSING` gets its row (active, US-027
  AC-5).
- `tests/integration/us-026-book-parts-pdf.test.ts` › the two AC-3 rows with
  `toc: {depth: 2}` (red since TICKET-079): turn green here.
- US-026 page tests without contents (`bookLines` undefined when there is no
  colophon, no back notes and signature 0): the condition gains "and no
  contents"; the depth-0 guard keeps today's output.
- US-019 running-header tests: the contents pages join the no-header range;
  no header test of other pages changes.

---

## Tests

- `tests/unit/us-027-table-of-contents.test.ts` › AC-4 (2), AC-5 (6).
- `tests/integration/us-027-table-of-contents-pdf.test.ts` › AC-4, AC-6 (5,
  with the SCAR-021 sweep), AC-5 (1), AC-9 (1).
- `tests/integration/us-026-book-parts-pdf.test.ts` › the two AC-3 contents
  rows.
- New, written first (SCAR-019): `US-027 AC-4: facing pages off, a cover:
  contents on p. 2, the first chapter on p. 3` in the PDF test file.
- Mutation checks: `after` placed right after the heading line; the last
  match instead of the first; no warning on a missing heading; contents in
  the body counted as front matter; the running header kept on a contents
  page; the spread rule without the contents.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** (1–4) `headingRuleTable`'s comparison gets a call site (the
  picked heading); its transforms (trim, case fold) are the ones AC-5 asks;
  edge input `  lore ` in the tests.
- **SCAR-002** (1–6) AC-9 composes cover, printed colophon, back notes,
  glossary, callout heading, numbering, roman, breaks, signature, depth 3;
  the picked place checked against US-025 (breaks), US-026 (parts, padding,
  first chapter), US-019 (header); decisions 1, 2, 5 re-read in every
  example.
- **SCAR-003** (1–3) red tests exist; AC list read again; map rows.
- **SCAR-006** (1–4) full gate, counts in the result.
- **SCAR-007** (1–3) page numbers named in the tests (p. 1, p. 3, `iv`).
- **SCAR-008** (1–5) `pagebreak(to:)` and the counters as measured at
  TICKET-079 (F1 to F4); output read by program.
- **SCAR-009** (1–4) the contents as first block, before the last H1, after
  the last section, after a cover; each in a test.
- **SCAR-010** (1–6) the contents lines are joined as whole blocks with the
  break lines; the merge with a US-025 break (one break) is a join hazard,
  tested by AC-9 (`h1: right`) and a mutation.
- **SCAR-011** (1–5) no new names; `TOC_HEADING_MISSING` is a code, not a
  label.
- **SCAR-012** n/a here (TICKET-088).
- **SCAR-013, SCAR-014** n/a.
- **SCAR-015** (1–5) the tests name the page of the contents, the chapter,
  the folio text and the entries.
- **SCAR-016** n/a.
- **SCAR-017** (1) grep for `frontMatter` and `arranged.chapter` in `src/`
  (cover pages, `bookLines`, furniture): each reader updated to "colophon or
  contents"; (2–8) one place decides where the contents go (`arrangeParts`).
- **SCAR-018** (1–10) mutation run with backups and checksums.
- **SCAR-019** (1–5) before and after; first, middle and last H1; roman on
  and off; facing pages on (tests) and off: the governance rule of round 8
  (a side acts as a new page) has no US-027 test, so this ticket writes one
  PDF test first, before the code: facing pages off, a cover, depth 2 →
  contents on p. 2 (no blank page), the first chapter on p. 3.
- **SCAR-020** n/a.
- **SCAR-021** (1–3) the outline reads its own layout: the sweep over 32 to
  38 chapters (one to two contents pages) checks every entry's folio and the
  first chapter's side; two compiles of the composed book give the same
  pages (run in the result).
- **SCAR-022** n/a.
- **SCAR-023** (1–10) guards above; each placement test asserts both
  neighbours (what precedes and follows), and the default-place test of the
  missing heading also asserts the warning.
- **SCAR-024** (1–4) the folio of a roman entry (O4) and the no-header range
  were measured; the contents in the body are measured by the AC-5 PDF test.
- **SCAR-025** n/a (judged by program; the look in M17).
- **SCAR-026** n/a.
- **SCAR-027** n/a.
- **SCAR-028** (1–4) the sweep's reader checked on a hand-written outline
  (G2 2026-10-29, 245 entries).
- **SCAR-029** n/a.

---

## Definition of done

- [x] Tests named above green; the two US-026 contents rows green; US-019,
      US-025, US-026 tests green
- [x] Mutation checks run; full gate counts in the result
- [x] Warning registry row; map rows AC-4, AC-5, AC-6, AC-9 name this
      ticket; index row `Done`

---

## Result (2026-10-29)

Changed: `src/core/convert/parts.ts` (`ArrangedParts.body`; new
`placeContents`, the one place that decides where the contents go: the
first top-level H1 of the body whose visible text compares equal by
`headingRuleKey`, `before` it or `after` its section, before the back notes
or at the end; front matter exactly before the first chapter);
`src/core/emit/breaks.ts` (`frontContentsLines`, `bodyContentsLines`, the
page lines of the contents, beside the other break writers);
`src/core/convert/index.ts` (`bookLines` takes the contents: front matter =
a colophon or contents before the first chapter, which also sets the cover's
next right page, the roman folios and the first chapter's spread rule;
contents in the body get their own pages and no-header range;
`TOC_HEADING_MISSING`; TICKET-084's `withContents` removed);
`docs/technical/warning-codes.md` (the row). The glossary-term filter of the
ticket's notes was dropped: a term lies one level below its section and is
never a top-level H1 (a mutant of it could not be caught).

- Two decisions asked while coding (rule 4) and answered by the user:
  printed part headings keep their numbers (US-026 decision 8; the
  alternative `numbering: none` measured: it does not step the counter); a
  `toc.heading` without `toc.position` reads as `before` (US-027 decision
  6). Stories, governance, the AC-9 test (`1 Colophon … iii`, `2 Rules`)
  and a new unit test.
- Defect found by a sharpened test and fixed: front-matter text before the
  first chapter (US-026 decision 7) ran on into the contents without a
  colophon, and the range marker hid that page's header; the front contents
  now always start with a weak page break, the range after it.
- Tests: the new facing-pages-off PDF test (written first, red, then green);
  `tests/unit/us-027-table-of-contents.test.ts` 33/33;
  `tests/integration/us-027-table-of-contents-pdf.test.ts` 16/16; the two
  US-026 contents rows green; US-026 unit and PDF green.
- SCAR-021: the AC-9 book compiled in two fresh processes (scratchpad
  `p027b/fresh.test.ts`): the same Typst (`3baaa002c8b3…`) and the same page
  table (16 pages: colophon `iii` p. 3, contents `iv` p. 4, blank `v`,
  `2 Rules` p. 6, back notes p. 16), before and after the fix.
- Mutants (scratchpad `mut085/run.py`; the US-027 and US-026 unit and PDF
  tests and the warning registry; baseline 0 failed, 101 passed): 13, all
  caught on the second run. The first run had 3 survivors, read as test
  inputs that could not reach the rule (SCAR-023): the body contents' header
  was not asserted; the long-contents test has no heading before the
  contents, so its header is empty anyway (new foreword test); the
  comparison test passed at the default place too (now asserts the place
  and no warning). Restores checked with `shasum -a 256 -c` (4 files OK).
- SCAR-001 gap → closed: the register in `docs/user-stories/README.md`
  gained the call sites of TICKET-084 (escaping of the title and nested
  heading text, `emitBlocks` `unlistNested`, `emitUnlistedHeading`) and of
  this ticket (`headingRuleKey` in `placeContents`, the two break writers).
- Gate (scratchpad `gate085.log`): typecheck, build (`main.js` sha256
  `41642946639f…`), lint green; `npm test` 1968 passed, 39 failed, 1 todo;
  integration 446 passed, 22 failed, 1 skipped. Every red test is of US-027
  (TICKET-086, 087: menu items and rows) or US-028.
