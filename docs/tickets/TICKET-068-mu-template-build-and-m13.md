# TICKET-068 — The MU template, test build `0.9.0-m13.1`, manual check M13

**Status:** Done (2026-10-22; M13 passed, its finding fixed)
**User story:** [US-023](../user-stories/US-023-templates-that-style-the-document.md)
**ACs addressed:** AC-11 (manual); by eye AC-1, AC-3, AC-5, AC-7
**Depends on:** TICKET-066, TICKET-067
**SCARs:** SCAR-006, SCAR-008, SCAR-012, SCAR-015, SCAR-016, SCAR-018, SCAR-019, SCAR-021, SCAR-023

---

## Description

Hand a ready test environment to the user for what only Obsidian shows: the
preset "A5 MU Print" with its template in the preview and the export, and the
warning for a top-level rule.

---

## Acceptance criteria (from user story)

- **AC-11:** the template `Obsidian2Typst/templates/A5 MU Print.typ` in the
  scratch vault, selected by the preset; a manual check that names what the
  page must show, and the warning of AC-5.

---

## Implementation notes

- Version `0.9.0-m13.1` in `package.json`, `manifest.json`, the two root
  entries of `package-lock.json`; `versions.json` gains `"0.9.0": "1.5.0"`;
  M3 and M6 to M12 name the current version; the version test names M13.
- Fixtures in `spikes/typst-wasm/scratch-vault/` only, with Obsidian closed
  (checked with `pgrep`): the template file (the measured draft of G0, its
  rules inside `#let template(doc)`: page fill and edge fades, ink, gold
  level 2, regular level 4, blue line, table colours, the footnote font, the
  runt cost); the preset note gains `template: Obsidian2Typst/templates/A5
  MU Print.typ`; a second template `Obsidian2Typst/templates/MU top-level
  rule.typ` with one top-level `#set` for the warning step. The preset note
  is backed up by full path with a checksum in
  `spikes/typst-wasm/m13-state-backup/` before it is changed; `data.json`
  stays as it is (active preset recorded, not changed).
- M13 in `docs/technical/manual-checks.md`: version and preset; the preview of
  a note with every content kind (colours, fade, headings, divider, table,
  callout, footnote, page numbers, running title); an export and the PDF;
  the warning (the preset switched to the rule template by the user in the
  settings, or a Defaults template — the step says which); the open
  question. Every expectation computed with the plugin's own functions and
  the compiler (scratch probe), not by eye.
- Known limitations stated: the MU fonts are not in the vault until the user
  adds them (`FONT_MISSING`, the default font); ornaments, columns, margin
  notes are not part of the template.

---

## Tests

- `tests/tooling/us-000-test-build-version.test.ts` — M13 names the current
  version.
- The full gate.

---

## SCAR check (2026-10-22, item by item against the Prevention lists)

- **SCAR-001, SCAR-002, SCAR-003** n/a beyond the version test (no code).
- **SCAR-006** (1–4) gate, no skip, counts, nothing deferred.
- **SCAR-007** (1–3) M13 states exact colours, texts and the warning.
- **SCAR-008** (1–3) the PDF of the fixture compiled and read by program
  before the handover; (4–6) n/a.
- **SCAR-009 to SCAR-011** n/a.
- **SCAR-012** (1) build installed and compared by checksum, fixtures and
  backup in place, `data.json` untouched; (2) place and restart stated; (3)
  unique version first; (4) mismatch = wrong build; (5) fixture names unique
  in the vault, shown by a listing; (6) applies.
- **SCAR-013, SCAR-014** n/a (no dialog; the user switches the template).
- **SCAR-015** (1) every step names what must be seen; (2) guard: the plain
  preset (A5 print) shows no parchment; (3) open question last; (4) known
  limitations stated; (5) applies.
- **SCAR-016** (1–8) the panel stays open while the template is edited
  (an edit of the template file reaches the next preview).
- **SCAR-017** (1–7) a defect found in M13 is answered with its class.
- **SCAR-018** (1–8) the preset note backed up by full path with a checksum,
  checked on restore.
- **SCAR-019** (1–5) the template from the preset; the warning step names its
  source.
