# US-042 — The UI standard: an export dialog, exports at once, a progress tab and debug info

**Status:** Draft (G1 2026-11-17; P1 to P7 decided; M32 done, accepted as is; **G2 2026-11-17: tests written, red by design, proven on a reference; G3 2026-11-17: tickets #175 to #181**)
**Introduced:** 0.16.0 (planned, P7)
**Tickets:** #175 (T1 the run: progress, cancel, notices), #176 (T2 the export dialog), #177 (T3 direct exports and
entries), #178 (T4 the progress tab), #179 (T5 debug info and section reset), #180 (T6 the string table), #181 (T7 test
build and manual check M33), in this order (G3, 2026-11-17)
**Follows:** the preferred UI standard of Obsidian Knowledge (`ui-standard.md`), the owner's decisions of
2026-11-17 in the control project's alignment note (D1 to D10 for all plugins; O2T-1 to O2T-6 for this one):
an export dialog beside the direct actions (D2, O2T-3), the ribbon menu kept with `Export…` first (D6), a
progress tab that opens only when a run is still going after about 2 s (D3, O2T-6, measured in
`docs/technical/spike-export-time.md`), `Copy debug info` (D7), ✅ / ❌ notices (D8), a reset per settings
section (O2T-4), re-exporting without a question as an allowed variant (O2T-2). F1 (O2T-1) was fixed
before this story, in 0.15.3 (#174).
**Amends:** US-008 AC-15 (the export asks for the folder), US-020 AC-3 (the ribbon menu), US-006 AC-3 (the
notice after an export), US-029 AC-1 (the tab's first line); the exact criteria are named at G2.

**As** an author who exports the same book again and again, **I want** an export to go straight into the
folder I chose last time, a dialog when I want to choose the preset or the folder, and to see how far a
long export has come, **so that** Obsidian2Typst works like the other plugins I use for the book, and a
long export does not look like a hang.

Reader of the output: the author at a keyboard, desktop only, English. All examples use invented names and
the synthetic sample book (SCAR-035).

---

## What exists today (0.15.3) and what users rely on (SCAR-027)

- **Starting an export:** the command `Export current note`; the ribbon icon `Obsidian2Typst` (`printer`)
  opens a menu: `Export current note`, `Open style panel`, then the presets (grouped, the active one
  checked, a click makes it active; US-020 AC-3, US-021 AC-5); the file explorer's and the editor's menus
  of a Markdown note: `Export to PDF` and `Preview` (US-020 AC-6, AC-7). Every export takes the **active
  preset** and then **asks for the folder in the system's folder dialog**, starting at the folder last used
  with that preset (`lastExportFolders`, US-008 AC-15).
- **Re-export:** an export writes `<note>.typ`, `<note>.pdf`, `export-warnings.md`, the template, the
  assets (and with the encounter sheet `<note> - Encounter Sheet.typ` / `.pdf`) into the folder, replacing
  them without a question. Users re-export into the same folder all the time (O2T-2: kept).
- **While it runs:** the notices `Compiling…` and `Compiling… (n of up to N)` (US-028); one export at a
  time (`An export is already running`). **After it:** with warnings `Exported with 3 warnings. Report:
  <folder>/export-warnings.md`; without warnings **no notice at all**; strict mode `Export aborted: …`;
  a failure `Export failed: <message>`.
- **Settings tab:** the line `Obsidian2Typst <version>`, then collapsible sections *Presets*, *Page*,
  *Text*, *Book*, *Export* with feature rows and gear modals (US-029), field reset icons (US-008 AC-18,
  US-010 AC-6). The style panel (US-012, US-029 AC-8) is the plugin's own side panel.
- Kept unchanged by this story: the style panel, the preview, the presets and their notes, every output
  file and its content, the warnings report and the vault's warnings note, strict mode, the one-export
  lock, the field reset icons, commit on Enter or blur, `Check compiler (developer)`.

## Acceptance criteria

- **AC-1 (direct exports go at once, O2T-3).** `Export current note` (command and ribbon menu) and the note
  menus' `Export to PDF` export into the active preset's remembered folder **without a dialog**. When the
  active preset has no remembered folder, they open the export dialog (AC-3) instead. Example: preset `A5
  print` with the remembered folder `/out/a5`: `Export to PDF` on `Sample/Book.md` writes `/out/a5/Book.pdf`
  and opens nothing; with the preset `Proof` never used, the dialog opens with an empty folder field.
- **AC-2 (new entries, D6).** A command `Export…` and, as the **first** item of the ribbon menu, `Export…`
  (icon `file-output`): both open the export dialog for the active note; with no open note the notice
  `Open a note to export it.` The rest of the ribbon menu stays as it is, in its order, below `Export…`.
  The note menus stay as they are (P2).
- **AC-3 (the export dialog).** A modal titled `Export <note name>` holds, top to bottom:
  1. **the preset** as a heading row with a dropdown of the valid presets (grouped as in the ribbon
     menu), the active one chosen; invalid presets are not offered;
  2. **the destination row:** a full-width folder field, `Choose folder…` (the system dialog, as today;
     the field works without it), and the button `Export` at the end of the row; under it a red line with
     the reason when the folder is refused (AC-4) and a grey line saying what is there (AC-5);
  3. a row `More options` with a gear that opens the plugin's settings tab.
  Choosing another preset puts that preset's remembered folder into the field (empty when it has none),
  at once. `Export` is disabled while the folder is refused.
- **AC-4 (the folder is checked before anything is written, SCAR-033).** A folder is accepted when it is an
  absolute path of the system (`/out/a5`; on Windows `C:\out\a5`); a missing folder is created by the
  export as today. Refused, with its red line: empty (`Choose an export folder.`); relative (`Export folder
  "out/a5" is not an absolute path.`). Paths are compared by segments.
- **AC-5 (what is at the destination).** The grey line names the PDF the run writes: `Book.pdf will be
  written.` or `Book.pdf exists (from 2026-11-17 14:02) and will be replaced.` (the file's modification
  time, local, `YYYY-MM-DD HH:MM`). It is made again on every change of the folder or the preset (SCAR-016).
  No question follows (O2T-2): replacing the plugin's own output is the normal loop.
- **AC-6 (when values are saved).** The folder and the preset chosen in the dialog are saved **when
  `Export` runs**: the folder as that preset's remembered folder, the preset as the active preset (P1).
  Enter runs when `Export` is enabled; Escape, the X and a click outside close the dialog and save nothing
  (SCAR-013, SCAR-016). Enter while an input method composes text does nothing.
- **AC-7 (the progress tab, D3, O2T-6).** Every export starts without a tab. If it is still running
  **2 s** after it started, a tab `Exporting <note name>` opens beside the user's tabs without taking the
  focus (M32). It shows: the current step as its heading (`Converting`, `Compiling`, `Compiling (2 of up
  to 8)`, `Writing files`, `Checking word gaps`, `Compiling the encounter sheet`), a `<progress>` bar
  without a value while the length is unknown, and a `Cancel` button. A run that ends before 2 s opens no
  tab. Example: a one-page note (about 0.1 s) ends with its notice only; the 301-page sample book (over
  2.9 s, measured) opens the tab.
- **AC-8 (warnings in the tab).** When the tab is open, each warning appears in a list under the bar as
  soon as it is known (the conversion's after converting, the compile's after compiling): its code in
  bold, the message, the note line, with a left border in Obsidian's yellow; the list scrolls to the new
  entry. The report file and the vault's warnings note are written as today.
- **AC-9 (cancel).** `Cancel` stops the run at once: a running compile is ended (its worker is stopped, as
  the preview does, US-012 AC-8); no PDF is written; files written before the cancel stay (P4). The notice
  `❌ Export cancelled.`; the button becomes `Close`, the tab and its warnings stay until closed.
- **AC-10 (end of a run).** In the tab, the heading becomes `Exported` (or `Export failed`, `Export
  cancelled`, `Export aborted (strict mode)`) and `Cancel` becomes `Close`. The tab stays until the user
  closes it; the next export that opens a tab reuses it (P5). The plugin does not resize or move windows.
- **AC-11 (notices, D8).** Finished: `✅ Exported Book.pdf to /out/a5` and, with warnings, `, 3 warnings
  (see export-warnings.md)`; singular `1 warning`. Cancelled: `❌ Export cancelled.` Failed: `❌ Export
  failed: <message>` (the compile's error and an exception alike). Strict mode: `❌ Export aborted: 3
  warnings (strict mode)` followed by the first five, as today. Refusals before a run keep their texts and
  end with a full stop. Notices last 5 s; the `Compiling…` notices give way to the tab's heading (they are
  not shown).
- **AC-12 (settings tab: header and debug info, D7).** The first line keeps `Obsidian2Typst <version>`
  and gains, at its right, a `Copy debug info` button (bug icon), which copies as plain text: the
  plugin's version, Obsidian's version (`apiVersion`), the list of enabled plugins with their versions
  sorted by id, and the settings file's content, then shows `Debug info copied.` Nothing is sent anywhere.
  No heading with the plugin's name.
- **AC-13 (reset per section, O2T-4).** *Page*, *Text* and *Book* each end with `Reset this section to
  defaults` behind the confirmation (`Cancel` first, US-008 AC-18 as amended by #174): `Reset "Page" to its
  defaults?` / `Your values in this section will be removed; presets that do not set them use the built-in
  values.` It removes exactly the Defaults values of that section's rows (the same removal as each row's
  icon) and nothing else; *Presets* and *Export* have none (P3). Example: with `Bleed (mm)` 5 and `Contents
  depth` 2 in the Defaults, resetting *Page* removes the bleed and keeps the contents depth (*Book*).
- **AC-14 (one string table).** Every user-facing text of the dialog, the tab, the progress tab and the
  notices comes from one module `src/plugin/strings.ts`, including the core's texts handed to notices; a
  text check finds no other string literal passed to `setName`, `setDesc`, `setButtonText`, `setTooltip`,
  `setText` or a notice in `src/plugin` (SCAR-017). *Amended 2026-11-18 (owner, at T6: "widen T6 now",
  "screens + notices"):* the check also reads `setTitle`, `setPlaceholder`, the ribbon icon's title and the
  shown fields (`title`, `text`, `label`, `name`, `desc`, `hint`, `confirmLabel`, `cancelLabel`, a
  question's `lines`, a feature's `rows`); and a second check finds no sentence-like literal in
  `src/plugin` outside the table but a named list of exemptions, each with its reason (programming faults,
  console diagnostics, the developer command, the debug info's format, key names, a type tag, the default
  folder). The statblock and details processors draw the book's content and are not read. *Amended
  2026-11-18 (owner, "notices only, own core table"):* the core's texts that become notices (the export's
  ✅/❌ notices and the strict-mode abort in `core/report`, the compile notices and the compile error, the
  heading-numbering notice) come from `src/core/strings.ts`, which imports nothing and which the plugin's
  table carries as `STRINGS.core`; preset validation messages and conversion warnings stay with the core
  code that finds them.
- **AC-15 (checked in Obsidian).** A manual check on the scratch vault with the tab and the dialog that
  stay open: every entry point (command, ribbon, both note menus, with and without a remembered folder),
  the dialog's keys (Enter, Escape, IME not checked unless an IME is at hand), the red and grey lines while
  typing, a preset change, the progress tab on the sample book and none on a short note, Cancel during the
  compile, every notice, debug info, the section reset (SCAR-012, SCAR-015, SCAR-018, SCAR-045).

## Decisions (P1 to P7; proposed at G1, accepted by the owner 2026-11-17: "go for the proposals")

- **P1:** the preset chosen in the dialog becomes the **active** preset when `Export` runs (as choosing it
  in the ribbon menu does); Cancel changes nothing. *Alternative:* the dialog's preset applies to that
  export only.
- **P2:** the note menus keep their two items (`Export to PDF` at once, `Preview`); the dialog is reached by
  the ribbon menu and the command. *Alternative:* a third item `Export…` in the note menus.
- **P3:** section resets for *Page*, *Text* and *Book* only (the Defaults); *Presets* has no defaults, and
  *Export* holds the strict-mode switch and two folders (user places, like Game Card Creator's output
  folder, which is never reset).
- **P4:** Cancel keeps the files written before it (the `.typ`, the assets, the template are written before
  the compile, so a failed compile leaves the `.typ` to look at — users rely on that); only the PDF is not
  written. *Alternative:* write every file only after a successful compile (changes today's failed-compile
  behaviour).
- **P5:** the progress tab stays after the run until the user closes it, and the next export reuses it.
  *Alternative:* it closes by itself after a finished run without warnings.
- **P6:** no progress bar on the dock or taskbar (`setProgressBar` is Electron's, not Obsidian's API, and
  not measured); recorded as a difference from the standard.
- **P7:** released as **0.16.0** (new features; settings files of 0.15.x work unchanged).

## Measurements to make before G2 (M32; decision rules written before the run, SCAR-024, SCAR-032)

- **M32-A, a tab during an export:** a spike build opens an own view in a new tab (`getLeaf('tab')`,
  `setViewState` with `active: false`) 2 s into a sample-book export and updates its heading per step.
  The rule: AC-7 stands if the tab opens **without taking the focus** from the note and its heading
  changes at least once **while the compile runs** (the compile is in a worker; the conversion is on the
  main thread). Otherwise AC-7 is rewritten before G2.
- **M32-B, the whole export in Obsidian** on the test machine (M1 MacBook, Obsidian 1.15.0), from the
  click to the end, for the sample book and a one-page note, logged by the spike build. Recorded as
  numbers; it confirms (or not) that the 2 s line separates the two.
- **Measured (M32, 2026-11-17):** the tab is drawn at once in the background and ticks through the compile; whole
  exports in Obsidian: the sample book 12.8 s and 12.5 s, a short note 0.38 s. Two findings accepted as is by the
  owner: a 2.1–2.2 s pause of Obsidian after the compile, and the new tab counted as the most recent leaf while the
  note stays in front.
- Taken as measured elsewhere, on the same Obsidian 1.15.0: the system folder dialog from a modal and
  `app.setting.openTabById` (Game Card Creator M11, M12); Obsidian's first-focus in a modal (M31).

## Interface used by the tests (G2, 2026-11-17)

Pure modules (no Obsidian import, SCAR-031); the drawn screens and `main.ts` only call them:

- `src/plugin/export-dialog/rules.ts` (AC-3 to AC-6): `dialogTitle(noteName)` → `Export <note>`;
  `checkExportFolder(text, path: {isAbsolute(p): boolean})` → `{ok: true, folder}` (the text without surrounding
  spaces and without trailing separators, a root kept as it is) or `{ok: false, message}` (`Choose an export
  folder.`; `Export folder "<text>" is not an absolute path.`); `destinationLine(pdfName, modified: Date | null)`
  (local time, `YYYY-MM-DD HH:MM`); `presetChoices(entries)` → `{heading, names}[]`, the valid presets grouped as
  `groupPresets` groups them, groups without a valid preset left out; `folderOf(lastExportFolders, preset)` (`''`
  when none); `exportDialogKey({key, isComposing, keyCode}, enabled)` → `'run' | 'cancel' | 'none'`;
  `saveExportChoices(settings, {preset, folder})` (the folder as that preset's, then the preset as the active one
  when it is another; nothing else).
- `src/plugin/export-dialog/dialog.ts` (AC-3, AC-5, AC-6): `ExportDialog` (a `Modal`), built with `{noteName,
  presets, activePreset, lastExportFolders, pathApi, modifiedAt(path): Promise<Date | null>, chooseFolder(initial):
  Promise<string | null>, openSettings(): void, join(folder, name): string}`; `choose()` opens it and resolves once
  with `{preset, folder}` (Export) or `null` (closed any other way). Drawn in `onOpen`: the title, a heading row with
  the preset dropdown, the destination row (text field, `Choose folder…`, `Export`), the red line
  (`o2t-export-error`) and the grey line (`o2t-export-info`), the row `More options` with a `settings` gear.
- `src/plugin/export-command.ts` (AC-1, AC-2, AC-6, AC-11): `ExportCommandDeps.chooseFolder` gives way to
  `exportDialog({noteName, preset}): Promise<{preset, folder} | null>`, and `settings` gains `update`;
  `exportNoteAt(deps, path)` exports at once into `lastExportFolders[active]` and opens the dialog only when it has
  none; the new `exportNoteWithDialog(deps, path)` always opens it; a dialog closed without Export ends the command
  with `cancelled` and no notice; the choice is saved (`saveExportChoices`) before converting.
  `startProgress(noteName)` (optional dep) is called once the folder is known; its `step({kind: 'convert'})` comes
  first, the progress goes to the run in `ExportRequest.progress`, and the command ends it (`end`) with the run's end
  (`endOf`); a conversion that fails ends it as `failed`.
- `src/plugin/actions.ts`, `src/plugin/menus.ts` (AC-2): `Actions.exportWithDialog(path?)`; `ribbonMenuEntries`
  starts with `{title: 'Export…', icon: 'file-output'}` calling it; the note menus unchanged; `main.ts` registers
  the command `export-dialog` (`Export…`).
- `src/core/export-progress.ts` (AC-7 to AC-10): `ExportStep` (`convert`, `compile` with `n` and `limit`, `write`,
  `gaps`, `sheet`); `stepHeading(step)`; `ExportEnd` (`exported`, `failed`, `cancelled`, `aborted`), `endHeading(end)`
  and `endOf(status)`; `ProgressState {title, heading, warnings, running}`; `createExportProgress({noteName, delayMs,
  timers: {set, clear}, openTab(cancel): {show(state)}})` → `ExportProgress {step, warnings, end, cancel, cancelled,
  onCancel(listener)}`: the tab is opened once, by the timer, only while the run has not ended; every later change
  is shown at once.
- `src/plugin/progress/draw.ts` (AC-7 to AC-10): `drawProgress(root, state, {cancel, close})`: the heading
  (`o2t-progress-heading`), while running a `progress` element without a `value` (`o2t-progress-bar`), the warnings
  (`o2t-progress-warnings`, one `o2t-progress-warning` each: the code in `strong`, the message, `line <n>`), the
  button `Cancel` (running) or `Close` (ended).
- `src/plugin/run-export.ts` (AC-8, AC-9, AC-11): `RunExportOptions.progress?`; each compile is a step (no
  `Compiling…` notice any more), then `write`, `sheet`, `gaps`; the conversion's warnings at the start, the run's
  after it; on cancel the running compile is ended (`compiler.dispose()`), nothing more is written, the status is
  `cancelled` and the notice `❌ Export cancelled.`; a failed compile's notice `❌ Export failed: <error>`; the busy
  refusal `An export is already running.`
- `src/core/report/index.ts` (AC-11): `finishedNotice({pdf, folder, warnings})`; `strictNotice` begins `❌ Export
  aborted: …`; `failedNotice(message)`; `CANCELLED_NOTICE`. `finishExport` gives the finished notice after every
  export that wrote its PDF, with or without warnings (`FinishExportOptions.pdfName`).
- `src/plugin/debug-info.ts` (AC-12): `debugInfo({pluginVersion, obsidianVersion, settingsText, plugins})` → the
  lines `Obsidian2Typst <v>`, `Obsidian <v>`, `Enabled plugins:`, `- <id> <version>` sorted by id, `Settings file:`,
  the file's text or `(no settings file)`, ending with a line break. `SettingsTabDeps.copyDebugInfo()`; the tab's
  first line holds the version text and a button (`bug`, tooltip `Copy debug info`).
- `src/plugin/settings/section-reset.ts` (AC-13): `RESETTABLE_SECTIONS` (`Page`, `Text`, `Book`);
  `sectionResetPaths(name)` (the Defaults paths of the section's rows and toggles); `withoutPaths(fields, paths)` (a
  copy without those keys; an object left empty is removed); `resetSectionQuestion(name)`; `resetSection({settings,
  confirm}, name)` (asks, then `setDefaults` once; `false` without a change on Cancel or with nothing to remove).
  The tab ends each of those sections with the row `Reset this section to defaults`.
- `src/plugin/strings.ts` (AC-14): the texts, in groups by screen; the row labels (`labels`) are also the keys
  the layout and the details table find the rows by. A tooling test (`us-042-string-table`) reads `src/plugin`.

## Not covered

- An overwrite question (O2T-2: re-export replaces the plugin's own files, an allowed variant of the
  standard, recorded in Obsidian Knowledge).
- A selection tree (D5: an export is one note), an update banner, maintenance actions.
- The Vault Compiler: its own story (D10 order).
