# TICKET-056 — The ribbon icon and menu, the file explorer and editor menus

**Status:** Done (2026-10-21)
**User story:** [US-020](../user-stories/US-020-actions-ribbon-and-note-menus.md)
**ACs addressed:** AC-3, AC-5 (the menu part), AC-6, AC-7, AC-9 (the ribbon)
**Depends on:** TICKET-055 (the actions)
**SCARs:** SCAR-008, SCAR-013, SCAR-014, SCAR-016, SCAR-017, SCAR-018, SCAR-019

---

## Description

Build the menu entries as data in a pure module, draw them with Obsidian's
`Menu`, and register the ribbon icon and the `file-menu` and `editor-menu`
events, each entry calling the actions of TICKET-055.

---

## Acceptance criteria (from user story)

- **AC-3:** icon `printer`, tooltip `Obsidian2Typst`; the menu `Export current
  note` (`file-output`), `Open style panel` (`panel-right`), a separator, the
  label `Preset`, every preset in settings order, the one `pickActive` gives
  checked, an invalid one ` (invalid)` and disabled; with none `No preset yet`
  disabled.
- **AC-5:** the menu is built at each click; an entry holds the preset's name
  and calls `usePreset(name)`, which reads the store then.
- **AC-6:** on a Markdown note (any case of `md`), not in the presets folder:
  `Export to PDF` (`file-output`) and `Preview` (`panel-right`) for the clicked
  note; nothing on a folder, another file, a preset note; no `files-menu`.
- **AC-7:** the same items in the editor menu for `info.file`.
- **AC-9:** the ribbon text check.

---

## Implementation notes

- New `src/plugin/menus.ts` (no Obsidian import): `ribbonMenuEntries(actions,
  {names, stored})` and `noteMenuEntries(actions, {path, folder},
  presetsFolder)` return `Entry[]` (`title`, `icon`, `checked`, `disabled`,
  `label`, `separator`, `run`); `pickActive` and `sortPresetNames` from
  `core/presets` decide the checked item and the order (the store's
  `entries()` is already sorted).
- `src/plugin/main.ts`: one small `showEntries(menu, entries)` that maps an
  entry to `menu.addSeparator()` or `menu.addItem(i => i.setTitle(…)
  .setIcon(…).setChecked(…).setDisabled(…).setIsLabel(…).onClick(…))`, the
  only place that draws an `Entry`; `addRibbonIcon('printer', 'Obsidian2Typst',
  (evt) => { const menu = new Menu(); showEntries(menu,
  ribbonMenuEntries(actions, {names: presets.entries(), stored:
  settings.data.activePreset})); menu.showAtMouseEvent(evt); })`;
  `registerEvent(workspace.on('file-menu', (menu, file) => …))` with
  `{path: file.path, folder: file instanceof TFolder}`;
  `registerEvent(workspace.on('editor-menu', (menu, _editor, info) => …))`
  with `info.file` (null: nothing). All option names read from
  `obsidian.d.ts` 1.14.4 (SCAR-008): `setChecked(boolean | null)`,
  `setIsLabel(boolean)`, `setDisabled(boolean)`.
- The editor menu's `Preview` must make that editor's pane active (AC-8):
  `showNote` gets the leaf when there is one (`info` is a `MarkdownView` with
  `leaf`), so `workspace.setActiveLeaf(leaf, {focus: true})` is used instead
  of opening the file again; decided in the code, reported.
- `tests/support/fake-obsidian.ts` has neither `TFolder` nor `Menu` (grep at
  G3): any test that loads `main.ts` through the fake needs `TFolder` (and
  `Menu`, `addRibbonIcon` on the fake plugin) added there; the entries
  themselves are tested as data.

---

## Tests

- `tests/plugin/us-020-actions-menus.test.ts`: every `US-020 AC-3`, `AC-6`
  test, the AC-5 menu tests, the AC-6/AC-7 and AC-9 text checks.
- Mutation checks (SCAR-018): the checked item from `stored` instead of
  `pickActive`; invalid presets enabled; the label clickable; the order
  reversed; `md` case-sensitive; preset notes allowed; folders allowed;
  `files-menu` registered; the editor menu for the active file instead of
  `info.file`.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** (1) `pickActive` and `sortPresetNames` get a new caller; their
  transforms (stored name or first name; locale-free order) fit the menu;
  (2) read before use (`core/presets/names.ts`); (3) no flag; (4) edge inputs:
  a stored name that vanished, an invalid first preset, `Upper.MD`.
- **SCAR-002** (1–3) composed: a clicked note that is not active, a split view
  (editor menu acts on its own pane), a preset note, an image, a folder;
  (4) the examples ran against today's code for the presets part; (5)
  wrappers: n/a (no generated text).
- **SCAR-003** (1) tests exist and are red; (2) AC list again before Done;
  (3) AC → test table in the result.
