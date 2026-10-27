# TICKET-064 — The menu items, the question and the write

**Status:** Done (2026-10-22)
**User story:** [US-022](../user-stories/US-022-heading-and-image-menus.md)
**ACs addressed:** AC-1, AC-3 (the items), AC-5 (the question), AC-6, AC-7 (the write), AC-8, AC-9, AC-10
**Depends on:** TICKET-062, TICKET-063 (with its amendment of 2026-10-22)
**SCARs:** SCAR-001, SCAR-002, SCAR-013, SCAR-014, SCAR-016, SCAR-017, SCAR-018, SCAR-019

---

## Description

The menu entries for a heading or image line and for an image file, the
action that asks and then writes the preset note in one atomic step, the
notice, and the wiring of the editor and file explorer menus.

---

## Acceptance criteria (from user story)

- **AC-1, AC-3, AC-6:** the items (titles, icons `list` and `image`), one per
  image, disabled with the reason without a preset or with an invalid one,
  none in a preset note.
- **AC-5:** the dialog `Change preset "<name>"` with the question,
  `Change preset` / `Cancel`, `Cancel` focused.
- **AC-7:** `Vault.process` with `editPresetField` at the moment of the write.
- **AC-8:** the notice `Preset "<name>" changed`; the store re-reads.
- **AC-9:** the active preset read again at the confirm.
- **AC-10:** one caller of `editPresetField`; `.process(` only in the action
  and the vault port.

---

## Implementation notes

- `src/plugin/menus.ts`: `presetEditEntries(actions, context, active)` and
  `imageFileEntries(actions, path, active)` over `headingRuleAction` and
  `coverAction`; `active` = `{name: pickActive(...), valid, fields}` read
  when the menu opens.
- `src/plugin/actions.ts`: `changePreset({preset, change, question})`: ask
  through `deps.confirm` (the `ConfirmModal` of `rows.ts`, title `Change
  preset "<name>"`, labels `Change preset` / `Cancel`); on yes, compare
  `pickActive` with `preset` (else the notice of AC-9); `presetNotes.process`
  with `editPresetField` (an error: the message as a notice, nothing written);
  the notice of AC-8. Deps `presetNotes` (the store's `VaultPort` gains
  `process`) and `confirm`.
- `src/plugin/obsidian/vault-port.ts`: `process(path, fn)` through
  `app.vault.process` (read from `obsidian.d.ts`, since 1.1.0).
- `src/plugin/main.ts`: the editor menu adds `presetEditEntries` for
  `lineContext(editor.getValue(), editor.getCursor().line, file.path, files)`
  (the vault's image files with their heads, as the export reads them) in the
  `obsidian2typst` section; the file menu adds `imageFileEntries` for an
  image file.
- Existing tests expected to change: the US-020 test `cover.png gets 0
  items` stays (it tests `noteMenuEntries`; the image items are a separate
  function); any `VaultPort` fake that must gain `process` (`FakeVault` has
  it since G2).

---

## Tests

- `tests/plugin/us-022-menus-write.test.ts`: all tests.
- Mutation checks (SCAR-018): `Cancel` writes; the write before the
  question; the active preset not read again; the note read when the
  question opens instead of at the write; no notice; an invalid preset
  enabled; one item for several images.

---

## SCAR check (2026-10-21, item by item against the Prevention lists)

- **SCAR-001** (1) new call sites: `ConfirmModal` (a question that is not a
  delete: its labels come from the caller, fit), `pickActive`,
  `Vault.process`, the store's re-read; (2) read; (3) no flag; (4) edge: an
  edit during the question.
- **SCAR-002** (1–3) composed: the active preset changed while asking, an
  edit while asking, an invalid preset, no preset; (4) checked against
  US-008, US-020, US-021; (5) n/a.
- **SCAR-003** (1) tests red; (2) AC list again; (3) table.
- **SCAR-006** (1–4) gate, no skip, counts, TICKET-065 tracked.
- **SCAR-007** (1) titles, question, notices exact; (2–3) yes.
- **SCAR-008** (1) `Vault.process`, `Editor.getCursor`, `Editor.getValue`
  read from the types; (2–3) the action tested on fakes, the app by eye;
  (4–5) n/a; (6) n/a; (7) n/a.
- **SCAR-009, SCAR-010, SCAR-011** n/a here.
- **SCAR-012** n/a here.
- **SCAR-013** (1) no field: Escape cancels, `Cancel` focused, Enter on the
  focused button (the `ConfirmModal`); (2–3) n/a; (4) M12 with the keyboard;
  (5) the dialog is SCAR-014's; (6) n/a.
- **SCAR-014** (1) the question names the preset and the exact change;
  (2) `Cancel` the default; (3) refusals first: no preset or an invalid one
  is a disabled item, no question; (4) a test shows no write before
  `Change preset` and none after `Cancel`; (5) the worst misplaced click
  named in the story; (6) n/a.
- **SCAR-015** n/a here (M12).
- **SCAR-016** (1) the menu reads the line and the preset when it opens; the
  action reads the preset at the confirm and the note at the write; (2) the
  screens follow through the store (named); (3–4) draw, change, use tests;
  (5) M12 with the panel open; (6) n/a; (7) every screen that shows the
  preset listed (AC-8); (8) n/a.
- **SCAR-017** (1) grep before coding: `vault.create`/`process` writers of
  preset notes; (2) one action; (3) the text check over `src/plugin`;
  (4–5) n/a; (6) inventory by grep (G0); (7) the text check matches the call.
- **SCAR-018** (1–7) backups of `menus.ts`, `actions.ts`, `vault-port.ts`,
  `main.ts`, checksums, checked restores, one match, arrays, baseline,
  survivors read first; M12 backs up the preset notes.
- **SCAR-019** (1) the active preset at none, invalid, valid, changed while
  asking; (2–4) n/a.

---

## Definition of done

- [x] Tests named above green
- [x] Existing tests that changed listed with the reason
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)
- [x] Register rows for the action and the vault port's `process`

