# TICKET-060 — The details pop-up of a preset

**Status:** Done (2026-10-21)
**User story:** [US-021](../user-stories/US-021-preset-groups-and-details.md)
**ACs addressed:** AC-4 (the `Details` button), AC-6, AC-7, AC-8, AC-9 (the pop-up), AC-10
**Depends on:** TICKET-058, TICKET-059
**SCARs:** SCAR-001, SCAR-002, SCAR-013, SCAR-014, SCAR-016, SCAR-017, SCAR-018, SCAR-019

---

## Description

The pop-up as a model (its table and buttons, built from the store at each
draw) and an Obsidian `Modal` that draws it and redraws while open; opened by
`Details` in the settings tab and by the `info` button beside the panel's
dropdown.

---

## Acceptance criteria (from user story)

- **AC-6:** title `Preset "<name>"`; columns `Setting`, `In this preset`,
  `Used` with `(preset)`, `(Defaults)`, `(built-in)`; rows of `DEFAULT_ROWS`
  and `FONT_ROWS`, then `Cover`, `Callout styles`, `Heading rules`; values
  as text; an invalid preset shows its error.
- **AC-7:** `Use`, `Open the note`, `Close` (focus); Escape closes; `Use`
  stays open as `In use`, disabled for the active and an invalid preset;
  `Open the note` opens the note and closes.
- **AC-8:** from `Details` (right after `Use`) and from the panel's `info`
  button, which reads the active preset at the click.
- **AC-9:** an open pop-up redraws on `presets.onChange`; a vanished preset
  shows `Preset "<name>" does not exist` and only `Close`.

---

## Implementation notes

- New `src/plugin/settings/details.ts` (no Obsidian import): `detailRows(fields,
  defaults)` — the label and path of every row of `DEFAULT_ROWS` and
  `FONT_ROWS`. `rows.ts` imports Obsidian (checked at G3), so the row data
  (`DEFAULT_ROWS`, `FONT_ROWS` and their types) moves into a new
  Obsidian-free `src/plugin/settings/row-data.ts`; `rows.ts` re-exports them,
  so every existing import stays; own value by
  `valueAt`; used value and source by the rule of `owner.ts` plus the
  built-ins (`BUILTIN_DEFAULTS`, `DEFAULT_FONTS`); text by the AC-6 rule;
  the three summaries. `detailsView(deps, name)` reads `presets.get(name)`
  and `settings.data` at each call.
- New `src/plugin/settings/details-modal.ts`: `PresetDetailsModal extends
  Modal`; `onOpen` draws `detailsView`, focuses `Close`, subscribes to
  `presets.onChange` (and to the settings, so `In use` follows a choice made
  elsewhere) and redraws; `onClose` stops both. Escape is Obsidian's.
- `openDetails(name)` deps: `settings-tab.ts` (button `Details` after `Use`)
  and `panel.ts` (`addExtraButton` with `setIcon('info')`,
  `setTooltip('Details of the preset')`, the active preset read in the
  handler); `main.ts` builds them with `openNote` (as `showNote` of US-020)
  and `usePreset` (the action).
- Existing tests expected to change: the two panel rigs of
  `us-012-panel-behavior` (one more dependency); reported.

---

## Tests

- `tests/plugin/us-021-groups-details.test.ts`: the `US-021 AC-4` (Details),
  `AC-6`, `AC-7`, `AC-8`, `AC-9` tests.
- Mutation checks (SCAR-018): the source from the Defaults before the preset;
  the trim group ignored; `Use` closing the pop-up; `Use` enabled for an
  invalid preset; the focus on `Use`; no redraw on change; listening not
  stopped on close; the panel button reading the active preset at drawing;
  `—` missing for a null built-in.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** (1) new call sites: `owner.ts` (source), `DEFAULT_ROWS`/
  `FONT_ROWS` (labels and paths), `usePreset`; their transforms read (trim
  group; row order); (2) each fits; (3) no flag; (4) edge: the trim group with
  a custom width, a null built-in font.
- **SCAR-002** (1–3) composed: `Use` in the pop-up while the settings tab is
  open (both update), an invalid preset, a vanished preset; (4) checked
  against US-008 (precedence), US-012 (owner rule), US-020 (`usePreset`);
  (5) n/a.
- **SCAR-003** (1) tests red; (2) AC list again; (3) table.
- **SCAR-006** (1–4) gate, no skip, counts, TICKET-061 tracked.
- **SCAR-007** (1) the example table exact; (2) n/a; (3) yes.
- **SCAR-008** (1) `Modal`, `addExtraButton`, `setIcon`, `setTooltip` read from
  `obsidian.d.ts`; (2–3) the model tested by program, the drawing by eye;
  (4–5) n/a; (6–7) n/a.
