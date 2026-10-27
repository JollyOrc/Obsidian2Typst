# TICKET-045 — Callouts in the preview, test build `0.2.0-m6.1`, manual check M6

**Status:** Done (2026-10-19)
**User story:** [US-016](../user-stories/US-016-callout-styles.md)
**ACs addressed:** AC-16; manual: AC-1 (compared with Obsidian), AC-14, AC-15 (by eye), AC-13 (icon drawn)
**Depends on:** TICKET-041 to TICKET-044
**SCARs:** SCAR-012, SCAR-015, SCAR-016, SCAR-009, SCAR-006, SCAR-008

---

## Description

Show that the preview panel draws callouts as the export does and redraws on a
preset edit, then hand a ready test environment to the user for the one check
only Obsidian can do: the PDF and the panel by eye, and Obsidian's own reading
of the header shapes.

---

## Acceptance criteria (from user story)

- **AC-16:** the preview uses the same `convert` and helper; an edit of
  `callouts` in the active preset note reaches the next preview request; no
  callout rows in the panel or the settings tab.
- **AC-1 (manual part):** the refused and accepted header shapes are compared
  with Obsidian's reading view (Notes of the story).
- **AC-14, AC-15:** a box crossing a page with its title on the first part; the
  composed note shows titles, colours, the icon and the style font.

---

## Implementation notes

- No new preview code is expected: the preview reuses `prepareNote` and
  `convert` (US-012). If `tests/plugin/us-016-callout-preview.test.ts` is
  already green after TICKET-043, this ticket only records it; if not, the
  gap is in passing `callouts` from `effectiveSettings` to `convert`, and is
  fixed there (one place, SCAR-017), not in the preview.
- Version `0.2.0-m6.1` in `package.json` and `manifest.json` (scheme of
  TICKET-026; minor bump for a new feature; `versions.json` untouched until a
  release). Shown in the plugin list and on the first line of the settings tab.
- `docs/technical/manual-checks.md`: new section **M6 — Callouts in the PDF and
  the preview (US-016)**, starting with `Expected version 0.2.0-m6.1` and `Run in
  the scratch vault`. Fixtures prepared by the developer (SCAR-012), all under
  `spikes/typst-wasm/scratch-vault/` (never `The Rules/`):
  - `Callouts.md`: the composed note of AC-15, a callout of 120 paragraphs
    (AC-14), the header shapes of AC-1 side by side (`> [!note] T`,
    `>[!NOTE]`, `> [!note]Title`, `> [!my type] T`, `> **[!note]** T`,
    `> text⏎> [!note]`), an alias, an unknown type, a heading inside a callout
    with a link to it.
  - `Layouting/Icons/quill.png` and a preset `Callouts` with `callouts.example`
    (fill `#f3ead7`) and `callouts.rule-note` (font `DejaVu Sans Mono`, icon).
  - `npm run install:scratch` run, checksum of the installed `main.js` equal to
    the build (printed in the handover).
- Steps of M6 (written out in the file):
  1. Plugin list and settings tab show `0.2.0-m6.1` (first step, SCAR-012).
  2. Open `Callouts.md` in reading view; for each header shape note whether
     Obsidian shows a callout box; compare with the list in the check
     (accepted: first two; refused: the other four).
  3. Export with preset `Callouts`; in the PDF: titles `Rolling dice`,
     `Inner`, `Why?`, `Ripe`, `House` each once; the example box parchment
     (`#f3ead7`), the `Why?` box orange tint, the `Inner` box blue tint inside
     the example box; the icon before `House`, its text in a monospace font;
     the long box crosses at least two pages, its title on the first part;
     `export-warnings.md` lists exactly one `CALLOUT_TYPE_UNKNOWN` (banana).
  4. Open the style panel on `Callouts.md`; without closing it, change
     `callouts.example.fill` in the preset note to `"#ffffff"`, save; the
     preview redraws with a white example box (SCAR-016: draw, change, use).
  5. Open question (SCAR-015): "Is anything missing, odd or ugly that this list
     did not ask about? Report it even if it seems unrelated."
  Known limitation stated in the check: Obsidian's built-in callout icons are
  not printed (Lucide, not bundled).

