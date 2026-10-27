# TICKET-048 — Glossary terms in the preview, test build `0.3.0-m7.1`, manual check M7

**Status:** Done (2026-10-19)
**User story:** [US-017](../user-stories/US-017-heading-rules-glossary.md)
**ACs addressed:** AC-12; manual: AC-4 and AC-11 (by eye), AC-10 (page bottom), AC-13 (the fixture's glossary), AC-14
**Depends on:** TICKET-046, TICKET-047
**SCARs:** SCAR-012, SCAR-015, SCAR-016, SCAR-006, SCAR-008, SCAR-017

---

## Description

Show that the preview panel draws glossary terms as the export does and
redraws on a preset edit, then hand a ready test environment to the user for
the check only Obsidian can do: the PDF and the panel by eye.

---

## Acceptance criteria (from user story)

- **AC-12:** the preview uses the same `convert`; an edit of `headingRules` in
  the active preset note (`glossary` to `none`) reaches the next preview
  request; no row in the panel or the settings tab.
- **AC-4, AC-11 (manual):** run-in lines read "Term — explanation" with the
  term in bold; terms are not in the PDF bookmarks; links jump to the terms.
- **AC-10 (manual):** no term alone at a page bottom in the long glossary.
- **AC-13 (manual):** the fixture's 40 terms printed run-in.
- **AC-14 (manual):** a deeper heading in a term has no number.

---

## Implementation notes

- No new preview code is expected: the preview reuses `prepareNote` and
  `convert` (US-012). If `tests/plugin/us-017-glossary-preview.test.ts` is
  green after TICKET-047, this ticket only records it; if not, the gap is in
  passing `headingRules` from `effectiveSettings` to `convert`, fixed there
  (one place, SCAR-017), not in the preview.
- Version `0.3.0-m7.1` in `package.json`, `manifest.json` and the two root
  entries of `package-lock.json` (minor bump: new feature); `versions.json`
  gets `"0.3.0": "1.5.0"` because TICKET-003's build test requires the release
  of a test build to be mapped (as in TICKET-045). The version test
  (`tests/tooling/us-000-test-build-version.test.ts`) checks M7 and the
  expected version of the other checks that state the current build.
- `docs/technical/manual-checks.md`: new section **M7 — Glossary terms in the
  PDF and the preview (US-017)**, first line the expected version and the
  place (scratch vault). Fixtures prepared by the developer (SCAR-012), all
  under `spikes/typst-wasm/scratch-vault/` (never `The Rules/`):
  - `Glossary.md`: `# Rules` with a link to a term, `# Glossary` with an
    introduction, terms: run-in, two paragraphs, list first, empty, inline
    markup, a term with `### Deep`, enough terms to cross a page; `# Back
    notes` with a link back to a term.
  - a copy of the fixture's glossary section (`compiledtext.md` lines 5310 to
    5436) as `Rules glossary.md`, so the real text is seen without exporting
    the whole book.
  - a preset `Glossary terms` (A5) with `headingRules: {Glossar: glossary}`
    and a note `Glossar.md` that uses the German heading, to check a preset
    key; active preset set with Obsidian **closed**, and verified in the
    settings tab as step 1 (SCAR-012).
  - `npm run install:scratch`, checksum of the installed `main.js` equal to
    the build (printed in the handover); an empty export folder
    `spikes/typst-wasm/m7-export`.
- Steps of M7 (written out in the file): (1) version and active preset; (2)
  export `Glossary.md`: run-in lines with bold terms and ` — `, lone term
  without dash, `Deep` without number, bookmarks list only `Rules`,
  `Glossary`, `End notes`, both links jump to their term, the warnings report
  lists exactly one `HEADING_IN_TERM`; (3) no page ends with a term alone; (4)
  export `Rules glossary.md`: 40 run-in terms, `Tidal Basin` link works; (5)
  `Glossar.md` gets terms through the preset key; (6) style panel open:
  change `Glossar: glossary` to `none`, save, the preview shows numbered
  headings; change back (SCAR-016); (7) open question (SCAR-015).

---

## Tests

- `tests/plugin/us-017-glossary-preview.test.ts` — both `US-017 AC-12:` tests.
- `tests/tooling/us-000-test-build-version.test.ts` — the version in M7 equals
  the manifest.