- **SCAR-006** (1) full gate; (2) no skip; (3) counts; (4) TICKET-057 tracked.
- **SCAR-007** (1) the menu is written out item by item in AC-3 and the tests;
  (2) n/a; (3) yes.
- **SCAR-008** (1) every `Menu`/`MenuItem` option and the two events read from
  the type definitions (listed in the story); (2) a menu that shows nothing is
  our bug: the entries are tested as data; (3) by program: entries; by eye:
  icons (strings, AC-10); (4) n/a (no canvas); (5) n/a; (6) n/a (the choices
  were offered after the API was read); (7) n/a.
- **SCAR-009, SCAR-010, SCAR-011** n/a: no generated text, pieces or names.
- **SCAR-012** n/a here (TICKET-057).
- **SCAR-013** (1–2) no dialog with a field; Obsidian's menus handle arrow
  keys, Enter and Escape; (3) n/a; (4) M10 runs the menu with the keyboard;
  (5) n/a; (6) n/a.
- **SCAR-014** (1–4) no destructive entry; (5) worst misplaced click: a
  preset entry (undo: choose the old one) and `Export to PDF` on the wrong
  note (the folder question can be cancelled); (6) n/a.
- **SCAR-015** n/a here (M10 in TICKET-057).
- **SCAR-016** (1) entries hold names, the action reads the store at the
  click; the menu is built at each click (never cached); (2) n/a; (3–4) AC-5
  tests; (5) M10 step with the menu open while a preset is renamed.
- **SCAR-017** (1) grep before coding: `addRibbonIcon`, `workspace.on(`,
  `new Menu(` in `src/plugin` (none today); (2) class: every menu entry draws
  through `showEntries`; (3) a text check: `addItem(` appears only in
  `showEntries` (added to the AC-9 test while coding, reported); (4) n/a.
- **SCAR-018** (1) path-mirrored backups of `menus.ts` and `main.ts` with a
  checksum list; (2) check after every restore, stop on failure; (3) one match
  per mutant; (4) arrays; (5) baseline in the same run; (6) verified trees.
- **SCAR-019** (1) presets at 0, 1, 3, invalid, missing stored name; (2) n/a;
  (3) yes; (4) M10 with an invalid preset in the vault.

---

## Definition of done

- [x] Tests named above green
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)
- [x] Register row for `menus.ts` and `showEntries`

## Result (2026-10-21)

Changed: new `src/plugin/menus.ts` (`ribbonMenuEntries`, `noteMenuEntries`,
`MenuEntry`, `PresetsView`; no Obsidian import); `src/plugin/main.ts` (the
action deps kept as a field `actionDeps`; `addRibbonIcon('printer',
'Obsidian2Typst', …)` with a new `Menu` at each click; `file-menu` with
`file instanceof TFolder`; `editor-menu` for `info.file`, whose `Preview`
uses actions built with a `showNote` that calls `workspace.setActiveLeaf(leaf,
{focus: true})` when `info` is a `MarkdownView`; `showEntries(menu, entries,
section?)`, the only `addItem`, the section `obsidian2typst` for the note
menus only). Register row "Menus". No change to `actions.ts`; no fake Obsidian
change (no test loads `main.ts`).

- Gate (scratchpad `gate056.log`): typecheck, build (`main.js` sha256
  `9bdde51cc098…`), lint green; `npm test` 1663 passed, 1 todo; integration
  370 passed, 1 skipped. No red test left in US-020.
- AC → tests: AC-3 — four entry tests, green; AC-5 — the three menu tests
  (draw, change, use) and the direct action test, green; AC-6 — six file
  cases, the items test, the `addItem` text check, green; AC-7 and AC-9 — the
  text checks, green.
- Tests changed or added while coding: the missing-stored-name test listed
  presets out of settings order (`Broken`, `Book`), an order the store never
  gives (`pickActive` sorts); now `Archive` (invalid) before `Book`. Added
  after two mutants survived: a valid first preset checked when the stored
  name is gone; a folder named `Archive.md` (the `md` check alone would let a
  folder through). The SCAR-017 text check for `addItem` (promised by the
  ticket). Story AC-6 names the `Archive.md` folder.
- Decision in the code (reported): sections only for the note menus; the
  ribbon menu is the plugin's own and its separator is not mixed with
  sections (their interplay is not documented in the types; M10 looks).
- Mutants (scratchpad `mut056/run.py`; the US-020 tests; baseline 0 failed,
  29 passed): 12, all caught on the second run (first run 10 of 12): checked
  from the stored name; invalid presets enabled; label clickable; order
  reversed; `md` case-sensitive; preset notes allowed; folders allowed;
  `files-menu` registered; editor menu for the active file; export entry
  passes the active note; nothing for no preset; ribbon icon renamed. Backups
  by full path, `shasum -a 256 -c` after every restore and at the end: both
  files OK, both runs.
- SCAR-017 greps: `addRibbonIcon`, `new Menu(`, `addItem(` — none before;
  `workspace.on(` — the panel's `active-leaf-change` only (not a menu).