---

## Tests

- `tests/plugin/us-016-callout-preview.test.ts` — both `US-016 AC-16:` tests.
- `tests/tooling/us-000-test-build-version.test.ts` — the version in M6 equals
  the manifest (extend its list of checks with M6).
- The full gate (typecheck, build, lint, `npm test`, integration).

---

## SCAR check (2026-10-18, item by item against the Prevention lists)

- **SCAR-001:** no new call site expected; if the preview needs a change, it is
  the shared `prepareNote` and its existing tests are the guard.
- **SCAR-002:** the manual note holds the composed cases of AC-6 and AC-15.
- **SCAR-003:** AC-16 has tests; the manual parts are listed in the register
  as manual.
- **SCAR-006:** gate green with pass counts before the handover.
- **SCAR-007:** the check states exact titles, colours and counts.
- **SCAR-008:** the panel draws with the existing canvas helper; no new canvas.
  Blank preview treated as our bug first; the console log of the panel is
  asked for if the preview is blank.
- **SCAR-009:** step 2 compares the header rule with Obsidian, the other
  consumer of the same text, in every shape the story lists.
- **SCAR-010, SCAR-011:** covered by TICKET-043 tests; nothing new here.
- **SCAR-012:** unique version first, build installed and compared by
  checksum, fixtures in the scratch vault, place named, restart of Obsidian
  stated if needed.
- **SCAR-013, SCAR-014:** n/a (no dialog, no destructive action; the preset
  note is edited by the user as text).
- **SCAR-015:** each step names what must be seen; the known limitation is
  stated; the check ends with the open question.
- **SCAR-016:** step 4 keeps the panel open: draw, change the preset, use.
- **SCAR-017:** if a defect is found in M6, the handover answer lists where the
  same pattern can occur (other callouts, other styles, `fit-image` template
  names).

---

## Definition of done

- [x] AC-16 tests green; full gate green; pass counts in the result
- [x] `0.2.0-m6.1` built, installed, checksum compared; fixtures in place
- [x] M6 written in `docs/technical/manual-checks.md` and passed by the user (2026-10-19)
- [x] Register rows ✅ with the date of M6 (2026-10-19)


## Result so far (2026-10-18, handover)

- AC-16: both tests green since TICKET-043; no source change in this ticket.
- Version `0.2.0-m6.1` in `package.json`, `manifest.json` and the two root
  entries of `package-lock.json`. **Deviation:** `versions.json` got
  `"0.2.0": "1.5.0"`; the note above said to leave it alone, but TICKET-003's
  build test requires the release of a test build to be mapped (it was
  `0.1.0` for every earlier build). M3's expected version moved to
  `0.2.0-m6.1` (the version test requires it); the version test now also
  checks M6.
- Fixtures (scratch vault only): `Callouts.md`, `Layouting/Icons/quill.png`,
  preset `Callouts.md`; active preset set to `Callouts` (previous
  `data.json` in `spikes/typst-wasm/m6-state-backup/data.before-m6-callouts.json`); empty
  `spikes/typst-wasm/m6-export`. Dry run in Node before writing M6: 9
  callouts, 4 plain quotes (shapes 3 to 6), 1 warning (`CALLOUT_TYPE_UNKNOWN`,
  line 19), icon copied, 7 A5 pages, long box from page 2 to 7.
- Gate: typecheck, lint, build green; `npm test` 1491 passed, 1 todo;
  integration 273 passed, 1 skipped.
- Installed: `main.js` sha256 `a85934358fd822bd…`, `manifest.json`
  `b7a2e2cc33a2…`, `styles.css` `9109f37bf368…`, each equal to the build.
- Waiting for: M6 run by the user.

## Result (2026-10-19, M6)

- M6 passed on `0.2.0-m6.1` (reported by the user). The user's first try
  was not run as the check describes (active preset `A5 print` instead of
  `Callouts`); with `Callouts` active all steps passed. No defect. Recorded in
  `docs/technical/spike-typst-wasm.md`, "Manual runs".
