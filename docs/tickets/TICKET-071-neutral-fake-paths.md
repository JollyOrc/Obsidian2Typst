# TICKET-071 — Neutral fake vault paths: `The Rules/` becomes `Sample/`

**Status:** Done (2026-10-27)
**User story:** [US-024](../user-stories/US-024-synthetic-public-fixture.md)
**ACs addressed:** AC-5
**Depends on:** TICKET-070 (the disk reads are gone first, so every remaining
occurrence is a fake path or a word in a name or comment)
**SCARs:** SCAR-006, SCAR-017, SCAR-018, SCAR-023

---

## Description

Rename every fake vault path in `tests/` from `The Rules/…` to `Sample/…`
(D6), with the rest of the path unchanged, together with the expected
outputs that contain the path; remove the vault name from the one comment in
`src/`. No behaviour changes.

---

## Acceptance criteria (from user story)

- **AC-5:** every fake vault path in `tests/` that starts with `The Rules/`
  starts with `Sample/`, the rest unchanged (`'The Rules/Rules.md'` →
  `'Sample/Rules.md'`, `'The Rules/assets/cover.png'` →
  `'Sample/assets/cover.png'`, `'/Users/me/Vault/The Rules/Rules.md'` →
  `'/Users/me/Vault/Sample/Rules.md'`); expected outputs that contain the path
  change with it (asset `from`, `FakeIndex.reads`); a warning carries no path
  and the Typst names only the note, so neither changes (measured at G2). No
  file of `tests/`, `src/` or `build/` names the vault.

---

## Implementation notes

The instances (G3, 2026-10-27, `grep -rcF` before TICKET-070; 170
occurrences in 45 files; count again after TICKET-070 and put the new list
in the result):

`src/core/report/index.ts` (1, a comment: becomes `Sample/Book.md`),
`tests/integration/us-001-blocks-roundtrip.test.ts` (2),
`us-001-inline-roundtrip` (2), `us-001-validity` (5),
`us-002-numbering-pdf` (1), `us-003-images-roundtrip` (1),
`us-006-output-and-source` (5), `us-007-composed-export` (3),
`us-007-export-compiledtext` (5), `us-009-cover-slug-pdf` (1),
`us-011-cover-pdf` (1), `us-012-preview-equals-export` (4),
`us-015-convert-compiles` (3), `us-016-callouts-pdf` (1),
`us-017-glossary-pdf` (1), `us-018-page-refs-pdf` (1), `us-019-folios-pdf`
(1), `us-023-template-hook-pdf` (1); `tests/plugin/us-003-asset-copy` (5),
`us-006-export-flow` (8), `us-007-export-run` (3), `us-008-export-command`
(9), `us-010-fonts-plugin` (1), `us-011-cover-asset` (1), `us-012-request`
(10), `us-016-callout-preview` (1), `us-017-glossary-preview` (1),
`us-018-rows-preview` (1), `us-019-folio-rows-preview` (1),
`us-020-actions-menus` (1), `us-022-menus-write` (6),
`us-023-template-hook-preview` (1); `tests/support/convert.ts` (3);
`tests/unit/us-003-asset-resolver` (22), `us-006-warnings` (2),
`us-009-cover-slug` (1), `us-011-cover-convert` (1),
`us-014-parse-lines-robustness` (1), `us-015-asset-index` (21),
`us-015-conversion-pipeline` (3), `us-015-line-map-and-edges` (3),
`us-016-callout-styles` (3), `us-017-heading-rules` (1),
`us-019-folios-headers` (1), `us-022-preset-edits` (20).

Forms found: `'The Rules/assets…'` (96), `'The Rules/Rules.md'` (16),
`'The Rules/compiledtext.md'` (15, fake note paths; the note name stays
`compiledtext` where the test does not read the real file), `'The Rules'`
alone (7, mostly the disk reads TICKET-070 removes), template-string forms,
`/Users/me/Vault/The Rules`, and the words in test names and comments.

- **Scripted edit (SCAR-018).** One script replaces `The Rules/` with
  `Sample/` and a lone `The Rules` in a path with `Sample`. Before it runs:
  a backup of every file it may touch, by full relative path, with a SHA-256
  list. Per file it asserts the number of replacements equals the count
  listed after TICKET-070; a mismatch restores the file and stops the run.
  Test names and comments that say "The Rules" in prose are edited by hand
  (they read "the sample vault").
- **Not changed:** `.prettierignore` and `eslint.config.mjs` keep their
  `The Rules` entries (the folder stays on the author's disk and must stay
  out of lint); they name the folder, not its content, and AC-5 covers
  `tests/`, `src/` and `build/` only.

