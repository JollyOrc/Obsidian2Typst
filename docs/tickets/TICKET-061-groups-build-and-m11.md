# TICKET-061 — Test build `0.7.0-m11.1`, manual check M11 (groups and details)

**Status:** Done (2026-10-21)
**User story:** [US-021](../user-stories/US-021-preset-groups-and-details.md)
**ACs addressed:** AC-11 (manual); by eye AC-3 to AC-9
**Depends on:** TICKET-058, TICKET-059, TICKET-060
**SCARs:** SCAR-012, SCAR-013, SCAR-014, SCAR-015, SCAR-016, SCAR-017, SCAR-006, SCAR-008, SCAR-018, SCAR-019

---

## Description

Hand a ready test environment to the user for what only Obsidian can show:
the three lists with groups (the dropdown's native menu on macOS), the pop-up
from both places, its keys and buttons, and a `group:` edit with the screens
open.

---

## Acceptance criteria (from user story)

- **AC-11:** lists with and without groups; the dropdown's group headings in
  the native menu; the pop-up of a valid and an invalid preset from both
  places; Escape, Enter on `Close`; `Use`, `Open the note`; a `group:` edit
  while the tab and the panel stay open; the open question.

---

## Implementation notes

- Version `0.7.0-m11.1` in `package.json`, `manifest.json`, the two root
  entries of `package-lock.json`; `versions.json` gains `"0.7.0": "1.5.0"`;
  M3, M6 to M10 name the current version; the version test checks M11.
- Fixtures in `spikes/typst-wasm/scratch-vault/` only: `group:` lines added
  to some presets of the vault (for example `Print` for A5 print, Folios,
  Folios single, PageRefs, PageRefs deep; `Screen` for A4 digital; `Print`
  for the invalid `Broken`), others left ungrouped; the added lines listed in
  M11 with their files; a backup of every changed preset note by full path
  with a checksum (SCAR-018); `data.json` only if needed, with Obsidian closed.
- Steps of M11 (written out in the file): version; the three lists with the
  groups (the dropdown's native menu); the pop-up from `Details` and from the
  `info` button, its table (one row checked against the note and the
  Defaults), its keys and buttons; the invalid preset's pop-up; a `group:`
  edit with the tab, the panel and a pop-up open; removing all groups again
  (the lists as today); the open question.
- Every M11 expectation traced to a test or computed from the vault with the
  real functions (as for M10).

---

## Tests

- `tests/tooling/us-000-test-build-version.test.ts` — M11 names the current
  version.
- The full gate.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** n/a: no new call site.
- **SCAR-002** (1–3) the check composes: the three lists and the pop-up at
  once, an invalid preset in a group; (4–5) n/a.
- **SCAR-003** (1) version test; (2) AC-11 gone through; (3) step → AC table.
- **SCAR-006** (1–4) gate before handover and Done, no skip, counts, nothing
  deferred.
- **SCAR-007** (1) M11 states the exact lists computed from the vault; (2–3)
  yes.
- **SCAR-008** (1–3) the native menu and the modal are judged by eye, named;
  (4) n/a; (5) a result per step in the run line; (6–7) n/a.
- **SCAR-009, SCAR-010, SCAR-011** n/a.
- **SCAR-012** (1) build installed and compared by checksum, fixtures in
  place, `data.json` with Obsidian closed; (2) place and restart stated;
  (3) unique version `0.7.0-m11.1` first; (4) mismatch = wrong build; (5) n/a.
- **SCAR-013** (1–4) the pop-up's keys and the dropdown with the keyboard;
  (5–6) n/a.
- **SCAR-014** (1–4) no destructive control; (5) worst misplaced click (`Use`)
  with its undo in a step; (6) n/a.
- **SCAR-015** (1) every step names what must be seen; (2) guard: all groups
  removed gives today's lists; (3) open question last; (4) known limitations
  stated; (5) each list written out.
- **SCAR-016** (1–4) covered by tests; (5) the edit step keeps tab, panel and
  pop-up open; (6) n/a; (7) every screen named in the step.
- **SCAR-017** (1) n/a; (2–3) the text checks; (4) a defect is answered with
  the class (every list, every pop-up opener); (5–6) n/a.
- **SCAR-018** (1) the changed preset notes and `data.json` backed up by full
  path with checksums; (2) checked on restore; (3) the edits assert their
  matches; (4) arrays; (5–7) n/a (no mutants).
- **SCAR-019** (1) groups at none, one, several, case, an invalid preset;
  (2) n/a; (3) n/a; (4) every preset of the vault listed.

---

## Definition of done

- [x] Version test extended and green
- [x] Full gate green with counts; installed build compared by checksum
- [x] M11 written, fixtures in place (backed up), every expectation traced
- [x] G4 entry before the handover; M11 passed by the user; run line recorded

## Result so far (2026-10-21, handover)

- No source change in this ticket.
- Version `0.7.0-m11.1` in `package.json`, `manifest.json`, the two root
  entries of `package-lock.json`; `versions.json` gained `"0.7.0": "1.5.0"`;
  M3, M6 to M10 expect the new version; the version test checks M11.
- Fixtures: seven preset notes of the scratch vault got a `group:` line after
  `schemaVersion: 1` (table in M11; `Folios single` uses `print` in lower
  case). Backed up first by full path to `spikes/typst-wasm/m11-state-backup/`
  with a checksum list of the originals (`shasum -c` in the backup folder: 7
  OK); each edit asserted its one match. Obsidian was running (pid 36033)
  during the edits; preset notes are plain vault files that Obsidian rereads,
  and `data.json` was not touched (active preset `Folios`, as M11 step 1
  states).
- Every M11 expectation traced (SCAR-015):
  | Step | Evidence |
  |---|---|
  | 1 version, active preset | version test; `data.json` read |
  | 2 settings tab groups, row buttons | computed from the vault with `groupPresets` (scratchpad `p020/m11.test.ts`); AC-4 text checks; the invalid description is the parser's message (line 5 after the added line) |
  | 3 dropdown, `info` icon | computed with `presetDropdownGroups`; the drawing tests on the fake select and the panel; the native menu by eye only |
  | 4 ribbon menu | computed with `ribbonMenuEntries` from the vault |
  | 5 pop-up table, keys | computed with `detailRows` from the note and the vault's Defaults; AC-7 tests (focus `Close`); Escape is Obsidian's (by eye) |
  | 6 `Use` stays open | AC-7 test; the settings tab follows (US-020 `onActivePresetChange`) |
  | 7 `info` reads at the click | AC-8 text check and the killed mutant of TICKET-060 |
  | 8 invalid pop-up | AC-6/AC-7 test |
  | 9 open pop-up follows an edit | AC-9 draw-change-use test; the modal's listener (text check) |
  | 10 a `group:` edit with tab and panel open | the panel test and `presets.onChange` redraws (US-012, US-021) |
- Deviation from the ticket's plan (reported): no step removes all groups
  again; the ungrouped lists are those of M10 on the same code path and are
  guarded by green tests (`US-021 AC-2 rule 5`, `AC-3 without groups`, `AC-5
  without groups`); the steps that change a note while a modal is open use a
  text editor outside Obsidian (the pop-up and the settings window are
  modal).
- Gate (scratchpad `gate061.log`): typecheck, lint, build green; `npm test`
  1701 passed, 1 todo; integration 370 passed, 1 skipped.
- Installed: `main.js` sha256 `06ba6440d4e2…`, `manifest.json`
  `1dc8bff4c8b7…`, `styles.css` `9109f37bf368…`, each equal to the build;
  installed version `0.7.0-m11.1`.
- Waiting for: M11 run by the user.

## M11 run (2026-10-21, reported by the user)

- Steps 1, 2 and 4 to 11 pass.
- **Step 3 (finding):** the panel's preset dropdown was greyed out; it became
  active during one of the later steps (which one was not seen). Status:
  being investigated (SCAR-017: the pattern searched in the whole code base
  before a cause is named).
- Cause found (2026-10-21): the preset store's `load()` reads every note but
  notifies no listener (`readAll` calls `announce`, never `emit`), and
  `main.ts` loads the store only in `onLayoutReady`. A style panel that
  Obsidian restores at startup (it was open from M10) draws its dropdown from
  an empty store and keeps it until another change redraws it — probably the
  `Use` of step 6. Reproduced in a scratch probe (`p020/restore.test.ts`):
  opened before the load, the dropdown has no options after the load; a later
  settings change draws `Folios`, `Minimal`. A gap since US-012, not a US-021
  regression.
- Class (SCAR-017; `presets.onChange(` and `presets.load()` in `src`): the
  panel restored at startup (dropdown, the rows' `Set by preset`, the
  preview's restyle) — affected; a change of the presets folder in the
  settings tab (`settings-tab.ts` reloads the store) — an open panel keeps the
  old folder's presets, and an empty new folder sends no event at all
  (`emit` skips an empty list) — affected; the settings tab and the pop-up
  (opened after the load, they redraw themselves) and the ribbon menu (built
  per click) — not affected.
- Fixed (the user's choice "fix now", 2026-10-21): `src/plugin/presets/store.ts`
  `load()` tells every listener once after reading, with the sorted names,
  also when the folder holds no preset. Red tests first (three, in
  `tests/plugin/us-021-groups-details.test.ts`: the load is announced; an
  empty folder is announced; a panel drawn before the load shows the grouped
  presets after it); one test expectation corrected before the fix (the
  second test first expected the two built-in notes, but the fake folder
  existed, so the honest case is an empty list). Existing tests changed:
  `tests/plugin/us-008-preset-store.test.ts` — its rig subscribed before the
  load and asserted exact event lists; it now empties the list after the load
  (the load event is US-021's), and the folder-change test asserts both load
  events (stronger). Mutants (scratchpad `mut061/run.py`): 3, all caught (load
  not announced; empty folder not announced; announced before reading);
  backup by full path, `shasum -a 256 -c` after every restore: OK. Story
  US-021 AC-9 states the rule for the class (every screen that shows presets
  follows the loading of the store).
- New build `0.7.0-m11.2` (`package.json`, `manifest.json`, the two root
  entries of `package-lock.json`; `versions.json` already holds `0.7.0`);
  M3, M6 to M11 expect it. M11 step 3 rewritten: run across a restart with the
  panel open, then a presets-folder change and back. Gate (scratchpad
  `gate061b.log`): typecheck, lint, build green; `npm test` 1704 passed, 1
  todo; integration 370 passed, 1 skipped. Installed: `main.js` sha256
  `67c69c98ac78…`, `manifest.json` `7c4643fcaaca…`, `styles.css`
  `9109f37bf368…`, each equal to the build; `data.json` unchanged (active
  preset `Folios`, folder `Obsidian2Typst/presets`).
- Waiting for: M11 steps 1 to 4 on `0.7.0-m11.2` (1 the version, 3 the
  fixed step, 2 and 4 because the store change reaches every list).

## Result (2026-10-21, M11)

- M11 passed: on `0.7.0-m11.1` steps 1, 2 and 4 to 11; after the store fix on
  `0.7.0-m11.2` steps 1 to 4, step 3 across a restart and a presets-folder
  change (reported by the user; Obsidian 1.14.4, macOS 27.0.1 (26A434)).
  Recorded in `docs/technical/spike-typst-wasm.md`, "Manual runs".
- Left in the scratch vault (fixtures, not the user's notes): the seven
  `group:` lines (backup in `spikes/typst-wasm/m11-state-backup/`, restored on
  request). The folder `Obsidian2Typst/presets-m11` of step 3 was not in the
  vault when this was written (M11 allowed deleting it); `data.json` reads
  the active preset `Folios` and the folder `Obsidian2Typst/presets`.
