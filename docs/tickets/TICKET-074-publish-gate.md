# TICKET-074 — The publish gate: ignore list, state tests, clean copy, private data

**Status:** Done (2026-10-27)
**User story:** [US-024](../user-stories/US-024-synthetic-public-fixture.md)
**ACs addressed:** AC-4 (the rule-2 check), AC-10, AC-11
**Depends on:** TICKET-069 to TICKET-073 (the clean copy is the last check)
**SCARs:** SCAR-006, SCAR-012, SCAR-017, SCAR-018, SCAR-023, SCAR-024

---

## Description

Make the publish set what US-024 says it is, prove that it holds no personal
data, and prove that a copy of only that set passes the full gate. Last, show
that the private inputs are byte-identical to the baseline taken at G2.

---

## Acceptance criteria (from user story)

- **AC-4 (rule 2):** `The Rules/` and `tests/fixtures/compiledtext.md` stay
  on disk, unchanged (SHA-256 list before and after equal).
- **AC-10:** no published file contains the author's family name, the macOS
  user name or the employer's short name, in any case.
- **AC-11:** `.gitignore` lists `The Rules/`,
  `tests/fixtures/compiledtext.md`, `spikes/`, `docs/state/`,
  `releases/*.zip`, `node_modules/`, `main.js`, `.DS_Store`; a copy of only
  the published files passes `npm ci`, typecheck, build, lint, `npm test`,
  `npm run test:integration`, with no new skip except the four `docs/state/`
  tests of `state-directory.test.ts`, which skip with
  `it.skipIf(!existsSync('docs/state'))` and a comment linking this ticket.

---

## Implementation notes

- `.gitignore`: add the missing lines (`The Rules/`,
  `tests/fixtures/compiledtext.md`, `spikes/`, `docs/state/`,
  `releases/*.zip`); the existing narrower `spikes/…` lines may stay. Only
  the pattern forms the matcher of `tests/support/sample.ts` reads (it
  refuses others).
- `tests/tooling/state-directory.test.ts`: the four tests that read
  `docs/state/` become `it.skipIf(!existsSync('docs/state'))(…)`, with one
  comment above them: `TICKET-074: docs/state/ is not published (US-024
  D9); these run where it exists.` The `CLAUDE.md` test stays `it(`.
- **Clean copy (AC-11).** A script in `spikes/` copies `publishedFiles()`
  (the same list the AC-10 test uses) into a new temporary folder outside
  the project, runs `npm ci` and the gate there, and records the pass and
  skip counts; the skip count is the project's skips plus exactly 4. The
  temporary folder is removed afterwards. Not measured before: the run time
  and whether `npm ci` needs the network (it does, for the registry); the
  result records both.
- **Personal data (AC-10).** The test is green when `.gitignore` is complete
  and TICKET-069 to 072 are done; a hit names the file and the word's index,
  never the word.
- **Rule 2.** `shasum -a 256 -c spikes/us-024-baseline/private-inputs.sha256`
  at the end: 3434 lines, all OK.
