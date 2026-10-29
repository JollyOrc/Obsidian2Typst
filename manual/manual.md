# Obsidian2Typst manual

Obsidian2Typst turns one Markdown note, and the images it links to, into a
[Typst](https://typst.app) file and a print-ready PDF without leaving
Obsidian. You write in Obsidian as usual; the plugin sets the page size,
margins, fonts, page numbers, cover, callout boxes, glossary and book
structure from **presets** that you keep as notes in your vault.

This manual describes version 0.10.0.

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Ways to run the plugin](#ways-to-run-the-plugin)
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
2.  Click the printer icon in the left ribbon and choose **Export current
    note**, or run **Obsidian2Typst: Export current note** from the command
    palette.
3.  Pick a folder for the export in the system dialog. The plugin remembers
    the folder for each preset and opens the dialog there next time.
4.  The plugin converts and compiles the note. The PDF and the Typst file are
    written to the chosen folder.

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
| Export current note | Exports the active note with the active preset. |
| Open style panel | Opens the style panel with the preview in the right sidebar. |
| Check compiler (developer) | Compiles a test page and appends the result and timing to `o2t-check.md` at the vault root. Only for troubleshooting. |

### The ribbon menu

The printer icon (**Obsidian2Typst**) in the left ribbon opens a menu with:

- **Export current note** and **Open style panel**, as the commands.
- **Preset**: every preset, with a check mark at the active one. Click a
  preset to make it active. An invalid preset is shown as `<name> (invalid)`
  and cannot be chosen. If you use [preset groups](presets.md#groups), the
  presets are listed under their group names.

### Note menus

Right-click a Markdown note in the file explorer, or right-click inside the
editor, to get:

- **Export to PDF**: exports that note (it does not have to be the active
  one).
- **Preview**: shows that note in the style panel.

Preset notes do not get these items; presets are never exported.

The editor menu also offers items that change the **active preset** for the
line the cursor is on:

| The cursor is on | Menu item | Guide |
| --- | --- | --- |
| a heading | Use as glossary section / Stop using as glossary section | [Glossary and heading rules](glossary-and-heading-rules.md) |
| a top-level `#` heading | Table of contents before this heading / after this heading / Remove table of contents placement | [Book structure](book-structure.md#table-of-contents) |
| a line with an image | Use as cover / Stop using as cover | [Images and the cover](images-and-cover.md#the-cover) |

In the file explorer, an image file gets **Use as cover**, too.

Each of these items asks first, naming the preset and the exact change
(**Change preset** or **Cancel**; Cancel is the default). Only the one setting
is written; comments and the rest of the preset note stay as they are.

> **Note:** A right-click does not move the cursor in Obsidian. Click into
> the heading or image line first, then right-click.

## What an export produces

For a note called `Book.md`, the export folder gets:

| File | Content |
| --- | --- |
| `Book.typ` | The generated Typst source. It is regenerated on every export, so do not edit it by hand. |
| `Book.pdf` | The compiled PDF. |
| `template.typ` | A copy of your [Typst template](templates.md), if the preset uses one. |
| `assets/…` | Copies of the images the note uses, in the same folder layout as next to the note. Images from outside the note's folder go to `assets/_external/`. |
| `export-warnings.md` | The warning report of this export (`No warnings.` when there are none). |

A note called `template` is written as `template-note.typ` and
`template-note.pdf`, so it never replaces the template copy.

The same warning report is also written as a vault note,
`<note name> export warnings.md`, into the warnings note folder (the vault
root by default). Its line numbers are links: click one to jump to that line
of your note. See [Warnings and strict mode](warnings.md).

If Typst reports an error, no PDF is written, but the `.typ` file and the
assets are, so you can look at the problem. The notice names the file, line
and column, for example `Typst error at Book.typ:41:8: unknown variable: foo`.

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
version. The tab has four sections.

### Presets

One row per preset, sorted by name (or under group headings, if you use
groups). The active preset reads `Active`; an invalid one shows its first
error and the line in the note, for example
`invalid: page.bleed must be a number of at least 0 (line 5)`.

| Button | What it does |
| --- | --- |
| Use / In use | Makes the preset active. Disabled for the active and for invalid presets. |
| Details | Opens a table of every setting: what the preset sets and what an export would use, with the source (preset, Defaults, built-in). |
| Duplicate | Copies the note as `<name> copy`. |
| Rename | Renames the note; links to it are updated. |
| Delete | Asks first, then moves the note to the trash as set in Obsidian under **Files and links → Deleted files**. The last preset cannot be deleted. |
| New preset | Creates an empty preset note. |

The settings tab does not edit the preset fields: open the note and edit its
frontmatter.

### Defaults

Values that every preset uses when its note does not set them. Leave a field
empty, or set a dropdown to `—`, to use the built-in value. Each row has a
reset icon (**Use the built-in value**) that asks before it removes a value.

Text and number fields are saved when you leave the field or press Enter;
switches and dropdowns are saved at once. A value that is not allowed shows
its message under the row, and the previous value stays.

| Row | Built-in value | Meaning | Guide |
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

### Fonts

The font rows of the Defaults. A dropdown lists the bundled fonts and the
fonts in the font folder; under the default and body font it names the
check-box glyphs the font lacks. See [Fonts](fonts.md).

| Row | Built-in value |
| --- | --- |
| Font folder | none |
| Default font | Libertinus Serif |
| Body font, size (pt) | the default font, 10 pt |
| Heading font, size (pt) | the default font, Typst's sizes per level |
| Caption font, size (pt) | the default font, 0.9 × body size |
| Code font, size (pt) | DejaVu Sans Mono, 0.9 × body size |

### Folders and warnings

These three settings belong to the plugin, not to a preset.

| Row | Default | Meaning |
| --- | --- | --- |
| Presets folder | `Obsidian2Typst/presets` | Vault folder of the preset notes. If it does not exist, it is created with the two built-in presets. |
| Strict mode | off | Any conversion warning stops the export before anything is written. |
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
| [Presets](presets.md) | Preset notes, precedence, groups, the details pop-up, invalid presets, a reference of every field. |
| [Page layout](page-layout.md) | Page size, margins, bleed and slug, facing pages, page numbers, running header, page numbers after links, heading numbering. |
| [Fonts](fonts.md) | Font roles, your own fonts from a vault folder, missing fonts and glyphs. |
| [Images and the cover](images-and-cover.md) | Image sizes, where images are found and copied, keeping images with their text, the cover page. |
| [Callout styles](callouts.md) | Callouts as boxes, built-in styles, your own styles, icons and fonts. |
| [Glossary and heading rules](glossary-and-heading-rules.md) | Turning a `Glossary` section into term entries; marking the colophon and the back notes. |
| [Book structure](book-structure.md) | Page breaks before headings, colophon and back notes, front matter and roman folios, signatures, the table of contents. |
| [Typst templates](templates.md) | Your own `.typ` file to style the whole document. |
| [The style panel](preview-panel.md) | The preview, its rows and the page range. |
| [Warnings and strict mode](warnings.md) | The warning report, strict mode, and a list of every warning. |
| [Markdown support](markdown-support.md) | How each Markdown and Obsidian element is converted. |
