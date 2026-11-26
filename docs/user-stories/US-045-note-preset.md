# US-045 — A note names its preset (`typst-preset`)

**Status:** Ready (G1 2026-11-26, D8 confirmed by the author 2026-11-26: "Yes, go"; G2 tests written 2026-11-26)
**Introduced:** 0.19.0
**Implemented:** —
**Amends:** US-008 (the active preset), US-012 (the preview panel's preset), US-042 (the export dialog's choices), US-014 AC (frontmatter is left out: one key is read)
**Control project:** `spec/Note Settings Questions.md` (NS-1 to NS-9, answered 2026-11-26: "Yes, all proposals")
**Partner:** Obsidian Vault Compiler US-7.5 writes the key into the compiled note (its reader is this story, SCAR-040).

---

## Story

**As an** author who prints different notes with different presets (a book in `A5 MU Print`, encounter sheets in
`A4 Encounter Sheets`),
**I want** a note to name its preset in a property,
**so that** exporting or previewing that note uses the right preset without switching the active preset back and
forth.

### Measured (2026-11-26, 0.18.0)

- One global `activePreset` (data.json). Export (`exportWith`, `export-command.ts:128-185`), the export dialog
  (`export-dialog/dialog.ts:54-55`) and the preview panel (`prepareNote`, `prepare-note.ts:206`) take it through
  `selectPreset` (`prepare-note.ts:86-112`, `pickActive`). Choosing a preset in the dialog (`saveExportChoices`,
  `export-dialog/rules.ts:116-124`) or in the panel (`usePreset`) **makes it the active preset**.
- The exported note's frontmatter is split off by `parse` and dropped; no `metadataCache` use anywhere.
- Preset names are the note names in the presets folder; `nameKey` compares them case-insensitively (NFC).
- `editPresetField` (`core/presets/note-edit.ts`) edits a note's YAML with the `yaml` Document API, which keeps the
  other keys, their order and comments (re-spacing measured and accepted 2026-10-21); it refuses a note without
  frontmatter.
- Obsidian's `MenuItem.setSubmenu` is **not** in the public typings (obsidian 1.14.4, checked) and the file menu is
  drawn synchronously; so the choice is a chooser dialog (D8).

### Who relies on the preset choice today (SCAR-017, SCAR-027)

| User | Assumes | After this story |
|---|---|---|
| `selectPreset` / `prepareNote` (export, preview) | the active preset | the note's preset first (AC-2), one function for all |
| `saveExportChoices` | the dialog's preset becomes active | not for a note with the key (AC-3) |
| preview panel (`panel.ts` dropdown, `activeFields`, style key) | the active preset | shows the used preset; locked for a note with the key (AC-5) |
| reading-view processors, `renderStatblock`, `statblockTypst` | the active preset | unchanged (D4) |
| `menus.ts` note entries | Export to PDF, Preview | + Preset for this note… (AC-6) |
| `note-edit.ts` | preset notes, frontmatter required | + a note property, frontmatter created when missing (AC-7) |
| `manual/presets.md`, `manual/manual.md`, `manual/markdown-support.md` | frontmatter left out | the key described (AC-9) |
| Vault Compiler US-7.5 | writes `typst-preset` into the compiled note | read here (AC-1) |

## Acceptance criteria

Terms. *The key* is the top-level property `typst-preset` of a note's frontmatter. *The used preset* is the preset an
export or the preview takes for a note.

- **AC-1 (the key).** A text value, trimmed; empty or absent means "no key". It names a preset as the preset list
  compares names (`nameKey`: case and Unicode form ignored). Examples: `typst-preset: A4 Encounter Sheets` and
  `typst-preset: a4 encounter sheets` both name `A4 Encounter Sheets`; `typst-preset: ""` is no key; a list or a
  number is refused (AC-4) with `the property typst-preset must be a preset name`. A note inside the presets folder
  is never read for the key (it is a preset, refused as today).