### Guards searched before the ticket (SCAR-023)

- Tests that compare a path in an output (`FakeIndex.reads`, asset `from`,
  the vault-relative warning note path in `us-006-export-flow`) change in
  the same edit; the gate shows any that was missed.
- `tests/plugin/us-006-export-flow.test.ts` checks the imports of
  `src/core/report/index.ts`, not its comments; not affected.

---

## Tests

- `tests/tooling/us-024-public.test.ts`: AC-5 green.
- The 45 files green with the new paths (no other change of expectations
  than the path).
- Mutation check: one occurrence left unrenamed in a test fails AC-5; the
  script's count check is shown to stop on a planted mismatch.

---

## SCAR check (2026-10-27, item by item against the Prevention lists)

- **SCAR-001** n/a (no utility).
- **SCAR-002** n/a (no new behaviour; the paths are data).
- **SCAR-003** (1–3) AC-5's test is red (G2); the AC list read again.
- **SCAR-006** (1–4) full gate, no skip, counts.
- **SCAR-007** (1–3) the examples of AC-5 are exact.
- **SCAR-008** n/a.
- **SCAR-009, SCAR-010** n/a (no generated text).
- **SCAR-011** (1–5) `Sample/` does not clash with another fake folder in
  the tests (`Other/`, `Menus/`, `Obsidian2Typst/`): checked by listing the
  fake folders before the run.
- **SCAR-012** n/a.
- **SCAR-013, SCAR-014** n/a.
- **SCAR-015** n/a.
- **SCAR-016** n/a.
- **SCAR-017** (1–7) the class is the 170 occurrences in 45 files, counted
  twice (before and after TICKET-070); the AC-5 text check keeps a new copy
  out.
- **SCAR-018** (1–9) backups by full path with checksums, the count per file
  asserted before writing, arrays for the file list, no `head` on the
  listing that decides, the checksum list checked after the run and after
  any restore.
- **SCAR-019** n/a.
- **SCAR-020** n/a.
- **SCAR-021** n/a.
- **SCAR-022** n/a.
- **SCAR-023** (1–8) AC-5 checks every file of `tests/`, `src/` and `build/`
  and asserts it saw `src/core/report/index.ts`; the planted unrenamed
  occurrence above.
- **SCAR-024, SCAR-025** n/a.

---

## Definition of done

- [x] AC-5 green; the 45 files green
- [x] The script's counts and the checksum check in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)

---

## Result (2026-10-27)

Changed: 34 test files (scripted), 2 test comments and 1 comment of
`src/core/report/index.ts` (by hand; it now names `Book export warnings.md`
for `Sample/Book.md`). No change of behaviour.

- Recount after TICKET-070: 146 occurrences in 34 test files (the 45 of G3
  less the disk reads TICKET-070 removed), plus 2 prose lines and the `src/`
  comment; one more form found by the recount: the URL-encoded
  `The%20Rules%2F` in the expected report links of `us-006-warnings` and
  `us-006-export-flow` (an output that contains the path, so it changes
  with it). `h-see-the-rules-now` in `us-002-headings` is a heading example,
  not the vault, and stays.
- SCAR-011: the tests' other fake folders (`Layouting`, `Export`,
  `Obsidian2Typst`, `Other`, `Styles`, `Book`, `Books`, `Reports`, `Notes`,
  `Elsewhere`, `Covers`, …) do not include `Sample`; the five files that
  had both a vault path and a `VAULT…` identifier use it as a variable name
  only.
- Script (scratchpad `ren071/rename.py`; `listed.json`, `applied.json`,
  `checksums.json`): backups of the 34 files by full path with SHA-256
  before any write; the count per file compared with the listed count before
  writing; 146 replacements in 34 files, every count as listed, no form left.
  Guard: on a copy of `tests/` with one planted extra occurrence the script
  stopped with `COUNT MISMATCH, nothing written` and the copy's checksums were
  unchanged. Prettier re-wrapped 5 of the files afterwards (shorter strings).
- Guard for AC-5: one `Sample/…` put back to the old name in
  `tests/unit/us-015-asset-index.test.ts` turned AC-5 red; the file was
  restored from its backup and its checksum checked (OK).
- Gate (scratchpad `gate071.log`): typecheck, build (`main.js`
  `cdbc3da5a4d9…`, unchanged), lint green; `npm test` 1819 passed, 6 failed,
  1 todo; integration 389 passed, 1 skipped. AC-5 green. The 6 red tests
  belong to TICKET-073 (AC-8 ×3) and TICKET-074 (AC-10, AC-11 ×2).
- Private inputs: 3434 checksums OK.
