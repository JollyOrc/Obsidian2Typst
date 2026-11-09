# Warnings and strict mode

[Back to the manual](manual.md)

When something in a note cannot be converted as written (a link without a
target, a missing image, a font that is not found), the plugin does not stop
and does not hide it: it converts what it can and reports a **warning** with
the line in your note.

## The warning report

After each export:

- A notice shows the count, for example
  `Exported with 2 warnings. Report: Export/export-warnings.md`. With no
  warnings there is no notice.
- `export-warnings.md` is written to the export folder.
- The same report is written as a vault note, `<note name> export
  warnings.md`, in the **Warnings note folder** (settings tab, section
  **Export**; empty = vault root). It is overwritten on every export, also with `No warnings.`, so it
  never shows problems you have already fixed.

The report starts with a summary (one row per warning code with its count),
followed by the details:

```markdown
# Export warnings

| code | count |
|------|-------|
| LINK_UNRESOLVED | 2 |
| ASSET_MISSING | 1 |

## Details

| code | message | source line |
|------|---------|-------------|
| LINK_UNRESOLVED | No heading matches "\[\[Nowhere\]\]" | 412 |
```

In the vault note, each line number is a link: click it to open your note at
that line. Warnings that belong to no line (fonts, templates) show `-`.

The style panel shows the number of warnings of the last preview compile.

Warnings are never printed into the PDF.

## Strict mode

**Settings → Obsidian2Typst → Export → Strict mode** (off by default). With strict mode on, any conversion warning stops the export before
anything is written; the export folder stays as it was. The notice lists the
first five:

```text
Export aborted: 2 warnings (strict mode)
line 412: LINK_UNRESOLVED
FONT_MISSING
```

A good way to work: leave strict mode off while you fix the warnings, then
switch it on so that no future export slips through with a problem.

The warnings found after the compile are an exception: they are known only
when the PDF exists, so they are reported but never stop an export. They are
`IMAGE_FLOATED`, `IMAGE_MOVED`, `IMAGE_FIT_OFF`, `LAYOUT_NOT_SETTLED`, the
entries' layout warnings (`ENTRY_AUTO`, `ENTRY_LAYOUT_CONFLICT`,
`ENTRY_OVERFLOW`, `ENTRY_SPREAD_EMPTY`, `ENTRY_BLANK_PAGE`,
`ENTRY_UNPAIRED`, `SECTION_INTRO_OVERFLOW`), the print checks
(`IMAGE_LOW_DPI`, `TEXT_WIDE_GAP`, `TEXT_GAP_SCAN_FAILED`), the page-layout
warning of the PDF (`PDF_PAGE_LAYOUT_FAILED`) and the encounter
sheet's (`ENCOUNTER_SHEET_SMALL_BOXES`, `ENCOUNTER_SHEET_FAILED`). The
warnings of the entry blocks themselves (`ENTRY_*` of the block, `STAT_*`,
`TAG_UNMAPPED`, `ENCOUNTER_SHEET_EMPTY`) come from the conversion and do stop
a strict export.

## Typst errors

A Typst error is not a warning: the PDF is not written. The notice shows the
first error with file, line and column, for example
`Typst error at Book.typ:41:8: unknown variable: foo`. The `.typ` file and the
report are still written. Errors usually come from a
[template](templates.md).

## All warnings