- The full gate (typecheck, build, lint, `npm test`, integration).

---

## SCAR check (2026-10-19, item by item against the Prevention lists)

- **SCAR-001:** no new call site expected; if the preview needs a change, it is
  the shared `prepareNote` and its tests are the guard.
- **SCAR-002:** the manual note holds the composed cases (lone, empty, deeper
  heading, two paragraphs, links before and after).
- **SCAR-003:** AC-12 has tests; the manual parts are listed in the register.
- **SCAR-006:** gate green with pass counts before the handover.
- **SCAR-007:** the check states exact texts (`Gambit — A thing…`), counts (40
  terms, 1 warning) and bookmark titles.
- **SCAR-008:** the panel draws with the existing canvas helper; a blank
  preview is our bug first; the panel's console log is asked for if blank.
- **SCAR-009:** step 2 sees the term at the start, middle and end of the
  section and before the next section.
- **SCAR-010, SCAR-011:** covered by TICKET-047 tests; nothing new here.
- **SCAR-012:** unique version first in M7 and in the settings tab; build
  installed and compared by checksum; fixtures and active preset prepared with
  Obsidian closed and checked in the app as step 1; export folder created;
  place named; restart stated.
- **SCAR-013, SCAR-014:** n/a (no dialog, no destructive action; the preset
  note is edited as text).
- **SCAR-015:** each step names what must be seen; known limitation: page
  numbers for internal links are a later story (no "see p. N"); the check ends
  with the open question.
- **SCAR-016:** step 6 keeps the panel open: draw, change the preset, use.
- **SCAR-017:** a defect found in M7 is answered with where the same pattern
  can sit (other rule keys, other heading levels, nested headings, the
  callout emitter's neighbours).

---

## Definition of done

- [x] AC-12 tests green; full gate green; pass counts in the result
- [x] `0.3.0-m7.1` built, installed, checksum compared; fixtures in place
- [x] M7 written in `docs/technical/manual-checks.md` and passed by the user (2026-10-19)
- [x] Register rows ✅ with the date of M7 (2026-10-19)

## Result so far (2026-10-19, handover)

- AC-12: both preview tests green since TICKET-047; no source change in this
  ticket.
- Version `0.3.0-m7.1` in `package.json`, `manifest.json`, the two root
  entries of `package-lock.json`; `versions.json` gained `"0.3.0": "1.5.0"`.
  M3 and M6 now expect `0.3.0-m7.1` too (the version test requires M3, M6 and
  M7 to name the current build); the version test checks M7.
- Fixtures (scratch vault only): `Glossary.md` (27 terms), `Rules
  glossary.md` (lines 5310 to 5436 of `The Rules/compiledtext.md`, read only;
  its hash is unchanged), `Glossar.md`, preset `Glossary terms`; empty
  `spikes/typst-wasm/m7-export`. Active preset written with Obsidian closed
  (checked with `pgrep`, the user confirmed the quit); previous `data.json`
  (active preset `Callouts`) in
  `spikes/typst-wasm/m7-state-backup/data.before-m7.json`.
- Dry run in Node with the preset and the vault's Defaults before writing M7:
  `Glossary.md` 4 pages, 25 run-in and 2 lone terms, 1 warning
  (`HEADING_IN_TERM`, line 38), bookmarks `1 Rules`, `2 Glossary`, `3 Back
  notes`, the two links land on pages 2 and 1, no page ends with a term;
  `Rules glossary.md` 5 pages, 40 run-in terms, 16 `LINK_UNRESOLVED`;
  `Glossar.md` 1 page, 2 run-in terms, no warning.
- Gate: typecheck, lint, build green; `npm test` 1547 passed, 1 todo;
  integration 332 passed, 1 skipped.
- Installed: `main.js` sha256 `0d72bd803f1e7c92…`, `manifest.json`
  `cef22a2d8bd8…`, `styles.css` `9109f37bf368…`, each equal to the build.
- Waiting for: M7 run by the user.

## Result (2026-10-19, M7)

- M7 passed on `0.3.0-m7.1`, all steps 1 to 7 (reported by the user;
  Obsidian 1.14.4, macOS 27.0.1 (26A434)). No defect, nothing odd reported.
  Recorded in `docs/technical/spike-typst-wasm.md`, "Manual runs".
