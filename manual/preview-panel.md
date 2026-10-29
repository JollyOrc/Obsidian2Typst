# The style panel

[Back to the manual](manual.md)

The style panel shows the pages of a note as they will be printed and lets
you change the Defaults next to the preview. Open it with the command
**Obsidian2Typst: Open style panel**, from the ribbon menu, or with
**Preview** in a note's menu. It opens in the right sidebar; there is only
ever one panel.

## What the panel shows

From top to bottom:

1.  **Preset**: a dropdown with the presets; choosing one makes it active
    for exports and the preview. Invalid presets are greyed out, with their
    error as tooltip. The info icon next to it opens the
    [details pop-up](presets.md#the-details-pop-up) of the active preset.
2.  **Page**: the rows of the Defaults (page, numbering, breaks, book,
    contents, images), the same rows as in the settings tab.
3.  **Fonts**: the font rows.
4.  **Cover**: the cover settings of the active preset, for reading only.
5.  **Pages**: the page range to show.
6.  **Refresh**.
7.  A status line, then the pages.

## Which value a row shows

Each row shows the value the next export would use. A row that the active
preset sets is disabled and reads, for example,
`Set by preset "A5 print"; change it in the preset note`. Every other row
edits the **Defaults**, exactly as the settings tab does; the panel never
writes a preset note.

## When the preview is redrawn

- The note shown is the last Markdown note you had open. The status line
  starts with `Preview of: <note>`.
- A change of a style value (a row, the active preset, a preset note, the
  Defaults) compiles again half a second after the last change.
- **Editing the note's text does not redraw the preview.** Press **Refresh**
  to read the note again.
- When you switch to another note, the panel shows
  `Note changed; press Refresh` and keeps the old pages, greyed, until you
  press Refresh.
- While an export runs, the preview waits.

## The page range

Type `all` (or leave the field empty), a page such as `4`, or a range such as
`3-5`, then press Enter or leave the field. The whole document is still
compiled; only the pages shown change. The range is kept while the panel is
open.

## Status line

- `Compiling…` while the compile runs.
- After a compile, the number of warnings: `no warnings`, `1 warning`,
  `2 warnings`. The full list is only written by an export (see
  [Warnings and strict mode](warnings.md)).
- After an error, the message, with the last good pages greyed out.

Images in the preview are reduced to at most 1200 pixels on their longest
side to keep it fast. The export always uses the original files.
