# TICKET-040 — Style panel view, shared rows module, command, manual check M2 step 15

**Status:** Done (2026-10-18)
**User story:** [US-012](../user-stories/US-012-style-preview-panel.md)
**ACs addressed:** AC-1, AC-2, AC-3, AC-5 (no edit listener), AC-14, AC-15; manual: AC-7, AC-13 (pixels)
**Depends on:** TICKET-037, TICKET-038, TICKET-039
**SCARs:** SCAR-017 (rows built once), SCAR-016 (events, click-time reads, tab stays open), SCAR-014 (same confirmations), SCAR-013, SCAR-012 (installed build, unique version), SCAR-015 (content stated), SCAR-001

---

## Description

The visible part: the view, the command, and the refactor that gives the Settings
tab and the panel one set of row functions.

---

## Implementation notes

- **Refactor first, no change in behavior:** `plugin/settings/rows.ts` takes `DEFAULT_ROWS`, `addTrimDropdown`, `addTrimSizeRow`, `addResetButton`, the gutter rule and a function `saveDefaultsField(deps, path, value)` (the body of the old `save` closure: `withField`, `setDefaults`, notices, `presets.refresh()`) out of `settings-tab.ts`. The Settings tab imports them; M2 steps 1 to 14 stay valid. The rows take a `{owner}` option (AC-2): a value owned by the preset is disabled with the text of `ownerNote`.
- `plugin/preview/open.ts`: `VIEW_TYPE_STYLE_PANEL`, `openStylePanel(workspace)` (one view, right sidebar), `presetChoices(entries, active)`.
- `plugin/preview/panel.ts`: the `ItemView` (`presetSelector`, `pageRows`, `fontRows`, `coverRows`, `rangeField` through `commitOnChange`, `Refresh`, `statusLine`, `previewArea`); listens to `settings.onChange`, `presets.onChange`, `rename`, `delete`, `active-leaf-change` (last Markdown note) and removes them in `onClose`; no `modify` or `editor-change` listener; every change calls `controller.styleChanged()`; `captureScroll` around redraws; pages from `planCanvases` with an `IntersectionObserver`-free scroll handler on the preview area. Export start and end call `exportStarted` and `exportFinished` (in `main.ts`, around `exportNote`).
- `main.ts`: `registerView`, command `open-style-panel` named `Open style panel`.
- An owned row (AC-2) gets no reset icon; `main.ts` builds the font list with `compileFonts` for the export and the preview, and calls `exportStarted`/`exportFinished` around an export.
- **Handover (SCAR-012):** build `0.1.0-m6.<n>` installed in the scratch vault and compared by checksum; `data.json` reset; fixtures in place: the reference note, a small note with a cover image, a short note of 6 pages, the presets `A5 print`, `A4 digital`, `Slug 5` (bleed 5) and `Broken` (invalid); the check says where it runs and that the panel is opened once and stays open.
- **Manual check M2 step 15** (written at the handover with the build version, SCAR-012, SCAR-013, SCAR-015, SCAR-016): the panel stays open throughout; expected content is stated for each step (page 3 of the reference drawn with text and images, 6.9 % non-white at A5; trim A5 to A4 changes the shape and the page count; page range `3-5` shows exactly three pages; `5-3` shows the message and keeps the range; a preset-owned value is disabled with its description; a change in the Settings tab appears in the panel; an invalid preset note shows the error and greys the pages; an export during a preview ends the preview; the vault and the export folder gain no file; keyboard only: type `3-5` in the range field and press Enter; the console shows `[o2t preview]` lines). The step names the known limits (preview images are softer than the export), asks for the content of page 1 (cover image) and page 3, and **ends with the open question** of SCAR-015: is anything missing, odd or ugly that the list did not ask about.

---

## Tests

