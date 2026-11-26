# Obsidian2Typst manual

Obsidian2Typst turns one Markdown note, and the images it links to, into a
[Typst](https://typst.app) file and a print-ready PDF without leaving
Obsidian. You write in Obsidian as usual; the plugin sets the page size,
margins, fonts, page numbers, cover, callout boxes, glossary and book
structure from **presets** that you keep as notes in your vault.

This manual describes version 0.19.0.

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Ways to run the plugin](#ways-to-run-the-plugin)
- [The export dialog](#the-export-dialog)
- [While an export runs](#while-an-export-runs)
- [What an export produces](#what-an-export-produces)
- [Presets in short](#presets-in-short)
- [The settings tab](#the-settings-tab)
- [What the converter understands](#what-the-converter-understands)
- [Guides for advanced topics](#guides-for-advanced-topics)

## Installation

The plugin runs on desktop Obsidian only (version 1.5.0 or later). It brings
its own Typst compiler and fonts, so you do not need to install Typst, and it
works offline.

1.  Download `main.js`, `manifest.json` and `styles.css` from the
    [releases page](https://github.com/JollyOrc/Obsidian2Typst/releases).
2.  Create the folder `<your vault>/.obsidian/plugins/obsidian2typst/` and
    copy the three files into it.
3.  In Obsidian, open **Settings → Community plugins**, reload the list and
    switch **Obsidian2Typst** on.

On its first start the plugin creates the folder `Obsidian2Typst/presets` with
two presets, `A5 print` and `A4 digital`. If the folder already exists, nothing
is created, so presets you deleted do not come back.

## Quick start

1.  Open the note you want to print.
2.  Click the printer icon in the left ribbon and choose **Export…**, or run
    **Obsidian2Typst: Export…** from the command palette.
3.  In the [export dialog](#the-export-dialog), pick the preset and the
    export folder (type an absolute path, or use **Choose folder…**), then
    press **Export** or Enter.
4.  The plugin converts and compiles the note and writes the PDF and the
    Typst file to that folder. A notice confirms it, for example
    `✅ Exported Book.pdf to /Users/me/Print`.

The plugin remembers the folder for each preset. From then on, **Export
current note** (and **O2T: Export to PDF** in a note's menu) exports at once
into that folder, without a dialog.

To see the result before you export, open the
[style panel](preview-panel.md): it shows the pages of the current note and
redraws them when you change a setting.

To change the look, choose another preset (the ribbon menu, the style panel or
the settings tab) or edit a preset note. See [Presets](presets.md).

## Ways to run the plugin

### Commands

Open the command palette (`Ctrl/Cmd + P`) and type `Obsidian2Typst`.

| Command | What it does |
| --- | --- |
| Export… | Opens the [export dialog](#the-export-dialog) for the active note. |
| Export current note | Exports the active note with the active preset at once, into that preset's remembered folder. Without a remembered folder it opens the export dialog. |
| Open style panel | Opens the style panel with the preview in the right sidebar. |
| Check compiler (developer) | Compiles a test page and appends the result and timing to `o2t-check.md` at the vault root. Only for troubleshooting. |

### The ribbon menu

The printer icon (**Obsidian2Typst**) in the left ribbon opens a menu with:

- **Export…**, **Export current note** and **Open style panel**, as the
  commands.
- **Preset**: every preset, with a check mark at the active one. Click a
  preset to make it active. An invalid preset is shown as `<name> (invalid)`
  and cannot be chosen. If you use [preset groups](presets.md#groups), the
  presets are listed under their group names.

### Note menus

Right-click a Markdown note in the file explorer, or right-click inside the
editor, to get the items below. In these menus every item of the plugin
starts with **O2T:**, so you can tell it from Obsidian's own items and those
of other plugins (the ribbon menu belongs to the plugin and has no prefix).

- **O2T: Export to PDF**: exports that note (it does not have to be the
  active one) at once, as **Export current note** does: into the active
  preset's remembered folder, or through the export dialog when there is
  none.
- **O2T: Preview**: shows that note in the style panel.
- **O2T: Preset for this note…**: chooses the preset this note is exported
  and previewed with (the property `typst-preset`), or the active preset; see
  [A preset for one note](presets.md#a-preset-for-one-note).

Preset notes do not get these items; presets are never exported.

The editor menu also offers items that change the **active preset** for the
line the cursor is on:

| The cursor is on | Menu item | Guide |
| --- | --- | --- |
| a heading | O2T: Use as glossary section / O2T: Stop using as glossary section | [Glossary and heading rules](glossary-and-heading-rules.md) |
| a top-level `#` heading | O2T: Table of contents before this heading / … after this heading / O2T: Remove table of contents placement | [Book structure](book-structure.md#table-of-contents) |
| a line with an image | O2T: Use as cover / O2T: Stop using as cover | [Images and the cover](images-and-cover.md#the-cover) |

In the file explorer, an image file gets **O2T: Use as cover**, too.

Each of these items asks first, naming the preset and the exact change
(**Cancel** or **Change preset**; Cancel comes first and has the focus). Only the one setting
is written; comments and the rest of the preset note stay as they are.

> **Note:** A right-click does not move the cursor in Obsidian. Click into
> the heading or image line first, then right-click.

## The export dialog

**Export…** opens a dialog titled `Export <note name>`. From top to bottom:

1.  **Preset**: a dropdown of the valid presets (grouped as in the ribbon
    menu), with the active one chosen. Invalid presets are not offered.
    Choosing a preset puts its remembered folder into the folder field
    (empty if it has none).
2.  **The export folder**: a full-width field, **Choose folder…** (the
    system's folder dialog) and **Export**. A folder that does not exist is
    created by the export. Under the field:
    - a red line when the folder cannot be used: `Choose an export folder.`
      (empty) or `Export folder "out" is not an absolute path.` **Export**
      is disabled while this line shows.
    - a grey line saying what will happen: `Book.pdf will be written.` or
      `Book.pdf exists (from 2026-11-17 14:02) and will be replaced.`
3.  **More options**: the gear opens the plugin's settings tab.

**Enter** exports (when **Export** is enabled). **Escape**, the close button
or a click outside close the dialog and save nothing. The folder and the
preset are saved only when **Export** runs: the folder becomes that preset's
remembered folder, and the preset becomes the active preset.

An export replaces the files of an earlier export in the same folder without
asking; the grey line tells you beforehand.

## While an export runs

A short export just ends with a notice. An export that is still running
after about 2 seconds opens a tab `Exporting <note name>` next to your tabs,
without taking the focus from your note. The tab shows:

- the current step: `Converting`, `Compiling`, `Compiling (2 of up to 8)`
  (see [Images and the cover](images-and-cover.md#keeping-images-with-their-text)),
  `Writing files`, `Compiling the encounter sheet`, `Checking word gaps`;
- a progress bar;
- the warnings as they are found: the code in bold, the message and the line
  of your note;
- **Cancel**.

**Cancel** stops the export at once, also during the compile. No PDF is
written; files that were already written (the `.typ`, the template, the
images) stay. At the end the tab reads `Exported`, `Export failed`,
`Export cancelled` or `Export aborted (strict mode)`, and **Cancel** becomes
**Close**. The tab stays until you close it; the next long export uses it
again.

Only one export runs at a time; a second one is refused with
`An export is already running.` While an export runs, the
[style panel](preview-panel.md) waits.

The notices (they stay about 5 seconds):

| Notice | When |
| --- | --- |
| `✅ Exported Book.pdf to /Users/me/Print` | The PDF was written. With warnings it adds `, 3 warnings (see export-warnings.md)`. |
| `❌ Export cancelled.` | You pressed **Cancel**. |
| `❌ Export failed: <message>` | Typst reported an error, or the export could not finish. |
| `❌ Export aborted: 3 warnings (strict mode)` | [Strict mode](warnings.md#strict-mode) stopped the export; the first five warnings follow. |

## What an export produces

For a note called `Book.md`, the export folder gets:

| File | Content |
| --- | --- |
| `Book.typ` | The generated Typst source. It is regenerated on every export, so do not edit it by hand. |
| `Book.pdf` | The compiled PDF. |
| `template.typ` | A copy of your [Typst template](templates.md), if the preset uses one. |
| `assets/…` | Copies of the images the note uses, in the same folder layout as next to the note. Images from outside the note's folder go to `assets/_external/`. |
| `export-warnings.md` | The warning report of this export (`No warnings.` when there are none). |
| `Book - Encounter Sheet.pdf`, `.typ` | The A4 encounter sheet, when the preset asks for it. See [Entries](entries.md#the-encounter-sheet). |

A note called `template` is written as `template-note.typ` and
`template-note.pdf`, so it never replaces the template copy.

The same warning report is also written as a vault note,
`<note name> export warnings.md`, into the warnings note folder (the vault
root by default). Its line numbers are links: click one to jump to that line
of your note. See [Warnings and strict mode](warnings.md).

If Typst reports an error, no PDF is written, but the `.typ` file and the
assets are, so you can look at the problem. The notice names the file, line
and column, for example
`❌ Export failed: Typst error at Book.typ:41:8: unknown variable: foo`.

With facing pages on, the PDF asks a PDF viewer to open as spreads (see
[Page layout](page-layout.md#facing-pages)).

The plugin never changes your note, your images or your preset notes during
an export or a preview.

## Presets in short

A preset is a note in the presets folder. Its frontmatter holds the settings,
for example:

```yaml
---
schemaVersion: 1
page:
  trimSize: A5
  bleed: 3
fonts:
  body: {family: "EB Garamond", size: 10}
---
My print edition.
```

Each setting is taken from the first place that sets it:

1.  the **active preset** note;
2.  the **Defaults** in the settings tab;
3.  the plugin's **built-in value**.

So a preset only needs the settings in which it differs. Changes to a preset
note apply to the next export and preview without a restart.

Some settings exist only in preset notes: the cover, callout styles, heading
rules, the preset group and the place of the table of contents.

The full description and a reference of every field are in
[Presets](presets.md).

## The settings tab

Open **Settings → Obsidian2Typst**. The first line shows the installed
version and, at its right, a bug icon, **Copy debug info**: it copies the
plugin's and Obsidian's versions, your enabled plugins with their versions
and the plugin's settings file as plain text, for a bug report (the notice
`Debug info copied.`). Nothing is sent anywhere. Below it are five sections: **Presets**, **Page**, **Text**,
**Book** and **Export**. Click a section's heading (or press Enter or Space
on it) to open or close it; Presets is open when you first open the tab, and
a section stays open or closed until you close Obsidian.

A section holds two kinds of rows:

- A **feature row** names a feature and says what it does. Some have a
  switch that turns the feature on or off; some have a gear icon (⚙) that
  opens a window with the feature's settings; some have both.
- A **plain row** is a single setting, edited on the spot.

### Presets

One row per preset, sorted by name (or under group headings, if you use
groups). The active preset reads `Active`; an invalid one shows its first
error and the line in the note, for example
`invalid: page.bleed must be a number of at least 0 (line 5)`.

Each row has **Use** (**In use** for the active preset; disabled for an
invalid one) and a gear that opens the preset's window. The same window
opens from the info icon next to the preset dropdown in the
[style panel](preview-panel.md).

| Button in the preset's window | What it does |
| --- | --- |
| Use / In use | Makes the preset active. Disabled for the active and for invalid presets. |
| Open the note | Opens the preset note in the editor. |
| Duplicate | Copies the note as `<name> copy`. |
| Rename | Renames the note; links to it are updated. An active preset stays active. |
| Delete | Asks first (**Cancel** is the first button and has the focus), then moves the note to the trash as set in Obsidian under **Files and links → Deleted files**. The last preset cannot be deleted. |
| Close | Closes the window (it has the focus, so Enter alone changes nothing). |

The window also shows a table of every setting: what the preset sets and
what an export would use, with the source (preset, Defaults, built-in).
Below the list, **New preset** creates an empty preset note.

The settings tab does not edit the preset fields: open the note and edit its
frontmatter.

### Page, Text and Book: the Defaults

These three sections hold the **Defaults**: values that every preset uses
when its note does not set them. Leave a field empty, or set a dropdown to
`—`, to use the built-in value. Each row has a reset icon (**Use the
built-in value**) that asks before it removes a value. A switch shows the
value an export would use, also when the Defaults leave it unset.

Each of the three sections ends with **Reset this section to defaults**. It
asks `Reset "Page" to its defaults?` (**Cancel** first) and then removes
your Defaults values of that section only, as if you had used every row's
reset icon; the other sections and your presets stay as they are.

In every question of the plugin (delete, reset, change preset), **Cancel**
is the first button and has the focus, so Enter alone changes nothing.

Text and number fields are saved when you leave the field or press Enter;
switches and dropdowns are saved at once. A value that is not allowed shows
its message under the row, and the previous value stays. When you close a
settings window (Escape, the close button or a click outside), what you typed
in its fields is saved as if you had left the field; a value that is not
allowed then shows its message as a notice.

| Section | Row | Kind | Settings behind the gear |
| --- | --- | --- | --- |
| Page | Page setup | gear | Trim size, Trim width / height, the four margins, Bleed, Slug, Facing pages, Gutter |
| Page | Page numbers | switch | — |
| Page | Running header | switch, gear | Running header level |
| Page | Page breaks | gear | Break before H1 … H6 |
| Text | Fonts | gear | Font folder, the four fonts and their sizes |
| Text | Heading numbering | plain | — |
| Text | Highlight colour | plain | — |
| Text | Page numbers in links | switch, gear | Link page level, Link page word |
| Text | Footnotes for external links | switch | — |
| Text | Template file | plain | — |
| Book | Book parts | gear | First chapter, Colophon heading, Back notes heading |
| Book | Roman folios in the front matter | switch | — |
| Book | Signatures | gear | Pages per signature |
| Book | Contents | gear | Contents depth, title, page numbers, dot leaders |
| Book | Image fit | gear | Smallest image size |
| Book | Print resolution | gear | Minimum print resolution |

The built-in value of every setting:

| Setting | Built-in value | Meaning | Guide |
| --- | --- | --- | --- |
| Highlight colour | `#ffeb3b` | Colour of `==highlighted==` text, `#rrggbb`. | [Markdown support](markdown-support.md) |
| Heading numbering | `1.1` | Numbering pattern: `1.1`, `a.1`, `(1.1)`, … or `none`. | [Page layout](page-layout.md#heading-numbering) |
| Footnotes for external links | on | Prints the address of a web link as a footnote. | [Markdown support](markdown-support.md#links) |
| Template file | none | Vault path of a `.typ` template. | [Typst templates](templates.md) |
| Trim size | `A5` | `A4`, `A5`, `A6`, `US Letter` or `Custom`. | [Page layout](page-layout.md#page-size-and-margins) |
| Trim width / height (mm) | — | Shown with `Custom`; saved together. | [Page layout](page-layout.md#page-size-and-margins) |
| Top, Bottom, Inside, Outside margin (mm) | 18, 22, 15, 15 | Page margins. | [Page layout](page-layout.md#page-size-and-margins) |
| Bleed (mm) | 0 | Extra area around the page for the printer. | [Page layout](page-layout.md#page-size-and-margins) |
| Slug (mm) | 0 | Empty area outside the bleed, for crop marks. | [Page layout](page-layout.md#page-size-and-margins) |
| Facing pages | on | Left and right pages with inside and outside margins. | [Page layout](page-layout.md#facing-pages) |
| Gutter (mm) | 5 | Extra inside margin for the binding; can be edited only while Facing pages is on in the Defaults. | [Page layout](page-layout.md#facing-pages) |
| Page numbers | on | Page numbers in the footer. | [Page layout](page-layout.md#page-numbers-and-running-header) |
| Running header | on | The current chapter title at the top of the page. | [Page layout](page-layout.md#page-numbers-and-running-header) |
| Running header level | 2 | Heading level shown in the header, 1 to 6. | [Page layout](page-layout.md#page-numbers-and-running-header) |
| Page numbers in links | on | Prints `(p. 42)` after internal links. | [Page layout](page-layout.md#page-numbers-after-links) |
| Link page level | 2 | Links to headings down to this level get the page number. | [Page layout](page-layout.md#page-numbers-after-links) |
| Link page word | `p.` | The word before the number. | [Page layout](page-layout.md#page-numbers-after-links) |
| Break before H1 … H6 | `none` | `none`, `page`, `right` or `left`. | [Book structure](book-structure.md#page-breaks-before-headings) |
| Pages per signature | 0 | `0`, `4`, `8`, `16` or `32`. | [Book structure](book-structure.md#signatures) |
| Roman folios in the front matter | off | `i`, `ii`, … before the first chapter. | [Book structure](book-structure.md#front-matter-and-the-first-chapter) |
| First chapter | `left` | Starts the first chapter on a `left` or `right` page. | [Book structure](book-structure.md#front-matter-and-the-first-chapter) |
| Colophon heading, Back notes heading | `hidden` | `hidden` or `printed`. | [Book structure](book-structure.md#colophon-and-back-notes) |
| Contents depth | 0 | `0` (no table of contents) to `6`. | [Book structure](book-structure.md#table-of-contents) |
| Contents title | `Contents` | Title above the table of contents. | [Book structure](book-structure.md#table-of-contents) |
| Contents page numbers, Contents dot leaders | on | Page numbers and dots in the table of contents. | [Book structure](book-structure.md#table-of-contents) |
| Smallest image size | 100 | How far an image may shrink to stay with its text, 10 to 100 %. | [Images and the cover](images-and-cover.md#keeping-images-with-their-text) |
| Minimum print resolution | 300 | Images printing below this dpi are reported; 0 turns the check off. | [Entries](entries.md#print-checks) |

The **Fonts** window lists the bundled fonts and the fonts in the font
folder; under the default and body font it names the check-box glyphs the
font lacks. See [Fonts](fonts.md).

| Row | Built-in value |
| --- | --- |
| Font folder | none |
| Default font | Libertinus Serif |
| Body font, size (pt) | the default font, 10 pt |
| Heading font, size (pt) | the default font, Typst's sizes per level |
| Caption font, size (pt) | the default font, 0.9 × body size |
| Code font, size (pt) | DejaVu Sans Mono, 0.9 × body size |

### Export

These three settings belong to the plugin, not to a preset.

| Row | Default | Meaning |
| --- | --- | --- |
| Strict mode | off | A switch: any conversion warning stops the export before anything is written (the warnings found after the compile never do). |

The export folder is not a setting of this tab: it is remembered per preset
when you export (see [The export dialog](#the-export-dialog)).
| Presets folder | `Obsidian2Typst/presets` | Vault folder of the preset notes. If it does not exist, it is created with the two built-in presets. |
| Warnings note folder | empty (vault root) | Where the `<note> export warnings.md` note is written. |

## What the converter understands

The plugin converts headings (numbered, with link targets), paragraphs, bold,
italic, strikethrough, highlight, inline code and code blocks, lists and task
lists, quotes, Obsidian callouts, tables, footnotes, internal links and
wikilinks, web links, images and image embeds with sizes. Frontmatter and
HTML comments are left out. Embedded notes (`![[Other note]]`) and math are
not converted yet. Links to other notes are looked up as headings of the
same note.

Details and the exact rules are in [Markdown support](markdown-support.md).

## Guides for advanced topics

| Guide | Topics |
| --- | --- |
| [Presets](presets.md) | Preset notes, precedence, groups, the preset's window, invalid presets, a reference of every field. |
| [Page layout](page-layout.md) | Page size, margins, bleed and slug, facing pages, page numbers, running header, page numbers after links, heading numbering. |
| [Fonts](fonts.md) | Font roles, your own fonts from a vault folder, missing fonts and glyphs. |
| [Images and the cover](images-and-cover.md) | Image sizes, where images are found and copied, keeping images with their text, the cover page. |
| [Callout styles](callouts.md) | Callouts as boxes, built-in styles, your own styles, icons and fonts. |
| [Glossary and heading rules](glossary-and-heading-rules.md) | Turning a `Glossary` section into term entries; marking the colophon and the back notes. |
| [Entries](entries.md) | Statblocks from `o2t-entry` blocks, entries chapters and their layouts, the quick reference, the encounter sheet, the print checks, the statblock in Obsidian and its API. |
| [Detail rows](details.md) | A row of icon badges under a heading from `o2t-details` blocks and the preset's `details` group, in the PDF and in Obsidian, and `api.renderDetails`. |
| [Encounter rows](encounters.md) | Prefilled encounter rows from `o2t-encounter` blocks: a row per creature with its attributes, boxes, track and attacks, for printing. |
| [Book structure](book-structure.md) | Page breaks before headings, colophon and back notes, front matter and roman folios, signatures, the table of contents. |
| [Typst templates](templates.md) | Your own `.typ` file to style the whole document. |
| [The style panel](preview-panel.md) | The preview, its rows and the page range. |
| [Warnings and strict mode](warnings.md) | The warning report, strict mode, and a list of every warning. |
| [Markdown support](markdown-support.md) | How each Markdown and Obsidian element is converted. |