---

## Amendment (2026-10-22): the menu from memory, the image read after the click

**Why:** the `editor-menu` and `file-menu` callbacks are synchronous
(`obsidian.d.ts:11092`); file bytes come only from `vault.readBinary`
(async, `src/plugin/obsidian/vault-access.ts:33`). The menu is built from
memory; the action reads the image (US-022 AC-3, AC-9, AC-10 amended; the
user's "go for it" and decision 4, 2026-10-22). The implementation notes
above that pass "the vault's image files with their heads" to `lineContext`
are replaced by these.

**ACs addressed in addition:** AC-9 (amended: the byte check at the click,
before the question; the two refusal notices), AC-12's new refusals (in
TICKET-065).

### Implementation notes

- `src/plugin/actions.ts`, `changePreset`: for `{kind: 'cover', file: path}`
  (not for `file: null`, not for heading rules), before `deps.confirm`:
  1. `path` not in `deps.vault.files()`, or `deps.vault.readHead(path)`
     throws: the notice `"<file name>" no longer exists; preset "<preset>"
     was not changed`, nothing else;
  2. `sniffImage(extensionOf(path), head)` false: the notice `"<file name>"
     is not a valid .<extension> image; preset "<preset>" was not changed`.

  `readHead` with its default length (16 bytes), as the export reads heads
  for the same check (`references.ts:123`). `<preset>` is the request's
  preset (the one the item was built for).
