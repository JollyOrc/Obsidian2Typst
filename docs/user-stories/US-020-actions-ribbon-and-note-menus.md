# US-020 — One function per action, a ribbon menu and note context menus

**Status:** Done (2026-10-21)
**Introduced:** v0.6.0 (planned; a new feature bumps the minor version)
**Implemented:** v0.6.0 (test build `0.6.0-m10.1`, M10 passed 2026-10-21)
**Supersedes:** —

---

## Story

**As an** author who exports notes to print,
**I want** to export a note, open the preview and switch the preset from a
ribbon icon and from the right-click menu of a note,
**so that** I do not have to know and type commands in the command palette.

Decided by the user (`docs/state/00_governance.md`, 2026-10-21): Plugin UX is
three stories done in order; this is the first (actions, ribbon menu, note
context menus). Story 2 brings a preset picker grouped by a `group:` field;
story 3 heading and image menus. The palette commands stay (hotkeys).

Today (read from the code, 2026-10-21): three palette commands — `Open style
panel`, `Export current note`, `Check compiler (developer)`; the preset list
with `Use` (disabled for an invalid preset), `Duplicate`, `Rename`, `Delete`,
`New preset` in the settings tab; a preset dropdown at the top of the style
panel (US-012, `addPresetDropdown`; missed in the first version of this
section, found by the SCAR-017 grep of TICKET-055, 2026-10-21); no ribbon
icon; no context menu. The plugin is desktop only.

Measured from the Obsidian 1.14.4 type definitions (`obsidian.d.ts`, SCAR-008):
`addRibbonIcon(icon, title, callback(evt))`; `new Menu()` with `addItem`,
`addSeparator`, `showAtMouseEvent`; `MenuItem.setTitle`, `setIcon`,
`setChecked`, `setDisabled`, `setIsLabel`, `setSection`, `onClick`; the
workspace events `file-menu` (menu, file, source, leaf) and `editor-menu`
(menu, editor, info with `file`). There is **no public submenu**; a preset
list therefore goes into the menu itself (decided 2026-10-21).

---

## Acceptance criteria

- **AC-1 (one function per action, SCAR-017):** Three actions, each one
  function in `src/plugin`, called by every entry point and by nothing else:

  | Action | Takes | Entry points |
  |---|---|---|
  | export a note | the vault path of a note | command `Export current note` (the active note), ribbon menu `Export current note`, file menu and editor menu `Export to PDF` (the clicked note) |
  | preview a note | the vault path of a note, or none | command `Open style panel` (none), ribbon menu `Open style panel` (none), file menu and editor menu `Preview` (the clicked note) |
  | use a preset | a preset name | settings tab `Use`, style panel preset dropdown, ribbon menu preset item |

  The actions live in `src/plugin/actions.ts`. A text check over `src/plugin`
  fails when any file but `actions.ts` calls the export functions of
  `export-command.ts` (`exportNoteAt`, `exportCurrentNote`) or
  `openStylePanel`; the settings tab's `Use` button calls `usePreset(entry.name)`
  and the style panel's preset dropdown calls `usePreset(name)`
  (renaming or deleting a preset still updates the stored name: that is not
  "using" a preset). Corrected at G2 (2026-10-21).

- **AC-2 (export a note by path):** The export action takes the path; the
  command passes the active note's path. The checks and messages are today's
  (US-008 AC-15), for the given note:

  | Given | Result |
  |---|---|
  | no note is open (command, ribbon) | notice `Open a note to export it` |
  | the note is in the presets folder | notice `Presets are not exported` |
  | no preset exists | notice `There is no preset; create one in the settings of Obsidian2Typst` |
  | the active preset is invalid | notice with the preset error, as today |
  | an export is running | notice `An export is already running` (US-007 lock) |
  | otherwise | the folder question, then the export of **that** note |

  Example (composed, SCAR-002): `Rules.md` is open in the editor; in the file
  explorer the author right-clicks `Glossary.md` and chooses `Export to PDF`:
  `Glossary.pdf` is written; `Rules.md` stays the active note.