- **Not in this ticket:** `git init`, the first commit, the GitHub
  repository and the release. They are the user's next step; `git
  check-ignore` is measured then (story Notes).

### Guards searched before the ticket (SCAR-023)

- `tests/tooling/state-directory.test.ts` is the only test that reads
  `docs/state/` (grep `docs/state` over `tests/`: it and the US-024 tests).
- `tests/integration/build-output.test.ts` expects `main.js` in the project
  after the build: in the clean copy the build makes it; the order of the
  gate (build before the integration tests) is kept.

---

## Tests

- `tests/tooling/us-024-public.test.ts` (all, including AC-10, AC-11 and the
  state-directory skip test).
- The clean-copy gate (procedure, counts in the result).
- Mutation checks: one `.gitignore` line removed (AC-11 test red); a fifth
  `skipIf` added to the `CLAUDE.md` test (red); a planted private word in a
  published file (AC-10 red), removed afterwards and checked by checksum.

---

## SCAR check (2026-10-27, item by item against the Prevention lists)

- **SCAR-001** n/a.
- **SCAR-002** n/a.
- **SCAR-003** (1–3) AC-10, AC-11 tests red (G2); the procedure parts named.
- **SCAR-006** (1–4) the clean-copy gate is the gate the public sees; its
  counts go into the result and into the release notes later.
- **SCAR-007** (1–3) the ignore lines and the skip form are exact.
- **SCAR-008** n/a.
- **SCAR-009, SCAR-010, SCAR-011** n/a.
- **SCAR-012** (1–6) the clean copy is the environment a stranger gets:
  made from the list, not by hand; its listing (file count) in the result.
- **SCAR-013, SCAR-014** n/a (the temporary folder is outside the project and
  removed by the script that made it).
- **SCAR-015** (1–5) the clean copy's gate includes the content tests of
  AC-6.
- **SCAR-016** n/a.
- **SCAR-017** (1–7) the publish set comes from one function
  (`publishedFiles`) used by the test and by the copy script.
- **SCAR-018** (1–9) the planted private word is put in by a script that
  backs the file up by full path with a checksum and restores it; the
  private inputs compared with the baseline.
- **SCAR-019, SCAR-020, SCAR-021, SCAR-022** n/a.
- **SCAR-023** (1–8) the AC-11 test matches the whole skip form and counts
  five tests; the mutants above.
- **SCAR-024** (1–4) `npm ci` behaviour and run time recorded as measured;
  `git check-ignore` stays "not measured" until the repository exists.
- **SCAR-025** n/a.

---

## Definition of done

- [x] `us-024-public.test.ts` all green; full gate green
- [x] Clean-copy gate green with counts (skips = project + 4)
- [x] Private inputs: 3434 checksums OK
- [x] ESLint and Prettier clean

---

## Result (2026-10-27)

Changed: `.gitignore` (five lines: `The Rules/`,
`tests/fixtures/compiledtext.md`, `spikes/`, `docs/state/`, `releases/*.zip`,
under a comment), `tests/tooling/state-directory.test.ts` (the four tests
that read `docs/state/` as `it.skipIf(!existsSync('docs/state'))`, a comment
that links this ticket; the `CLAUDE.md` test unchanged). No change of `src/`;
no `git init`, commit or push.

- Changed while doing it: the first version put the condition into a
  constant (`it.skipIf(NO_STATE)`); the AC-11 test asks for the form the story
  names, and the story is the source of truth, so the condition is written
  inline.
- Guard mutants (scratchpad `mut074/`; the public test file, baseline 9
  passed): the `docs/state/` line removed from `.gitignore` (the AC-11 list
  test red), a fifth `skipIf` on the `CLAUDE.md` test (the AC-11 skip test
  red), a private word written into `README.md` (the AC-10 test red); the three
  files restored from their full-path backups, checksums OK.
- **Clean copy** (scratchpad `clean074/`: `published.txt`, `npm-ci.log`,
  `gate.log`): `publishedFiles()` (the function the AC-10 test uses) listed
  498 files (none under `The Rules/`, `spikes/`, `docs/state/`,
  `node_modules/`, no `compiledtext.md`, `.zip` or `main.js`); copied into a new
  folder outside the project (6.4 MB). `npm ci`: 161 packages in about 1.5 s
  (from the local npm cache; whether it works with an empty cache is not
  measured); npm did not run the install scripts of `esbuild` and `fsevents`
  (not yet approved under npm's `allowScripts`); the build worked without
  them. Gate in the copy: typecheck, build, lint green; `npm test` 1822
  passed, 4 skipped, 1 todo — the 4 skipped are exactly the four
  `docs/state/` tests (verbose run); integration 389 passed, 1 skipped (as in
  the project). The copy was removed afterwards.
- Gate in the project (scratchpad `gate074.log`): typecheck, build (`main.js`
  `cdbc3da5a4d9…`, unchanged), lint green; `npm test` 1826 passed, 1 todo;
  integration 389 passed, 1 skipped. No red test.
- Rule 2: `shasum -a 256 -c spikes/us-024-baseline/private-inputs.sha256`:
  3434 OK, 0 failed.
- Not measured (story Notes): `git check-ignore` (the folder is not a
  repository yet); `npm ci` without a local cache.
