# TICKET-073 — The sample vault in the scratch vault; manual checks rewritten

**Status:** Done (2026-10-27)
**User story:** [US-024](../user-stories/US-024-synthetic-public-fixture.md)
**ACs addressed:** AC-8
**Depends on:** TICKET-069 (the vault and its manifest)
**SCARs:** SCAR-012, SCAR-014, SCAR-015, SCAR-016, SCAR-017, SCAR-018, SCAR-023, SCAR-025

---

## Description

`npm run install:scratch` also copies `tests/fixtures/sample/` into the
scratch vault as `Sample/`, checked by SHA-256, and the manual checks M1 to
M13 name notes, headings, images and texts of the sample vault. The rewritten
steps are run at each check's next run (AC-8), not in this ticket.

---

## Acceptance criteria (from user story)

- **AC-8:** `installSample({from, to})` in `build/install-scratch.mjs`
  copies every file and checks it by SHA-256, returning the number of files;
  the script's main block calls it with
  `from: join(root, 'tests/fixtures/sample')` and
  `to: join(root, 'spikes/typst-wasm/scratch-vault/Sample')`; every manual
  check names the sample vault (read from the manifest), never `The Rules/`
  or `compiledtext`; `manual-checks.md` names `Sample/Book.md`.

---

## Implementation notes

- `build/install-scratch.mjs`: `installSample` reads every source first (a
  missing file leaves the target untouched, as `installBuild`), then
  replaces the folder `Sample/` of the scratch vault: it removes the old
  folder and copies the new one, so a file deleted from the sample does not
  stay behind. `Sample/` holds generated test data only; the M checks that
  edit a sample note back it up first (SCAR-018).
- `build/install-scratch.d.mts`: the declaration of `installSample`.
- **The scratch vault's presets folder** is `Obsidian2Typst/presets`; the
  sample's `presets/Sample.md` defines `rule-box`. The checks that need
  `rule-box` point the presets folder at `Sample/presets` as a step, or the
  installer also copies `presets/Sample.md` into `Obsidian2Typst/presets/`
  under a name unique there (SCAR-012: a listing proves it). Decided while
  writing M6 (callouts); both keep the vault's other presets untouched.
- **manual-checks.md:** for each of M1 to M13 every reference to a note of
  the private copy in the scratch vault (`compiledtext.md`, notes of
  `The Rules/`) and every expected text taken from it is replaced by the
  sample's: notes `Sample/Book.md` and `Sample/Other.md`, headings and
  terms and sentences from `manifest.json`, page counts measured from the
  sample's PDF in the check's preset. The other fixture notes of the scratch
  vault that are not private (`Callouts.md`, `Folios.md`, `Menus.md`, …) stay
  where a check uses them; each is listed with its decision in the result.
- Every M section keeps `Expected version` and `scratch vault`, and M3, M6
  to M13 keep the current version (`us-000-test-build-version`); M1, M2, M3
  keep the strings `us-007-plugin-wiring` and `us-008-wiring` read.
- Each rewritten step states what must be seen (SCAR-015) and ends with the
  open question; steps that use a control keep "without closing the tab"
  (SCAR-016).
- No test build and no handover in this ticket: a rewritten check is run with
  the next versioned build of its next run (SCAR-012).

### Guards searched before the ticket (SCAR-023)

- `tests/tooling/us-000-test-build-version.test.ts` (sections, versions),
  `tests/plugin/us-007-plugin-wiring.test.ts`, `us-008-wiring.test.ts`
  (strings): kept, listed above.
- `TICKET-026 installBuild` tests: `installBuild` is not changed.

---

## Tests

- `tests/tooling/us-024-install-sample.test.ts` (all three).
- `us-000`, `us-007-plugin-wiring`, `us-008-wiring` stay green.
- Mutation checks: one file not copied; a copy not checked; the old
  `Sample/` not removed (a planted stray file stays); the main block not
  calling `installSample`.
- A dry run of `npm run install:scratch` with the listing of the scratch
  vault's `Sample/` and the checksum check in the result.

---

## SCAR check (2026-10-27, item by item against the Prevention lists)

- **SCAR-001** n/a (no shared utility; `installSample` is a sibling of
  `installBuild`, same rules).
- **SCAR-002** (1–5) the M steps use `Book.md`, the composed note (callouts,
  glossary, page refs, folios, cover) of every story.
- **SCAR-003** (1–3) the AC-8 tests are red (G2).
- **SCAR-006** (1–4) full gate.
- **SCAR-007** (1–3) every rewritten step names the exact text from the
  manifest.
- **SCAR-008** n/a.
- **SCAR-009, SCAR-010, SCAR-011** n/a; file names unique where looked up
  (SCAR-012 below).
- **SCAR-012** (1–6) the install compares every copy; the checks name the
  place (`Sample/` in the scratch vault); the version rules kept; a fixture
  name used by a check is unique where Obsidian looks it up (a listing in
  the result: `Book.md`, `Other.md`, the image names, the preset name).
- **SCAR-013** n/a.
- **SCAR-014** (1–6) the install replaces only `Sample/`, generated data; the
  worst misplaced action is running the install during a check that edited
  a sample note — the check backs the note up first (stated in the checks
  that edit).
- **SCAR-015** (1–5) each step lists what a correct result shows; the open
  question at the end.
- **SCAR-016** (1–7) steps with controls keep "without closing the tab";
  M11's restart step stays.
