# TICKET-054 — Page numbers in the preview, test build `0.5.0-m9.1`, manual check M9

**Status:** Done (2026-10-21)
**User story:** [US-018](../user-stories/US-018-page-numbers-for-internal-links.md)
**ACs addressed:** AC-8 (preview); manual: AC-8 (rows in the app), AC-4, AC-5, AC-7, AC-9 (by eye)
**Depends on:** TICKET-052, TICKET-053
**SCARs:** SCAR-012, SCAR-015, SCAR-016, SCAR-006, SCAR-008, SCAR-013, SCAR-014, SCAR-017, SCAR-018, SCAR-019

---

## Description

Show that the preview prints the numbers as the export does and follows a
preset edit, then hand a ready test environment to the user for the check
only Obsidian can do: the three rows, the PDF and the panel by eye, with a
non-default preset too.

---

## Acceptance criteria (from user story)

- **AC-8 (preview):** the preview shows the numbers as the export; an edit of
  `linkPageLevel` in the active preset reaches the next preview request.
- **AC-8 (manual):** the three rows in the settings tab and in the panel,
  keyboard and reset as every Defaults row.
- **AC-4, AC-5, AC-7, AC-9 (manual):** numbers equal the folios of their
  targets, plain after a bold link, none in headings and headers, the word of
  the preset, the fixture's book.

---

## Implementation notes

- No new preview code is expected (the preview reuses `prepareNote` and
  `convert`); if `tests/plugin/us-018-rows-preview.test.ts` is not green after
  TICKET-053, the gap is in passing the fields from `effectiveSettings` to
  `convert`, fixed there (SCAR-017).
- Version `0.5.0-m9.1` (a new feature: minor) in `package.json`,
  `manifest.json`, the two root entries of `package-lock.json`;
  `versions.json` gains `"0.5.0": "1.5.0"`; M3, M6, M7, M8 and M9 name the
  current version (the version test is extended with M9).
- `docs/technical/manual-checks.md`: new section **M9 — Page numbers for
  internal links (US-018)**, first the expected version and the place.
  Fixtures in `spikes/typst-wasm/scratch-vault/` only: `PageRefs.md` (a cover
  image; chapters on several pages; links to `#`, `##`, `###` targets; a
  bold link, a link inside a bold sentence, a link in a footnote, a callout
  and a table cell; a link in a heading; a link whose target is on its own
  page; a glossary whose explanations link to chapters and to a `###`
  section; a link to a term), presets `PageRefs` (A5, cover on, built-in
  values) and `PageRefs deep` (`linkPageLevel: 3`, `linkPageWord: "S."`,
  SCAR-019), and a copy of the fixture. Active preset written only while
  Obsidian is closed (checked with `pgrep`, the user asked to quit first),
  `data.json` backed up by full path (SCAR-018); empty export folder
  `spikes/typst-wasm/m9-export`. A Node dry run with both presets and the
  vault's Defaults gives the page numbers the check states, read page by
  page (SCAR-019).
- Steps of M9 (written out in the file): (1) version and active preset;
  (2) the three rows in the settings tab and the panel: the toggle with the
  mouse; the level with the keyboard only (type, Enter), a refused `7`; the
  word: type `S.`, leave the field, click its reset icon at once and read the
  question (SCAR-013, SCAR-014, SCAR-016), without closing the tab; (3) export
  `PageRefs.md`: each number as stated, plain after the bold link, bold inside
  the bold sentence, none in the heading and none in any header, the
  same-page link numbered; (4) switch to `PageRefs deep`: the `###` links
  numbered, `(S. N)`; (5) panel open: change `linkPageLevel` in the preset,
  the preview follows (SCAR-016); (6) switch `linkPageNumbers` off in the
  Defaults: no numbers in the preview and the export; (7) export the fixture
  copy and look at the glossary pages; (8) open question (SCAR-015).

---

## Tests

- `tests/plugin/us-018-rows-preview.test.ts` — both `US-018 AC-8:` preview
  tests.
- `tests/tooling/us-000-test-build-version.test.ts` — M9 names the current
  version.
- The full gate.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** (1–4) n/a: no new call site of a shared utility (fixtures and
  docs only).
- **SCAR-002** (1–4) the fixture note composes every case of AC-5 in one
  note; the dry run runs it through the whole converter with all stories'
  rules on.
- **SCAR-003** (1) the two preview tests exist (red now); (2) AC list again
  before Done; (3) AC → test → result table in the result, manual steps
  included.
- **SCAR-006** (1) full gate before the handover and before Done; (2) no
  skip; (3) counts in the result and in G4; (4) nothing deferred without a
  ticket.
- **SCAR-007** (1) M9 states each expected number from the dry run; (2) the
  deep preset is the second level of the same note; (3) yes.
- **SCAR-008** (1–3) the dry run reads the PDF by program before the
  handover; (4) n/a; (5) the check text logs each step's result in the run
  line.