| Code | Meaning |
| --- | --- |
| `HTML_UNSUPPORTED` | An HTML tag other than `<u>`, `<span>`, `<br>` was dropped; its text is kept. |
| `COMMENT_DROPPED` | HTML comments were removed (one warning with the count). |
| `HEADING_LEVEL_SKIPPED` | A heading level was skipped, e.g. from 1 to 3. |
| `HEADING_EMPTY` | A heading without text was left out. |
| `HEADING_RULE_NO_TERMS` | A glossary heading has no headings one level below it. |
| `HEADING_IN_TERM` | A deeper heading inside a glossary term is printed without number. |
| `ASSET_MISSING` | An image file was not found; a red placeholder is printed. |
| `ASSET_TYPE_UNSUPPORTED` | The image type is not PNG, JPEG, GIF, WebP or SVG. |
| `ASSET_INVALID` | The file's content does not match its extension, or it is empty. |
| `ASSET_REMOTE` | An image from a web address is not downloaded. |
| `ASSET_AMBIGUOUS` | Several vault files have the embed's name; the first is used. |
| `IMAGE_IN_HEADING` | An image in a heading is placed after the heading. |
| `IMAGE_FLOATED` | An image did not fit after its text; it was placed at the top of the next page. |
| `IMAGE_MOVED` | An image did not fit after its text and moved to the next page; the space before it stays empty. |
| `IMAGE_FIT_OFF` | Image fit could not settle the layout in 8 compiles; the PDF was made without it (images at full size). |
| `LAYOUT_NOT_SETTLED` | Typst could not finish the layout; page numbers, running headers and image places may be wrong. Also counted in the preview. |
| `LINK_UNRESOLVED` | No heading matches a link; its text is printed without link. |
| `LINK_AMBIGUOUS` | Several headings match a link; the first is used. |
| `LINK_URL_NOT_SPELLED` | A web link inside a heading gets no address footnote. |
| `EMBED_NOTE_UNEXPANDED` | An embedded note (`![[Other note]]`) is not included; its name is printed. |
| `TABLE_ROW_LONG` | A table row has more cells than the header; the extra cells are cut. |
| `FOOTNOTE_UNDEFINED` | A footnote reference has no definition. |
| `FOOTNOTE_UNUSED` | A footnote definition is never used, or defined twice. |
| `FOOTNOTE_UNCLOSED` | An inline footnote `^[` is not closed; it is kept as text. |
| `FOOTNOTE_NESTED` | A footnote reference inside a footnote was left out. |
| `FONT_MISSING` | A font family was not found; another font is used. |
| `FONT_FOLDER_MISSING` | The font folder does not exist. |
| `FONT_ARCHIVE_IGNORED` | A `.zip` file in the font folder was not read. |
| `FONT_FILE_INVALID` | A font file could not be read. |
| `FONT_GLYPH_MISSING` | A font lacks characters the note uses. |
| `TEMPLATE_MISSING` | The template file does not exist. |
| `TEMPLATE_SHADOWS_BUILTIN` | The template redefines a Typst built-in. |
| `TEMPLATE_NAME_TAKEN` | The template defines a name the plugin defines. |
| `TEMPLATE_RULE_IGNORED` | A top-level `#set` or `#show` in the template does not apply. |
| `COVER_MISSING` | The cover image was not found. |
| `COVER_TYPE_UNSUPPORTED` | The cover image type is not supported, or the file is broken. |
| `COVER_CROPPED` | More of the cover image is cut off than `cropWarningPercent`. |
| `COVER_BACK_UNSUPPORTED` | `cover.back` is set, but a back cover is not supported yet. |
| `CALLOUT_TYPE_UNKNOWN` | A callout type has no style; the default box is used. |
| `CALLOUT_ICON_MISSING` | A callout style's icon was not found or is not an image. |
| `BOOK_PART_JOINED` | A second colophon or back-notes section was joined to the first. |
| `BOOK_PART_EMPTY` | A colophon or back-notes section is empty and was left out. |
| `TOC_HEADING_MISSING` | The heading chosen for the table of contents is not in the note. |
| `ENTRY_YAML_INVALID` | An `o2t-entry` block is not valid YAML or not a list of keys; the entry has no statblock. |
| `ENTRY_ORPHAN_BLOCK` | An `o2t-entry` block does not stand directly under a heading. |
| `ENTRY_BLOCK_TWICE` | A heading has two `o2t-entry` blocks; the first is used. |
| `ENTRY_BLOCK_IN_CONTAINER` | An `o2t-entry` block sits in a quote, callout or list; it is not an entry. |
| `ENTRY_VALUE_NOT_TEXT` | A value of an entry is neither text, a number nor a list of them; it is left out. |
| `ENTRY_IN_GLOSSARY` | A block under a glossary term is not an entry and is not printed. |
| `DETAIL_YAML_INVALID` | An `o2t-details` block is not valid YAML or not a list of keys; no row. |
| `DETAIL_ORPHAN_BLOCK` | An `o2t-details` block does not stand directly under a heading. |
| `DETAIL_BLOCK_TWICE` | A heading has two `o2t-details` blocks; the first is used. |
| `DETAIL_BLOCK_IN_CONTAINER` | An `o2t-details` block sits in a quote or callout; it is not read. |
| `DETAIL_IN_GLOSSARY` | An `o2t-details` block under a glossary term is not read and not printed. |
| `DETAIL_BLOCK_WITH_ENTRY` | A heading has an `o2t-entry` block and an `o2t-details` block; the entry is read, the details block is dropped. |
| `DETAIL_VALUE_NOT_TEXT` | A value of a detail is a list or a map; it is left out. |
| `DETAIL_VALUE_UNMAPPED` | A value is not in the item's `labels` or `icons`; it is printed as written. |
| `ENTRY_TRACK_UNKNOWN` | An entry names a track cell the preset does not have. |
| `ENTRY_NO_LEDE`, `ENTRY_LEDE_SHORT` | An entry starts with something other than a paragraph (a list, an image, …), or its opening paragraph has fewer than 10 words; it is still set beside the statblock. |
| `STAT_BOXES_MANY`, `STAT_BOXES_NOT_NUMBER` | The box value is over 45, or not a whole number; no boxes are drawn. |
| `TAG_UNMAPPED` | An entry's tag has no label in `entries.tagLabels`; it is left out. |
| `STAT_SUM_MISMATCH` | The total of `entries.statblock.sum` does not equal the sum of its keys. |
| `STAT_ATTACK_NO_DICE` | An attack names no dice (`2d6`). |
| `ENTRY_OUTSIDE_CHAPTER` | An entry outside every entries chapter is printed as text with its statblock. |
| `ENTRY_NESTED_LAYOUT` | An entry inside another entry has a `layout`; it is printed inline. |
| `ENTRY_LAYOUT_UNKNOWN` | An entry's `layout` is not one of the layouts; `auto` is used. |
| `ENTRY_LAYOUT_CONFLICT` | A layout needs an illustration the entry lacks, or of another shape; another layout is used. |
| `ENTRY_AUTO` | The layout the automatic choice took, to copy into the block. |
| `ENTRY_OVERFLOW` | An entry runs past its page or spread. |
| `ENTRY_SPREAD_EMPTY` | A spread's right page stays mostly empty. |
| `ENTRY_UNPAIRED` | A page entry has no partner; its right page stays blank. |
| `ENTRY_BLANK_PAGE` | A blank page was added before an entry or a section opener. |
| `SECTION_INTRO_OVERFLOW` | A section's intro runs over its opener page. |
| `IMAGE_LOW_DPI` | An image prints below `images.minDpi`. |
| `TEXT_WIDE_GAP` | A justified line has a word gap wider than `entries.maxWordGap`. |
| `TEXT_GAP_SCAN_FAILED` | The word-gap scan could not read the PDF; no line was checked. |
| `PDF_PAGE_LAYOUT_FAILED` | A facing-pages PDF could not be set to open as spreads; it was written as compiled. |
| `ENCOUNTER_SHEET_EMPTY` | The encounter sheet is on, but the preset has no track and no box key. |
| `ENCOUNTER_SHEET_SMALL_BOXES` | The sheet's boxes shrank under 2.0 mm to fit the page. |
| `ENCOUNTER_SHEET_FAILED` | The A4 encounter sheet did not compile; the book was written. |
| `NODE_UNSUPPORTED` | An element the converter does not know; its text is kept. |
