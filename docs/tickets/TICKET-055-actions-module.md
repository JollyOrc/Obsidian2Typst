# TICKET-055 — The actions: export a note by path, preview a note, use a preset

**Status:** Done (2026-10-21)
**User story:** [US-020](../user-stories/US-020-actions-ribbon-and-note-menus.md)
**ACs addressed:** AC-1 (with the style panel's preset dropdown, added 2026-10-21), AC-2, AC-4, AC-5 (the action part), AC-8, AC-9 (the commands)
**Depends on:** —
**SCARs:** SCAR-001, SCAR-002, SCAR-014, SCAR-016, SCAR-017, SCAR-018, SCAR-019

---

## Description

Put the three actions into one module that every entry point calls, export a
note by its path instead of only the active one, and route the two commands
and the settings tab's `Use` button through the actions. No new control in
this ticket (the menus are TICKET-056); the visible behaviour of the commands
and the settings tab stays the same.

---

## Acceptance criteria (from user story)

- **AC-1:** one function per action in `src/plugin/actions.ts`; only that file
  calls `exportNoteAt`, `exportCurrentNote` or `openStylePanel`; `Use` calls
  `usePreset(entry.name)`.
- **AC-2:** the export takes a path; the command passes the active note; the
  messages of US-008 AC-15 and the US-007 lock message stay; example: the
  clicked `Glossary.md` is exported while `Rules.md` stays active.
- **AC-4:** choosing a preset saves it like `Use`; the active one changes
  nothing.
- **AC-5:** the action reads the preset at the click: `Preset "Folios" does
  not exist`, `Preset "A5 print" is invalid: …` (the store's messages).
- **AC-8:** `Preview` first shows the note (makes it active), then the panel;
  without a note only the panel; no room: today's notice.
- **AC-9:** the commands keep ids and names and call the actions.

---

## Implementation notes

- `src/plugin/export-command.ts`: new `exportNoteAt(deps, path: string |
  null)` with today's body (the `path` replaces `deps.notes.activePath()`);
  `exportCurrentNote(deps)` stays as `exportNoteAt(deps,
  deps.notes.activePath())`, so the US-007, US-008, US-010 and US-012 tests
  that call it are unchanged.
- New `src/plugin/actions.ts`: `createActions(deps)` → `{exportNote(path?),
  previewNote(path?), usePreset(name)}`. Deps: the `ExportCommandDeps` fields,
  plus `showNote(path): Promise<void>` and `openPanel(): Promise<boolean>`.
  `exportNote()` without a path uses `deps.notes.activePath()`.
  `usePreset(name)`: `presets.use(name)` at the call; a refusal goes to
  `notice` as is; the stored name equal → nothing; else `settings.update({
  activePreset: name})`.
- `src/plugin/main.ts`: builds the actions once in `onload` with the real
  deps (`showNote`: from the file explorer `workspace.getLeaf(false).openFile`;
  `openPanel`: today's `openStylePanel` call with its leaves); the two command
  callbacks call `actions.exportNote()` and `actions.previewNote()`; the old
  private `exportNote` and `openPanel` methods become the deps or go.
- `src/plugin/settings/settings-tab.ts`: `SettingsTabDeps` gains `usePreset`;
  the `Use` button calls `usePreset(entry.name)` and redraws as today.
- `src/plugin/preview/panel.ts` (added 2026-10-21 after the SCAR-017 grep
  found it; the user accepted the counter-offer): the panel's deps gain
  `usePreset`; the preset dropdown calls `usePreset(name)` instead of
  `settings.update({activePreset: name})`. The rename and delete flows of the
  settings tab keep updating the stored name (not "using" a preset).
- Existing tests expected to change, each reported: the tests that build the
  settings tab with `SettingsTabDeps` — `tests/plugin/us-008-text-commit.test.ts`
  and `tests/plugin/us-012-panel.test.ts` (grep at G3) — get the new
  dependency; none for the export command (wrapper kept).

---

## Tests

- `tests/plugin/us-020-actions-menus.test.ts`: every `US-020 AC-2`, `AC-4`,
  `AC-5`, `AC-8` test and the AC-1 text checks; the AC-9 text check's command
  part (its ribbon part is TICKET-056).
- Mutation checks (SCAR-018): `exportNote(path)` ignores the path; the active
  preset updated also when unchanged; `usePreset` without the `use` check;
  `previewNote` opens the panel before showing the note; the no-room notice
  dropped; `Use` back to a direct `settings.update`.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** (1) `exportNoteAt` and `selectPreset` keep their transforms;
  `presets.use` gets a new caller (`usePreset`) whose messages are passed on
  unchanged, listed in the register row of the preset store; (2) read before
  use: `use` returns `does not exist` / `is invalid: …`; (3) no flag added;
  (4) edge inputs: a preset note path, an empty vault, a name that vanished.
- **SCAR-002** (1–3) composed: the clicked note is not the active one; the
  settings tab and the panel open while a preset is chosen (AC-10); (4) the
  examples were run against today's code (rig probe, G2); (5) wrappers: n/a
  (no generated text).
- **SCAR-003** (1) tests exist and are red; (2) AC list again before Done;
  (3) AC → test table in the result.
- **SCAR-006** (1) full gate before Done; (2) no skip; (3) counts in the
  result; (4) TICKET-056/057 red tests tracked in the map.
- **SCAR-007** (1) messages and call orders exact in the tests; (2) n/a;
  (3) yes.
- **SCAR-008** (1) Obsidian calls (`getLeaf`, `openFile`) read from the
  types; (2–3) the actions are tested by program with fakes; the app is AC-10;
  (4) n/a (no canvas); (5) n/a; (6) n/a (no choice offered without
  measuring); (7) n/a (no layout-dependent output).
- **SCAR-009** n/a: no generated text.
- **SCAR-010** n/a: no concatenated pieces.
- **SCAR-011** n/a: no generated names.
- **SCAR-012** n/a here (TICKET-057).
- **SCAR-013** n/a: no dialog with a field is new.
- **SCAR-014** (1–4) no destructive action is added; `Use` keeps its form;
  (5) worst misplaced click (a preset chosen) is listed in the story with its
  undo; (6) n/a.
- **SCAR-015** n/a here (no output change).
- **SCAR-016** (1) `usePreset` reads the store at the call; (2) the settings
  tab and the panel redraw on the settings change as today; (3–4) AC-5 tests
  draw, change, use with a changed store; (5) M10 keeps the tab open.
- **SCAR-017** (1) grep before coding: `exportCurrentNote(`, `openStylePanel(`,
  `activePreset:` in `src/plugin` (hits and decisions in the result); (2) the
  class is every entry point (AC-1 table); (3) one module and a text check;
  (4) n/a.
- **SCAR-018** (1) path-mirrored backups of `export-command.ts`, `actions.ts`,
  `main.ts`, `settings-tab.ts` with a checksum list; (2) `shasum -a 256 -c`
  after every restore, stop on failure; (3) each mutant asserts one match;
  (4) arrays; (5) baseline in the same run; (6) caught only on a verified tree.
- **SCAR-019** (1) presets at 0, 1, several, invalid, missing stored name
  (tests of AC-2, AC-3, AC-5); (2) n/a; (3) yes; (4) M10 (TICKET-057).

---

## Definition of done

- [x] Tests named above green; the export-command tests unchanged and green
- [x] Existing tests that changed listed with the reason
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)

## Result (2026-10-21)

Changed: `src/plugin/export-command.ts` (`exportNoteAt(deps, path)`;
`exportCurrentNote` is its wrapper with the active path); new
`src/plugin/actions.ts` (`createActions`, `panelOpener`); `src/plugin/main.ts`
(the actions built once as a field; both commands call them; the export run
moved into `runExportRequest`; `showNote` opens the note with
`workspace.getLeaf(false).openFile`; the old private `exportNote` and
`openPanel` are gone); `src/plugin/settings/settings-tab.ts` and
`src/plugin/preview/panel.ts` (a `usePreset` dependency for `Use` and for the
preset dropdown). Register row "Actions". Scope addition accepted by the user
(2026-10-21): the style panel's preset dropdown, found by the SCAR-017 grep.

- Gate (scratchpad `gate055.log`): typecheck, build (`main.js` sha256
  `2701c788a0fb…`), lint green; `npm test` 1646 passed, 15 failed, 1 todo;
  integration 370 passed, 1 skipped. All 15 red tests are TICKET-056's (the
  menus module, the menu events, the ribbon icon).
- AC → tests: AC-1 — the three text checks (export functions and
  `openStylePanel` only in `actions.ts`; `Use`; the panel dropdown), green;
  AC-2 — four tests, green (exportNoteAt, the clicked note, the messages, an
  export error); AC-4 — green; AC-5 (action part) — the new direct test,
  green; AC-8 — three tests, green; AC-9 — the command part is in the
  ribbon test, red until TICKET-056.
- Existing tests changed: `tests/plugin/us-012-panel-behavior.test.ts` (two
  rigs get `usePreset`, unused there); `tests/plugin/us-012-panel.test.ts`, the
  US-012 AC-3 text check now looks for `this.deps.usePreset(name)` in the panel
  and its wiring to `this.actions.usePreset` in `main.ts` (it pinned the old
  `settings.update({activePreset` call). The export-command tests are
  unchanged and green. `us-008-text-commit` needed no change (it only reads the
  settings tab's source text; it never builds the tab).
- Tests added while coding: an export error gives `Export failed: …` (the
  catch moved from `main.ts` into the action); the action part of AC-5
  (missing and invalid preset) without the menus (added after the mutant
  "usePreset without the store check" survived, because the menu tests are
  still red).
- Mutants (scratchpad `mut055/run.py`; US-020, US-012 panel and behaviour,
  US-008 export command and text commit tests; baseline 15 failed, 93 passed):
  10, all caught on the second run (first run 9 of 10): export ignores the
  path; active preset saved again; `usePreset` without the store check; panel
  before the note; no-room notice dropped; export error not caught; `Use` back
  to `settings.update`; dropdown back to `settings.update`; null path not
  refused; command calls the old export. Backups by full path, `shasum -a 256
  -c` after every restore and at the end: all 5 files OK, both runs.
- SCAR-017 greps: `exportCurrentNote(` — `main.ts` (replaced), its definition;
  `openStylePanel(` — `main.ts` (replaced), its definition; `activePreset:` —
  settings tab `Use` (routed), rename and delete (the stored name, kept),
  panel dropdown (routed, scope addition), `data.ts` (type and default).
