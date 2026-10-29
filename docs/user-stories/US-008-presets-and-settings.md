# US-008 — Presets stored as vault notes, defaults, and a template file

**Status:** Done
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author who prints the same book in several forms,
**I want** named presets (e.g. "A5 print", "A4 digital") that live as notes in
my vault, on top of defaults and my own template file,
**so that** I can switch the look of the whole book in one step, edit presets
by hand, and have them sync with the vault.

---

## Acceptance criteria

- **AC-1 (what is a preset field, precedence):** Strict mode and the warnings
  note folder (US-006) are global plugin settings and are not preset fields.
  Every other setting is a preset field (highlight colour, external-link
  footnotes, heading numbering, page setup, fonts and font folder, cover,
  template file, and so on). Effective value = preset value if set, else the
  value in the `Defaults` section of the settings tab if set, else the
  built-in default. Example: built-in body size `10pt`, Defaults `11pt`,
  preset "A5 print" sets nothing → `11pt`; the preset sets `9.5pt` → `9.5pt`.
  A field is *set* when it is present and not `null`. Nested fields merge field
  by field: a preset with `page: {bleed: 5}` changes only `page.bleed`, and one
  with `margins: {top: 20}` only the top margin.

  *Fields of this version* (fonts and cover are added by US-010 and US-011,
  with the same precedence; `callouts` by US-016 and `headingRules` by US-017, preset notes only, as the cover): `highlightColor`, `externalLinkFootnotes`,
  `headingNumbering`, `page` (US-009), `template`. Built-in defaults:
  ```
  highlightColor: "#ffeb3b"      headingNumbering: "1.1"
  externalLinkFootnotes: true    template: (none)
  page: trimSize A5, margins top 18 / bottom 22 / inside 15 / outside 15,
        gutter 5, bleed 0, slug 0, facingPages true,
        folios true, runningHeader true, runningHeaderLevel 2 (US-019)
  ```
  Example with a field that exists now: built-in `#ffeb3b`, Defaults
  `#a5d6a7`, preset sets nothing → `#a5d6a7`; the preset sets `#ffffff` →
  `#ffffff`; neither sets it → `#ffeb3b`.

- **AC-2 (a preset is a Markdown note):** Presets live in the vault folder set
  by the setting `Presets folder` (default `Obsidian2Typst/presets`). Each
  preset is one `.md` file; the file name without extension is the preset name,
  the settings are YAML frontmatter, the body is free text for the user's own
  remarks and is ignored. Example `Obsidian2Typst/presets/A5 print.md`:
  ```
  ---
  schemaVersion: 1
  page:
    trimWidth: 148
    trimHeight: 210
    bleed: 3
  highlightColor: "#ffeb3b"
  ---
  Print edition for the printer in Berlin.
  ```
  Fields that are missing inherit (AC-1). Unknown fields are ignored and kept
  when the plugin rewrites the file. The plugin rewrites a preset note only to
  create, duplicate or rename it (AC-5); the settings tab does not edit preset
  fields (decided by the user 2026-10-17: they are edited in the note). A
  missing `schemaVersion` means 1; a larger one than the plugin knows makes the
  preset invalid with `Preset needs a newer version of Obsidian2Typst
  (schemaVersion 2)`. A note without frontmatter is a valid preset that sets
  nothing. A byte-order mark at the start of the note is ignored; line numbers
  do not change (`---`, `page:`, `  bleed: -2` after a mark still gives line 3). The YAML is read with the `yaml` package (decided by the user
  2026-10-17), which gives line and column of errors.

- **AC-3 (editing by hand):** When a preset note is modified in Obsidian (or
  changed by sync), the plugin re-reads it within 2 seconds; the settings tab,
  the side panel, and the preview use the new values without restart. The
  store sends one change event per preset note; the panel and the preview
  (US-012) subscribe to it when they exist, and the test uses a fake
  subscriber. A change in the body of the note (not the frontmatter) sends no
  event. Several changes within 300 ms of one note are read once.