- `src/plugin/menus.ts`: the active preset as the menus see it, one function
  for both menus, `activePresetView(entries, stored)` (`pickActive` over the
  store's entries: name, valid, fields).
- One predicate for "a preset note", `isPresetNote(path, presetsFolder)` in
  `src/core/presets/names.ts`, used by `noteMenuEntries`, the editor-menu
  handler and `prepare-note.ts` (today two copies of
  ``path.startsWith(`${folder}/`)``: `menus.ts:115`, `prepare-note.ts:61`;
  their behaviour unchanged, the US-008 and US-020 tests are the proof); a
  text check that ``startsWith(`${`` with a presets folder appears nowhere
  else in `src/plugin` (SCAR-017).
- `src/plugin/main.ts`: the editor menu, for a note outside the presets
  folder: `lineContext(editor.getValue(), editor.getCursor().line,
  file.path, this.actionDeps.vault.files(), view.fields?.headingRules)` and
  `presetEditEntries(actions, context, view)`; the file menu, for a file:
  `imageFileEntries(actions, file.path, view)`. All synchronous; no `await`
  in either callback.
- Register rows: the actions row (`changePreset`, its reads in order), the
  vault port (`process`), "Asset resolver" (`sniffImage`'s new call site in
  the action).

### Tests

- `tests/plugin/us-022-menus-write.test.ts`: the seven AC-9 tests of the
  amendment (G2) on top of the tests named above, and the text check
  `"a preset note" is one predicate` (added at G3, 2026-10-22; red before
  the code: it finds the two copies).
- Mutation checks (SCAR-018), on top of the list above: the byte check after
  the question; the byte check skipped; a deleted file reported as invalid;
  `Stop using as cover` reading the image; the file-list check removed
  (relying on `readHead` alone); the item's image replaced by the first image
  of the line.

### SCAR check of the amendment (2026-10-22, item by item)

- **SCAR-001** (1) new call sites `sniffImage` and `extensionOf` in the
  action: one transform each (the header check; the lower-case extension);
  (2) read and fit, with the same head length as the export; (3) no flag
  needed; (4) edge input: a `.png` holding text; a file deleted after the
  menu opened.
- **SCAR-002** (1–5) composed: two images on one line with one broken, the
  file explorer item, `Stop using`, the heading item, the preset switched;
  checked against US-003 (the byte check), US-008 (the store), US-020 (the
  note menus' items stay, the new items come after them in the same
  section).
- **SCAR-003** (1) red tests exist (G2); (2) the AC list read again: AC-1,
  AC-3, AC-5 to AC-10; (3) the table in `docs/technical/tests.md`.
- **SCAR-006** (1–4) full gate, no skip, counts in the result; TICKET-065
  tracked.
- **SCAR-007** (1–3) the notices exact in the tests.
- **SCAR-008** (1) the callback types read: `editor-menu` and `file-menu`
  synchronous, `Editor.getValue`, `getCursor` synchronous, `readBinary`
  async; (2–3) the action tested on fakes, the menus by eye in M12; (4–7)
  n/a.
- **SCAR-009, SCAR-010, SCAR-011** (all items) n/a: no generated text, no
  concatenated output, no generated names.
- **SCAR-012** (1–5) n/a here (TICKET-065).
- **SCAR-013** (1–6) no field; the question is the `ConfirmModal` (`Cancel`
  focused, Escape cancels); the refusals are notices, no dialog.
- **SCAR-014** (1) the question names the image path and the preset; (2)
  `Cancel` the default; (3) refusals before the question — the byte check
  and the file check come first; (4) tests show no question and no write
  after a refusal; (5) the worst misplaced click: an item for the wrong image
  — the question names it; (6) n/a.
- **SCAR-015** (1–5) n/a here; M12 asks the open question.
- **SCAR-016** (1) the menu reads the line, the file list and the preset
  when it opens; the action reads the image at the click, the preset at the
  confirm, the note at the write; (2) the screens follow the store; (3–4)
  draw → change → use tests (file replaced, file deleted); (5) M12 with the
  panel open; (6) n/a; (7) AC-8 lists the screens; (8) n/a.
- **SCAR-017** (1) grep `presetsFolder}/` and `pickActive(` in `src/plugin`
  (2026-10-22): the folder check in `menus.ts:115` and `prepare-note.ts:61`
  — both move to `isPresetNote`, with a text check; `pickActive` in
  `menus.ts:68` (ribbon) and `prepare-note.ts:69` (the export's choice,
  US-008) — the menus' new uses go through `activePresetView`, which calls
  it, and the export's stays (it reads the data at export time); (2–3) one action reads the image, one writes; (4–5) n/a; (6) the
  writers of preset notes inventoried at G0; (7) the text checks match the
  call (`editPresetField(`, `.process(`).
- **SCAR-018** (1–7) backups of `menus.ts`, `actions.ts`, `vault-port.ts`,
  `main.ts` by full path with checksums, checked restores, one match per
  edit, arrays, the baseline in the same run, survivors read first; M12 backs
  up the preset notes.
- **SCAR-019** (1) the active preset at none, invalid, valid, switched; the
  image at valid, invalid, deleted, replaced.

### Definition of done (amendment)

- [x] The seven AC-9 tests green with the tests above
- [x] No `await` in the two menu callbacks (read in the code; M12 by eye)
- [x] Mutation checks of the amendment run, results in the result
- [x] Register rows: actions (`changePreset`), vault port (`process`), asset
  resolver (`sniffImage` in the action)

---

## Result (2026-10-22)

Changed:
- `src/core/presets/names.ts` (`isPresetNote`) and `index.ts` (export);
  `src/plugin/menus.ts` (`noteMenuEntries` uses it; new `ActivePresetView`,
  `activePresetView`, `presetEditEntries`, `imageFileEntries`);
  `src/plugin/prepare-note.ts` (uses `isPresetNote`).
- `src/plugin/presets/store.ts` (`VaultPort.process`),
  `src/plugin/obsidian/vault-port.ts` (`process` through `vault.process`).
- `src/plugin/actions.ts` (`ActionDeps.presetNotes`, `confirm`;
  `PresetChangeRequest`; `changePreset`; the private `imageRefusal`).
- `src/core/convert/index.ts` (exports `lineContext`).
- `src/plugin/main.ts` (one vault port for the store and the action;
  `confirm` over `ConfirmModal`; the editor menu adds `presetEditEntries` for
  `lineContext` of the cursor line outside the presets folder; the file menu
  adds `imageFileEntries` for a file; no `await` in either callback).

Register rows: "Asset resolver", "Actions", "Menus" (US-022 uses), new
"Preset vault port" and "Preset note predicate".

- Gate (scratchpad `gate064.log`): typecheck, build (`main.js` sha256
  `057a331ab903…`), lint green; `npm test` 1752 passed, 1 todo, 0 failed;
  integration 370 passed, 1 skipped.
- AC → tests: AC-1, AC-3, AC-5 to AC-10 in
  `tests/plugin/us-022-menus-write.test.ts` (26 tests) — green.
- Existing test changed (reported): `tests/plugin/us-008-wiring.test.ts`
  "US-008 AC-7: never modifies or permanently deletes a vault file" forbade
  `vault.process(` in the vault port. US-008 AC-7 is about export and preview
  ("never write presets"); the guard was wider. It now forbids `modify`,
  `delete`, `append` as before and allows exactly one `vault.process(` (the
  US-022 write; `main.ts` still fully guarded; the US-022 text check keeps
  `.process(` to the action and the port). Not foreseen at G3: the ticket
  said "none planned".
- Change against the amendment's notes (reported): the check that the image
  is in `deps.vault.files()` before `readHead` was dropped as redundant: the
  vault reader throws for a path it does not have (`vault-access.ts`
  `file()`), and the fake does the same; the deleted-file test covers it.
- Tests added while coding: a preset note without frontmatter is not written
  and gives `The preset note has no frontmatter` (no plugin test covered a
  refused edit); after the mutation run, the whole statement in `main.ts`
  that leaves preset notes out (SCAR-017 item 7), and `activePresetView` at
  stored, missing stored, invalid and none (SCAR-019).
- Mutants (scratchpad `mut064/run.py`; US-022, US-020, US-008 tests; final
  baseline 0 failed, 216 passed): 15, all caught after the two tests above
  — `Cancel` writes; the question skipped; the active preset not read
  again; the note read when the question opens; no notice; a refused edit
  written; an invalid preset enabled; one item for several images; the byte
  check after the question; the byte check skipped; a deleted file reported
  as invalid; the item's image replaced by the first; the preset-note check
  without the slash; the editor menu in preset notes; the stored preset
  ignored by the menus. First run: baseline 1 failed (the US-008 guard
  above), 2 survivors (the last two), read as inputs that could not reach the
  rule: no test reached `main.ts` or `activePresetView`. Not run as a
  mutant: `Stop using as cover` reading the image (no path to read; the
  `events` assertion of the Stop test is its guard). Backups by full path,
  `shasum -a 256 -c` after every restore and at the end: six files OK.
- Not verified by tests (M12): that Obsidian's `vault.process` writes nothing
  when `change` throws (the types say `fn` returns the new content
  synchronously; the refusal is checked by hand with a preset note without
  frontmatter), the menus in the app, the keys of the question.
- SCAR-017 greps after the code: `isPresetNote(` — `main.ts`, `menus.ts`,
  `prepare-note.ts`, no other folder check; `editPresetField(` —
  `actions.ts` only in `src/plugin`; `.process(` — `actions.ts`,
  `vault-port.ts`.
