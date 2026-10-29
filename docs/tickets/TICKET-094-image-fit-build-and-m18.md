# TICKET-094 — Test build and manual check M18 (image fit)

**Status:** Done (2026-10-29)
**User story:** [US-028](../user-stories/US-028-image-fit.md)
**ACs addressed:** AC-9 in Obsidian; AC-4 to AC-6, AC-11 in a real export and
the preview
**Depends on:** TICKET-089 to TICKET-093, TICKET-095 (the look, found here on 2026-10-29), TICKET-096 (floats, found here on 2026-10-29), TICKET-097 (a float on its own page, found here on 2026-10-29)
**SCARs:** SCAR-012, SCAR-015, SCAR-016, SCAR-018, SCAR-025, SCAR-029,
SCAR-030

---

## Description

Build `0.10.0-m18.1`, install it in the scratch vault with a preset `Image
fit` (the `Contents` settings of M17 plus `images.minScale: 70`), and hand
over M18: the row in the settings tab and the style panel; the preview and
the export of `Sample/Book.md` with shrunk, floated and moved images, their
warnings in the report and the preview's count, an image in a callout, the
signature and the back notes still on the last page; strict mode on once
(the PDF is still written).

---

## Implementation notes

- As TICKET-088: the version in `manifest.json`, `package.json`,
  `package-lock.json` and every check's Expected version; install with
  checksums against the fresh build; backups
  `spikes/typst-wasm/m18-state-backup/before/` and `handover/` by full path
  with checksum lists; `data.json` never written while Obsidian runs.
- `docs/technical/manual-checks/M18.md` and its index row in the same change
  (SCAR-029); the version test extended to M18.
- Every number M18 names (pages, decisions, warnings) measured through the
  plugin's `convertNote` with the font catalog, after the M17 baseline (424
  pages with `Contents`) is reproduced (SCAR-012, SCAR-028); the shrunk and
  floated pages looked at at 3× (SCAR-025).
- Fixture names unique by listing.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-006** (1–4) full gate before the handover.
- **SCAR-012** (1–7) environment complete and current; unique version shown;
  the check starts with version and place; numbers through the plugin's
  path; names unique.
- **SCAR-015** (1–5) the check names the images, their pages and warnings;
  the open question at the end.
- **SCAR-016** (1–8) the row on an open tab; the preview watched while the
  preset changes.
- **SCAR-018** (1–10) backups with checksums; the handover backup holds the
  state to return to.
- **SCAR-025** (1–4) the shrunk and floated pages at reading size, the image
  edges zoomed.
- **SCAR-029** (1–4) M18 a file of its own with its index row.
- **SCAR-030** (1–4) the measurement probe's limits set from measured times.
- Other SCARs: as in TICKET-089 to 093 (no code beyond the version).

---

## Definition of done

- [x] Build `0.10.0-m18.1` installed; checksums equal to the fresh build
- [x] `M18.md` and its index row; tooling tests green
- [x] Full gate green; G4 entry; M18 handed over
- [x] After the user's pass: story `Done`, index rows, G5 (proposals put to the user)

## Stopped (2026-10-29) and what was measured for M18

- Stopped before the build: the fit images did not look as today
  (TICKET-095). Done: backup `spikes/typst-wasm/m18-state-backup/before/` (93
  files, checked); the M17 baseline reproduced (`Contents`: 424 pages, 149
  warnings).
- To measure again after TICKET-095: with V0 `Book.md` at 70 gave one move
  (`figure-38.png`), with V3 70 full decisions — the facing-pages run shows
  no shrink, float or move; at 70 single-sided 6 floats and 1 shrink were
  seen with V0. M18 needs settings that show each decision with V3.
- Strict mode: `Book.md` has 149 conversion warnings, so strict mode stops
  it before the compile; M18 shows strict mode with a note without
  conversion warnings (measured with V0: 12 paragraphs and
  `![[map.png|400]]` give 0 warnings and a move at line 29), a new fixture
  note in the scratch vault (its name checked unique).

## Stopped again (2026-10-29): with V3 a float's text no longer fills the gap

- Measured before the build (nothing installed; the scratch vault unchanged):
  with V3 no floated image lets the text after it fill the gap (top-level
  sweep, `minScale: 70`: 0 of 4 floats with facing pages, 0 of 8 without);
  without TICKET-095's outer block 4/4 and 8/8; with V0 4/5 and 8/10. The
  PDF test's float check accepts the text on the next page for every float,
  so it stayed green. Ledger entry of this date.
- For M18 with V3: `Book.md` with facing pages gives 70 `full` (as at 100,
  AC-13); single-sided at 70 4 floats and 1 shrink (416 pages); no move. A
  check note (0 conversion warnings) gives shrink, float, move and a move in
  a callout; measure again after the fix.

## Stopped a third time (2026-10-29): a float placed above its own text

- Measured with C3 before the build (nothing installed; the scratch vault
  unchanged): `Book.md` single-sided at 70 gives 5 floats and 1 shrink (416
  pages); `figure-10.png` (line 1126) is drawn at the top of its probe's
  page (p. 68), above the text it follows, not on the next page (AC-4). The
  check note was tuned again (shrink, float, move, a move in a callout; 0
  conversion warnings). Ledger entry of this date.

## Handover (2026-10-29)

- Build `0.10.0-m18.1` (`main.js` `787b899cdbea…`; `main.js`,
  `manifest.json`, `styles.css` equal to the fresh build) installed;
  `Sample/` reinstalled (73 files). New in the vault: the presets `Image fit`
  and `Image fit single`, the note `Image fit check.md` (names unique by
  listing); export folders `m18-export/1`, `2`. Backups
  `m18-state-backup/before/` (93) and `handover/` (96), checksums OK; they
  differ by the three new notes and the plugin's `main.js` and
  `manifest.json` only (`data.json` unchanged).
- M18's numbers measured from the installed files (scratch probe
  `m094b/final/m18.test.ts`): `Contents` 424 pages, 149 warnings; `Image fit`
  70 `full`, 424 pages; `Image fit single` 416 pages, 4 floats (lines 3035,
  3655, 5572, 5675, each on the page after its probe) and 1 shrink (line
  4091), 153 warnings; the check note 8 pages, 0 conversion and 3 fit
  warnings (float line 41, moves lines 53 and 62, shrink line 13).
