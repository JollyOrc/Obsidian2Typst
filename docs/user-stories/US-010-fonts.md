# US-010 — Fonts: one default, overridable per role, loaded from the vault

**Status:** Done (2026-10-17, M5 passed on build `0.1.0-m5.2`)
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author,
**I want** to set a default font and override it for individual roles,
**so that** body text, headings, captions, and code look the way I want
without configuring every role.

---

## Acceptance criteria

- **AC-1 (fields, roles, precedence; decided by the user 2026-10-17):** Roles
  are `body`, `heading`, `caption`, `code`. The settings are preset-note fields
  and also exist in the Defaults of the settings tab (effective value = preset,
  else Defaults, else built-in, per field, as US-008 AC-1):
  ```
  fonts:
    folder: "Layouting/Fonts"   # vault folder with .ttf/.otf files, per preset (AC-3)
    default: "Libertinus Serif" # default family
    body:    {family: "EB Garamond", size: 10}   # size in pt
    heading: {family: "Cinzel", size: 18}
    caption: {size: 9}
    code:    {family: "DejaVu Sans Mono"}
  ```
  Every field is optional. Built-in values: `folder` none, `default` `Libertinus
  Serif`, `body.size` 10, `code.family` `DejaVu Sans Mono`. A role without its own
  `family` uses the default family, except `code`, whose built-in family is
  `DejaVu Sans Mono`. A role without its own `size`: `heading` keeps Typst's own
  size scaling, `caption` and `code` are `0.9em` (0.9 times the body), `body` is
  10 pt. A `heading.size` is one size for every heading level (limit of this
  version; sizes per level are backlog). Invalid values make the preset invalid
  (US-008 AC-4) with the line of the field: `fonts must be a group of settings`;
  `fonts.folder must be a vault folder path written as text`; `fonts.default must
  be a font family name written as text`; `fonts.<role> must be a group of
  settings`; `fonts.<role>.family must be a font family name written as text`;
  `fonts.<role>.size must be a number of pt greater than 0 and at most 200`. A
  family name is text with at least one character that is not a blank; `null` is
  unset. Examples: `body: 12` → `fonts.body must be a group of settings (line 5)`;
  `heading: {size: 0}` → `fonts.heading.size must be a number of pt greater
  than 0 and at most 200 (line 6)`; `default: ""` → `fonts.default must be a
  font family name written as text (line 4)`. Unknown role names are ignored.

- **AC-2 (resolved families and the Typst they give; worked example):** The
  preamble rule `text-and-fonts` (order 40, US-015 AC-2) writes exactly four
  lines, always, with the resolved families (after AC-4) and the resolved sizes:
  ```
  #set text(font: "Libertinus Serif", size: 10pt)
  #show heading: set text(font: "Cinzel")
  #show raw: set text(font: "DejaVu Sans Mono", size: 0.9em)
  #show figure.caption: set text(font: "Libertinus Serif", size: 0.9em)
  ```
  for default `Libertinus Serif`, `heading.family` `Cinzel`, body size 10. With
  `heading.size: 18` the heading line ends `, size: 18pt)`. A size is written
  without trailing zeros (`10.5pt`). Family names are written as Typst strings
  (quotes and backslashes escaped, US-013 `typstString`). Changing only the
  default to `EB Garamond` changes the body and caption lines but not the heading
  and code lines; changing only `body.family` changes only the `#set text` line.
  The four lines come after the page rules and before the highlight rule; no
  other rule moves. Family names match the files case-insensitively
  (`cinzel` finds `Cinzel`) and the name written is the one the file reports.

- **AC-3 (fonts from a vault folder, per preset):** When `fonts.folder` is set,
  every `.ttf` and `.otf` file in it and in its sub-folders (extension in any
  case) is given to the compiler together with the bundled fonts of US-007
  AC-13 (bundled first); the families they contain are the available families.
  A `.zip` file there is not opened: warning `FONT_ARCHIVE_IGNORED` (`Font
  archive ignored, unzip it first: Layouting/Fonts/Cinzel.zip`, line 0), one
  per zip. A folder that does not exist: `FONT_FOLDER_MISSING` (`Font folder not
  found: Layouting/Fonts`, line 0) and only the bundled fonts are used. A font
  file the compiler cannot read: `FONT_FILE_INVALID` (`Font file cannot be read:
  Layouting/Fonts/broken.ttf`, line 0), the file is skipped. Other files are
  ignored silently. Fonts are never copied into the export folder (licences);
  the `.typ` names families only.