- **AC-4 (invalid preset notes):** A preset note with invalid YAML or a field
  with an invalid value (e.g. `bleed: -2`) is shown in the preset list marked
  `invalid` with the first error and its line, cannot be selected for export or
  preview, and does not affect the other presets. A notice appears once per
  change. Fixing the note makes it valid again automatically. The error text
  is `<field or YAML message> (line <n>)`, `n` counted in the note file with
  the frontmatter fence as line 1. Examples: `bleed: -2` on line 6 →
  `page.bleed must be a number of at least 0 (line 5)`; a tab character in the YAML →
  the message of the parser with its line. A frontmatter that is not a group of
  `name: value` lines is invalid with `Frontmatter must contain settings written
  as name: value`; one that is not closed with `Frontmatter is not closed (line 1)`. A field with a wrong type
  (`highlightColor: 5`) is invalid like a wrong value. Only the first error is
  shown. If the active preset becomes invalid, exports and the preview refuse
  with `Preset "<name>" is invalid: <error>`; the active preset is not
  switched.

- **AC-5 (create, duplicate, rename, delete):** The settings tab creates a
  preset (empty, or as a copy of an existing one) as a new note, renames it by
  renaming the note through Obsidian's rename (so links to it are updated), and
  deletes it by moving the note to the trash according to the user's Obsidian
  "Deleted files" setting. Names are unique case-insensitively: creating
  `a5 print` when `A5 print.md` exists is rejected with `A preset with this
  name already exists`. Characters not allowed in file names (`/ \ : * ? " < > |`)
  are rejected. Deleting the active preset activates the first remaining one in
  alphabetical order; the last remaining preset cannot be deleted. A
  duplicate is a byte copy of the note (body and unknown fields included)
  named `<name> copy` (`<name> copy 2`, … if taken). An empty preset is a note
  with only `schemaVersion: 1`. Names are trimmed and stored in Unicode NFC; they are compared
  after NFC and case folding, so `Ä` written as one character and as `A` plus a
  combining diaeresis is the same name (`A preset with this name already
  exists`). An empty name, one that starts with a dot, one that ends with a dot
  (`A preset name cannot end with a dot`), one longer than 100 characters, and a
  Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`,
  in any case, also with a suffix after a dot as in `CON.draft`: `A preset name
  cannot be a Windows device name`) are rejected; `CONTENT`, `COM10` and
  `my CON` are fine. Alphabetical
  order compares case-insensitively and by code point.

- **AC-6 (built-in presets):** If the presets folder does not exist when the
  plugin loads, it is created with two notes: `A5 print` (trim 148×210 mm,
  bleed 3 mm) and `A4 digital` (trim 210×297 mm, bleed 0 mm); their page values
  are US-009 AC-6. If the folder exists, nothing is created, so deleted
  built-ins do not come back. No other presets ship.

- **AC-7 (export and preview never write presets):** Exporting or previewing
  never modifies any preset note (byte-identical before and after). State such
  as the last export folder is kept per preset name in the plugin's `data.json`,
  not in the preset note.

- **AC-8 (plugin data):** The active preset, Defaults, strict mode, warnings
  note folder, presets folder, and the last export folders are stored in
  `data.json`. After restarting Obsidian they are identical. Unknown or
  invalid fields in an old `data.json` are replaced by defaults with the notice
  `Some settings were reset`; there is no crash. `data.json` has its own
  `schemaVersion` (1) and a migration test. The active preset is stored by
  name; if no preset of that name exists after loading, the first one in
  alphabetical order is active, without a notice.

- **AC-9 (template file):** A preset may select a `.typ` file in the vault as
  template (field `template`; if unset, the Defaults value; if still unset, no
  template). At export it is copied to `<export>/template.typ`, and the
  generated `<name>.typ` starts with
  ```
  #import "template.typ": *
  ```
  before any generated `#set` or `#show` rule, so the template's definitions
  are available; its rules apply through `template(doc)` (US-023). The vault copy is never modified; the export copy is
  overwritten on each export. (Confirmed by the user: exports are purely
  regenerated; the template is the user's own file.)

- **AC-10 (template shadows a Typst built-in):** The plugin scans the template
  for top-level definitions at line start of the form `#let name` or
  `#let name(`. If `name` is one of Typst's standard-library names of the
  bundled compiler version, the export continues and warning
  `TEMPLATE_SHADOWS_BUILTIN` is reported with the template line:
  ```
  template.typ:
  3: #let quote(body) = block(inset: 1em, body)

  warning: TEMPLATE_SHADOWS_BUILTIN  Template line 3 defines "quote", which shadows a Typst built-in
  ```
  The override itself stays in effect (the user may want it). Definitions that
  are not at line start, or inside code blocks, are not detected; this is a
  known limit. A byte-order mark at the start of the template is ignored when scanning (line
  numbers do not change), and a definition on the first line or the last line
  without a final newline is found. The names come from a list in the source
  (`core/template/std-names.ts`), generated from the bundled compiler
  (Typst 0.14.2); a test compares the list with what the compiler reports, so
  a compiler update that adds a name fails until the list is regenerated.

- **AC-11 (missing template):** If the selected template does not exist, the
  export continues without the import and warning `TEMPLATE_MISSING` is
  reported.

- **AC-12 (composed: preset used by an export and the preview):** Switching the
  active preset changes both the next export and the preview (US-012) with no
  restart. A preset that sets only `page.bleed: 5` and nothing else inherits all
  other values from Defaults and built-ins; the effective page size of A5 trim
  becomes 158×220 mm.

- **AC-13 (heading numbering pattern, from US-002 AC-1b):** The field
  `headingNumbering` holds a Typst numbering pattern or `none`. A pattern
  without a counting symbol (`1`, `a`, `A`, `i`, `I`, and the other symbols of
  Typst) makes Typst fail with `invalid numbering pattern` (measured); the
  preset shows the notice `Invalid heading numbering; "1.1" is used` (like
  AC-8, a notice and not a conversion warning) and uses `"1.1"`:
  ```
  headingNumbering: "x"      -> notice, "1.1" is used
  headingNumbering: "a.1"    -> kept          "(1.1)" -> kept        none -> kept
  ```
  The counting symbols are those that Typst accepts; the test compiles every
  one of them and the failing example. Measured over U+0020 to U+27FFF with the
  bundled compiler (Typst 0.14.2) these are the 24 symbols `* 1 A I a i Α α א ١ ۱ १ ক ১ ① ⓵ あ い ア イ ㄱ 一 壹 가`; a test finds them again by
  bisection, so a compiler update that adds one fails until the list is
  extended. The check is `core`; the notice is shown when the preset is
  read, once per change.

- **AC-14 (effective settings for the pipeline):** A function in `core`
  turns preset, Defaults and built-ins into the input of `convert`
  (US-015 AC-3): `{page: PageGeometry, highlightColor, headingNumbering,
  externalLinkFootnotes, template: boolean}` plus the template text to copy.
  The page goes through `resolvePageSetup` (US-009); an error there makes the
  preset invalid (AC-4). `template` is true only when the template file exists
  (AC-11). Example: preset `page: {bleed: 5}` and nothing else →
  `pageWidth 158`, `pageHeight 220` (AC-12), `highlightColor "#ffeb3b"`.

- **AC-15 (export command; moved here from US-007 AC-1):** The command
  `Obsidian2Typst: Export current note` takes the effective settings of the
  active preset, asks for the folder (remembered per preset name, AC-7), reads
  the note, builds the `AssetIndex` over the vault (`getFiles` and the first 16
  bytes of a file), calls `convert` (US-015), then `runExport` (US-007).
  Exports of a note inside the presets folder are refused with `Presets are not
  exported`. The command is refused with the notice of AC-4 when the active
  preset is invalid. Notices: no note open → `Open a note to export it`; a note
  in the presets folder (also in a subfolder, not `presets-old`) → `Presets are
  not exported`; no preset at all → `There is no preset; create one in the
  settings of Obsidian2Typst`; a cancelled folder dialog starts nothing and
  shows nothing. The folder dialog opens at the folder last used with that
  preset; a preset without one opens it without a start folder.

- **AC-17 (operating the dialogs; found by M2, 2026-10-17; SCAR-013, SCAR-014):**
  The dialogs `New preset` and `Rename preset` have the focus in the name field
  when they open. Enter in the field has exactly the effect of clicking `OK`:
  a refused name shows its message in the dialog and keeps it open (example:
  `a/b` + Enter shows `A preset name cannot contain / \ : * ? " < > |`), an
  accepted name closes it. Escape closes the dialog without any change. Enter
  while an input method is composing text (`isComposing` true, or key code
  229) does not submit. `Delete` never deletes at once: it opens a
  confirmation dialog `Delete preset "<name>"?` with the text `The note moves to
  the trash, as set in Obsidian under "Deleted files".`, and, when the preset
  is the active one, the extra sentence `"<next>" becomes the active preset.`
  (`<next>` is the one `planDelete` names). The buttons are `Delete` and
  `Cancel`; the focus is on `Cancel` when the dialog opens, so Enter alone
  cancels; Escape cancels. Nothing is trashed, and the active preset does not
  change, before `Delete` is chosen, nor after `Cancel` or Escape. The last
  remaining preset is refused at once with `The last preset cannot be deleted`
  and no dialog opens.

- **AC-18 (reset icons of the Defaults rows; asked by the user 2026-10-17;
  SCAR-014):** Every row of the Defaults (highlight colour, heading numbering,
  footnotes for external links, template file, trim size, trim width, trim
  height, the four margins, gutter, bleed, slug, facing pages) has a reset icon
  with the tooltip `Use the built-in value`, as the Fonts rows of US-010 AC-6.
  It asks before it removes a value: `Reset "<label>"?` with `The value "<v>"
  is removed from the Defaults. Presets that do not set this field use the
  built-in value.` and the buttons `Reset` and `Cancel`; `<v>` is the value as
  written (`10.5`, `#aa3300`, `A5`), for a switch `on` or `off`. Nothing
  changes on `Cancel`, and a row without a value asks nothing and changes
  nothing. After `Reset` the row shows the empty field (switch off). Emptying a
  text or number field by typing is editing, not the icon, and stays without a
  question. The dialog is the one of the delete question (SCAR-014): the focus
  is on `Cancel` when it opens, Enter alone cancels, Escape cancels. The flow
  is the one of US-010 AC-6 (`resetDefaultField`), so the destructive call is
  not made before the user confirmed, and one helper serves the icons of both
  the Defaults rows and the Fonts rows (no row calls the removal on its own).
  The icon always acts on the value the Defaults hold at the moment of the
  click, not on the one shown when the tab was drawn (found by M2 on build
  `0.1.0-m5.3`: a value typed in the open tab was not reset until the tab was
  closed and opened again). Example: type `5` into `Bleed (mm)`, leave the
  field and click the icon at once: the question for `"5"` opens, without
  reopening the tab.
  Example: Defaults hold `bleed` 5; the icon of `Bleed (mm)` asks `The value
  "5" is removed from the Defaults...`; after `Reset` the field is empty and a
  preset that does not set `page.bleed` exports with the built-in bleed 0.
  The three rows of `Folders and warnings` have no reset icon (the worst
  misplaced click there changes a folder name that is typed again at once, and
  no stored value is lost), so they need no question.

- **AC-19 (a redraw keeps the scroll position; found by M2 step 14,
  2026-10-18; SCAR-016):** Whenever the settings tab draws itself again (a
  dropdown, a switch, the reset icon, a change of a preset), the part that
  scrolls keeps its position: the row the user was working on stays where it
  was and the tab does not jump to the top.

- **AC-20 (a text or number field is saved when it is left, not on every key;
  found by M2 step 14, 2026-10-18; SCAR-016, SCAR-017):** Every text and number
  field of the settings tab (the Defaults rows, the two trim size rows, the
  Fonts rows, `Presets folder`, `Warnings note folder`) is saved when the user
  leaves it or presses Enter, once, with the text that stands in it then. A
  half-typed value is never saved, validated or shown to the presets. Example:
  with the height 240 in the Defaults, typing `2` before `0` of a new `200` in
  `Trim height (mm)` raised `trimHeight must be at least 50 mm` for every
  preset; with `Presets folder` typed as `Obsidian2Typst/new`, nothing may
  create the folders `O`, `Ob`, … on the way. Switches and dropdowns are saved
  at once (one click is one value). A value that is refused when the field is
  left shows its message in the row as before (AC-9 of M2).

- **AC-16 (what the user checks by hand):** The settings tab and the command
  cannot be run outside Obsidian. Manual check M2 (settings tab: list, invalid
  marker, create, duplicate, rename, delete, Defaults) and M3 (export command
  end to end for the sample vault, US-024) are in `docs/technical/manual-checks/M02.md` and `M03.md`; the
  logic behind them is tested with fakes.

---

## Notes

- Frontmatter-based per-document overrides were not selected and are out of
  scope.
- Which fields exist is defined by US-001 AC-13 (highlight colour), US-002
  AC-1b (heading numbering), US-004 AC-1c (external link footnotes), US-009
  (page), US-010 (fonts and font folder), US-011 (cover). Later stories add
  fields; the schema is versioned (`schemaVersion: 1`) and migrations are
  tested.
- Decided by the user: presets are vault notes (sync and hand-editable),
  everything except strict mode and the warnings note folder is per preset,
  the template is imported with a wildcard plus a shadowing warning, and only
  the two built-in presets ship.
- Proposal to confirm: frontmatter notes (`.md`) rather than `.json` files,
  because Obsidian shows and edits notes natively and hides other file types by
  default.
- The vault compiler's own notes and the presets folder must stay out of the
  input file; the presets folder is not part of any compiled book.
- Decided by the user on 2026-10-17: the `yaml` package for parsing; the schema
  holds only the fields of finished stories; the built-in page default is the
  A5 print geometry with bleed 0; the tab edits the Defaults, preset fields are
  edited in the note; four tickets in this story (core, store, template and
  wiring, settings tab and command).
- US-007 AC-1 (the command and the remembered folder) is delivered by AC-15
  here; US-007 AC-6 and AC-7 are checked with it.

---

## Related tickets

- [TICKET-021](../tickets/TICKET-021-presets-core.md) — presets core (AC-1, 2, 4, 5, 6, 13, 14)
- [TICKET-022](../tickets/TICKET-022-preset-store-and-plugin-data.md) — store, plugin data, vault port (AC-1, 3 to 8, 12)
- [TICKET-023](../tickets/TICKET-023-template-and-export-command.md) — template and export command (AC-9 to 12, 14, 15)
- [TICKET-024](../tickets/TICKET-024-settings-tab.md) — settings tab, manual checks (AC-1, 4, 5, 13, 16)
- [TICKET-025](../tickets/TICKET-025-dialog-keys-and-delete-confirmation.md) — Enter key in dialogs, delete confirmation (AC-17)
- [TICKET-026](../tickets/TICKET-026-test-build-version-and-install.md) — unique test build version, install script (SCAR-012)
- [TICKET-035](../tickets/TICKET-035-defaults-reset-confirmation.md) — reset confirmation on the Defaults rows (AC-18)