- **SCAR-009, SCAR-010, SCAR-011** n/a.
- **SCAR-012** n/a here.
- **SCAR-013** (1) no field; Escape closes; Enter on the focused button;
  focus on `Close`; (2) n/a; (3) n/a (no field); (4) M11 with the keyboard;
  (5) the dialog only confirms nothing (SCAR-014 below); (6) n/a.
- **SCAR-014** (1) no destructive action; (2) the safe default is `Close`
  with the focus; (3) n/a; (4) `Use` tested not to run before a click;
  (5) worst misplaced click `Use`, undo named; (6) n/a.
- **SCAR-015** n/a here (M11).
- **SCAR-016** (1) `detailsView` reads the store and settings at each draw;
  the panel button reads the active preset in its handler; (2) the open
  pop-up redraws on preset and settings changes (named); (3–4) draw, change,
  use tests; (5) M11 keeps the pop-up open while the note is edited; (6) n/a;
  (7) the pop-up is listed among the screens that show presets (AC-9).
- **SCAR-017** (1) grep before coding: `new Modal`/`extends Modal` in
  `src/plugin` (ConfirmModal, NameModal: dialogs with a question or a field,
  not affected); (2) class: every place that opens the pop-up goes through
  `openDetails`; (3) text checks; (4–6) n/a.
- **SCAR-018** (1–6) backups of `details.ts`, `details-modal.ts`,
  `settings-tab.ts`, `panel.ts`, `main.ts`, checksums, checked restores,
  one match, arrays, baseline; (7) survivors read as unreachable inputs.
- **SCAR-019** (1) values at preset, Defaults, built-in, null built-in, the
  trim group; presets valid, invalid, vanished, active; (2) n/a; (3) yes;
  (4) M11.

---

## Definition of done

- [x] Tests named above green
- [x] Existing tests that changed listed with the reason
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)
- [x] Register rows for `details.ts` and the modal

## Result (2026-10-21)

Changed: new `src/plugin/settings/row-data.ts` (`DEFAULT_ROWS`, `FONT_ROWS`,
`FieldRow`, `FontRow` moved out of `rows.ts`, which re-exports them); new
`src/plugin/settings/details.ts` (`detailRows`, `detailsView`, types); new
`src/plugin/settings/details-modal.ts` (`PresetDetailsModal`);
`src/plugin/settings/settings-tab.ts` (`Details` after `Use`, dependency
`openDetails`); `src/plugin/preview/panel.ts` (an `info` extra button with the
tooltip `Details of the preset` on the preset row, reading the active preset
in its handler; dependency `openDetails`); `src/plugin/main.ts` (`openDetails`
opens the modal with the store, the settings, `usePreset` and `showNote`).
Register row "Preset details".

- Gate (scratchpad `gate060.log`): typecheck, build (`main.js` sha256
  `06ba6440d4e2…`), lint green; `npm test` 1701 passed, 1 todo; integration
  370 passed, 1 skipped. No red test left in US-021.
- AC → tests: AC-4 Details, AC-6 (six tests), AC-7 (five), AC-8 (text check),
  AC-9 (draw, change, use and the text check), AC-10 (inside these) — green.
- Existing tests changed: `tests/plugin/us-012-panel-behavior.test.ts` (both
  panel rigs get `openDetails`, unused there). Test support changed:
  `tests/support/settings-source.ts` lists `row-data.ts` among the files that
  "the settings tab" text checks read (the US-009 row-order check read
  `rows.ts` only and failed after the move; the order it guards is unchanged).
- Tests and story corrected while coding: the G2 test and AC-6 said the
  built-in cover is `none`; US-011's `DEFAULT_COVER` is `auto` (the first
  image of the note) — test and story now say `auto` (SCAR-002 widened: the
  example was not checked against US-011). Added before the mutation run: the
  trim-group row (a preset `trimSize` owns the width row); the `onClose` text
  check now needs `stop()`; the modal's settings listener (so `In use`
  follows a choice made elsewhere) is in the AC-9 text check.
- Mutants (scratchpad `mut060/run.py`; US-021 plugin, US-012 panel and
  behaviour tests; baseline 0 failed, 71 passed): 11, all caught on the first
  run: Defaults before the preset; trim group ignored; `Use` closes; `Use`
  enabled for an invalid preset; focus on `Use`; `Open the note` does not
  close; no `—` for a null built-in; no redraw on a preset change; listening
  not stopped; `Details` opens the active preset; the panel button reads a
  value captured at drawing. Backups by full path, `shasum -a 256 -c` after
  every restore and at the end: all 4 files OK.
- SCAR-017 greps: `extends Modal` — `ConfirmModal` (a question) and
  `NameModal` (a field) in the settings, not affected; `openDetails` — the
  settings tab and the panel only, both through `main.ts`.
