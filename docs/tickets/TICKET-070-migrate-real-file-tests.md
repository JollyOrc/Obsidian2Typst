# TICKET-070 — Move the 23 real-file tests to the sample vault

**Status:** Done (2026-10-27)
**User story:** [US-024](../user-stories/US-024-synthetic-public-fixture.md)
**ACs addressed:** AC-3 (the tests read the manifest), AC-4, AC-6 (content of
the migrated PDF tests), AC-12 (US-016 AC-17 to `Other.md`, in the tests)
**Depends on:** TICKET-069
**SCARs:** SCAR-002, SCAR-003, SCAR-006, SCAR-015, SCAR-017, SCAR-018, SCAR-019, SCAR-021, SCAR-023

---

## Description

Every test that reads `tests/fixtures/compiledtext.md` or the folder
`The Rules/` from disk reads the committed sample vault instead, and every
number it asserted of the real file comes from `manifest.json`. After this
ticket no test needs the private vault (AC-4 green).

---

## Acceptance criteria (from user story)

- **AC-3:** every test that asserted a number of the real file reads its
  number from the manifest; no expected number is computed with the plugin's
  own functions.
- **AC-4:** no file in `tests/` reads `The Rules` or `compiledtext.md`; the
  23 files read `tests/fixtures/sample/`.
- **AC-6:** every PDF test that used the real file asserts content of the
  sample's PDF (a known sentence, fonts, images, terms); the blank guard
  stays.