- **AC-4 (missing family, fallback chain, messages):** A configured family that
  is neither in the vault folder nor bundled is reported with `FONT_MISSING`
  (line 0) and replaced: a role family by the default family (for `code`: by
  `DejaVu Sans Mono`); the default family itself by the bundled `Libertinus
  Serif`; a family not found and also the default missing: the role gets the
  bundled default. One warning per configured family and role (the default
  counts as role `default`). Messages: `Font "Cinzel" for heading was not found;
  "Libertinus Serif" is used` and `Default font "Foo" was not found; "Libertinus
  Serif" is used`. A role that has no family of its own and inherits a missing
  default gets no second warning. Example: default `Foo` (missing), `heading` =
  `Cinzel` (in the folder), `code` = `Bar` (missing) gives `#set text(font:
  "Libertinus Serif", …)`, heading `Cinzel`, code `DejaVu Sans Mono`, caption
  `Libertinus Serif`, and exactly two warnings: `Default font "Foo" was not found; "Libertinus Serif" is used` and `Font "Bar" for code was not found; "DejaVu Sans Mono" is used`.

- **AC-5 (glyph coverage by the plugin):** The plugin reads every font file of
  AC-3 and the bundled fonts with the compiler's `get_font_info` and answers
  `hasGlyph(family, codePoint)` itself; it does not rely on Typst. The distinct
  characters of the source text are checked against the resolved family of the
  role that shows them: `heading` for heading text, `code` for inline code and
  code blocks, `caption` for image captions, `body` for everything else
  (paragraphs, lists, tables, footnotes, quotes, link text). Spaces, control
  characters and invisible format characters (U+200B to U+200F, U+2060, U+FEFF,
  U+FE00 to U+FE0F) are not checked. Per font family, one warning
  `FONT_GLYPH_MISSING` lists up to 10 missing characters in code point order,
  with ` and N more` after the tenth for the rest, and the first source line where one occurs:
  `Font "Libertinus Serif" lacks 2 characters: ☠ U+2620, ⚔ U+2694 (first at line
  12)` (one character: `lacks 1 character: …`; 12 missing: the ten, then `and 2
  more`, written `<ten items, comma-separated> and 2 more (first at line N)`). Code points are written `U+` plus at least four upper-case hex digits.
  The same family used by two roles gets one warning with the union. Task-list
  glyphs keep their own rule (US-005 AC-6), which now uses the resolved body
  family.

- **AC-5b (feature glyphs):** A fixed list of glyphs that features need is kept
  in `core/fonts`: `☐` U+2610 and `☒` U+2612 (task lists). Later features add to
  it (for example ornaments).

