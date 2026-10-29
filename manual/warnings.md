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
  warnings.md`, in the **Warnings note folder** (settings tab; empty = vault
  root). It is overwritten on every export, also with `No warnings.`, so it
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

**Settings → Obsidian2Typst → Folders and warnings → Strict mode** (off by
default). With strict mode on, any conversion warning stops the export before
anything is written; the export folder stays as it was. The notice lists the
first five:

```text
Export aborted: 2 warnings (strict mode)
line 412: LINK_UNRESOLVED
FONT_MISSING
```

A good way to work: leave strict mode off while you fix the warnings, then
switch it on so that no future export slips through with a problem.

`IMAGE_FLOATED` and `IMAGE_MOVED` are an exception: they are known only after
the compile, so they are reported but never stop an export.

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
| `NODE_UNSUPPORTED` | An element the converter does not know; its text is kept. |