`tests/plugin/us-012-panel.test.ts` (text checks and helpers) and the existing
tests that read `settings-tab.ts` as text: `us-008-reset-confirmation`,
`us-008-scroll`, `us-008-text-commit`, `us-008-wiring` and
`us-009-settings-page`. After the refactor each of them reads the tab, `rows.ts`
and `panel.ts` together (one helper `tests/support/settings-source.ts`), so that
a class check covers the moved code and a new instance in `rows.ts` or
`panel.ts` fails them (SCAR-017). Their expectations are not weakened; list in
this ticket which assertion moved to which file. Mutation checks: a text field with `addText` in `panel.ts`, a
second `DEFAULT_ROWS`, a `modify` listener, a kept `settings.data` value.

---

## SCAR check (2026-10-18, item by item against the Prevention lists)

- **SCAR-017:** one rows module; class checks over tab + rows + panel (see Tests); the same-defect list for the handover: any text field, reset icon, scroll keeping or dropdown that the panel shows.
- **SCAR-016:** events from the settings and the presets, click-time reads (`saveDefaultsField`, `addResetButton`), manual step on the open panel.
- **SCAR-014:** worst misplaced click: reset icon and trim dropdown keep their questions; an owned row has no reset icon (AC-2); Refresh and the range change nothing saved.
- **SCAR-013:** no dialog with a field is added; the range field is checked with the keyboard only.
- **SCAR-012, SCAR-015:** handover and the content of the check above.
- **SCAR-001:** the shared functions (`commitOnChange`, `captureScroll`, `ConfirmModal`, `planTrimChoice`) get a new call site; their transforms are documented in their files; the same tests run over the moved code.
- **SCAR-008:** no canvas outside the helper (text check). SCAR-002, SCAR-003, SCAR-007: story ACs with numbers, composed cases, register rows. SCAR-009 to SCAR-011: not affected.

---

## Definition of done

- [x] Panel tests green; the older tests read the three files; gate green: typecheck, lint, build, `npm test` 1422 passed, integration 236 passed (SCAR-006)
- [x] Manual check M2 step 15 written, installed build compared (`0.1.0-m6.1`, sha256 `3cf9db45…`), passed by the user (2026-10-18)
- [x] US-012 set to Done; rows of `docs/technical/tests.md` set to ✅

## Result (2026-10-18)

New: `settings/rows.ts` (all row functions, `ConfirmModal`, preset dropdown, range input), `settings/save-field.ts`, `preview/open.ts`, `preview/panel.ts`, `styles.css`, wiring in `main.ts` (view, command, `compilePreview`, export announce, dispose), `tests/support/settings-source.ts`, `tests/support/fake-obsidian.ts`; tests `us-012-rows`, `us-012-panel-behavior`; the installer copies `styles.css`. 

**Assertions that moved (not weakened):** `us-008-reset-confirmation` (`this.addResetButton(` → `addResetButton(env,`), `us-008-scroll` (`this.fillFonts(holder).finally` → `addFontRows(holder, this.rowsEnv()).finally`), `us-009-settings-page` (`this.display()` after Facing pages → `env.redraw()`; `t.setDisabled(!enabled)` → `…|| owner !== null`; `this.customTrim` → `env.trim.custom`; `t.setDisabled(!custom)` → `…|| owner !== null`); `us-008-text-commit`, `us-008-wiring`, `us-008-reset-confirmation`, `us-008-scroll`, `us-009-settings-page` read tab + rows + panel through `settingsSource()`. Own tests changed: the panel test imports `saveDefaultsField` from `save-field.ts` (rows imports Obsidian), its "same function" check reads the rows, the `compileFonts` check reads `main.ts` and `request.ts` once each.

**Differences from the ticket text:** (1) The Cover group shows values as text only: the Defaults hold no cover (US-011, user decision 2026-10-17), so there is nothing a panel row could save; AC-2 says the Cover rows have the labels of the same rows of the Settings tab, and the tab has none. (2) `exportStarted`/`exportFinished` wrap the `run` of the export (the compile), not the whole command, so cancelling the folder dialog does not stop the preview. (3) `Minimal` and `Bleed 5` presets were added to the fixtures because the built-in presets set every page field (all rows owned). (4) Mutants: 33 (rows and owner rules, panel listeners, drawing, close, wiring); one equivalent mutant (a second guard against painting while greyed) led to removing the duplicate.