- **SCAR-020, SCAR-022** n/a.
- **SCAR-021** (1–3) the running title checked on two pages of the fixture.
- **SCAR-023** (1–7) every expectation read from the compiled fixture; the
  version test asserts M13.

---

## Definition of done

- [x] Version test extended and green
- [x] Full gate green with counts; installed build compared by checksum
- [x] M13 written, fixtures and backups in place, every expectation traced
- [x] G4 entry before the handover; M13 passed by the user; run line recorded

---

## Handover (2026-10-22)

- Version `0.9.0-m13.1` in `package.json`, `manifest.json`, both root entries
  of `package-lock.json`, M3 and M6 to M13; `versions.json` gained
  `"0.9.0": "1.5.0"`. The version test names M13 (red before M13, green after).
- Gate (scratchpad `gate068.log`): typecheck, build, lint green; `npm test`
  1775 passed, 1 todo; integration 380 passed, 1 skipped. `npm run
  install:scratch`: installed `main.js` and `manifest.json` identical to the
  fresh build (sha256 `cdbc3da5a4d9…`, `72d7edc6026d…`).
- Fixtures (Obsidian closed, checked with `pgrep`; names unused before, by
  listing): `Obsidian2Typst/templates/A5 MU Print.typ` (the measured draft
  inside `#let template(doc)`), `Obsidian2Typst/templates/MU top-level
  rule.typ` (one `#set` at line 3), `MU check.md` (every content kind, two
  pages), the preset's `template:` line and its body text updated; the empty
  folder `spikes/typst-wasm/m13-export`. `data.json` unchanged (checksum OK).
- Backups: `spikes/typst-wasm/m13-state-backup/before/` (the preset note
  before this ticket) and `handover/` (as handed over, with `data.json` in its
  checksum list); both checked. The first backup was taken before the
  `template:` line was added, so the compare after M13 needs the handover
  copy: the folder was split into the two, each with its checksums.
- Expectations computed with the plugin's own preparation (preset parser,
  `effectiveSettings`, `definesTemplateHook`, `templateWarnings`), the font set
  over the vault (`createFontSet`), `convert` and the compiler (scratch probe
  `m13/probe.test.ts`), for A5 MU Print, A5 print (guard), the template edited
  to blue, and the rule template: pages, header and footer per page, the
  texts, the fills, the gradients, the warnings in order; page 1 by image.
- Found while computing: the note first fit on one page, so the running title
  could not be checked; the Tessera chapter was lengthened to put `Glossary`
  on page 2 (SCAR-021). The template's `set line` also colours the footnote
  separator blue; M13 states it.

## Result (2026-10-22)

M13 passed, all steps 1 to 7 (reported by the user); run line in
`docs/technical/spike-typst-wasm.md`. Finding (step 7, a screenshot): the
parchment fade showed seams. Cause: four opaque gradient strips overlapped and
the one drawn last covered the others, so the colour jumped at the inner edge
of each side strip. Fixed on the user's directive: each strip now fades from
the edge colour to transparent (`mu-fade-end`) over the page fill, so
overlaps blend.

- Changed: the scratch template `Obsidian2Typst/templates/A5 MU Print.typ`
  (four gradient lines, a constant, comments); the test fixture in
  `tests/integration/us-023-template-hook-pdf.test.ts` (the same change; the
  shading count 4 → 8, a gradient and its transparency mask per strip, so a
  return to opaque strips fails the test); US-023 AC-8 (the eight shading
  objects); M13 step 2 (smooth, without seams).
- Re-check of M13 step 2: compiled from the vault's files with the plugin's
  preparation, font set and compiler (scratch probe `m13/probe.test.ts`,
  `mu-final`): 2 pages, the same texts, headers, page numbers, fills and
  warnings as before, 8 shadings; both pages rendered at three times their
  size (scratchpad `m13/final-p1.png`, `final-p2.png`) and read: the fade is
  smooth on all four edges, no seams; page 2 as step 2 describes.
- Gate (scratchpad `gate068b.log`): typecheck, build, lint green; `npm test`
  1775 passed, 1 todo; integration 380 passed, 1 skipped. The build is
  unchanged (`main.js` equal to the installed one), so no new test build.
