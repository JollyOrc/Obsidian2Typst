# TICKET-082 — Test build and manual check M16 (book parts and signatures)

**Status:** Done
**User story:** [US-026](../user-stories/US-026-book-parts-and-signatures.md)
**ACs addressed:** AC-9 (rows in Obsidian), AC-10 (preview and export by
eye); AC-3 to AC-6 in a real export
**Depends on:** TICKET-078 to TICKET-081
**SCARs:** SCAR-012, SCAR-015, SCAR-016, SCAR-018, SCAR-025

---

## Description

Build `0.10.0-m16.1`, install it with the regenerated sample vault, a preset
`Book parts` (signature 8, roman front matter, first chapter left), and M16:
the rows; the preview and export of `Sample/Book.md` with cover, colophon on
p. 3 with `iii`, the first chapter on p. 4, back notes on the last page, a
total of a multiple of 8, the padding pages with their folio only.

---

## Implementation notes

- As TICKET-077: version in the three files and the M sections, install,
  checksums, backups `m16-state-backup/before/` and `handover/`, fixture
  names unique by listing, `data.json` never written while Obsidian runs,
  every number measured through the plugin's own path (SCAR-012).

---

## SCAR check (2026-10-28, item by item against the Prevention lists)

- **SCAR-012** (1–7) as TICKET-077, with the new item: numbers measured with
  the font catalog.
- **SCAR-015** (1–5) the check names texts, folios, page numbers; the open
  question.
- **SCAR-016** (1–8) rows on an open tab; the preset edited with the preview
  open.
- **SCAR-018** (1–10) backups with checksums.
- **SCAR-025** (1–4) the padding pages and the colophon page at reading size,
  the folio zoomed.

---

## Definition of done

- [x] Build installed and compared by checksum
- [x] M16 passed by the user (2026-10-29: "all m16 tests pass"), no findings

---

## Handover (2026-10-29)

Build `0.10.0-m16.1` (`main.js` sha256 `77c39c19129c…`, the code of
TICKET-081; only the version changed in `manifest.json`, `package.json`,
`package-lock.json`). `npm run install:scratch`: `main.js`, `manifest.json`,
`styles.css` byte-identical to the fresh build; `Sample/` 73 files equal to
`tests/fixtures/sample/`. New preset note `Obsidian2Typst/presets/Book
parts.md` (once in the vault, by listing). M16 written in
`docs/technical/manual-checks.md`; every Expected version line names
`0.10.0-m16.1`; the version test covers M16 (proven by a mutant).

- Measured (scratchpad `m082/measure.test.ts`, the plugin's `convertNote`
  with the font catalog): 424 pages (53 × 8), cover p. 1, p. 2 empty,
  colophon p. 3 `iii`, `1 Mollit` p. 4 `1`, padding pp. 422, 423 (`419`,
  `420`, no header), back notes p. 424 (`421`); signature 16: 432 pages;
  149 warnings, no `BOOK_PART_*`. Bookmarks (PDFKit): nine chapters, none for
  the hidden parts. Rows (`rowsRig` probe `m082r`): the three preset rows
  disabled with the owner text, no reset icon; the two heading rows free.
- Looked at at 3× (SCAR-025): pages 3, 422, 424; the page numbers zoomed (the
  first look made `419` seem bolder; zoomed, the same weight).
- Backups: `spikes/typst-wasm/m16-state-backup/before/` (88 files) and
  `handover/` (91 files), checksums checked; `data.json` not written
  (Obsidian was running). Export folder `m16-export/1` empty.
- Gate (scratchpad `gate082.log`): typecheck, build, lint green; `npm test`
  1934 passed, 63 failed, 1 todo; integration 430 passed, 34 failed, 1
  skipped; every red test is of US-027, US-028 or the two US-026 contents rows.
