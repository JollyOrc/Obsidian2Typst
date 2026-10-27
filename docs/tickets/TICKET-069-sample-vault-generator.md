# TICKET-069 — The sample vault generator and the committed sample vault

**Status:** Done (2026-10-27)
**User story:** [US-024](../user-stories/US-024-synthetic-public-fixture.md)
**ACs addressed:** AC-1, AC-1b, AC-2, AC-2b, AC-2c, AC-3, AC-6, AC-7
**Depends on:** —
**SCARs:** SCAR-002, SCAR-006, SCAR-007, SCAR-008, SCAR-009, SCAR-010, SCAR-011, SCAR-015, SCAR-017, SCAR-018, SCAR-021, SCAR-023, SCAR-024

---

## Description

Write the deterministic generator `tests/fixtures/generate.ts`, run it once,
and commit its output `tests/fixtures/sample/` (D7): a long filler note
`Book.md` that covers the real file's census (AC-2), the features the real
file lacks (AC-2b) and the facts existing tests assert (AC-2c), a short
`Other.md`, a preset note `presets/Sample.md`, opaque images, one unused
`.pdf`, and `manifest.json` counted while writing (AC-3).

---

## Acceptance criteria (from user story)

- **AC-1:** `npm run fixtures` writes the vault from a fixed seed; no network,
  no clock; two runs byte-identical.
- **AC-1b:** the committed vault equals a fresh run; differences are named.
- **AC-2:** at least the real file's count in every census row, every block
  and inline pair, every text start and end class, the 11 non-ASCII
  characters; a cover image first; one `Glossary` with at least 10 terms;
  one unused `.pdf`; the warnings `LINK_AMBIGUOUS`, `LINK_UNRESOLVED`,
  `COMMENT_DROPPED`.
- **AC-2b:** the 13 built-in callouts, `rule-box` in `note`, `mystery`; the
  contents of a callout; every wikilink form; the embeds; task lists; a
  callout in a glossary term; exactly five warning codes.
- **AC-2c:** anchors by rule ≥ 52 / 51 / 36, ≥ 14 ambiguous, ≥ 10
  unresolved; ≥ 47 repeated titles with ≥ 158 extra uses; numbered links at
  levels 1 / 2 / 3 / 6 ≥ 22 / 33 / 59 / 139; ≥ 40 terms, one linked ≥ 3
  times; ≥ 41 comments; ≥ 8 H1; long rows as listed.
- **AC-3:** the manifest's numbers equal a second source (census, parsed
  headings, conversion, warnings); the generator calls no plugin function.
- **AC-6, AC-7:** the PDF of `Book.md`: zero errors in 30 s, five sentences,
  both fonts, one image object per distinct image, every term, the blank
  guard; at least 202 pages; page numbers to the same, the next and an
  earlier page.

---

## Implementation notes

- **Self-contained.** `generate.ts` imports only `node:fs`, `node:path` and
  `node:zlib`. It must run as `node tests/fixtures/generate.ts` (Node type
  stripping needs `.ts` extensions on relative imports, which `tsc` refuses
  without `allowImportingTsExtensions`), so it imports nothing from `src/` or
  `tests/support/` (also AC-3: no plugin function). It exports
  `generateSample(outDir)` and runs it for `tests/fixtures/sample` only when
  started as the main module (`import.meta.url === file://${argv[1]}`), so
  the tests can import it without writing into the repository.
- **Determinism.** A seeded generator (for example mulberry32, seed in the
  manifest); arrays in a fixed order; no `Object.keys` order of computed
  keys without sorting; `\n` line ends; JSON written with sorted keys and two
  spaces and a final newline. PNG: colour type 2 (RGB, opaque, no alpha;
  AC-6 counts image objects and an alpha channel adds a soft mask),
  `zlib.deflateSync` at a fixed level, CRC-32 written by the generator.
  JPEG: one small fixed baseline JPEG as bytes in the source, made distinct
  per file by a `COM` segment with the file's index (distinct bytes, so the
  image count of AC-6 is the number of files). PDF: a minimal fixed text PDF.
- **Images.** 56 `.png`, 7 `.jpg`, 1 `.jpeg` references at least (the real
  mix); 17 with alt text (captions), 47 without; one subfolder of `assets/`
  as the real vault has; the cover as the first line.
- **Model, then text.** The generator builds a list of blocks (chapters of 8
  H1 with H2 to H6 below, paragraphs, lists, tables, quotes, callouts, the
  glossary), writes them, and counts while writing. Every count of the
  manifest comes from the model (which target a link has, its level, the
  resolution rule it was written for, whether it is in a glossary
  explanation), never from parsing the written text.
- **US-004 rules.** Read US-004 AC-8 before writing the anchor forms (text,
  slug, number stripped, ambiguous = a title that two headings share,
  unresolved = no such heading). The by-rule split is checked by the
  migrated US-004 test (TICKET-070); this ticket's test checks the sum and
  the warnings.
