# TICKET-059 — The three preset lists grouped

**Status:** Done (2026-10-21)
**User story:** [US-021](../user-stories/US-021-preset-groups-and-details.md)
**ACs addressed:** AC-2 (the text check), AC-3, AC-4 (headings), AC-5, AC-9 (the lists)
**Depends on:** TICKET-058
**SCARs:** SCAR-008, SCAR-013, SCAR-016, SCAR-017, SCAR-018, SCAR-019

---

## Description

Group the style panel's dropdown, the settings tab's preset list and the
ribbon menu through `groupPresets`, unchanged while no preset has a group.

---

## Acceptance criteria (from user story)

- **AC-3:** one `<optgroup>` per group, labelled with its heading; the active
  option selected (also when invalid); invalid options disabled with the
  error as tooltip; a choice calls `usePreset`.
- **AC-4 (headings):** one heading row per group under `Presets`.
- **AC-5:** a separator and a label per group replace the `Preset` label.
- **AC-9 (lists):** a `group:` edit redraws the tab and the panel
  (`presets.onChange`, today); the ribbon menu shows it at its next opening.

---

## Implementation notes

- `src/plugin/preview/open.ts`: `presetDropdownGroups(entries, active)` →
  `{label, choices}[]` over `groupPresets` and today's `presetChoices`.
- `src/plugin/settings/rows.ts`, `addPresetDropdown`: takes the groups; for a
  labelled group creates an `optgroup` (`d.selectEl.createEl('optgroup',
  {attr: {label}})`) and appends its options there (measured, G1); unlabelled
  options go straight into the select as today. Value, disabling and the
  tooltip as today.
- `src/plugin/settings/settings-tab.ts`: the preset list loops over
  `groupPresets(entries)`; a group with a heading gets `new
  Setting(root).setName(group.heading).setHeading()` before its rows.
- `src/plugin/menus.ts`: `PresetsView.names` gain `group`;
  `ribbonMenuEntries` uses `groupPresets`; without headings the US-020 entries
  stay byte for byte.
- `src/plugin/main.ts`: passes the store entries (which now carry `group`).
- Existing tests expected to change: `tests/plugin/us-012-panel.test.ts` if it
  builds `addPresetDropdown`'s arguments; the US-020 menu tests only if their
  view objects need `group` (typing), reported.

---

## Tests

- `tests/plugin/us-021-groups-details.test.ts`: the `US-021 AC-3`, `AC-4`
  (headings), `AC-5` tests and the AC-2 text check.
- Mutation checks (SCAR-018): optgroup skipped; labels in the wrong order;
  the heading row missing; the ribbon `Preset` label kept with groups; the
  separator dropped; `groupPresets` bypassed in one list.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** (1) `presetChoices` and `addPresetDropdown` get a grouped
  caller; their transforms (selectable, active, tooltip) unchanged; (2) read;
  (3) no flag: groups are data; (4) edge: an invalid active preset in a
  group.
- **SCAR-002** (1–3) composed: active preset in a group, invalid in a group,
  the three lists at once; (4) checked against US-012 (panel), US-020
  (menus); (5) n/a.
- **SCAR-003** (1) tests red; (2) AC list again; (3) table in the result.
- **SCAR-006** (1–4) full gate, no skip, counts, later tickets tracked.
- **SCAR-007** (1) the menu and table written out; (2) n/a; (3) yes.
- **SCAR-008** (1) `createEl('optgroup')` on Obsidian's `selectEl` (outside
  the dropdown API, measured in Chromium, G1); (2–3) the model tested by
  program, the native look by eye (M11); (4–5) n/a; (6) the grouping choices
  were measured before they were offered; (7) n/a.
- **SCAR-009, SCAR-010, SCAR-011** n/a.
- **SCAR-012** n/a here.
- **SCAR-013** (1–2) no field; the dropdown's keyboard is the native one;
  (3) n/a; (4) M11 runs it with the keyboard; (5–6) n/a.
