# TICKET-072 — Docs describe the sample vault and quote no rules text

**Status:** Done (2026-10-27)
**User story:** [US-024](../user-stories/US-024-synthetic-public-fixture.md)
**ACs addressed:** AC-9, AC-12
**Depends on:** TICKET-070, TICKET-071 (the docs name the tests as they are
after the move)
**SCARs:** SCAR-007, SCAR-017, SCAR-018, SCAR-023, SCAR-024

---

## Description

Replace the rules text quoted in tracked files, and make the project docs and
every story AC that names the real file as test input name the sample vault.
Records of what happened keep their wording, except quoted rules text.

---

## Acceptance criteria (from user story)

- **AC-9:** the quoted rules text in the 13 published files of the scan and
  the heading in the comment of `src/core/markers/heading-rules.ts:35` is
  replaced by filler or by text from the sample vault; afterwards the scan
  (segments of 20 or more characters from `compiledtext.md`, 35 or more from
  the rest of the vault, over every published file) finds nothing; it runs
  locally and its output goes into the result. `docs/state/` is not
  published and not changed (D9).
- **AC-12:** `CLAUDE.md` (project context, rule 2, the gate comment),
  `README.md`, `docs/technical/tests.md` and every story AC that names the
  real file, `The Rules/` or `compiledtext.md` as test input name the sample
  vault; US-016 AC-17 names `Other.md`; release notes and Done tickets'
  evidence keep their wording except quoted rules text.

---

## Implementation notes

**AC-9 instances** (the scan of 2026-10-27, scratchpad `census/quotes.json`;
the quotes themselves are not repeated here so that this ticket does not
publish them): `docs/technical/manual-checks.md`,
`docs/tickets/TICKET-047-glossary-terms-conversion.md`,
`docs/user-stories/US-004-links-and-references.md`,
`docs/user-stories/US-011-cover.md`,
`docs/user-stories/US-018-page-numbers-for-internal-links.md`,
`tests/integration/us-018-page-refs-pdf.test.ts`,
`tests/unit/us-002-headings.test.ts`, `tests/unit/us-004-links.test.ts`,
`tests/unit/us-009-cover-slug.test.ts`,
`tests/unit/us-011-cover-convert.test.ts`, `tests/unit/us-011-cover.test.ts`,
`tests/unit/us-017-heading-rules.test.ts`,
`tests/unit/us-018-page-refs.test.ts`, and `src/core/markers/heading-rules.ts:35`
(comment). Several tests may already have changed in TICKET-070; the scan
is run again first, and the list in the result is the one it gives.

- In a test, a quoted heading or cover file name used as example input is
  replaced by a filler one of the same shape (same length class, same
  characters that matter: `%20`, digits, `-`, `_`), so the test keeps the
  case it checks (SCAR-023: the input still reaches the rule).
- The scan script (the one of the census, in the scratchpad) is re-created
  in `spikes/` (git-ignored, so it does not publish the private vault's
  words) and run where the vault is.

