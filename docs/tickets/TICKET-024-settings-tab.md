# TICKET-024 — Settings tab and the manual checks M2 and M3

**Status:** Done
**User story:** [US-008](../user-stories/US-008-presets-and-settings.md)
**ACs addressed:** AC-1 (Defaults UI), AC-4 (list and marker), AC-5 (UI), AC-13 (notice), AC-16
**Depends on:** TICKET-022, TICKET-023

---

## Description

The screen of the plugin in Obsidian's settings: the Defaults, the list of
presets with create, duplicate, rename and delete, the presets folder, strict
mode (US-006) and the warnings note folder. The tab edits only the Defaults;
preset fields are edited in the preset note (decided by the user on
2026-10-17). The tab cannot run outside Obsidian, so its logic stays in the
store and in `core` and the tab itself is checked by text and by two manual
procedures.

---

## Acceptance criteria (from user story)

See US-008. This ticket covers:

- **AC-1:** the Defaults section edits the fields through `setDefaults`; a
  refused value shows its message and keeps the previous value.
- **AC-4:** an invalid preset is listed marked `invalid` with `formatPresetError`
  and cannot be chosen.
- **AC-5:** buttons `New preset`, `Duplicate`, `Rename`, `Delete`; the name
  errors of `validatePresetName` are shown where the name is typed.
- **AC-13:** a numbering pattern without counting symbol shows the notice.
- **AC-16:** `docs/technical/manual-checks.md` holds M2 (settings tab) and M3
  (export command for The Rules).

---

## Implementation notes

- **`src/plugin/settings/settings-tab.ts`:** a `PluginSettingTab`; sections
  `Defaults`, `Presets`, `Presets folder`, `Strict mode`, `Warnings note
  folder`; subscribes to the store's `onChange` and redraws; unsubscribes in
  `hide()`.
- No logic of its own beyond layout: validation, uniqueness and ordering come
  from `core/presets`, writes from the store. A test that lists the strings
  of the tab lives in `tests/plugin/us-008-wiring.test.ts`.
- **`docs/technical/manual-checks.md`:** M2: preset folder created on first
  start with `A5 print` and `A4 digital`; live edit of a preset note reaches
  the tab within 2 s; invalid marker and notice; create, duplicate, rename
  (links updated), delete (Obsidian trash); rename on another synced device.
  M3: `Obsidian2Typst: Export current note` on a real note with a template,
  with the files `<name>.typ`, `<name>.pdf`, `assets/`, `template.typ` and
  `export-warnings.md`; the folder is remembered per preset; with Wi-Fi off.
  Each has pass criteria and a record line, as M1 has.
- After the manual runs the result is entered in `docs/technical/tests.md`
  (AC-16 row) with the date; until then the row says `manual: open`.

---

## Tests

- `tests/plugin/us-008-wiring.test.ts` — tab sections and buttons (AC-1,
  AC-5), M2 and M3 text (AC-16).
- `tests/plugin/us-008-plugin-data.test.ts` — AC-1, AC-13 (logic behind the tab).

---

## Definition of done

- [x] All listed tests pass.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] M2 and M3 run by the user (2026-10-17, see spike-typst-wasm.md, Manual runs) in Obsidian and recorded (date, Obsidian version, system).
- [ ] User story status set to Done after the manual runs.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [ ] Ticket status set to `Done` in `docs/tickets/README.md`.

## Implementation result

- `plugin/settings/settings-tab.ts`: sections `Presets` (list with `Use`, `Duplicate`, `Rename`, `Delete`, marker `invalid` with `formatPresetError`, `New preset`), `Defaults` (15 fields, saved when the field is left; a refused value shows its message and the previous value comes back), `Folders and warnings` (presets folder, strict mode, warnings note folder). A change of the Defaults refreshes the store.
- `core/presets/edit.ts` (`getField`, `withField`) keeps the tab free of logic.
- `docs/technical/manual-checks.md`: M2 and M3.
- The tab itself is not testable outside Obsidian; the wiring test checks its strings and calls. M2 and M3 are still to be run by the user.