- **SCAR-009, SCAR-010, SCAR-011** n/a: no new generated text.
- **SCAR-012** (1) build, `npm run install:scratch`, installed files compared
  by checksum with the build, fixtures and active preset in place with
  Obsidian closed; (2) the place (scratch vault, folder) and the restart are
  stated; (3) unique version `0.5.0-m9.1`, shown in the plugin list and the
  settings tab, first step of M9; (4) a mismatch is read as "wrong build";
  (5) n/a.
- **SCAR-013** (1) step 2: Enter in the level field commits, a refused `7`
  shows the message; (2) IME case covered by the shared key function (unit
  tests of US-008); (3) the US-008 AC-20 text check; (4) keyboard-only step;
  (5) n/a.
- **SCAR-014** (1–2) step 2 reads the reset question with `Cancel` focused,
  both answers; (3) n/a; (4) existing test; (5) worst click: the word row's
  reset icon (story Notes); (6) n/a.
- **SCAR-015** (1) every step names what must be seen (numbers, weights,
  where none may be, the word); (2) the guard is step 6 (switch off, numbers
  gone, links still there); (3) open question last; (4) known limitations: none known at G3; the dry run compares the
  preview's numbers with the export's (the preview downsamples images,
  US-012), and M9 states the result either way; (5) headers checked.
- **SCAR-016** (1) the reset reads the value at the click; (2) a preset edit
  reaches the preview (test and step 5); (3) step 2 in the order draw, change,
  use; (4) existing test; (5) "without closing the tab" in steps 2 and 5.
- **SCAR-017** (1) n/a (no defect); (2–3) the rows are covered by the class
  tests; (4) a defect found in M9 is answered with the list of the same class
  (rows, mark kinds, containers).
- **SCAR-018** (1) `data.json` backed up by full path with a checksum before
  it is written; (2) checked after restore when the user asks to restore;
  (3) the preset edit is scripted with a match count; (4) arrays; (5–6) n/a
  (no mutants here).
- **SCAR-019** (1) the check uses the default and a non-default preset;
  (2) n/a; (3) the dry run uses both presets; (4) the dry run output is read
  page by page against AC-2 before the handover.

---

## Definition of done

- [x] The two preview tests green; the version test extended and green
- [x] Full gate green with counts; installed build compared by checksum
- [x] M9 written, fixtures and presets in place, dry run numbers in M9
- [x] G4 entry before the handover; M9 passed by the user; run line recorded

## Result so far (2026-10-21, handover)

- AC-8 preview: both tests green since TICKET-053; no source change in this
  ticket.
- Version `0.5.0-m9.1` in `package.json`, `manifest.json`, the two root
  entries of `package-lock.json`; `versions.json` gained `"0.5.0": "1.5.0"`;
  M3, M6, M7, M8 expect the new version; the version test checks M9.
- Fixtures (scratch vault only): `PageRefs.md` (the cover embedded by its
  full vault path), presets `PageRefs` and `PageRefs deep`, `The
  Rules/compiledtext-m9.md` (byte-equal to `The Rules/compiledtext.md`; the
  vault's older `compiledtext.md` is not the current fixture); empty
  `spikes/typst-wasm/m9-export`.
- Dry run in Node (scratchpad `p018/dryrun.test.ts`: the vault's files and
  Defaults, both presets, the PDF read page by page): `PageRefs.md` 7 pages,
  no warning, 12 calls with `PageRefs` and 13 with `PageRefs deep`; numbers
  and pages as listed in M9 steps 3 and 4 (each number equals the folio of its
  target; the same-page `Rules (p. 1)`; none in the heading or the headers);
  `The Rules/compiledtext-m9.md` 265 pages, 33 numbers, none in a header, 25
  warnings about the fixture's own links and one comment.
- Preview: the same `convert`; for `PageRefs.md` (only the full-page cover)
  the numbers cannot differ from the export; a note with large images inside
  the text could differ (stated in M9 as a known limitation; not measured).
- Gate (scratchpad `gate054.log`): typecheck, lint, build green; `npm test`
  1634 passed, 1 todo; integration 370 passed, 1 skipped.
- Installed: `main.js` sha256 `14514faaf884…`, `manifest.json`
  `218343500047…`, `styles.css` `9109f37bf368…`, each equal to the build.
- Obsidian was not running (`pgrep -x Obsidian` empty, checked again right
  before the write); `data.json` backed up to
  `spikes/typst-wasm/m9-state-backup/data.before-m9.json` (`cmp` equal,
  sha256 `4a7399eae74e…` in `SHA256SUMS`); only `activePreset` changed
  (`Folios` → `PageRefs`), checked against the backup.
- Waiting for: M9 run by the user.

## Result (2026-10-21, M9)

- M9 passed on `0.5.0-m9.1`, all steps 1 to 8 (reported by the user;
  Obsidian 1.14.4, macOS 27.0.1 (26A434)). No defect, nothing odd reported.
  Recorded in `docs/technical/spike-typst-wasm.md`, "Manual runs".