- **SCAR-017** (1–7) every reference to the private copy in
  `manual-checks.md` is found by grep (`compiledtext`, `The Rules`, and the
  private copy's note names) and listed with its replacement.
- **SCAR-018** (1–9) the scratch vault's `Sample/` and `data.json` backed up
  with checksums before the dry run; checked after.
- **SCAR-019** (1–5) the checks keep their non-default presets.
- **SCAR-020, SCAR-021, SCAR-022** n/a.
- **SCAR-023** (1–8) the AC-8 tests check the call with its arguments, every
  file's checksum, and the absence of the private names in the checks; the
  mutants above.
- **SCAR-024** n/a.
- **SCAR-025** (1–4) expected page images in the checks are taken from the
  sample's PDF at reading size.

---

## Definition of done

- [x] The three AC-8 tests green; `us-000`, `us-007`, `us-008` wiring green
- [x] Dry run of the install with listing and checksums in the result
- [x] Per-reference decisions for `manual-checks.md` in the result
- [x] Full gate green; counts in the result

---

## Result (2026-10-27)

Changed: `build/install-scratch.mjs` (`installSample`, the main block's call),
`build/install-scratch.d.mts`, `docs/technical/manual-checks.md` (32
passages), `tests/tooling/us-024-install-sample.test.ts` (one test added, see
below), `tests/fixtures/generate.ts` (the cover's size, see below) and the
regenerated sample vault. In the scratch vault (test environment, git-ignored):
the new folder `Sample/` (73 files) and the note `Glyph check.md`. No change of
`src/`; `installBuild` unchanged.

- **The `rule-box` route (open since G3):** decided while rewriting: none of
  the checks that export `Sample/Book.md` is a callout check, and M6 uses its
  own notes; so the checks keep the vault's presets folder, and their exports
  report `rule-box` and `mystery` as `CALLOUT_TYPE_UNKNOWN` (stated in M7 and
  M9). `Sample/presets/Sample.md` stays where the install puts it.
- **References rewritten (every one, by grep for `The Rules`, `compiledtext`
  and `Rules glossary`):** M1 (the scratch vault needs no real notes), M2
  (f), the needs, (c), (i), (j); M3 the needs, steps 1 and 2, the pass
  criteria; M4 the needs, the instruction, step 1; M5 the needs and steps 2 to
  6; M7 the needs and step 4; M8 the needs and step 6; M9 the needs and step
  7; M10 the needs and steps 4 and 8. After: no match.
- **Expected values measured from the sample (SCAR-015), with the plugin's
  merge of the vault's preset and Defaults (`effectiveSettings`), the
  pipeline and the bundled compiler (scratchpad `m073/m.test.ts`, `m.json`):**
  `Book.md` has 419 pages in `A5 print`, `Folios`, `Slug 5` and `Glossary
  terms`; the cover alone on page 1 without a number, folios 1 to 418; headers
  such as `Cras Ac` on pages 3 to 6 in `Folios`; the glossary on pages 413 to
  419 with all 42 terms run-in; 148 warnings (80 `LINK_AMBIGUOUS`, 64
  `LINK_UNRESOLVED`, 2 `CALLOUT_TYPE_UNKNOWN`, 1 `EMBED_NOTE_UNEXPANDED`, 1
  `COMMENT_DROPPED`); 178 page numbers at `linkPageLevel` 2 (the manifest's
  `numberedLinks['2']`), none in a header; page 3 in `A5 print` is 15.0 to
  18.0 % non-white (drawn at 2× and 1×; it shows text, a table and a callout
  box, looked at at reading size); conversion and compile 5 to 8 s.
- **Found and fixed:** (1) the generated cover was 40 × 28 px landscape, so
  M4 step 1 ("no `COVER_*` line") would fail on a crop warning; the generator
  now writes it at 148 × 210 px (A5 portrait; measured: no `COVER_CROPPED`);
  the vault regenerated, the US-024 tests green (45). (2) `Glyphs.md`, a
  hand-made check note of M5, lay inside the private copy folder of the scratch
  vault; copied unchanged as `Glyph check.md` to the vault root (SHA-256
  equal; the name exists once, by listing).
- **Found, not changed (for the next run, SCAR-012):** the scratch vault's
  `PageRefs.md` sets `linkPageLevel: 3`, but M9 describes it at the built-in
  values; M9 step 7 now says to check this first and gives both results (178
  numbers at level 2; 420 pages and 436 numbers at level 3). The scratch
  vault's own copy of the private cover file still has its old name; no check
  names it any more.
- **Test added (SCAR-023):** the ticket listed a mutant "the old `Sample/`
  not removed", which no G2 test could catch; a test now plants a stray file
  in `Sample/` before the install and expects it gone.
- **Mutants (scratchpad `mut073/`; the AC-8 test file, baseline 4 passed):**
  one file not copied (2 tests red), the old folder not removed (1), the main
  block not calling `installSample` (1) — caught; a copy not checked —
  survives: on a working disk every copy is intact, so the defensive
  checksum check cannot be reached without a failing write, and the function
  has no injectable file system (accepted, reported). The file was restored
  after every mutant and its checksum checked: OK.
- **Dry run:** `installSample` run into the scratch vault's `Sample/` (73
  files, `shasum -c` against the source: all OK); `data.json`, `main.js` and
  `manifest.json` of the installed plugin unchanged (checksums before and
  after). The full `npm run install:scratch` was not run: it would also rebuild
  and replace the installed test build `0.9.0-m13.1`; the main block's call is
  covered by the text test and runs at the next handover.
- Gate (scratchpad `gate073.log`): typecheck, build (`main.js`
  `cdbc3da5a4d9…`, unchanged), lint green; `npm test` 1823 passed, 3 failed,
  1 todo; integration 389 passed, 1 skipped. The 3 red tests are
  TICKET-074's (AC-10, AC-11 ×2). Private inputs: 3434 checksums OK.
- The rewritten steps are run at each check's next run with the versioned
  build of that run (AC-8); no handover in this ticket.