- **AC-6 (font picker in the settings tab shows coverage):** The Defaults have
  a `Fonts` section with a folder field and, for the default family and each
  role, a family dropdown and (for roles) a size field. A dropdown lists the
  bundled families and the families of the folder in effect for the active
  preset (its `fonts.folder`, else the Defaults' folder), sorted
  case-insensitively, plus an entry for the current value when it is not found,
  shown as `<name> (not found)`. Under the default-family and body-family fields
  the picker shows the feature glyphs the font lacks. Example for a font
  without U+2610 and U+2612: `Missing: ☐ U+2610, ☒ U+2612. Task lists will use
  [ ] and [x].` For a font with both, nothing is shown; for one that lacks only
  one, only that one is named. The message changes when the selection changes.
  The size fields accept the numbers of AC-1 and show the message of AC-1 for
  anything else. The preset notes themselves are edited as text (US-008).
  Every Fonts row has a reset icon (as the other Defaults rows). It asks before
  it removes a value (SCAR-014): `Reset "Heading font"?` with `The value
  "Cinzel" is removed from the Defaults. Presets that do not set this field use
  the built-in value.` and the buttons `Reset` and `Cancel`; nothing changes on
  `Cancel`, and a row without a value asks nothing. Emptying the text field by
  typing is editing, not the icon, and stays without a question. The other
  Defaults rows get the same question (US-008 AC-18).

- **AC-7 (preview and export agree):** The resolved families, sizes and
  warnings come from one pure function (`core/fonts: resolveFonts`) that the
  export calls now and the preview (US-012) calls later; the list of font files
  given to the compiler is built by one function too. A test shows that the
  export request holds exactly the fonts that the function lists. The preview
  wiring is checked in US-012.

- **AC-8 (composed export, content not only success; SCAR-015):** A preset with
  `fonts.folder`, a missing default, a heading family from the folder, a code
  family that is missing and `body.size: 11` exports to a `.typ` with exactly
  the lines of AC-4's example (size 11pt), the warnings of AC-4, and a PDF that
  names the embedded fonts: the bundled `LibertinusSerif`, `DejaVuSansMono` and
  the folder font, whose text can be read back (`Hello`); a source character that
  the body font lacks gives the AC-5 warning. The export folder contains no font
  file.

---

## Notes

- Glyph coverage comes from the bundled compiler's `get_font_info` (spike S4);
  no font-parsing library is needed. The core only sees the injected
  `hasGlyph` interface; the plugin builds it from the font files.
- The compiler is silent about unknown families and missing glyphs, so the
  plugin produces `FONT_MISSING` and `FONT_GLYPH_MISSING` itself. The `.typ`
  names exactly one family per role (no Typst fallback list) so that what the
  plugin reports is what Typst uses.
- The plugin ships default fonts (spike S4: none come with the compiler):
  Libertinus Serif and DejaVu Sans Mono, delivered by US-007 AC-13 on
  2026-10-17. New Computer Modern is not bundled.
- Decided by the user 2026-10-17: settings in the Defaults and in preset notes;
  the vault font folder is per preset; sizes as in AC-1.
- My defaults to confirm: `code` falls back to `DejaVu Sans Mono` and not to the
  proportional default; `heading.size` applies to all levels; fonts are read from
  the vault on every export (measured cost is in the spike notes; a cache is
  backlog); new warning codes `FONT_FOLDER_MISSING`, `FONT_ARCHIVE_IGNORED`,
  `FONT_FILE_INVALID` become `active` in `docs/technical/warning-codes.md`
  together with `FONT_MISSING`.
- Tests are measured with the real compiler (SCAR-008, SCAR-015): the PDF names
  its fonts, text is readable, and a guard shows the result without fonts.
- Font licences: exported folders do not copy fonts. Compiling the `.typ`
  elsewhere needs the same fonts (`typst compile --font-path`).
- The vault already has `Layouting/Fonts.md` and zipped font collections; the
  user must unzip them into the font folder.
- Manual check M5: fonts from a vault folder in real Obsidian (what each page
  shows, the picker in the settings tab).

---

## Related tickets

- [TICKET-001](../tickets/TICKET-001-typst-wasm-spike.md) — Spike: bundled WASM Typst compiler
- [TICKET-030](../tickets/TICKET-030-fonts-core.md) — core: `fonts` preset fields, catalog, `resolveFonts`, fallback chain and messages, preamble rule 40 (AC-1, AC-2, AC-4)
- [TICKET-031](../tickets/TICKET-031-vault-fonts.md) — vault fonts: font info in the worker, font set, warnings of AC-3, export seam (AC-3, AC-7)
- [TICKET-032](../tickets/TICKET-032-glyph-check.md) — glyph check of the source text per role, feature glyphs, task-marker family (AC-5, AC-5b)
- [TICKET-033](../tickets/TICKET-033-fonts-settings-tab.md) — settings tab: Fonts section, dropdowns, glyph notice (AC-6)
- [TICKET-034](../tickets/TICKET-034-fonts-pdf-and-m5.md) — PDF checks and manual check M5 (AC-8)