- **US-018 rule.** Read US-018 AC-2 and AC-3 before counting
  `numberedLinks`: a link to a heading of level ≤ L, a link to a glossary
  term counting with its heading level, every link inside a glossary
  explanation; unresolved links are not numbered. The AC-2c test compares
  each count with the plugin's page-ref calls, so a misread rule fails.
- **Join hazards (SCAR-009, SCAR-010).** The census requires text runs that
  start and end with `#`, `.`, `,`, `(`, `)`, `"`, `-`, `+`, `:`, `!`, `?`,
  `/` and non-ASCII characters. Write them where the real file has them
  (after a link, before a line break, in table cells) and run the AC-2b
  "only five warning codes" test and the AC-6 compile to see that nothing
  breaks.
- **Repeated titles (SCAR-011).** 47 or more titles that repeat, and at least
  one natural title of the generated label shape (`Lorem 2` beside two
  `Lorem`), so US-002's uniqueness keeps its clash case.
- **Prettier.** Add `tests/fixtures/sample` to `.prettierignore`; the
  generated JSON is not reformatted (AC-1b compares bytes).
- **Notes to measure while coding:** the run time of the generator (story
  Notes); the PDF page count of `Book.md` (≥ 202).

### Guards searched before the ticket (SCAR-023)

- `tests/integration/us-001-validity.test.ts` lists `tests/fixtures/*.md`
  (top level only): `sample/` is a subfolder, `generate.ts` is not `.md`; not
  affected here (TICKET-070 changes the test).
- `npm run lint` runs Prettier over the project: covered by the
  `.prettierignore` line above.
- No test forbids a write below `tests/fixtures/`.

---

## Tests

- `tests/tooling/us-024-generator.test.ts` (all).
- `tests/unit/us-024-census.test.ts` (all).
- `tests/integration/us-024-sample-pdf.test.ts` (all).
- Every other test stays as it is (no existing file changes in this ticket).
- Mutation checks (SCAR-018, SCAR-023): one built-in callout type left out;
  one heading level skipped; a manifest count off by one (`comments`,
  `numberedLinks['2']`, `anchors.ambiguous`); the seed taken from the clock;
  an alpha channel in one PNG; the cover not first; one non-ASCII character
  left out; the glossary terms one level too deep.

---

## SCAR check (2026-10-27, item by item against the Prevention lists)

- **SCAR-001** (1–4) no shared utility of `src/` is used; the generator's own
  helpers (PNG writer, word picker) are local to it.
- **SCAR-002** (1–5) composed: AC-2's 44 + 8 pairs, AC-2b's table, AC-2c's
  facts; every example of AC-2b was run through the whole converter at G1;
  wrappers: bold, links, inline footnotes, callouts, cells, glossary terms.
- **SCAR-003** (1–3) red tests exist (G2, 44 + 8); the AC list read again
  here; map rows.
- **SCAR-006** (1–4) full gate before Done; no skip; counts in the result;
  TICKET-070 to 074 tracked.
- **SCAR-007** (1–3) every count has its exact minimum in the story.
- **SCAR-008** (1–6) PDF facts measured before (images, masks, fonts,
  hyphenation, page numbers); the PDF test reads content by program; no
  canvas; the generator logs nothing but fails loudly on a bad model.
- **SCAR-009** (1–4) text start and end classes in every position the census
  lists; the compile of AC-6 and the warning-code test as the exhaustive check.
- **SCAR-010** (1–6) the join hazards of a link followed by `.`, `(`, `;`
  and of `/` next to `*` are written into the filler where the real file has
  such neighbours; the existing join tests stay.
- **SCAR-011** (1–5) the repeated titles and a natural `Lorem 2` title.
- **SCAR-012** (1–6) n/a here (no handover; TICKET-073 and the next M run).
- **SCAR-013, SCAR-014** n/a (no dialog; the generator writes only its own
  output folder; the CLI run replaces `tests/fixtures/sample/` and nothing
  else).
- **SCAR-015** (1–5) AC-6 names the content; the blank guard is in the file.
- **SCAR-016** n/a (no control).
- **SCAR-017** (1–7) one generator, one manifest; every count read from the
  model in one place.
- **SCAR-018** (1–9) the generator writes only `outDir`; the mutation run
  backs up `tests/fixtures/generate.ts` and the committed vault by full path
  with a checksum list, checks after every restore; the private inputs
  checked against `spikes/us-024-baseline/private-inputs.sha256` at the end.
- **SCAR-019** (1–5) the PDF test uses non-default settings; the AC-2c test
  covers `linkPageLevel` 1, 2, 3, 6.
- **SCAR-020** (1–3) no option offered.
- **SCAR-021** (1–3) page relations read from the printed numbers; the
  oscillation case stays in US-018's own tests.
