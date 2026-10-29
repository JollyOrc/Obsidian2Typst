# TICKET-077 — Test build and manual check M15 (page breaks)

**Status:** Done (2026-10-28)
**User story:** [US-025](../user-stories/US-025-page-breaks-by-heading.md)
**ACs addressed:** AC-7 (the rows drawn in Obsidian), AC-10 (the preview by
eye); AC-2, AC-6 checked in a real export
**Depends on:** TICKET-075, TICKET-076
**SCARs:** SCAR-012, SCAR-015, SCAR-016, SCAR-018, SCAR-025

---

## Description

A test build `0.10.0-m15.1` in the scratch vault and the manual check M15:
the six rows in the settings tab and the style panel, a preset with
`h1: right` and `h2: page` on the sample vault's `Book.md`, the preview and an
export, the blank pages judged at reading size.

---

## Implementation notes

- Build with the version `0.10.0-m15.1` in `manifest.json` only (as M13);
  install into the scratch vault's plugin folder; compare the installed
  `main.js` with the fresh build by checksum (SCAR-012).
- Fixture: a preset note `Breaks.md` in `Obsidian2Typst/presets` with
  `page.breakBefore: {h1: right, h2: page}`; its name checked unique by a
  listing. Back up `data.json` and every note the check touches by full path
  with checksums (`spikes/typst-wasm/m15-state-backup/`, `before/` and
  `handover/`, SCAR-018); never write `data.json` while Obsidian runs.
- M15 steps (in `docs/technical/tests.md`), each naming the version and the
  place: the rows (options, `—`, reset question, a preset row disabled with
  its text), changed and used on a tab that stays open (SCAR-016); the
  preview of `Book.md`: every chapter on a right page, blank pages with a
  folio and no header, inspected at reading size, the page edges and the
  folio zoomed (SCAR-025); the export: the same pages in the PDF; an open
  question at the end (SCAR-015).

---

## SCAR check (2026-10-28, item by item against the Prevention lists)

- **SCAR-012** (1) the environment complete: build installed and compared,
  fixture in place; (2) the place named in each step; (3) a unique version
  shown in Obsidian; (4) a version mismatch read as "wrong build"; (5) the
  fixture's file names unique by a listing; (6) applies.
- **SCAR-015** (1) the check names the content: chapter titles, folios, blank
  pages; (2) the guard tests of TICKET-075; (3) the open question; (4) known
  gaps stated (none); (5) applies.
- **SCAR-016** (1–8) the rows changed and used without closing the tab; the
  preset edited while the panel is open.
- **SCAR-018** (1–10) backups by full path with a checksum list, checked after
  restore; the handover state kept.
- **SCAR-025** (1–4) the pages judged at reading size, the joins (header
  area, folio) zoomed.
- Other SCARs: as in TICKET-075 and TICKET-076.

---

## Definition of done

- [x] Build `0.10.0-m15.1` installed and compared by checksum
- [x] M15 passed by the user, findings handled
- [x] Fixture state: preset notes as handed over; `data.json` differs only by the check's own effects (not written while Obsidian runs)

---

## Handover (2026-10-28)

- Version `0.10.0-m15.1` in `manifest.json`, `package.json`,
  `package-lock.json`; the `Expected version` lines of M2, M3, M6 to M14 and
  the new M15 name it; the version test covers M15.
- `npm run install:scratch`: `main.js` (sha256 `a5c96785fdaf…`, the same
  bytes as the TICKET-076 gate: the version is not in `main.js`),
  `manifest.json`, `styles.css` byte-identical to the fresh build; `Sample/`
  73 files.
- Fixture: `Obsidian2Typst/presets/Breaks.md` (`h1: right`, `h2: page`);
  `Breaks.md` and `Book.md` exist once (listing). `data.json` not written
  (Obsidian was running; unchanged since the `before` backup).
- Backups: `spikes/typst-wasm/m15-state-backup/before/` (17 files: plugin
  files, `data.json`, 13 preset notes) and `handover/` (17 files with
  `Breaks.md`), checksums OK. Export folders `m15-export/1`, `2` empty.
- Every expectation of M15 measured from `Sample/Book.md` with `Breaks` and
  the vault's Defaults (scratch probe `m15/measure.test.ts`): 435 pages, the
  nine chapters on odd pages, blank pages 2, 52, 116, 230, 358 with folio and
  no header, page 4 starting with `1.1 Cras Ac`; with `h2: none` 425 pages,
  blank pages 2, 222, 348, 418; 148 warnings.

---

## Result (2026-10-28)

M15 passed (the user's report). Checked by program afterwards: the export
(`m15-export/1/Book.pdf`) has the 435 pages, blank pages and section start
that M15 names. Finding: the warnings note has 149 entries, not 148 — the M14
exports show the same 149 (`FONT_GLYPH_MISSING` for the task box U+2610); the
count in M8, M9, M14 and M15 had been measured without the plugin's font
catalog and is corrected in all four (SCAR-017). Vault: preset notes as handed
over (checksums OK); `data.json` changed only by the check (active preset
`Breaks`, a remembered export folder) and was not written while Obsidian ran.

- Correction (2026-10-28, found at the TICKET-078 gate): the handover ran
  typecheck, lint and the tooling tests only, not the full gate (SCAR-006);
  `tests/integration/build-output.test.ts` was red from the version change on
  (`versions.json` did not map `0.10.0`). Fixed by `"0.10.0": "1.5.0"`.
