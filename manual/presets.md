# Presets

[Back to the manual](manual.md)

A preset is a named set of print settings, such as "A5 print" or "A4
digital". You switch the look of the whole book by choosing another preset.
Presets are ordinary notes in your vault, so they sync with the vault and you
can edit them by hand.

## Contents

- [A preset is a note](#a-preset-is-a-note)
- [Where a value comes from](#where-a-value-comes-from)
- [Choosing the active preset](#choosing-the-active-preset)
- [Creating, renaming and deleting presets](#creating-renaming-and-deleting-presets)
- [Editing a preset](#editing-a-preset)
- [Invalid presets](#invalid-presets)
- [Groups](#groups)
- [The details pop-up](#the-details-pop-up)
- [Menu items that change the active preset](#menu-items-that-change-the-active-preset)
- [Field reference](#field-reference)

## A preset is a note

Presets live in the presets folder (default `Obsidian2Typst/presets`; change
it in the settings tab under **Folders and warnings**). Each `.md` file there
is one preset:

- the file name without `.md` is the preset name;
- the YAML frontmatter holds the settings;
- the body is free text for your own remarks; the plugin ignores it.

```yaml
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

`schemaVersion` is the version of the preset format; a missing one means 1. A
note without frontmatter is a valid preset that sets nothing. Fields the
plugin does not know are ignored and kept.

The plugin ships two presets, created when the presets folder does not exist:

| Preset | Trim size | Bleed | Other |
| --- | --- | --- | --- |
| `A5 print` | A5 (148 × 210 mm) | 3 mm | facing pages, margins 18 / 22 / 15 / 15 mm, gutter 5 mm |
| `A4 digital` | A4 (210 × 297 mm) | 0 mm | `linkPageNumbers: false` (no page numbers after links in a screen PDF) |

Preset notes are never exported, and an export or preview never changes them.

## Where a value comes from

Each setting is taken from the first of these that sets it:

1.  the active preset note;
2.  the **Defaults** section of the settings tab;
3.  the built-in value.

A setting is *set* when it is present and not `null`. Groups merge field by
field: a preset with only

```yaml
page:
  margins:
    top: 20
```

changes the top margin and keeps every other page value from the Defaults or
the built-in values.

Example: the built-in body size is 10 pt. If the Defaults set 11 and the
preset sets nothing, the body is 11 pt; if the preset sets `9.5`, it is
9.5 pt.

Which settings can be where:

| Settings | Preset note | Defaults |
| --- | --- | --- |
| Page, fonts, highlight colour, heading numbering, link footnotes, template, link page numbers, page breaks, book, table of contents (depth, title, switches), image fit | yes | yes |
| Cover, callout styles, heading rules, group, table of contents place (`toc.heading`, `toc.position`) | yes | no |
| Presets folder, strict mode, warnings note folder | no | plugin settings |

## Choosing the active preset

The active preset is used by every export and by the preview. Choose it in
any of these places; they all show the same choice:

- the ribbon menu (printer icon), under **Preset**;
- the dropdown at the top of the [style panel](preview-panel.md);
- the **Use** button in the settings tab or in the details pop-up.

An invalid preset cannot be chosen. If the active preset is deleted or
renamed outside the plugin, the first preset by name becomes active.

## Creating, renaming and deleting presets

In **Settings → Obsidian2Typst → Presets**:

- **New preset** creates a note with only `schemaVersion: 1`.
- **Duplicate** copies the note, body and all, as `<name> copy` (or
  `<name> copy 2`, …).
- **Rename** renames the note through Obsidian, so links to it are updated.
- **Delete** asks `Delete preset "<name>"?` and moves the note to the trash as
  set in Obsidian. **Cancel** is the default button. If you delete the active
  preset, the dialog names the preset that becomes active. The last preset
  cannot be deleted.

In the name dialogs, Enter is the same as **OK** and Escape closes the dialog
without a change. A name is refused when:

- another preset has the same name, ignoring case (`a5 print` and
  `A5 print`);
- it contains `/ \ : * ? " < > |`;
- it is empty, starts or ends with a dot, or is longer than 100 characters;
- it is a Windows device name such as `CON`, `PRN`, `NUL`, `COM1` or `LPT1`.

You can also create, copy or rename a preset note in the file explorer like
any other note.

## Editing a preset

Open the preset note and edit its frontmatter, in source mode or in
Obsidian's properties view. The plugin reads the note again within two
seconds of a change; the settings tab, the style panel and the preview use the
new values at once. Changing only the body of the note has no effect.

Tips:

- Write colours in quotes: `"#8b5a2b"`. Without quotes, YAML reads `#` as the
  start of a comment.
- Use spaces, not tabs, for indentation.
- Use `null` or delete the line to go back to the Defaults.

## Invalid presets

A preset with broken YAML or a value that is not allowed is marked invalid.
The settings tab shows its first error with the line in the note, counted
from the opening `---` as line 1:

```text
invalid: page.bleed must be a number of at least 0 (line 5)
```

An invalid preset cannot be chosen. If the active preset becomes invalid, the
export and the preview stop with `Preset "<name>" is invalid: <error>` until
you fix the note; the plugin does not switch to another preset. A notice
appears once per change. Other presets are not affected.

One exception: a heading numbering pattern that Typst cannot use (for example
`headingNumbering: "x"`) does not make the preset invalid. The notice
`Invalid heading numbering; "1.1" is used` appears and `1.1` is used.

## Groups

With many presets, sort them into groups with the field `group`:

```yaml
group: Print
```

The settings tab, the ribbon menu and the panel's dropdown then list the
presets under their group names. Presets without a group are listed together.
`group` exists only in preset notes.

## The details pop-up

The **Details** button in the settings tab, and the info icon next to the
preset dropdown in the style panel, open a pop-up titled `Preset "<name>"`.
It lists every setting in three columns:

| Setting | In this preset | Used |
| --- | --- | --- |
| Highlight colour | | `#00ff00 (Defaults)` |
| Trim size | `A5` | `A5 (preset)` |
| Bleed (mm) | `3` | `3 (preset)` |
| Slug (mm) | | `0 (built-in)` |

**Used** is the value an export would use, with its source. At the end come
summary rows for the cover, the callout styles, the heading rules and the
place of the table of contents. For an invalid preset the pop-up shows the
error instead of the table.

Buttons: **Use** (make it active), **Open the note** (opens the preset note
and closes the pop-up), **Close**.

## Menu items that change the active preset

Some settings can be set from the editor or file explorer menu without
opening the preset note:

- **Use as glossary section** on a heading: see
  [Glossary and heading rules](glossary-and-heading-rules.md).
- **Table of contents before/after this heading** on a top-level heading: see
  [Book structure](book-structure.md#table-of-contents).
- **Use as cover** on an image: see
  [Images and the cover](images-and-cover.md#the-cover).

Each item asks first, in a dialog titled `Change preset "<name>"` that names
the exact change. Only that one setting is written; comments, the order of
the other lines and the body of the note are kept. The item is disabled when
there is no preset or the active preset is invalid.

## Field reference

All fields are optional. Lengths are in millimetres, font sizes in points.

```yaml
---
schemaVersion: 1
group: Print                     # preset notes only

# Text
highlightColor: "#ffeb3b"        # colour of ==highlight==
headingNumbering: "1.1"          # a Typst numbering pattern, or none
externalLinkFootnotes: true      # web addresses as footnotes
linkPageNumbers: true            # (p. 42) after internal links
linkPageLevel: 2                 # 1 to 6
linkPageWord: "p."               # the word before the page number
template: "Layout/book.typ"      # vault path of a Typst template

# Page
page:
  trimSize: A5                   # A4, A5, A6, US Letter
  trimWidth: 154                 # with trimHeight: wins over trimSize
  trimHeight: 216
  margins: {top: 18, bottom: 22, inside: 15, outside: 15}
  gutter: 5
  bleed: 3
  slug: 0
  facingPages: true
  folios: true                   # page numbers
  runningHeader: true
  runningHeaderLevel: 2          # 1 to 6
  breakBefore:                   # none, page, right, left
    h1: right
    h2: page

# Fonts
fonts:
  folder: "Layout/Fonts"         # vault folder with .ttf and .otf files
  default: "Libertinus Serif"
  body: {family: "EB Garamond", size: 10}
  heading: {family: "Cinzel", size: 18}
  caption: {size: 9}
  code: {family: "DejaVu Sans Mono"}

# Cover (preset notes only)
cover:
  mode: auto                     # auto, file, none
  file: "Sample/assets/cover.png"
  blankPageAfter: false
  cropWarningPercent: 5          # 0 to 100

# Callout styles (preset notes only)
callouts:
  example:
    fill: "#f3ead7"
    border: {color: "#8b5a2b", width: 1}
    inset: 8
    title: {text: "Example", color: "#8b5a2b"}
    font: {family: "EB Garamond", size: 9.5}
    icon: "Layout/Icons/quill.png"

# Heading rules (preset notes only)
headingRules:
  Glossary: glossary             # glossary, colophon, back-notes, none
  Imprint: colophon
  Notes: back-notes

# Book structure
book:
  signature: 0                   # 0, 4, 8, 16, 32
  romanFrontMatter: false
  firstChapter: left             # left, right
  colophonHeading: hidden        # hidden, printed
  backNotesHeading: hidden       # hidden, printed

# Table of contents
toc:
  depth: 0                       # 0 (none) to 6
  title: "Contents"
  pageNumbers: true
  dotLeaders: true
  heading: "Rules"               # preset notes only: place it at this H1
  position: before               # preset notes only: before, after

# Images
images:
  minScale: 100                  # 10 to 100 (%)
---
```

| Field | Built-in | Allowed values | Guide |
| --- | --- | --- | --- |
| `highlightColor` | `#ffeb3b` | `#rrggbb` | [Markdown support](markdown-support.md) |
| `headingNumbering` | `1.1` | a pattern with a counting symbol (`1`, `a`, `A`, `i`, `I`, …), or `none` | [Page layout](page-layout.md#heading-numbering) |
| `externalLinkFootnotes` | `true` | `true`, `false` | [Markdown support](markdown-support.md#links) |
| `linkPageNumbers` | `true` | `true`, `false` | [Page layout](page-layout.md#page-numbers-after-links) |
| `linkPageLevel` | `2` | whole number 1 to 6 | [Page layout](page-layout.md#page-numbers-after-links) |
| `linkPageWord` | `p.` | text, not empty | [Page layout](page-layout.md#page-numbers-after-links) |
| `template` | none | vault path of a `.typ` file | [Typst templates](templates.md) |
| `page.*` | A5, 18 / 22 / 15 / 15, gutter 5, bleed 0, slug 0, facing pages, folios, running header at level 2 | see guide | [Page layout](page-layout.md) |
| `page.breakBefore.h1` … `h6` | `none` | `none`, `page`, `right`, `left` | [Book structure](book-structure.md#page-breaks-before-headings) |
| `fonts.*` | Libertinus Serif, 10 pt; code DejaVu Sans Mono | see guide | [Fonts](fonts.md) |
| `cover.*` | `auto`, no blank page, 5 % | see guide | [Images and the cover](images-and-cover.md#the-cover) |
| `callouts.*` | Obsidian's callout colours | see guide | [Callout styles](callouts.md) |
| `headingRules` | `Glossary: glossary`, `Colophon: colophon`, `Back notes: back-notes` | `glossary`, `colophon`, `back-notes`, `none` | [Glossary and heading rules](glossary-and-heading-rules.md) |
| `book.*` | signature 0, roman off, first chapter `left`, both headings `hidden` | see guide | [Book structure](book-structure.md) |
| `toc.*` | depth 0, title `Contents`, page numbers and dot leaders on | see guide | [Book structure](book-structure.md#table-of-contents) |
| `images.minScale` | `100` | whole number 10 to 100 | [Images and the cover](images-and-cover.md#keeping-images-with-their-text) |
| `group` | none | text | [Groups](#groups) |
