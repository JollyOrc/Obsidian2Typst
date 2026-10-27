# TICKET-057 — Test build `0.6.0-m10.1`, manual check M10 (menus in Obsidian)

**Status:** Done (2026-10-21)
**User story:** [US-020](../user-stories/US-020-actions-ribbon-and-note-menus.md)
**ACs addressed:** AC-10 (manual); by eye: AC-3, AC-5 to AC-8
**Depends on:** TICKET-055, TICKET-056
**SCARs:** SCAR-012, SCAR-013, SCAR-014, SCAR-015, SCAR-016, SCAR-017, SCAR-006, SCAR-008, SCAR-018, SCAR-019

---

## Description

Hand a ready test environment to the user for what only Obsidian can show:
the ribbon icon and its menu, the file explorer and editor menus, choosing a
preset while the settings tab and the panel are open, and exporting a note
that is not the active one.

---

## Acceptance criteria (from user story)

- **AC-10:** the menus and icons as in AC-3, AC-6, AC-7 (with an invalid
  preset listed); a preset chosen while the tab and the panel stay open; the
  export of a non-active note (its PDF holds that note's text); `Preview` of a
  note; a second export while one runs; the menus with the keyboard; the open
  question.

---

## Implementation notes

- Version `0.6.0-m10.1` in `package.json`, `manifest.json`, the two root
  entries of `package-lock.json`; `versions.json` gains `"0.6.0": "1.5.0"`;
  M3, M6 to M9 name the current version; the version test checks M10.
- `docs/technical/manual-checks.md`: new section **M10 — Ribbon and note
  menus (US-020)**, first the expected version and the place. Fixtures in
  `spikes/typst-wasm/scratch-vault/` only: the existing `Broken` preset gives
  the invalid entry (checked before writing M10); `PageRefs.md` and
  `Folios.md` as the two notes (one active, one clicked); an empty export
  folder `spikes/typst-wasm/m10-export`. `data.json` backed up by full path
  with a checksum, written only with Obsidian closed (`pgrep`), active preset
  stated in M10.
- Steps of M10 (written out in the file): (1) version and active preset;
  (2) the ribbon icon (a printer) and its tooltip; the menu as in AC-3, with
  `Broken (invalid)` greyed; keyboard only: open with a click, then arrow keys,
  Enter on a preset, Escape on a second opening (SCAR-013); (3) with the
  settings tab open in one window and the style panel open, choose another
  preset in the ribbon menu: both show it at once, without closing either
  (SCAR-016); (4) the file explorer menu on `PageRefs.md`, on a folder, on an
  image, on a preset note (AC-6); (5) `Folios.md` active, `Export to PDF` on
  `PageRefs.md` in the file explorer: the PDF holds `PageRefs.md`'s text
  (`StepA` on page 2), `Folios.md` stays active (SCAR-015: content, not only
  success); (6) `Preview` on `PageRefs.md`: it opens and the panel shows it;
  (7) the editor menu in a split view: the clicked pane's note; (8) a second
  `Export to PDF` while one runs: `An export is already running`; (9) the
  commands still in the palette with their names; (10) the open question.
- A dry run is not possible for menus; instead every M10 expectation is traced
  to a green test or an AC, listed in the ticket result.

---

## Tests

- `tests/tooling/us-000-test-build-version.test.ts` — M10 names the current
  version.
- The full gate.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** n/a: no new call site.
- **SCAR-002** (1–3) the check composes: a non-active note, a split view, an
  export during an export, open tab and panel; (4) n/a (no story example
  changes); (5) n/a.
- **SCAR-003** (1) the version test exists; (2) AC-10 gone through before
  Done; (3) M10 step → AC table in the result.
- **SCAR-006** (1) full gate before the handover and before Done; (2) no
  skip; (3) counts; (4) nothing deferred.
- **SCAR-007** (1) M10 states exact titles, order and messages; (2) n/a;
  (3) yes.
- **SCAR-008** (1–3) icons are strings: M10 asks to look at each one; a blank
  icon is reported as our bug; (4) n/a; (5) the check text logs a result per
  step in the run line; (6–7) n/a.
- **SCAR-009, SCAR-010, SCAR-011** n/a.
- **SCAR-012** (1) build, `npm run install:scratch`, checksums compared,
  fixtures and active preset in place with Obsidian closed; (2) place and
  restart stated; (3) unique version `0.6.0-m10.1`, first step; (4) a mismatch
  is "wrong build"; (5) n/a.
- **SCAR-013** (1–2) menus with the keyboard (step 2); no field dialog is new;
  (3) n/a; (4) keyboard-only step; (5–6) n/a.
- **SCAR-014** (1–4) no destructive control; (5) the worst misplaced click
  (a preset entry) is in step 3 with its undo; (6) n/a.
- **SCAR-015** (1) step 5 names the content of the PDF; (2) guard: the active
  note's text must not be in it; (3) open question last; (4) known
  limitations stated (no submenu, no multi-file export); (5) the menus are
  judged by eye: each one written out.
- **SCAR-016** (1–4) covered by tests; (5) steps 3 and 6 keep the tab and
  the panel open.
- **SCAR-017** (1) n/a (no defect); (2–3) covered by the text checks; (4) a
  defect found is answered with the list of the class (every entry point).
- **SCAR-018** (1) `data.json` backed up by full path with a checksum before
  it is written; (2) checked when restored; (3) the edit asserts the old
  value; (4) arrays; (5–6) n/a.
- **SCAR-019** (1) the menu with an invalid preset and several presets;
  (2) n/a; (3) n/a; (4) every preset the check uses is listed.

---

## Definition of done

- [x] Version test extended and green
- [x] Full gate green with counts; installed build compared by checksum
- [x] M10 written, fixtures in place, every expectation traced to a test or AC
- [x] G4 entry before the handover; M10 passed by the user; run line recorded

## Result so far (2026-10-21, handover)

- **Defect found while writing M10 step 3, fixed before the handover (the
  user accepted the counter-offer, 2026-10-21):** the settings tab listened to
  preset notes only, so a preset chosen in the ribbon menu or in the style
  panel's dropdown (since US-012) left an open tab showing the old one as `In
  use` (US-020 AC-4). New `onActivePresetChange(store, listener)` in
  `src/plugin/settings/data.ts` (a call only when `activePreset` changes, so
  saves of other fields do not redraw the tab while the author types);
  `display()` of `src/plugin/settings/settings-tab.ts` uses it, `hide()` stops
  it. Tests: draw, change another field (no redraw), choose a preset (one
  redraw), back (two), stop (none); a text check of `display()` and `hide()`.
  Mutants (scratchpad `mut057/run.py`): 5, all caught on the second run (the
  `hide` text check was sharpened after the first run let "hide does not
  stop" through); backups by full path, `shasum -a 256 -c` after every
  restore and at the end, both files OK. SCAR-017 class "every screen that
  shows the active preset": the style panel follows `settings.onChange`
  (US-012 AC-14), the ribbon menu is built at each click, the settings tab now
  follows; no other screen shows it.
- Version `0.6.0-m10.1` in `package.json`, `manifest.json`, the two root
  entries of `package-lock.json`; `versions.json` gained `"0.6.0": "1.5.0"`;
  M3, M6 to M9 expect the new version; the version test checks M10.
- Scratch vault as it was after M9 (no `data.json` write: the active preset
  is `PageRefs`, as M10 step 1 expects); empty
  `spikes/typst-wasm/m10-export`.
- Every M10 expectation traced (SCAR-015; menus cannot be dry-run):
  | Step | Evidence |
  |---|---|
  | 1 version, active preset | version test; `data.json` read (`PageRefs`) |
  | 2 menu text, order, check mark, `Broken (invalid)` | AC-3 tests; the entries computed from the vault's 12 presets with the real functions (scratchpad `p020/menu.test.ts`) — the list in M10 is that output; icons and keyboard: by eye only |
  | 3 tab and panel follow a choice | `onActivePresetChange` test; panel: US-012 AC-14 tests; dropdown → `usePreset`: AC-1 text check |
  | 4 file menu on note, folder, image, preset note | AC-6 tests (incl. a folder named `x.md`) |
  | 5 export of a non-active note | AC-2 test; the PDF content: M9 dry run of `PageRefs.md` (7 pages, `StepA` on page 2) |
  | 6 `Preview` from the file explorer | AC-8 tests |
  | 7 editor menu in a split view | text check (`info.file`); pane activation (`setActiveLeaf`) not covered by a test — by eye only |
  | 8 second export while one runs | the US-007 lock tests (`us-007-export-run`, `us-007-plugin-wiring`); same path for every entry point (AC-1 text check) |
  | 9 commands unchanged | AC-9 text check |
- Gate (scratchpad `gate057.log`): typecheck, lint, build green; `npm test`
  1665 passed, 1 todo; integration 370 passed, 1 skipped.
- Installed: `main.js` sha256 `bcf31ed65059…`, `manifest.json`
  `46c9d19bc7b4…`, `styles.css` `9109f37bf368…`, each equal to the build;
  installed version `0.6.0-m10.1`.
- Waiting for: M10 run by the user.

## M10 run (2026-10-21, reported by the user)

- Steps 1 to 5 and 8 to 10 pass.
- **Step 6 (defect):** `Preview` from the file explorer opens the right note
  and the style panel, but the preview is not drawn; `Refresh` in the panel
  draws it correctly.
- **Step 7 (defect):** the same from the editor menu in a split view.
- Status: open; cause being investigated (SCAR-017: the pattern is searched
  in the whole code base before a fix is proposed).
- Cause (2026-10-21): not a code defect. The preview controller compiles at
  once only for the panel's first note; when another note becomes active it
  shows `Note changed; press Refresh` and compiles nothing (US-012 AC-4,
  `controller.ts` `setNote`). The panel was open from step 3, so `Preview`
  hit that branch. US-020 AC-8's example had not been checked against US-012
  AC-4. Pattern search (SCAR-017): the controller's note is set in one place
  (`panel.ts` `followNote`); the entry points that make a note active and show
  the panel are `Preview` in the file explorer and in the editor menu (steps 6
  and 7); `Open style panel` passes no note. The user decided to keep the
  hint (no code change); US-020 AC-8 and M10 steps 6 and 7 amended, step 6
  also checks the closed-panel case. Steps 6 and 7 to be confirmed against
  the amended text on the same build `0.6.0-m10.1` (no new build).

## Result (2026-10-21, M10)

- M10 passed on `0.6.0-m10.1`: steps 1 to 5 and 8 to 10 at the first run;
  steps 6 and 7 after they were rewritten to US-012 AC-4 (the user's decision
  to keep the hint), on the same build (reported by the user; Obsidian 1.14.4,
  macOS 27.0.1 (26A434)). No code defect. Recorded in
  `docs/technical/spike-typst-wasm.md`, "Manual runs".
