# TICKET-088 — Test build and manual check M17 (table of contents)

**Status:** Done (M17 passed 2026-10-29)
**User story:** [US-027](../user-stories/US-027-table-of-contents.md)
**ACs addressed:** AC-7, AC-8 in Obsidian; AC-2 to AC-6, AC-9 in a real
export and the preview
**Depends on:** TICKET-083 to TICKET-087
**SCARs:** SCAR-012, SCAR-013, SCAR-015, SCAR-016, SCAR-018, SCAR-025,
SCAR-029

---

## Description

Build `0.10.0-m17.1`, install it in the scratch vault with a preset
`Contents` (the `Book parts` settings of M16 plus `toc.depth: 2`), and hand
over M17: the Contents rows and the details pop-up; the menu items on an H1
of `Sample/Book.md` (keyboard only once); the preview and the export with the
contents at the default place and at a picked place; the entries, their
folios, the links, the bookmarks of a callout heading, the contents pages
without a running header.

---

## Implementation notes

- New file `docs/technical/manual-checks/M17.md` and its row in the index
  `docs/technical/manual-checks.md` in the same change (SCAR-029); the tests
  read it through `tests/support/manual-checks.ts` (`readCheck('M17')`);
  `tests/tooling/manual-checks-files.test.ts` keeps index and files one to
  one.
- As TICKET-082: version in `manifest.json`, `package.json`,
  `package-lock.json` and the checks that name it; `versions.json` maps
  `0.10.0`; install, checksums of `main.js`, backups
  `spikes/typst-wasm/m17-state-backup/before/` and `handover/` by full path
  with checksum lists; `data.json` never written while Obsidian runs (and the
  M15 leftover in it — active preset `Breaks` — is put to the user first).
- Every number M17 names (pages, folios, entries) is measured through the
  plugin's own path (`convertNote` with the font set) and checked against
  the M16 baseline (424 pages with the `Book parts` preset) before it is
  trusted (SCAR-012, SCAR-028).
- Every fixture file M17 names by its name is unique where it is looked up,
  shown by a listing.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-006** (1–4) full gate before the handover, counts in the result.
- **SCAR-012** (1–7) environment complete and current: build installed and
  compared with the fresh build by checksum, sample vault and preset in
  place, unique version shown in the app, the check starts with the version
  and the place; numbers measured through the plugin's path with the font
  catalog; names unique by listing.
- **SCAR-013** (1–6) one menu item run with the keyboard only (Enter,
  Escape) in M17.
- **SCAR-015** (1–5) the check names the entry texts, folios, the absent
  headings and the bookmark; ends with the open question.
- **SCAR-016** (1–8) rows and menu items on a tab that stays open; the
  preview watched while the preset changes.
- **SCAR-018** (1–10) backups by full path with checksums; the handover
  backup holds the state to return to.
- **SCAR-025** (1–4) the contents page rendered at reading size (3×), the
  dot leaders and the folio column zoomed in on.
- **SCAR-029** (1–4) M17 a file of its own, an index row, read by id.
- Other SCARs (001 to 011, 014, 017, 019 to 024, 026 to 028): as in TICKET-083
  to 087 (no code in this ticket beyond the version).

---

## Definition of done

- [x] Build `0.10.0-m17.1` installed; checksums equal to the fresh build
- [x] `M17.md` and its index row; tooling tests green
- [x] Full gate green apart from US-028; G4 entry; M17 handed over
- [x] After the user's pass: story `Done`, index rows, G5 (M17 passed
      2026-10-29; the run line in `spike-typst-wasm.md`)

---

## Handover (2026-10-29)

Build `0.10.0-m17.1` (`main.js` sha256 `d9216accd333…`, the code of
TICKET-087; only the version changed in `manifest.json`, `package.json`,
`package-lock.json` and the Expected version of M3, M6 to M16).
`npm run install:scratch`: `main.js`, `manifest.json`, `styles.css`
byte-identical to the fresh build; `Sample/` 73 files equal to
`tests/fixtures/sample/`. New preset note `Obsidian2Typst/presets/Contents.md`
(the `Book parts` settings and `toc: depth: 2`; no file named `Contents` in
the vault before, by listing). `docs/technical/manual-checks/M17.md` and its
index row; the version test covers M17 (proven by a mutant: M17 naming the
old version fails it; restored, compared).

- `data.json` not written (Obsidian was running) and unchanged by the
  install; its active preset is `Book parts` (chosen during M16), so the
  M15 question about `Breaks` is void.
- Measured (scratchpad `m088/measure.test.ts`, the plugin's `convertNote`
  with the font catalog; first the M16 baseline: `Book parts` 424 pages, 149
  warnings): `Contents` 424 pages, contents pp. 4, 5 (`iv`, `v`, no header),
  `1 Mollit` p. 6 (`1`), 35 entries (9 chapters, 26 sections), each
  chapter's number equal to the folio of its heading page; after `Praesent`:
  contents pp. 178, 179 (`175`, `176`), `4 Dui Velit` p. 180 (`177`); a
  missing heading: the default place and `TOC_HEADING_MISSING` (150
  warnings); the Defaults' title `Inhalt` without dot leaders: 424 pages,
  `1 Mollit` p. 6. Bookmarks (PDFKit): the nine chapters, no `Contents`.
  Links of p. 4: 30, among them p. 115 (`3 Praesent`). The preset note after
  the menu's change and after Remove (`m088/edit.test.ts`): the toc group
  as M17 says; Remove gives the note back byte for byte.
- Looked at at 3× (SCAR-025): pp. 4, 5, 177, 178, 180 and p. 4 without dot
  leaders. The text reader splits some numbers without dot leaders (`1 4`);
  the page shows `14` (the reader's spacing, not the PDF).
- Backups: `spikes/typst-wasm/m17-state-backup/before/` (92 files) and
  `handover/` (93 files: the same paths and `Contents.md`), checksums
  checked. Export folder `m17-export/1` empty.
- Gate (scratchpad `gate088.log`): typecheck, build, lint green; `npm test`
  1983 passed, 27 failed, 1 todo; integration 446 passed, 22 failed, 1
  skipped; every red test is of US-028.