- **AC-3 (the ribbon icon and its menu):** One ribbon icon, icon `printer`,
  tooltip `Obsidian2Typst`. A click opens a menu at the mouse with, in this
  order:
  ```
  Export current note        (icon file-output)
  Open style panel           (icon panel-right)
  ───────────
  Preset                     (a label, not clickable)
  A4 digital
  A5 print              ✓    (the active preset is checked)
  Broken (invalid)           (disabled)
  ```
  The presets are in the order of the settings tab (`sortPresetNames`). The
  checked item is the preset an export would use now: `pickActive(names,
  activePreset)` — the stored one, or, when it no longer exists, the first
  name in that order (also when that one is invalid; the export then refuses
  with its error, as today). An invalid preset is listed with ` (invalid)` and cannot be chosen, as `Use`
  in the settings tab. With no preset: the label and one disabled item `No
  preset yet`. All presets are listed, however many (decided 2026-10-21;
  story 2's picker replaces the list when presets are grouped).

- **AC-4 (choosing a preset from the menu):** A click on a preset makes it the
  active preset, exactly as `Use` in the settings tab: the setting is saved, an
  open settings tab and the style panel show it, the next export and preview
  use it. Clicking the active (checked) preset changes nothing. Choosing a
  preset is not destructive (no data is lost; it can be switched back), so
  there is no question (SCAR-014: this is the worst misplaced click of the
  menu, listed here with its undo — choose the other preset again).

- **AC-5 (the menu reads the state when it opens and when it is used,
  SCAR-016):** The menu is built each time the icon is clicked, from the
  presets and the active preset at that moment. A click reads the preset by
  its name at the moment of the click. Examples in the order draw, change,
  use:
  - the menu is open; in another window the preset `Folios` is renamed to
    `Book`; the author clicks `Folios`: notice `Preset "Folios" does not
    exist` (the preset store's message, as for every use of a preset);
    nothing changes;
  - the menu is open; `A5 print` becomes invalid (its note is edited); the
    author clicks `A5 print`: notice `Preset "A5 print" is invalid: <its
    error with line>` (the store's message); the active preset stays as it
    was;
  - the menu is closed and opened again after `Book` was created: `Book` is in
    the list.

- **AC-6 (file explorer menu):** Right-clicking a Markdown note (extension
  `md`, any case) in the file explorer adds, in one section, `Export to PDF`
  (icon `file-output`) and `Preview` (icon `panel-right`). Not added for: a
  folder (also one named `Archive.md`; added at TICKET-056), a non-Markdown file (`cover.png`), a note in the presets folder
  (`Obsidian2Typst/presets/A5 print.md`), a selection of several files
  (`files-menu`; decided 2026-10-21: exporting several notes is a feature of
  its own).

- **AC-7 (editor menu):** Right-clicking in the editor of a Markdown note adds
  the same two items for the note of that editor (`info.file`), under the same
  rules as AC-6 (none in a preset note). In a split view the items act on the
  pane that was clicked, not on the active one.

- **AC-8 (preview a note):** `Preview` first makes the clicked note the active
  note (decided 2026-10-21): from the file explorer it opens the note as a
  click on it in the file explorer does; from the editor menu it activates
  that editor's pane. Then it shows the style panel (opened in the right
  sidebar if it is closed, revealed if it is open), which shows the note
  because it follows the active note (US-012 AC-4, one rule). US-012 AC-4
  decides when it compiles (confirmed by the user after M10, 2026-10-21):
  - the panel was closed: it opens with the note and compiles it at once;
  - the panel already shows another note: it shows the new name, the hint
    `Note changed; press Refresh` and the old pages greyed; `Refresh`
    compiles the note.
  Example: `Rules.md` is active and the panel shows it; right-click
  `Glossary.md` in the file explorer, `Preview`: `Glossary.md` is open in the
  editor, the panel reads `Preview of: Glossary` with `Note changed; press
  Refresh` over the greyed pages of `Rules`; `Refresh` draws `Glossary`.
  (The first version of this example said "the panel shows `Glossary.md`"
  and was not checked against US-012 AC-4; M10 found it.) `Open style
  panel` (command, ribbon) keeps today's behaviour: the panel follows the last
  active note (US-012 AC-4). With no room for the panel: notice `There is no
  room for the panel in the right sidebar`, as today.

- **AC-9 (the commands stay):** The three commands keep their ids
  (`open-style-panel`, `export-current-note`, `check-compiler`) and names, so
  existing hotkeys work. `Check compiler (developer)` gets no menu item.

- **AC-10 (manual check):** In Obsidian, with a test build: the ribbon icon
  and its menu as in AC-3 (with an invalid preset in the list), choosing a
  preset while the settings tab and the panel are open (both show it at once,
  without closing them), the file explorer and editor menus on a note, a
  preset note, an image and a folder (AC-6, AC-7), exporting a note that is
  not the active one (AC-2 example; the PDF holds that note's text), `Preview`
  of a note, a second export started while one runs, and the keyboard
  navigation Obsidian gives every menu (arrow keys, Enter, Escape). The check
  ends with the open question (SCAR-015).

---

## Decisions (answered 2026-10-21)

1. **Presets in the ribbon menu.** *Decided: inline list.* There is no public submenu. Proposed: the
   presets listed inline under a `Preset` label (AC-3), all of them; story 2
   replaces the list by its picker when presets are grouped. Alternative: only
   the active preset shown, with an item `Choose preset…` that opens the
   settings tab.
2. **`Preview` of a note that is not the active one.** *Decided: open it
   first.* The panel follows the
   last active note (decided 2026-10-18). Proposed: `Preview` opens the clicked
   note in the editor (it becomes the active note) and shows the panel, so the
   rule stays one rule. Alternative: the panel shows the clicked note without
   opening it, until the active note changes again.
3. **Several selected files** (`files-menu`): *Decided: no items.* Proposed none in this story
   (export of several notes is a feature of its own). Alternative: `Export to
   PDF` for each selected note, one after another, with one folder question.

---

## Notes

- New controls (SCAR-013 to 017): the ribbon icon and menu items are not
  dialogs with fields (Obsidian's menus give arrow keys, Enter and Escape);
  the export's folder question is today's. Worst misplaced click: choosing a
  preset (AC-4, undo by choosing the old one); `Export to PDF` on the wrong
  note asks for the folder first, where it can be cancelled.
- SCAR-019: the preset list at 0, 1 and several presets, with an invalid one
  and with the stored active preset missing (`pickActive` then takes the
  first name in settings order, valid or not; read from
  `src/core/presets/names.ts`).
- Icon names (`printer`, `file-output`, `panel-right`) are Lucide names;
  `IconName` is only `string` in the types, so a wrong name is not a compile
  error and shows no icon. The manual check looks at each icon (SCAR-008:
  blank output is our bug until proven).
- Out of this story: grouping and a detail pop-up (story 2), heading and image
  menus (story 3), exporting several notes.

---

## Related tickets

- [TICKET-055](../tickets/TICKET-055-actions-module.md) — the actions
  (AC-1, AC-2, AC-4, AC-5, AC-8, AC-9 commands).
- [TICKET-056](../tickets/TICKET-056-ribbon-and-note-menus.md) — the ribbon
  and note menus (AC-3, AC-5 menu, AC-6, AC-7, AC-9 ribbon).
- [TICKET-057](../tickets/TICKET-057-menus-build-and-m10.md) — test build
  `0.6.0-m10.1`, manual check M10 (AC-10).