- **SCAR-022** n/a (no callback).
- **SCAR-023** (1–8) every manifest number has a second source in the tests;
  the mutants above; a survivor is read first as a model that cannot reach
  the rule.
- **SCAR-024** (1–4) the run time and the page count are measured and
  recorded; no other statement about a tool.
- **SCAR-025** (1–4) the PDF of `Book.md` is looked at once at reading size
  (three pages: the cover, a callout page, a glossary page) before Done.

---

## Definition of done

- [x] The three US-024 test files above green
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)
- [x] Generator run time and page count recorded; private inputs checksum OK

---

## Result (2026-10-27)

Changed: `tests/fixtures/generate.ts` (new; Node built-ins only; seed
20261027; `generateSample(outDir)`, and as a program `node
tests/fixtures/generate.ts [outDir]`), `tests/fixtures/sample/` (generated,
72 files, 816 KB: `Book.md`, `Other.md`, `presets/Sample.md`, 68 images in
`assets/` and `assets/plates/`, `assets/notes.pdf`, `manifest.json`),
`package.json` (script `fixtures`), `.prettierignore`
(`tests/fixtures/sample`). No change of `src/`.

- `Book.md`: 7 234 lines, 517 724 bytes, 669 headings (9 H1 with the
  appendix that holds the four links to the linked term), 273 tables, 42
  terms, 44 comments (first on line 191), 70 images (17 with caption) of 68
  files; anchors 404 by text / 290 by slug / 247 number-stripped, 80
  ambiguous, 62 unresolved; numbered links 53 / 178 / 436 / 947 at levels 1 /
  2 / 3 / 6; 50 repeated titles with 200 extra uses and the natural twin
  `… 2`. Every number is at least the real file's.
- Measured: the generator runs in 0.18 s (`node`, 0.42 s through `npm run
  fixtures`); the PDF of `Book.md` in A5 print has 299 pages (≥ 202) and is
  converted and compiled in 5.6 s (< 30 s). Manifest SHA-256 `92aaea98de17…`,
  `Book.md` `e440731f47a6…`.
- Gate (scratchpad `gate069.log`): typecheck, build (`main.js`
  `cdbc3da5a4d9…`, equal to release 0.9.0), lint green; `npm test` 1816
  passed, 8 failed, 1 todo; integration 388 passed, 1 skipped (all eight
  US-024 PDF tests green). The 8 red tests belong to later tickets, each red
  for its reason: AC-8 ×3 (`installSample`, TICKET-073), AC-4 (the 23 files,
  TICKET-070), AC-5 (45 files, TICKET-071), AC-10 and AC-11 ×2 (`.gitignore`,
  the state-test skip, TICKET-074).
- AC → tests: AC-1, AC-1b (6), AC-2, AC-2b, AC-2c, AC-3 (31), AC-6, AC-7 (8)
  — green.
- Changed while coding (reported): (1) the AC-2c test added the ambiguous
  links to the sum a second time; US-004 counts an ambiguous link under the
  rule that found its candidates (52 + 51 + 36 + 10 = 149), so the test now
  sums the rules and the unresolved and checks the ambiguous as a part
  (SCAR-023: a test input the real producer never gives); (2) the AC-1 test
  ran both generations in one import, so a seed taken at module load could
  not differ; it now runs two `node` processes (found by the clock-seed
  mutant, which only AC-1b caught at first); (3) the generator takes an
  optional output folder as a program, for that test; (4) table header cells
  are lowercase: two capitalised header cells side by side read as a heading's
  title in the PDF text and moved a known sentence's heading page; (5) a
  known-sentence heading gets a title that no other title contains; (6) no
  parameter property (Node's type stripping refuses it).
- Mutants (scratchpad `mut069b/run.py`, `results.json`; the three US-024
  test files, baseline 45 passed): 10, all caught — a built-in callout type
  left out; no level-6 heading; manifest `comments`, `numberedLinks['2']`,
  `anchors.ambiguous` each off by one; the seed from the clock (AC-1 and
  AC-1b); an alpha channel in one PNG (AC-6 image objects); the cover not
  first; one non-ASCII character left out; the glossary terms one level too
  deep (8 tests). Backups of the generator and the 72 vault files by full
  path, SHA-256 checked after every restore and at the end: OK. A first run
  (`mut069/`) on the code before change (2) gave the same result except AC-1.
- Looked at reading size (SCAR-025; pages 2, 3 and 296 at three times their
  size): callout boxes in their colours, tables with cell breaks, the
  natural twin heading, the note callout with tasks, table and embedded
  image, the glossary run-in terms with page numbers and the tip callout in a
  term. Noted, not changed: the glossary filler has a lowercase word after a
  full stop where a link list follows (filler text only); task boxes print as
  `[ ]` / `[x]` text, the plugin's behaviour today (seen at G1).
- Private inputs: `spikes/us-024-baseline/private-inputs.sha256`, 3434 lines,
  all OK.