**AC-12 instances** (grep of 2026-10-27 for `compiledtext`, `The Rules` or
"real file" in stories and tickets, 39 files; the story said 34 for the
narrower grep without "real file"): US-001, US-002, US-003, US-004, US-005,
US-006, US-007, US-008, US-011, US-012, US-014, US-015, US-016, US-017,
US-018, US-019, US-022; TICKET-001, 008, 010, 012, 013, 014, 015, 016, 017,
018, 023, 024, 027, 031, 043, 045, 048, 051, 053, 054, 063, 065. Per file
the result lists each hit and its decision: an AC or a test description
that names the real file as test input → the sample vault (with the
manifest key where it names a number); a record of what happened (a
ticket's Result, a dated decision, a release note) → kept, except a quoted
rules text.

- `CLAUDE.md`: the project context ("The example vault … is the real-world
  test input"), rule 2 ("nothing ever modifies the … vault") and the gate
  comment ("converts fixtures (incl. The Rules/)"). `CLAUDE.md` is the
  user's process file: the new wording is shown to the user in the chat and
  written only on the user's "go" for that text.
- `README.md` lines 27 and 40; `docs/technical/tests.md` line 51 and the map
  rows whose description names the real file.

**Short rules terms** (decided 2026-10-27, "Game + common"; US-024 AC-9):
the heading scan of the real file gives 386 distinct headings under 20
characters; 27 occur in published files (1 453 times, 134 files). Replace 19
of them — 11 game-specific and 8 common nouns — 615 occurrences in 53 files
(30 in `tests/`, 20 in `docs/`, `CLAUDE.md`, `scars/README.md`,
`src/core/markers/heading-rules.ts`). Keep 8: the plugin's and the docs' own
words. The terms, their groups and every file with its count are in
`spikes/us-024-baseline/short-terms.json` and `short-terms-groups.json`; they
are not repeated here, so this ticket does not publish them.

- Run the scan again after TICKET-070 and TICKET-071 (both change tests that
  hold the terms) and work from that list; the result gives the new counts.
- In tests, a term used as example input (a heading, its label `h-…`, an
  anchor `#…`, a link text) becomes a filler term of the same shape, and
  every expected output derived from it changes with it (labels, slugs,
  page-number targets). The test composed note of US-015
  (`tests/support/convert.ts`) holds several of them; its expected outputs
  in other tests change together.
- In `scars/` and `CLAUDE.md` an example word becomes a neutral one; the
  example keeps its meaning.
- After the change the short-term scan finds only the 8 kept words.

### Guards searched before the ticket (SCAR-023)

- `tests/tooling/state-directory.test.ts` reads `CLAUDE.md` for `**G0**` to
  `**G5**` and `docs/state/*.md`: the edit keeps them.
- `tests/unit/us-013-typst-escaping.test.ts` reads the register of
  `docs/user-stories/README.md`: not changed here.
- `tests/plugin/us-007-plugin-wiring.test.ts`, `us-008-wiring.test.ts`,
  `tests/tooling/us-000-test-build-version.test.ts` read
  `manual-checks.md`: the AC-9 edit there keeps every string they need
  (TICKET-073 rewrites the checks).

---

## Tests

- `tests/tooling/us-024-public.test.ts` stays green; the full gate green.
- The scan's output (zero hits) and the per-file decisions in the result.

---

## SCAR check (2026-10-27, item by item against the Prevention lists)

- **SCAR-001** n/a.
- **SCAR-002** n/a (docs).
- **SCAR-003** (1–3) AC-9 and AC-12 are procedures with their evidence in
  the result; the map says so.
- **SCAR-006** (1–4) full gate after the edits.
- **SCAR-007** (1–3) every changed AC keeps exact values (manifest keys).
- **SCAR-008** n/a.
- **SCAR-009, SCAR-010, SCAR-011** n/a.
- **SCAR-012** n/a.
- **SCAR-013, SCAR-014** n/a.
- **SCAR-015** n/a.
- **SCAR-016** n/a.
- **SCAR-017** (1–7) the class is listed twice (scan and grep); every hit has
  its decision in the result; the AC-5 and AC-10 checks keep the test and
  personal parts out automatically.
- **SCAR-018** (1–9) edits by hand; if a script edits docs, backups by full
  path with checksums; the private inputs compared with the baseline.
- **SCAR-019, SCAR-020, SCAR-021, SCAR-022** n/a.
- **SCAR-023** (1–8) replaced example inputs keep their shape; the full gate
  shows they still reach their rules.
- **SCAR-024** (1–4) no doc gains a statement about a tool that is not
  measured.
- **SCAR-025** n/a.

---

## Definition of done

- [x] Scan output zero hits, in the result
- [x] Short-term scan: only the 8 kept words, counts in the result
- [x] Per-file decisions for the 39 stories and tickets, in the result
- [x] `CLAUDE.md` text approved by the user before it is written
- [x] Full gate green; counts in the result

---

## Result (2026-10-27)

Scans (git-ignored scripts and results in `spikes/us-024-baseline/`:
`scan.py`, `terms.py`, `lower.py`, `scan-072-before.json`,
`scan-072-final.json`), over the 419 files a publish would include:

- **Long quotes:** 12 files before (11 after TICKET-070), 0 after. The five
  sources and their neutral replacements of the same shape: a cover file name
  (39 uses in 6 files), a heading and its slugs and numbered anchors (29 uses
  in 7 files), a glossary explanation (2 docs), a bare address with an
  escaped underscore (6 uses in 3 files), a heading with comma, hyphen and
  question mark and its label (2 uses).
- **Short terms (decided 2026-10-27, "Game + common", then "Only as rules
  examples"):** 601 occurrences in 53 files before. The 11 game terms
  replaced in every form; the 8 common nouns only as the rules' examples. Pass
  1 (`terms.py`, written forms, multi-word slugs and `%20` forms): 594
  replacements in 52 files, `CLAUDE.md` left out; pass 2 (`lower.py`,
  lowercase forms inside `h-…` and `#…` tokens only): 236 in 28 files; by
  hand: the multi-space `Tidal   Basin` (4), the `%20` paths with a digit
  before the term (7), the apostrophe slug (2), "the end notes" (1),
  `[[tessera]]` (1), the lowercase game word in the US-018 PDF test and its
  marker (17). Every pass backed up its files by full path with SHA-256 and
  asserted its per-file counts. After: only the 12 reviewed ordinary uses
  remain (the allow-list): "Next Permitted Action" in `CLAUDE.md` and
  `tests/tooling/state-directory.test.ts`; "Situation, Cause, Action,
  Resolution" in `scars/README.md`; the "Action" column of US-020; "Turn …"
  as a verb in `manual-checks.md` (lines 28, 152, 153, 331) and in
  TICKET-014, 018, 043; "Bear" among the animals of an M13 table.
- **Found while doing it (reported):** (1) the first run replaced every
  capitalised use of the common nouns and hit project vocabulary ("Next
  Permitted Action" became a different field name and the state test went
  red); all 53 files were restored from the backup (checksums OK) and the
  user chose "only as rules examples"; (2) `CLAUDE.md` was in the scan's file
  list and the first run changed it; it was restored at once (checksum OK)
  and is left to the user's go; (3) one filler word was replaced again
  ("Flint" → "Moss") when two US-018 PDF tests that search the PDF text for
  it failed; the cause was not established (the same tests had passed in an
  earlier run with "Flint"), the second word made them pass; (4) the unresolved
  anchor names of the real file listed in US-004 AC-8 (rules-derived slugs
  the scan did not see) were removed; the counts stay.
- **AC-12:** `README.md` (the test input is the generated sample vault; the
  layout line), `docs/technical/tests.md` (the fixtures paragraph, three map
  rows), and the story ACs that used the real file as test input: US-001
  AC-11, US-002 AC-1c, US-004 AC-8 (regression), US-006 (report link
  example), US-007 AC-6 and AC-13, US-008 (M3 pointer), US-012 AC-13, US-014
  AC-4, US-015 (example paths, AC-10), US-016 AC-17 (on `Other.md`), US-017
  AC-13, US-018 AC-9, US-019 AC-11, US-022 (example path), US-003 (example
  path). Kept as records (dated measurements of the real file, the MVP
  heading of the story index, Done tickets): 37 lines in stories and docs,
  all tickets. `manual-checks.md` is TICKET-073's.
- Gate (scratchpad `gate072b.log`): typecheck, build (`main.js`
  `cdbc3da5a4d9…`, unchanged), lint green; `npm test` 1819 passed, 6 failed,
  1 todo; integration 389 passed, 1 skipped. The 6 red tests are TICKET-073's
  and TICKET-074's. Private inputs: 3434 checksums OK.
- **`CLAUDE.md`** (the user's go on the proposed wording, 2026-10-27): the
  project context (the test input is the generated sample vault; the private
  vault is git-ignored, never read by a test, never modified), rule 2 (the
  sample vault changes only through its generator; nothing modifies a private
  vault), the gate comment (`incl. the sample vault`). Backup before the edit
  in the scratchpad (`CLAUDE.md.before072`); the diff shows exactly the three
  passages. Gate after it (scratchpad `gate072c.log`): typecheck, build
  (`main.js` unchanged), lint green; `npm test` 1819 passed, 6 failed
  (TICKET-073, 074), 1 todo; the state test green; integration 389 passed,
  1 skipped. Private inputs: 3434 checksums OK.
- Final scans (`scan-072-closed.json`): long quotes 0; short terms 18 uses in
  9 files: the 12 kept uses above and 6 in this ticket's own result, which
  names those same kept uses to document the allow-list.
