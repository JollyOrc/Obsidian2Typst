# TICKET-051 — Folios and headers in the preview, test build `0.4.0-m8.1`, manual check M8

**Status:** Done (2026-10-20)
**User story:** [US-019](../user-stories/US-019-folios-and-running-headers.md)
**ACs addressed:** AC-10; manual: AC-2 (rows in the app), AC-4, AC-5, AC-9, AC-11 (by eye)
**Depends on:** TICKET-049, TICKET-050
**SCARs:** SCAR-012, SCAR-015, SCAR-016, SCAR-006, SCAR-008, SCAR-013, SCAR-014, SCAR-017

---

## Description

Show that the preview draws folios and headers as the export does and redraws
on a preset edit, then hand a ready test environment to the user for the check
only Obsidian can do: the three new rows, the PDF and the panel by eye.

---

## Acceptance criteria (from user story)

- **AC-10:** the preview uses the same `convert`; an edit of
  `page.runningHeaderLevel` in the active preset note reaches the next preview
  request.
- **AC-2 (manual):** the three rows in the settings tab and in the panel's
  Page group; keyboard and reset as every Defaults row.
- **AC-4, AC-5, AC-9, AC-11 (manual):** folios at the outer edge, header
  titles, no header on H1 pages, cover without number, the fixture's book.

---

## Implementation notes

- No new preview code is expected (the preview reuses `prepareNote` and
  `convert`); if `tests/plugin/us-019-folio-rows-preview.test.ts` is not green
  after TICKET-050, the gap is in passing `pageFurniture` from
  `effectiveSettings` to `convert`, fixed there (SCAR-017).
- Version `0.4.0-m8.1` in `package.json`, `manifest.json`, the two root
  entries of `package-lock.json`; `versions.json` gains `"0.4.0": "1.5.0"`
  (TICKET-003 build test); M3, M6, M7 and M8 name the current version (the
  version test is extended with M8).
- `docs/technical/manual-checks.md`: new section **M8 — Folios and running
  headers (US-019)**, first the expected version and the place. Fixtures in
  `spikes/typst-wasm/scratch-vault/` only: `Folios.md` (the worked example of
  AC-5 with a cover image, a footnote in a chapter title, a callout with an
  H2, a glossary section), and a preset `Folios` (A5, cover on); a second
  preset `Folios single` (`facingPages: false`, `runningHeaderLevel: 3`).
  Active preset written only while Obsidian is closed (checked with `pgrep`,
  the user asked to quit first), previous `data.json` backed up by full path
  (SCAR-018); empty export folder `spikes/typst-wasm/m8-export`. A Node dry run
  of the notes with the presets gives the page numbers the check states.
- Steps of M8 (written out in the file): (1) version and active preset; (2)
  the three rows in the settings tab and the panel: toggle with the mouse,
  level with the keyboard only (type, Enter), a refused `7`, the reset icon
  and its question (SCAR-013, SCAR-014), without closing the tab (SCAR-016);
  (3) export `Folios.md`: cover without number, folios from 1 at the outer
  edges, header titles page by page as stated, no header on H1 pages, no
  footnote mark in a header; (4) switch to `Folios single`: centred numbers,
  level-3 titles; (5) panel open: change `runningHeaderLevel` in the preset,
  the preview redraws (SCAR-016); (6) export the fixture copy and look at a
  few spreads; (7) open question (SCAR-015).

---

## Tests

- `tests/plugin/us-019-folio-rows-preview.test.ts` — both `US-019 AC-10:`
  tests.
- `tests/tooling/us-000-test-build-version.test.ts` — M8 names the current
  version.
- The full gate.

---

## SCAR check (2026-10-20, item by item against the Prevention lists)

- **SCAR-001:** no new call site expected.
- **SCAR-002:** the manual note holds the composed cases (cover, callout H2,
  glossary, footnote in a title, single pages, level 3).
- **SCAR-003:** AC-10 has tests; the manual parts are in the register.
- **SCAR-006:** gate green with counts before the handover.
- **SCAR-007:** the check states exact titles per page and folio numbers from
  the dry run.
- **SCAR-008:** the panel draws with the existing canvas helper; a blank
  preview is our bug first.