- **AC-12 (tests part):** US-016 AC-17 ("no callout header, no callout rule
  or call") is checked on `Other.md`.

---

## Implementation notes

The instances (G3, 2026-10-27; found by the AC-4 check and an independent
grep, the same 23 files; line numbers of today). "Reads" are the lines that
read the private input; "tests" are the tests of the `describe` block that
holds the read. A module-level read is used by the tests named.

| File | Reads | Tests | ACs |
|------|-------|-------|-----|
| `tests/integration/us-001-blocks-roundtrip.test.ts` | 161 | 164, 194, 206 | US-001 AC-11, AC-15, AC-1d |
| `tests/integration/us-001-inline-roundtrip.test.ts` | 215 | 221 | US-001 AC-11 |
| `tests/integration/us-001-validity.test.ts` | 19 (walks the vault; lists `tests/fixtures/*.md`) | every test of the file | US-001 AC-11 |
| `tests/integration/us-002-labels-roundtrip.test.ts` | 127 | 129, 142 | US-002 AC-3 |
| `tests/integration/us-002-numbering-pdf.test.ts` | 95 | 100, 116 | US-002 AC-1c |
| `tests/integration/us-003-images-roundtrip.test.ts` | 171, 172 | 189, 197, 201, 209 | US-003 AC-1, AC-1b, AC-2b, AC-4 |
| `tests/integration/us-004-links-roundtrip.test.ts` | 178 | 179, 188 | US-004 AC-1, AC-8 |
| `tests/integration/us-005-footnotes-roundtrip.test.ts` | 165 | 168 | US-005 AC-4 |
| `tests/integration/us-005-tables-roundtrip.test.ts` | 199 | 202, 212, 216, 221 | US-005 AC-1, AC-2b, AC-3 |
| `tests/integration/us-006-output-and-source.test.ts` | 28, 32, 35, 132, 158 (the rule-2 snapshot) | 119, 176 | US-006 AC-4, AC-7 |
| `tests/integration/us-007-export-compiledtext.test.ts` | 52, 60 | 58 | US-007 AC-6 |
| `tests/integration/us-012-preview-equals-export.test.ts` | 116, 126 | 122, 148, 186 | US-012 AC-13 |
| `tests/integration/us-015-convert-compiles.test.ts` | 128, 137 | 139, 157 | US-015 AC-10 |
| `tests/integration/us-017-glossary-pdf.test.ts` | 397 | 399 | US-017 AC-13 |
| `tests/integration/us-018-page-refs-pdf.test.ts` | 328 | 330 | US-018 AC-9 |
| `tests/integration/us-019-folios-pdf.test.ts` | 421 | 423 | US-019 AC-11 |
| `tests/unit/us-004-links.test.ts` | 480, 511 | 479, 509 (the other tests of the block use their own notes) | US-004 AC-8 |
| `tests/unit/us-014-parse-lines-robustness.test.ts` | 17 (module level) | 74, 95, 171, 210 | US-014 AC-3, AC-4, AC-5 |
| `tests/unit/us-015-line-map-and-edges.test.ts` | 298, 365 | 297, 364 | US-015 AC-11, AC-12 |
| `tests/unit/us-016-callouts-convert.test.ts` | 536 | 535 | US-016 AC-17 (→ `Other.md`) |
| `tests/unit/us-017-heading-rules.test.ts` | 642 | 644, 660, 677 | US-017 AC-13 |
| `tests/unit/us-018-page-refs.test.ts` | 532 | 540 (four levels), 546, 553 | US-018 AC-3, AC-9 |
| `tests/unit/us-019-folios-headers.test.ts` | 328 | 330, 338 | US-019 AC-8, AC-11 |

- **The source.** `readSample('Book.md')` and the vault list
  `listFiles(SAMPLE_DIR)` (prefixed `Sample/`) from `tests/support/sample.ts`;
  images from the sample's `assets/` where the test reads bytes
  (`us-003-images-roundtrip`, `us-006-output-and-source`).
- **The numbers.** Each literal of the real file becomes a manifest key:
  64 / 17 / 47 images and 62 files → `images`; 655 headings → the length of
  `headings`; 41 comments → `comments`; 149 anchors and 52 / 51 / 36 / 14 /
  10 → `anchors`; 261 tables, 59 cell breaks → `census`; 15 inline notes →
  `census.kinds['inline-footnote']`; 40 terms → `glossary.terms`; the term
  the links go to → `linkedTerm`; 22 / 33 / 59 / 139 → `numberedLinks`; 33
  numbers at the built-in values → `numberedLinks['2']`; the H1 titles that
  start pages → `headings['1']`; the page relation of the glossary links →
  read from the PDF as today.
- **Titles in test names.** Test names that quote the real file's headings
  name the manifest key instead (for example "numbers the second H1 as
  chapter 2"), so no rules text stays in a test name (AC-9 removes the
  rest).
- **`us-001-validity`.** Lists the notes of the sample vault (`Book.md`,
  `Other.md`) instead of `tests/fixtures/*.md`; the test that required the
  real file asserts that both notes are listed.
- **`us-006-output-and-source`** (rule 2). Its snapshot proves the export
  leaves the source untouched: it snapshots `tests/fixtures/sample/`
  instead; the copied assets come from the sample.
- **US-016 AC-17** on `Other.md`: no callout header in the source, no
  `callout` rule or call in its Typst. The test asserts that `Book.md` has
  callouts, so the choice of note is shown to matter (SCAR-023).
- No change of `src/`. A story whose AC names the real file is changed in
  TICKET-072, not here.

### Guards searched before the ticket (SCAR-023)

- The AC-4 check counts every reader call; this ticket removes the 23 files'
  private reads and adds reads of `tests/fixtures/sample/`, which the check
  allows.
- No other test forbids a read below `tests/fixtures/`.

---

## Tests

- `tests/tooling/us-024-public.test.ts`: AC-4 green.
- The 23 files above green on the sample.
- Mutation checks (SCAR-023), one per rule the real file guarded: US-004
  resolution order (slug before text); US-002 a repeated title not suffixed;
  US-001 AC-15 the comment summary with the last line; US-005 cell breaks
  dropped; US-018 the level filter off by one; US-017 a term left as a
  heading; US-019 a header on an H1 page; US-003 an asset copied twice.
  Each must turn a migrated test red.

---

## SCAR check (2026-10-27, item by item against the Prevention lists)

- **SCAR-001** (1–4) no shared utility gets a new call site in `src/`;
  `tests/support/sample.ts` helpers are documented.
- **SCAR-002** (1–5) the sample note is the composed case of every migrated
  test; AC-2b adds callouts and wikilinks to the composed run.
- **SCAR-003** (1–3) each migrated test keeps its AC id; the map rows of the
  23 files keep their status after the gate.
- **SCAR-006** (1–4) full gate; no new skip; counts in the result.
- **SCAR-007** (1–3) the manifest keys are named per literal above.
- **SCAR-008** (1–6) no new API; PDF facts as measured (G2).
- **SCAR-009, SCAR-010** (1–4, 1–6) the join tests of US-018 (AC-3,
  SCAR-010 row) run on the sample, whose census holds the real neighbours.
- **SCAR-011** (1–5) the label test runs on ≥ 47 repeated titles and the
  natural `Lorem 2` title (TICKET-069).
- **SCAR-012** n/a (no handover).
- **SCAR-013, SCAR-014** n/a.
- **SCAR-015** (1–5) every migrated PDF test asserts content from the
  manifest; the blank guards stay.
- **SCAR-016** n/a.
- **SCAR-017** (1–7) the class is the 23 files of the table, found twice;
  the AC-4 check keeps a new copy out.
- **SCAR-018** (1–9) the edits are made by hand per file (no scripted
  replace); the mutation run backs up the mutated `src/` files by full path
  with checksums and checks after every restore; private inputs compared with
  the baseline at the end.
- **SCAR-019** (1–5) the US-018 test keeps its four levels; US-012 AC-13
  keeps every built-in preset.
- **SCAR-020** n/a.
- **SCAR-021** (1–3) the page tests (US-018, US-019) read relations from the
  printed numbers and the footers, as before.
- **SCAR-022** n/a.
- **SCAR-023** (1–8) each number has its manifest key and a second source
  (TICKET-069's tests); the mutants above; US-016 AC-17 shows the other note
  has callouts.
- **SCAR-024** n/a (no statement about a tool).
- **SCAR-025** n/a (no visual check).

---

## Definition of done

- [x] AC-4 green; the 23 files green on the sample
- [x] Mutation checks run, results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)
- [x] Private inputs checksum OK against the baseline

---

## Result (2026-10-27)

Changed: the 23 test files of the table; `tests/support/sample.ts`
(`withCalloutHarness`, see below); `tests/fixtures/generate.ts` (one sentence
of `Other.md`, see below) and the regenerated `tests/fixtures/sample/Other.md`
and `manifest.json`. No change of `src/`.

- Gate (scratchpad `gate070.log`): typecheck, build (`main.js`
  `cdbc3da5a4d9…`, unchanged), lint green; `npm test` 1818 passed, 7 failed,
  1 todo; integration 389 passed, 1 skipped. AC-4 green. The 7 red tests
  belong to later tickets, each red for its reason: AC-5 (TICKET-071), AC-8
  ×3 (TICKET-073), AC-10, AC-11 ×2 (TICKET-074).
- Every real-file number is a manifest value or a count from the sample's own
  parse: images (total, captions, embeds, files), headings and H1 titles,
  comments and the first comment line, anchors by rule, unresolved and
  ambiguous, tables, cell breaks, inline footnotes, numbered links at levels
  1 / 2 / 3 / 6 and at the built-in values, glossary terms and the linked
  term, long rows. Test names no longer quote the real file's headings
  (their remaining short rules terms in other tests are TICKET-072's).
- Changed while coding (reported):
  1. **The callout harness.** Book.md has callouts (the real file had
     none). Tests that compile emitted blocks without the pipeline's preamble
     (`us-001-blocks`, `us-002-labels`, `us-002-numbering`, `us-003-images`,
     `us-004-links-roundtrip`, `us-005-footnotes`, `us-005-tables`) put the
     callout helper and a plain style per used type in front, through one
     function `withCalloutHarness` in `tests/support/sample.ts` (documented
     with its transforms, SCAR-001); the US-001 test asserts that the output
     has callouts, so the harness is in effect.
  2. **US-014 "no word lost".** Wikilinks and embeds carry their words in
     their fields, and task markers (`[x]`) are markup; the word count reads
     the fields and strips the markers (the real file had neither).
  3. **US-017 bookmark check.** "No term is a bookmark" compared the end of
     a title with ` <term>`; a body heading ending in the same word matched.
     It now compares the whole title (optional number, then the term),
     SCAR-023.
  4. **US-016 AC-17 on `Other.md`.** The sentence of `Other.md` said "It has
     no callout", and the word itself appears in its Typst; the generator
     now writes "It has no boxed note" (TICKET-069's product, regenerated;
     AC-1b green). A second test shows the check sees the callouts of
     Book.md.
  5. **Instances the table missed (SCAR-017).** In
     `us-006-output-and-source` the module-level `md` and the asset reader
     were also used by the AC-6 tests (lines 77 to 104 before the change):
     the count of missing images (64) and a second disk read of
     `The Rules/assets` (it passed only because the folder is on this disk);
     both moved to the sample. The AC-4 check found no further read.
  6. **US-006 snapshot.** The vault root on disk is `tests/fixtures`, the
     note `sample/Book.md`; the test now also checks that the three copied
     assets arrived, as the other side of "the source is untouched".
  7. **US-007 AC-6.** The export test also asserts the first known sentence
     in the PDF text (US-024 AC-6).
- Mutants (scratchpad `mut070/run.py`, `results.json`; baselines green per
  group): 8, each caught by a migrated sample-note test — US-004 rule order
  (the regression test), US-002 a repeated title not suffixed (the label
  tests), US-001 AC-15 the last comment line (the summary test), US-005 cell
  breaks dropped (the cell-break test), US-018 the level filter off by one
  (the four level tests and the PDF count), US-017 a term left as a heading
  (the run-in, outside-glossary and bookmark tests), US-019 a header on an
  H1 page (the folio test), US-003 an asset copied twice (the US-015 compile
  test; the US-003 copy test as well). The join test of US-018 stays green
  for the level mutant, as it should: it runs at level 6 and checks joins.
  Backups of the seven mutated `src/` files by full path, SHA-256 checked
  after every restore and at the end: OK.
- Private inputs: 3434 checksums OK.
