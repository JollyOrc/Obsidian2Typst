# US-024 — A synthetic public fixture replaces the private vault in the tests

**Status:** Done (2026-10-27)
**Introduced:** v0.9.1 (planned; tests, fixtures and docs only, no change of
the plugin's behaviour, so a patch version)
**Implemented:** TICKET-069 to TICKET-074 (2026-10-27); the clean copy of the
publish set passes the full gate
**Supersedes:** the role of `The Rules/` and `tests/fixtures/compiledtext.md`
as test input (`CLAUDE.md` project context and rule 2, `README.md`,
`docs/technical/tests.md`, every AC that names "the real file")

---

## Story

**As the** author of the plugin,
**I want** every automated test and every manual check to run on a generated,
public sample vault instead of my private rules vault,
**so that** the project can be published on GitHub without my rules text,
my images or my personal data, and anyone who clones it gets a green gate.

Decided by the user (`docs/state/00_governance.md`, 2026-10-27): D1 the real
vault is replaced completely (no test reads it any more); D2 the fixture is
generated only, by a deterministic script; D3 the text is neutral filler with
the real file's structure; D4 the scratch vault for manual checks switches to
the generated vault too; D5 the fake `The Rules/...` paths in tests are
renamed to a neutral vault name, and rules text quoted in the docs is removed;
D6 the name is `Sample`; D7 the generated vault is committed and a test
checks that it is current; D8 the generated note covers the real file's
census plus callouts, wikilinks, embeds and task lists, with no coverage
tool; D9 `docs/state/` is not published, and the ledger stays append-only.

Today (measured 2026-10-27, read-only, scratch probe `census/census.test.ts`
with the plugin's `parse` and `convert`, and by grep):

- `tests/fixtures/compiledtext.md`: 386 706 bytes, 5 444 lines; line 5 holds
  the author's name. 28 test files name it; 23 test files read it or
  `The Rules/` from disk (counted at G2 by the AC-4 check and by an
  independent grep; the G1 figure "read by 28" counted fake paths too).
- `The Rules/` is read from disk by 6 integration tests, all for the file list
  or the first bytes of `The Rules/assets` (63 files: 55 `.png`, 6 `.jpg`,
  1 `.jpeg`, 1 `.pdf`; one subfolder; no blanks, capitals, `%` or non-ASCII in
  the names): `us-001-validity`, `us-003-images-roundtrip`,
  `us-006-output-and-source` (a snapshot that proves rule 2),
  `us-007-export-compiledtext`, `us-012-preview-equals-export`,
  `us-015-convert-compiles`.
- 19 of the 28 files assert numbers of the real file (for example 64
  images, 17 with a caption, 62 assets, 18 counts in
  `us-014-parse-lines-robustness`).
- Every other `The Rules/...` string in `tests/` is a fake vault path that is
  never read from disk (141 quoted strings, for example
  `NOTE_PATH = 'The Rules/Rules.md'` in `tests/support/convert.ts`).
- Rules text quoted in tracked files (segments of 20 or more characters from
  the real file, 35 or more from the rest of the vault): 14 files — 6 in
  `docs/` (`US-004`, `US-011`, `US-018`, `TICKET-047`, `manual-checks.md`,
  `docs/state/30_scar_checks.md`) and 8 in `tests/` (`us-002-headings`,
  `us-004-links`, `us-009-cover-slug`, `us-011-cover`, `us-011-cover-convert`,
  `us-017-heading-rules`, `us-018-page-refs`, `us-018-page-refs-pdf`), plus
  one heading in a comment of `src/core/markers/heading-rules.ts:35`.
- The real file's census (the generator's input list, AC-2) is the table in
  AC-2.

---

## Acceptance criteria

- **AC-1 (the generator):** A script `tests/fixtures/generate.ts`, run with
  `npm run fixtures`, writes the sample vault `tests/fixtures/sample/` from a
  fixed seed: the long note `Book.md`, a short second note `Other.md`, its
  images under `tests/fixtures/sample/assets/`, a preset note
  `presets/Sample.md` that defines the user callout type `rule-box` (for the
  manual checks, AC-8), and a manifest `manifest.json` (AC-3). It
  uses no network, no clock and no random source other than its own seeded
  generator. Run twice, it writes byte-identical files (SHA-256 of every file
  equal). Example: `npm run fixtures && shasum -a 256 tests/fixtures/sample/**`
  gives the same list twice.

- **AC-1b (committed and current; D7):** The generated vault is committed. A
  test runs the generator into a temporary folder and compares every file
  with `tests/fixtures/sample/` by SHA-256; it fails with the names of the
  files that differ, are missing or are extra. Example: a hand edit of one
  word in `Book.md` makes the test fail with `Book.md differs`; deleting
  `assets/map-01.png` fails with `assets/map-01.png missing`.

- **AC-2 (the census is covered):** `Book.md` contains at least the count of
  the real file in every row of this table (measured 2026-10-27). Text is
  neutral filler (`Lorem ipsum`-style words from a fixed word list) in the
  same structure.

  | What | Real file | Fixture at least |
  |------|-----------|------------------|
  | Lines / bytes | 5 444 / 386 706 | 5 444 / 386 706 |
  | Headings h1 / h2 / h3 / h4 / h5 / h6 | 8 / 64 / 98 / 218 / 190 / 77 | the same |
  | Paragraphs | 1 644 | 1 644 |
  | Lists bullet / ordered; deepest nesting | 118 / 10; 2 | the same |
  | Tables; most columns; aligns | 261; 8; default and centre | the same |
  | Images (all local, in a folder); with caption / without | 64; 17 / 47 | the same |
  | Image types | `.png`, `.jpg`, `.jpeg` | the same, plus one `.pdf` file in `assets/` that no note uses |
  | Links to a heading `#…` / bare web URLs / `[text](https://…)` / `mailto:` / other | 149 / 14 / 8 / 1 / 1 | the same |
  | Inline footnotes `^[…]` (with 9 links inside them) / footnote reference + definition | 15 / 1 + 1 | the same |
  | Bold / italic / `<u>…</u>` / `<span>…</span>` / `<br>` | 60 / 30 / 5 / 5 / 59 | the same |
  | Comments `<!-- … -->` / code blocks / quotes / hard breaks | 41 / 1 / 13 / 1 | the same |
  | A `Glossary` heading with terms one level below | 1 section | 1 section, at least 10 terms |
  | A cover image as the first line | `![](assets/…png)` | the same |
  | Warnings from `convert` | `LINK_AMBIGUOUS` 14, `LINK_UNRESOLVED` 10, `COMMENT_DROPPED` 1 | each code at least once |

  Every container × element pair of the real file is in the fixture (44
  block pairs and 8 inline pairs of the census walker, for example a link inside a list item, bold inside a quote, a footnote
  reference inside a quote, a link inside a table cell, a `<br>` inside a
  cell, a link inside an inline footnote, bold inside a link and a link inside
  bold). Every first and last character class of a text run in the real file
  is in the fixture, at the start and at the end of a text run (letter, digit,
  blank, `#`, `.`, `,`, `(`, `)`, `"`, `-`, `+`, `:`, `!`, `?`, `/`, non-ASCII),
  and all 11 non-ASCII characters of the real file (`°`, `é`, `ê`, `ö`, `–`,
  `—`, `’`, `“`, `”`, `…`, and a no-break space). A test computes this census
  for `Book.md` with the same walker the census probe used and compares it
  with the table.

- **AC-2b (features the real file lacks; D8):** `Book.md` also contains, at
  least once each and in these compositions:

  | Feature | In `Book.md` |
  |---------|--------------|
  | Built-in callouts | each of the 13 built-in types (`note`, `abstract`, `info`, `todo`, `tip`, `success`, `question`, `warning`, `failure`, `danger`, `bug`, `example`, `quote`) once, with a title |
  | User callout type | `rule-box` (styled by the settings in the tests and by `presets/Sample.md` in the scratch vault), nested inside a `note` callout |
  | Unknown callout type | `mystery` once (warning `CALLOUT_TYPE_UNKNOWN`, default box) |
  | Inside a callout | a task list, a table, an image embed, a nested callout, a wikilink in bold |
  | Wikilinks | to a heading of the same note (`[[#Ipsum dolor]]`), with the note name and an alias (`[[Book#Sit amet\|the alias]]`), in bold, inside an inline footnote, in a glossary explanation, to another note (`[[Other]]`) and to a missing note (`[[Missing]]`) |
  | Embeds | an image embed `![[assets/map.png]]` and a note embed `![[Other]]` (warning `EMBED_NOTE_UNEXPANDED`) |
  | Task lists | open and done items, nested one level, inside a callout and inside a glossary term's explanation |
  | A callout in a glossary term | a `tip` callout after a term's first paragraph |

  Measured 2026-10-27 (scratch probe `census/extras.test.ts`, the whole
  `convert` with built-in defaults and `rule-box` in the settings, then the
  bundled compiler): zero compile errors; the warnings are exactly
  `LINK_UNRESOLVED` for `[[Other]]` and `[[Missing]]` (`No heading matches
  "[[Other]]"`: wikilinks resolve to headings of the note itself),
  `CALLOUT_TYPE_UNKNOWN` for `mystery`, `EMBED_NOTE_UNEXPANDED` for
  `![[Other]]`. Output examples from that run:

  ```
  md : See [[#Ipsum dolor]], [[Book#Sit amet|the alias]], **[[Other]]** and [[Missing]].
  typ: See #link(<h-ipsum-dolor>)[Ipsum dolor], #link(<h-sit-amet>)[the alias], *Other* and Missing.
  md : > > [!rule-box] Nested user type
       > > Inner **[[#Ipsum dolor]]** text.
  typ:   #callout("rule-box", title: [Nested user type])[
           Inner *#link(<h-ipsum-dolor>)[Ipsum dolor]* text.
         ]
  md : > - [ ] open task
  typ:   - \[ \] open task
  md : ## Consectetur          (under # Glossary)
       Explanation with [[#Sit amet]].
  typ: #glossary-term[Consectetur] <h-consectetur> Explanation with #link(<h-sit-amet>)[Sit amet];.
  ```

  The manifest (AC-3) counts these features as well, and the tests that
  covered callouts, wikilinks, embeds and task lists with their own small
  notes keep those notes; the generated note adds the composed run.
  `Book.md` converted with `rule-box` styled gives exactly the warning codes
  `CALLOUT_TYPE_UNKNOWN`, `COMMENT_DROPPED`, `EMBED_NOTE_UNEXPANDED`,
  `LINK_AMBIGUOUS` and `LINK_UNRESOLVED`, no other (added at G2: an
  unexpected warning means the generator wrote something it did not mean).

- **AC-2c (the facts existing tests assert; added at G3, 2026-10-27):**
  Nine of the 23 test files that read the real file assert facts the census
  of AC-2 does not hold. `Book.md` has at least the real file's number of
  each (measured 2026-10-27: scratch probe `census/extra2` and the assertions
  of the tests named):

  | Fact | Real file | Test that asserts it |
  |------|-----------|----------------------|
  | Links to a heading resolved by its text / by its slug / with a leading number stripped; ambiguous; unresolved | 52 / 51 / 36; 14; 10 | `tests/unit/us-004-links.test.ts` (US-004 AC-8) |
  | Heading titles that occur more than once; extra occurrences | 47; 158 (655 headings, 497 distinct titles) | `us-002-labels-roundtrip` (US-002 AC-3) |
  | Links numbered at `linkPageLevel` 1 / 2 / 3 / 6 (US-018: links to headings up to the level, every link in a glossary explanation) | 22 / 33 / 59 / 139 | `tests/unit/us-018-page-refs.test.ts`, `us-018-page-refs-pdf` (US-018 AC-9) |
  | Glossary terms; one term linked from at least 3 places | 40; yes | `us-017-heading-rules`, `us-017-glossary-pdf` (US-017 AC-13) |
  | Comments, reported in one warning with the line of the first | 41 | `us-001-blocks-roundtrip` (US-001 AC-15) |
  | H1 titles, each starting a page | 8 | `us-019-folios-pdf` (US-019 AC-11), `us-002-numbering-pdf` (US-002 AC-1c) |
  | Table rows with more cells than the header | 0 | `us-005-tables-roundtrip` (US-005 AC-3) |

  Example: the US-004 regression "149 anchors, 52/51/36 by rule, 14
  ambiguous, 10 unresolved" becomes "the counts of `manifest.anchors`", and
  each of those is at least the real number.

- **AC-3 (expected numbers come from the generator):** `manifest.json` lists
  what the generator wrote, counted while writing: the numbers of AC-2, the
  asset file names, the image references with and without caption, the
  heading texts per level, the glossary terms, and five known sentences with
  their heading (for PDF content checks, AC-6), and the facts of AC-2c under
  the keys `anchors` (`byText`, `bySlug`, `byNumberStripped`, `ambiguous`,
  `unresolved`), `repeatedTitles` (`titles`, `extra`), `numberedLinks` (by
  level `'1'`, `'2'`, `'3'`, `'6'`), `linkedTerm` (`term`, `links`),
  `comments` (`count`, `firstLine`) and `longRows`. The generator counts each
  from what it wrote (it knows every link's target, its level and whether
  it sits in a glossary explanation); it does not call the plugin's
  resolver or emitter. Every test that asserted a
  number of the real file reads its number from the manifest; no expected
  number is computed with the plugin's own functions. Example: US-003 AC-1
  "finds all 64 images" becomes "finds all `manifest.images.total` images",
  and the manifest says 64 only because the generator wrote 64.

- **AC-4 (no test reads the private vault):** No file in `tests/` reads
  `The Rules` or `compiledtext.md` from disk. A text check over every file of
  `tests/` counts the calls of `readFileSync`, `readdirSync`, `statSync`,
  `existsSync` and of the local `walk`, `snapshot` and `heads` helpers whose
  argument contains `The Rules` or `compiledtext.md`, and expects 0; no file
  of `tests/` contains the path `fixtures/compiledtext`. It asserts that every
  reader call it examined equals the number of reader calls counted by a
  separate pattern (SCAR-023). A temporary output named after a note
  (`Reports/compiledtext export warnings.md`) is not the private file and is
  not a hit (narrowed at G2). Measured 2026-10-27: the check finds 23 test
  files, the same 23 an independent grep for disk reads found; they read
  `tests/fixtures/sample/` instead.
  `The Rules/` and `tests/fixtures/compiledtext.md` stay on disk, unchanged
  (SHA-256 list before and after the work equal; rule 2).

- **AC-5 (neutral fake paths):** Every fake vault path in `tests/` that starts
  with `The Rules/` starts with `Sample/` (D6), with the rest unchanged. Examples: `'The Rules/Rules.md'` →
  `'Sample/Rules.md'`; `'The Rules/assets/cover.png'` →
  `'Sample/assets/cover.png'`; `notePath: '/Users/me/Vault/The Rules/Rules.md'`
  → `'/Users/me/Vault/Sample/Rules.md'`. Expected outputs that contain the
  path change with it. Measured 2026-10-27 (scratch probe `census/ac5`, the
  composed note of US-015 AC-5 with `notePath: 'Sample/Rules.md'`): the asset
  use is `{from: 'Sample/assets/map.png', to: 'assets/map.png'}` and
  `FakeIndex.reads` lists `Sample/assets/...`; a warning carries only its
  line (`{code: 'LINK_UNRESOLVED', line: 3}`), never a path, and the
  generated Typst names only the note (`from "Rules.md"`), so neither
  changes. (The G1 example "a warning location `Sample/Rules.md:12`" was
  wrong and is replaced by this one.)
  A text check finds no `The Rules` in `tests/`, `src/` or `build/`.

- **AC-6 (content, not only success):** Every PDF test that used the real file
  asserts content of the fixture's PDF: at least one known sentence from the
  manifest on the page where its heading is, the embedded fonts (Libertinus
  Serif, DejaVu Sans Mono), the image count, and the glossary terms. The
  guard that shows the blank result (no fonts → no font in the PDF) stays.
  A sentence counts as on its heading's page when it is on that page or the
  next (the paragraph may break), blanks ignored. The image count is the
  number of `/Subtype /Image` objects, which equals the number of distinct
  image files the note uses (measured 2026-10-27: an image used twice is
  stored once, an opaque PNG or JPEG has no soft mask; so the generator
  writes opaque images). Measured the same day: the extracted text of
  filler words shows no hyphenation, and a compile with no fonts names no
  font (`/BaseFont` absent).
  Example: the US-007 AC-6 export of `Book.md` in 30 s has zero compile
  errors and its text contains the manifest's sentence 1.

- **AC-7 (pages and page edges):** In the built-in preset A5 print the
  fixture's PDF has at least as many pages as the real file's: 202 (measured
  2026-10-27, scratch probe `census/pages`, bundled fonts, stand-in images),
  and it has links to headings on the same page, on the next page and on an
  earlier page, so the page-number (US-018) and running-header (US-019) tests
  keep their page edges. The check reads the printed page numbers: with
  `linkPageNumbers: true`, `linkPageLevel: 2`, `linkPageWord: 'p.'` and
  folios on, each `(p. N)` on a page is compared with that page's folio. The
  real file gives 1 same-page, 1 next-page and 24 earlier-page numbers (and
  7 later), on 202 pages with a folio each (measured the same day); the
  fixture needs at least one of each of the first three.

- **AC-8 (the generated vault for manual checks):** `npm run install:scratch`
  also copies `tests/fixtures/sample/` into the scratch vault as the folder
  `Sample/` and checks every copy by SHA-256, with a new function
  `installSample({from, to})` in `build/install-scratch.mjs` that returns the
  number of files copied. Every manual check M1 to M13 names notes,
  headings, images and expected texts from the generated vault (read from the
  manifest), never from `The Rules/` or `compiledtext`; the manual
  checks (`manual-checks.md` and its check files, split 2026-10-29) name
  `Sample/Book.md`. The check of each
  rewritten M step is done at its next run, with the versioned build of that
  run (SCAR-012).

- **AC-9 (rules text out of the docs):** The quoted rules text in the 14 files
  listed under "Today" and the heading in `heading-rules.ts:35` is replaced by
  filler text or by text from the generated vault (for example a quoted
  heading of the real file → a heading of `Book.md` from the manifest; the
  quotes are listed by file in the scratch scan `census/quotes.json` and in
  the ticket, not here, so this story does not quote them). After
  the change, the scan used for the census (segments of 20 or more characters
  from `compiledtext.md`, 35 or more from the rest of the vault, over every
  file the publish would include) finds nothing; it is run locally, where the
  vault is, and its output is recorded in the ticket. `docs/state/` is not
  published (D9): it is git-ignored, so the quote in the append-only ledger
  stays where it is and the scan does not include `docs/state/`. Of the 14
  files, 13 are changed; `docs/state/30_scar_checks.md` is not.

  Short rules terms too (decided 2026-10-27): the heading names of the real
  file under 20 characters (386 distinct) are scanned in every published
  file, as whole words in their written form (case-sensitive, so the
  ordinary lowercase word is not a hit) and, for a term of several words,
  also as its slug (`lorem-ipsum` in `#lorem-ipsum` or `h-lorem-ipsum`). Measured the same day: 27 of them occur, 1 453 times in
  134 files. 19 are replaced (615 occurrences in 53 files: 30 in `tests/`,
  20 in `docs/`, `CLAUDE.md`, `scars/README.md`,
  `src/core/markers/heading-rules.ts`): 11 game-specific terms and 8 common
  nouns that are the real file's headings. 8 words stay because they are the
  plugin's or the docs' own vocabulary: the built-in `Glossary` rule, the
  callout type `success`, the story template's `Example:` and five ordinary
  words. The lists are in `spikes/us-024-baseline/short-terms.json` and
  `short-terms-groups.json` (git-ignored, because they are rules text). After
  the change the short-term scan finds only the 8 kept words. A replaced
  example input keeps its shape and the case its test checks (for example a
  two-word heading stays a two-word filler heading, a slug stays a slug).

- **AC-10 (no personal data):** No file the publish would include contains
  the author's family name or the employer's short name, in any case, nor the
  macOS user name as a home path (`/Users/<name>`, any case; the same word is
  the public GitHub handle that owns the repository and holds the copyright in
  `LICENSE`, so the bare word is allowed — amended 2026-10-27 with the user's
  licence decision) (the three are written base64-encoded in the test,
  so the test and this story do not contain them; corrected at G2, the G1
  wording named two of them). The files are those `.gitignore` does not
  exclude (AC-11), read by a matcher for the pattern forms this project uses
  that refuses any other form; the check asserts it saw `package.json` and
  `tests/fixtures/sample/Book.md`.

- **AC-11 (green without the vault):** A copy of the project that holds only
  the files the publish would include (no `The Rules/`, no
  `tests/fixtures/compiledtext.md`, no `spikes/`, no `docs/state/`, no
  `releases/*.zip`, no `node_modules/`; `.gitignore` lists each of these and
  `main.js` and `.DS_Store`), after
  `npm ci`, passes the full gate: `npm run typecheck`, `build`, `lint`,
  `npm test`, `npm run test:integration`, with no test skipped that was not
  skipped before, except the four tests of
  `tests/tooling/state-directory.test.ts` that read `docs/state/`: they skip
  with an explicit `it.skipIf(!existsSync('docs/state'))` and a comment that
  links the ticket, because `docs/state/` is not published (D9; decided
  2026-10-27). Where `docs/state/` exists they run as today; the fifth test
  (`CLAUDE.md` names the gates) runs everywhere. Example: in a temporary folder outside the project,
  `npm ci && npm run typecheck && npm run build && npm run lint && npm test &&
  npm run test:integration` ends green, with the pass counts recorded.

- **AC-12 (the docs describe the generated vault):** `CLAUDE.md` (project
  context, rule 2, the gate comment), `README.md`, `docs/technical/tests.md`
  and every story AC that names "the real file", `The Rules/` or
  `compiledtext.md` as test input name the generated vault instead (34
  story and ticket files by grep today; the list goes into the ticket,
  SCAR-017). US-016 AC-17 ("the real file has no callout header, and its
  Typst has no callout rule or call") moves to `Other.md`, which has no
  callout, because `Book.md` has callouts (D8). Records of what happened
  (release notes, Done tickets' evidence)
  keep their wording, except the quoted rules text that AC-9 removes; the
  ledger is not published and is not changed (D9).

---

## Notes

- Not measured yet (SCAR-024): that `.gitignore` keeps the files of AC-11 out
  (to be shown with `git check-ignore` once the folder is a repository); that
  a filler text with the census of AC-2 reaches the same code paths as the
  real file (no coverage tool, D8: the census is the stand-in for it); the
  run time of the generator (it does not exist yet; measured at its ticket).
- Composed cases (SCAR-002): AC-2's pair list and AC-2b's table are the
  composed cases; AC-2b's examples were run through the whole converter with
  the built-in defaults and compiled (measured 2026-10-27). The tests that
  check AC-2's census against the generated note are written (G2) and pass
  only once the generator exists.
- No dialog, control, menu or callback is involved (SCAR-013, 014, 016, 022
  n/a).

### Decisions (2026-10-27, `docs/state/00_governance.md`)

- **D6:** the neutral name is `Sample`.
- **D7:** the generated vault is committed; AC-1b checks it is current.
- **D8:** the census plus callouts, wikilinks, embeds and task lists (AC-2b);
  no coverage tool.
- **D9:** `docs/state/` is not published; the ledger stays append-only and
  unchanged.
- **G3 counter-offer (2026-10-27):** the four `docs/state/` tests of
  `state-directory.test.ts` skip when the folder is absent (AC-11); AC-2c
  added before the tickets; US-016 AC-17 moves to `Other.md` (AC-12).

---

## Related tickets

- [TICKET-069](../tickets/TICKET-069-sample-vault-generator.md) — The sample vault generator and the committed sample vault
- [TICKET-070](../tickets/TICKET-070-migrate-real-file-tests.md) — Move the 23 real-file tests to the sample vault
- [TICKET-071](../tickets/TICKET-071-neutral-fake-paths.md) — Neutral fake vault paths: `The Rules/` becomes `Sample/`
- [TICKET-072](../tickets/TICKET-072-docs-without-the-private-vault.md) — Docs describe the sample vault and quote no rules text
- [TICKET-073](../tickets/TICKET-073-sample-vault-for-manual-checks.md) — The sample vault in the scratch vault; manual checks rewritten
- [TICKET-074](../tickets/TICKET-074-publish-gate.md) — The publish gate: ignore list, state tests, clean copy, private data