- **SCAR-009:** the check looks at titles with markup and footnotes in the
  header position.
- **SCAR-010, SCAR-011:** covered by TICKET-050 tests.
- **SCAR-012:** unique version first; build installed and compared; fixtures
  and active preset prepared with Obsidian closed; step 1 checks the preset in
  the app; export folder empty; place named; restart stated.
- **SCAR-013:** step 2 uses the keyboard only for the level row (Enter
  commits; a refused value keeps the field open with its message).
- **SCAR-014:** step 2 clicks the reset icon and checks the question and
  `Cancel`.
- **SCAR-015:** each step names what must be seen; known limitations stated
  (no ornaments, no page references yet); the check ends with the open
  question.
- **SCAR-016:** steps 2 and 5 keep the tab and the panel open.
- **SCAR-017:** a defect found in M8 is answered with where the same pattern
  can sit (other rows, other preset levels, cover cases).
- **SCAR-018:** the `data.json` backup by full path, compared with `cmp`.

---

## Definition of done

- [x] AC-10 tests green; full gate green; pass counts in the result
- [x] `0.4.0-m8.1` built, installed, checksum compared; fixtures in place
- [x] M8 written in `docs/technical/manual-checks.md` and passed by the user (2026-10-20)
- [x] Register rows ✅ with the date of M8 (2026-10-20)

## Result so far (2026-10-20, handover)

- AC-10: both preview tests green since TICKET-050.
- **Deviation (source change in this ticket, decided by the user
  2026-10-20):** the dry run with `Folios single` (level 3) showed an H2 of the
  previous H1 section on the pages of a new section (old rules 3 and 4 looked
  only at levels L and L − 1). The helper now takes the last heading before
  the page whose level is at most L: same titles for level 2 (all earlier
  tests unchanged and green), `Appendix` for level 3. Changed:
  `src/core/emit/furniture.ts` and `tests/support/furniture.ts` (one line
  each), AC-5 of the story (rules 3 and 4 merged), the exact text in AC-3;
  measured first with the bundled Typst (levels 2 and 3); new test `US-019
  AC-5: level 3 in a new H1 section shows the H1 title, never the old
  chapter`. Two behavioural mutants of the new line (`==`, `<`, applied to the
  emitter and the support text together) are caught by the PDF tests; backups
  by full path, `shasum -c`: OK.
- Version `0.4.0-m8.1` in `package.json`, `manifest.json`, the two root
  entries of `package-lock.json`; `versions.json` gained `"0.4.0": "1.5.0"`;
  M3, M6, M7 expect the new version; the version test checks M8.
- Fixtures (scratch vault only): `Folios.md` (the cover embedded by its full
  path, so no `ASSET_AMBIGUOUS`), presets `Folios` and `Folios single`; the
  vault's older `The Rules/compiledtext.md` for step 6; empty
  `spikes/typst-wasm/m8-export`. Active preset `Folios` written with Obsidian
  not running (`pgrep`); previous `data.json` (active `Glossary terms`) in
  `spikes/typst-wasm/m8-state-backup/data.before-m8.json`, compared with `cmp`.
- Dry run in Node with the presets and the vault's Defaults: `Folios.md` 15
  pages, no warning, folios 1 to 14 on pages 2 to 15 at x 43 (even) and
  369/373 (odd), headers as listed in M8 step 3; `Folios single` the same pages,
  numbers centred (x 206/208), headers as in step 4; `The Rules/compiledtext.md`
  265 pages, folios from 1 on page 2.
- Gate: typecheck, lint, build green; `npm test` 1575 passed, 1 todo;
  integration 349 passed, 1 skipped.
- Installed: `main.js` sha256 `4360ca03363d81c9…`, `manifest.json`
  `e7aef3475c29…`, `styles.css` `9109f37bf368…`, each equal to the build.
- Waiting for: M8 run by the user.

## Result (2026-10-20, M8)

- M8 passed on `0.4.0-m8.1`, all steps 1 to 7 (reported by the user;
  Obsidian 1.14.4, macOS 27.0.1 (26A434)). No defect, nothing odd reported.
  Recorded in `docs/technical/spike-typst-wasm.md`, "Manual runs".
