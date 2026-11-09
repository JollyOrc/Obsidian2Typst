# Detail rows: a few properties as icons under a heading

[Back to the manual](manual.md)

A **detail row** is one line of small badges, an icon and a label each, set
directly under a heading: for example a pace, a kind and a requirement. The
facts live as properties of a note, the preset says which badge each one
becomes, and the plugin draws the row in the PDF and, in Obsidian, in reading
view. Notes keep their facts as data instead of a table in the text.

## Contents

- [The details block](#the-details-block)
- [Setting up the row](#setting-up-the-row)
- [What a badge shows](#what-a-badge-shows)
- [Links in a value](#links-in-a-value)
- [The row in the PDF](#the-row-in-the-pdf)
- [The row in Obsidian](#the-row-in-obsidian)
- [The drawing API for your own views](#the-drawing-api-for-your-own-views)
- [Warnings](#warnings)

## The details block

Put a fenced code block with the info string `o2t-details` directly under the
heading. It holds the properties as YAML; it is data and is never printed as
it is. The Obsidian Vault Compiler can write these blocks for you from the
properties of your notes (its format is described in
`docs/technical/details-block.md`).

````markdown
###### Reed Weaving
```o2t-details
pace: Brisk
kind: craft
needs: "[[#Basket Knots|Basket Knots]]"
starter: true
```
You weave reeds into mats, baskets and rope.
````

- The block stands directly under a heading of any level; blank lines between
  the two are fine. One block per heading.
- A block in a quote or a callout, under a glossary term, or after other text
  is not read (see [Warnings](#warnings)). A heading that also has an
  `o2t-entry` block is an entry: its details block is dropped.
- Keys are lower case in the block; the plugin compares them without regard
  to case. Keys that the preset does not name are ignored.

## Setting up the row

Without a `details` group in the preset there is no row: the blocks are read
and left out, with no warning. The group exists in preset notes only.

```yaml
details:
  color: "#7a4a2e"      # the colour of the text and the icons; default #7a4a2e
  size: 9.5             # pt; default 9.5
  items:                # the badges, in the order they are printed
    - key: pace
      icons:            # an icon per value: the vault path of an SVG file
        slow: Icons/slow.svg
        brisk: Icons/brisk.svg
      labels:           # a label per value
        slow: Slow
        brisk: Brisk
    - key: kind
      icon: Icons/kind.svg           # one icon for every value
      labels: {craft: Craft, lore: Lore}
    - key: needs
      icon: Icons/lock.svg           # no label: the value is printed
    - key: starter
      icon: Icons/sprout.svg
      label: Known from the start    # a flag: the label, only when true
```

- `key` is required; `icon`, `icons`, `label` and `labels` are optional. A
  value of `icons` or `labels` wins over the single `icon` or `label`.
- Icons are SVG files in the vault; every fill and stroke is drawn in the
  row's colour. The plugin prints no credit for icons: put the credit of the
  icons you use into the book's own credits.
- In **grayscale** (`colorMode: grayscale`) the row is `#4d4d4d`, whatever
  `color` says.
- The size is the text size of the row; the icons are 0.95 em, the gap
  between badges 1.1 em.

## What a badge shows

For each item, in the preset's order:

| The block says | The badge |
|---|---|
| a text or a number (`pace: brisk`) | the icon of that value and its label; with no label, the value as written |
| a flag (`starter: true`) | the item's icon and label |
| `false`, empty, blank or no key | nothing |
| a list or a map | nothing, and a warning |

- Values are compared without regard to case and without surrounding spaces:
  `Brisk`, ` brisk ` and `BRISK` are all `brisk`.
- A value the item's `labels` or `icons` do not know is printed as written,
  with the icon or label that exist, and the report says
  `DETAIL_VALUE_UNMAPPED`.
- A flag with neither icon nor label shows nothing. An empty `labels` or
  `icons` counts as not set.
- A block none of whose items has a value draws no row.

## Links in a value

A link in a value stays a link, as in the text. In the PDF it is a link to
the heading, with the page number after it under the same rules as every
other link (page numbers on, folios on, the heading's level within
`linkPageLevel`). In Obsidian it is an internal link. A value that a label
replaces is plain text. An image or an embed in a value prints its alt text
or its name, never a picture.

## The row in the PDF

The row is one paragraph directly under the heading, set in the preset's
colour and size, not justified; it wraps when it is long. An icon is never
left alone at the end of a line: it stays with the first word of its label.
The row stays with its heading and with the first lines of the text after
it, at every heading level. It is not a heading: it is not in the contents,
the outline or the bookmarks. The quick reference and the encounter sheet
list entries only and are not affected.

## The row in Obsidian

Reading view and live preview draw an `o2t-details` block as the same row,
with the **active** preset's `details` group. Instead of the row you see the
block itself with one notice:

| Case | Notice |
|---|---|
| the active preset has no `details` group | `No details row: the active preset has no details settings.` |
| the YAML does not parse | `DETAIL_YAML_INVALID (line N)` |
| the block is in a quote or callout | `DETAIL_BLOCK_IN_CONTAINER` |

Value problems are a notice line under the row. Changing the active preset,
or saving its note, redraws the open notes.

## The drawing API for your own views

For a view of your own (for example a `dataviewjs` block that shows a note's
facts):

```js
const api = app.plugins.plugins["obsidian2typst"].api;
const {badges} = await api.renderDetails(dv.container, {
  pace: "brisk", kind: "craft", needs: "[[Basket Knots]]", starter: true,
}, {heading: "Reed Weaving"});
```

- The first argument is the element to draw into; the second a plain object
  of properties (keys in any case; values text, numbers or booleans; a link as
  its text `[[Note|shown]]`); `options.heading` only names the heading in
  notices.
- It returns `{badges}`, the badge elements in the order drawn. The API adds no
  click handler.
- Without a `details` group it draws the notice above and returns no badge.
- `api.version` is still `1`; `api.renderStatblock` and `api.clearIconCache()`
  are as before (`clearIconCache()` forgets the icons of both).

## Warnings

All of these are listed with the others in [Warnings and strict
mode](warnings.md); in strict mode they stop the export.

| Code | Case |
|---|---|
| `DETAIL_YAML_INVALID` | the YAML of a block does not parse or is not a mapping |
| `DETAIL_ORPHAN_BLOCK` | the block is not directly under a heading |
| `DETAIL_BLOCK_TWICE` | a heading has two blocks; the first is used |
| `DETAIL_BLOCK_IN_CONTAINER` | the block is in a quote or a callout |
| `DETAIL_IN_GLOSSARY` | the block is under a glossary term |
| `DETAIL_BLOCK_WITH_ENTRY` | the heading also has an `o2t-entry` block; the entry wins |
| `DETAIL_VALUE_NOT_TEXT` | a value is a list or a map; it is left out |
| `DETAIL_VALUE_UNMAPPED` | a value is not in the item's `labels` or `icons`; it is printed as written |