- **SCAR-014** (1–5) no destructive control; the worst misplaced click is a
  preset choice (undo as in US-020); (6) n/a.
- **SCAR-015** n/a here (M11).
- **SCAR-016** (1) the lists read the store when drawn; the menu at each
  click; (2) a `group:` edit redraws tab and panel (named); (3–4) covered by
  the store test and the US-012/US-020 redraw tests; (5) M11 keeps both open;
  (6) n/a; (7) every screen that shows a preset list is listed (AC-9).
- **SCAR-017** (1) grep before coding: `entries()` and `presetChoices(` in
  `src/plugin`; (2) class: every list; (3) `groupPresets` plus the text check;
  (4) n/a; (5) n/a; (6) inventory by grep (G0).
- **SCAR-018** (1–6) path-mirrored backups of `open.ts`, `rows.ts`,
  `settings-tab.ts`, `menus.ts`, `main.ts`, checksums, checked restores,
  one match, arrays, baseline; (7) survivors read as unreachable inputs
  first.
- **SCAR-019** (1) lists at no group, one, several, invalid in a group;
  (2) n/a; (3) yes; (4) M11.

---

## Definition of done

- [x] Tests named above green; the US-012 and US-020 tests green
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)

## Result (2026-10-21)

Changed: `src/plugin/preview/open.ts` (`presetDropdownGroups`,
`PresetChoiceGroup`); `src/plugin/settings/rows.ts` (`addPresetDropdown`
takes groups; a labelled group is an `optgroup` made with
`selectEl.createEl('optgroup', {attr: {label}})`, its options with
`createEl('option', {text, value})` — options read from `obsidian.d.ts`
`DomElementInfo`); `src/plugin/preview/panel.ts` (passes each entry's group);
`src/plugin/settings/settings-tab.ts` (the list loops over `groupPresets`, a
heading row per labelled group); `src/plugin/menus.ts` (`PresetsView.names`
gain an optional `group`; a separator and a label per group; without groups
the US-020 entries exactly). `main.ts` unchanged (the store entries already
carry `group`).

- Gate (scratchpad `gate059.log`): typecheck, build (`main.js` sha256
  `5086d1fc0aa7…`), lint green; `npm test` 1687 passed, 13 failed, 1 todo;
  integration 370 passed, 1 skipped. All 13 red tests are TICKET-060's (the
  `Details` button, the pop-up).
- AC → tests: AC-2 text check, AC-3 (model, drawing, the panel), AC-4
  headings (text check), AC-5 (two tests), AC-9 lists (the panel test, and
  the existing redraw on `presets.onChange`) — green; US-012 and US-020 tests
  unchanged and green.
- Existing tests changed: none. Test support changed:
  `tests/support/fake-obsidian.ts` — the fake select gains `createEl` for an
  `optgroup` whose options also go into `selectEl.options` (document order,
  as measured in Chromium) and a `groups` record.
- Tests added while coding: the dropdown drawn with groups into the fake
  select (so the drawing is tested, not only named by a text check); the
  style panel drawing the store's groups (added after the mutant "panel drops
  the group" survived); the settings-tab heading text check now requires the
  condition and the call (after "heading row missing" survived — the tab
  cannot be built in the fake; M11 looks at it).
- Mutants (scratchpad `mut059/run.py`; US-021, US-020, US-012 panel and
  behaviour tests; baseline 13 failed, 88 passed): 8, all caught on the
  second run (first run 6 of 8): optgroup skipped; dropdown not grouped;
  labels from the first preset name; heading row missing; `Preset` label kept
  with groups; separator dropped; ribbon bypasses `groupPresets`; panel drops
  the group. Backups by full path, `shasum -a 256 -c` after every restore and
  at the end: all 5 files OK, both runs.
- SCAR-017 greps: `addPresetDropdown(` — one caller (the panel);
  `presetChoices(` — `open.ts` (now inside `presetDropdownGroups`) and the
  US-012 test (unchanged); `entries()` — the three lists now group,
  `prepare-note.ts` (a name list, not shown) not affected.