- **AC-2 (which preset is used).** With the key naming a valid preset, the used preset is that preset for the direct
  export (`Export current note`, the menu's `Export to PDF`), the export dialog's first choice and the preview
  panel; without the key, the active preset as today. One function decides it for all three (SCAR-017). The note's
  text is read when the export or the preview starts, never from Obsidian's metadata cache (SCAR-022).
- **AC-3 (the active preset stays).** An export or a preview with the note's preset does not change `activePreset`.
  In the export dialog of a note with the key, choosing another preset exports with it once; the active preset
  and the note stay unchanged; the folder is remembered for the chosen preset as today. For a note without the key,
  the dialog behaves as today (the chosen preset becomes active).
- **AC-4 (a key that names nothing usable).** Unknown name: the direct export and the preview refuse with
  `Preset "X" (from this note's properties) does not exist`; invalid preset: `Preset "X" (from this note's
  properties) is invalid: …` (the existing reason). The export dialog opens on the active preset and shows that line
  in its refusal row; exporting from it then uses the dialog's choice (AC-3). Nothing falls back silently.
- **AC-5 (the preview panel).** While it shows a note with a usable key, the panel's preset list shows that preset,
  is not changeable, and says `Set by this note's properties (O2T: Preset for this note…)`. With another note it
  works as today. The panel's style key uses the used preset (redraw when the key changes on the next refresh).
- **AC-6 (the menu).** The file menu and the editor menu of a `.md` note outside the presets folder get
  `O2T: Preset for this note…`. It opens a chooser: first `Active preset (no property)`, then every valid preset in
  the list's order; the note's current choice is marked `(current)`, read from the file when the chooser opens.
  Choosing writes (AC-7) and shows `✅ Preset for "<note>": <preset>` or `✅ Preset for "<note>": the active preset`.
  Escape closes without writing; the chooser works by keyboard (SCAR-013).
- **AC-7 (the write).** Only the key changes: set or replaced in place, or removed; the other keys keep their order,
  values and comments (the `yaml` Document API, re-spacing as accepted 2026-10-21); every byte outside the
  frontmatter stays. A note without frontmatter gets `---` / `typst-preset: <name>` / `---` as its first lines (the
  name quoted when YAML needs it). A frontmatter left empty by a removal is removed with its two `---` lines. A
  frontmatter that is unclosed or not a mapping is not changed: `Could not set the preset: <reason>`. The write is
  one `vault.process` (atomic). Examples: `---\ntags: [x]\n---\nText` + `A4 Encounter Sheets` →
  `---\ntags: [x]\ntypst-preset: A4 Encounter Sheets\n---\nText`; `Text` + `A5 print` →
  `---\ntypst-preset: A5 print\n---\nText`; `---\ntypst-preset: A5 print\n---\nText` + active →
  `Text`.
- **AC-8 (nothing else changes).** A note without the key exports and previews byte-identically to 0.18.0 with the same
  active preset; the reading-view statblocks, `renderStatblock`, `renderDetails` and `statblockTypst` keep using the
  active preset; the frontmatter is still not printed.
- **AC-9 (documents).** `manual/presets.md`: "A preset for one note"; `manual/manual.md`: the menu item;
  `manual/markdown-support.md`: frontmatter is left out except `typst-preset`, which chooses the preset. Strings in
  `src/plugin/strings.ts`.
- **AC-10 (release 0.19.0).** Versions, notes, a manual check M36 run together with the Vault Compiler's check
  (the compiled note carries the key; its export uses it), in the scratch vault.

## Decisions (the author, 2026-11-26: "Yes, all proposals")

- **D1 (NS-1).** The key is `typst-preset`, no plugin name in it.
- **D2 (NS-6).** The note's preset for export, dialog and preview; the active preset unchanged.
- **D3 (NS-6).** Unknown or invalid: refused with a message naming the property; nothing falls back silently.
- **D4 (NS-6).** Reading-view statblocks and the API keep the active preset.
- **D5 (NS-7).** A menu item writes the key; only that key changes.
- **D6 (NS-8).** This plugin first (0.19.0), then the Vault Compiler (0.27.0); one joint manual check.
- **D7 (G1).** The key matches names as the preset list does (case and Unicode form ignored).
- **D8 (G1, measured; confirmed 2026-11-26).** A chooser dialog instead of a submenu: `setSubmenu` is not in Obsidian's public API and the
  file menu is drawn before the file could be read.

## Not covered

Per-note settings beyond the preset; the reading view and the API following the note's preset; a key on a folder.

## Tickets

- #191 T1 — the key, the chooser list, the note write (AC-1, AC-6, AC-7)
- #192 T2 — export, dialog, preview, panel (AC-2 to AC-5, AC-8)
- #193 T3 — the menu and the chooser (AC-6)
- #194 T4 — documents, M36, release 0.19.0 (AC-9, AC-10)
