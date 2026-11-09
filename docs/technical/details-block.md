# The `o2t-details` block

Owned by [US-038](../user-stories/US-038-detail-rows.md) (epic #152, decided at
G0 on 2026-11-09). This page is the one contract between the block's writer
and its readers (SCAR-040):

- **Writer:** the Obsidian Vault Compiler (its epic: ObsidianVaultCompiler#118,
  built against this page), which inlines each note that has detail
  properties into the compiled note.
- **Readers:** this plugin, Obsidian2Typst — the PDF export
  (`src/core/markers/details.ts`, `src/core/details/model.ts`), the preview
  in Obsidian and the drawing API (`src/plugin/details/processor.ts`); and
  the author's own vault views through the API.

## What the block is

One fenced code block under a heading, holding some of the note's properties
as YAML. It is data, never text: the plugin does not print it. Where the
plugin has a `details` preset group it draws **one row of badges** (an icon
and a label each) directly under the heading instead.

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

The row of that note, with the preset of the example below, reads (icons not
shown): `Brisk · Craft · Basket Knots · Known from the start`, each badge with
its icon, in the order of the preset.

## Rules for the writer

1. **Info string:** exactly `o2t-details`.
2. **Fence:** backticks, one more than the longest run of backticks in the
   content, at least three (as for `o2t-entry`).
3. **Place:** directly under the note's heading, only blank lines between
   them; one block per heading; never inside a quote, callout or list item;
   never under a glossary term; never beside an `o2t-entry` block of the
   same heading. **A note that has both entry keys and detail keys gets only
   the entry block, and the writer warns** (the reader, if it meets both
   under one heading, reads the entry and drops the details block with
   `DETAIL_BLOCK_WITH_ENTRY`). A note that is embedded as a section of
   another note gets no block. The block may sit under a heading of any
   level, 1 to 6 (deep levels such as 5 and 6 are normal).
4. **Form:** the fixed YAML form of the entry block: `yaml` 2.9.1 (YAML 1.2)
   with `stringify(value, {nullStr: ''})`, one key per line, double quotes
   only where YAML needs them (a value with `[[` or `: ` is quoted).
5. **Keys:** lower case.
6. **Content:** exactly the properties named by the writer's setting
   (`detailMarkerKeys` in the Vault Compiler), **in that order**, that the
   note has set; a listed key the note does not have is left out; `tags` is
   never written unless the author lists it. A note with none of the listed
   keys gets no block. No other property is written.
7. **Values:**
   - text or a number as it is (`Brisk`, `3`; a Text property that looks
     like a number is quoted, `"3"`);
   - a flag (a Checkbox property) as the YAML boolean `true` or `false`;
     `false` may be written or left out;
   - an empty property as `key:` (the reader treats it as not set);
   - **no list and no map** (the reader leaves such a value out with
     `DETAIL_VALUE_NOT_TEXT`).
8. **Links:** a wikilink in a value is converted by the writer to the same
   in-book link as in body text, in Obsidian's heading form:
   `[[#Basket Knots|Basket Knots]]` (a note's own heading; the alias is the
   text shown) or `[[Note#Heading|text]]`. Markdown links
   `[text](#Heading)` are read the same way. Bold and italic stay as
   Markdown. An image or an embed in a value is not drawn: the reader prints
   its alt text or its name.

## What the reader does

- Accepts any valid YAML 1.2 mapping, not only the fixed form. An empty block
  is an empty mapping: no row.
- Compares keys in lower case; the first of two keys that differ only in case
  wins. Keys that no preset item names are ignored without a warning.
- Takes the block out of the tree right after parsing, before any other step
  reads it (SCAR-034, SCAR-039): no other step sees an `o2t-details` code
  node. (The details scan runs before the entry scan; an `o2t-entry` block
  next to it does not matter for the place.)
- Builds the row from the preset's `details` group. **Without that group
  there is no row** and no warning: the block is read and dropped.

### The preset group `details` (preset notes only)

```yaml
details:
  color: "#7a4a2e"      # #rrggbb; built-in #7a4a2e; grayscale: #4d4d4d
  size: 9.5             # pt, greater than 0; built-in 9.5
  items:                # the badges in print order
    - key: pace
      icons:            # an icon per value (the vault path of an SVG file)
        slow: Icons/slow.svg
        brisk: Icons/brisk.svg
        swift: Icons/swift.svg
      labels:           # a label per value
        slow: Slow
        brisk: Brisk
        swift: Swift
    - key: kind
      icon: Icons/kind.svg          # one icon for every value
      labels: {craft: Craft, lore: Lore, feat: Feat}
    - key: needs
      icon: Icons/lock.svg          # no label: the value is printed
    - key: starter
      icon: Icons/sprout.svg
      label: Known from the start   # a flag: the label, only when true
```

- `key` (required, text, unique without regard to case); `icon` and
  `icons`, `label` and `labels` are all optional. A per-value entry wins over
  the single one; the single one is the fallback.
- **A text or number value** is matched without case and without
  surrounding spaces (`Brisk`, ` brisk `, `BRISK` are all `brisk`). Its badge
  shows the icon (`icons[value]`, else `icon`, else none) and the label
  (`labels[value]`, else `label`, else **the value as written**, typeset:
  bold, italic and links work).
- **A flag** (YAML `true`) shows the item's `label` (or `labels.true`) and
  `icon` (or `icons.true`); `false`, no key, `null` and empty text show
  nothing. A flag with neither icon nor label shows nothing.
- **Unmapped:** when the item has `labels` (and no single `label`) and the
  value is not in it, or has `icons` (and no single `icon`) and the value is
  not in it, the badge is printed with what is available (the value as
  written when there is no label) and `DETAIL_VALUE_UNMAPPED` is reported
  (once per item, at the block's line).
- A badge is printed only when it has an icon, a label or a value; a block
  none of whose items has a value gives no row.

### Warnings

All codes are listed in [warning-codes.md](warning-codes.md); strict mode
stops on them as on every conversion warning.

| Code | Case |
|---|---|
| `DETAIL_YAML_INVALID` | the YAML does not parse or is not a mapping; no row |
| `DETAIL_ORPHAN_BLOCK` | the block is not directly under a heading |
| `DETAIL_BLOCK_TWICE` | a second block under one heading (the first counts) |
| `DETAIL_BLOCK_IN_CONTAINER` | the block is in a quote or callout, at any depth |
| `DETAIL_IN_GLOSSARY` | the heading is a glossary term or inside one; no row |
| `DETAIL_BLOCK_WITH_ENTRY` | the heading also has an `o2t-entry` block |
| `DETAIL_VALUE_NOT_TEXT` | a list or map value of a key the preset uses; left out |
| `DETAIL_VALUE_UNMAPPED` | a value the item's maps do not know; printed as written |

## The PDF row

Directly after the heading (and before any other block), as one block that
stays with the heading and with the text after it (`sticky`), set at the
preset's `size`, in `color`, unjustified; the badges are separated by a gap of
1.1 em and the row wraps when it is long. An icon is 0.95 em square, recoloured
to the row's colour, and bound to the first word of its label (they never part
at a line end). The row is not a heading: it is not in the outline, the
contents or the bookmarks. In a link value, the link is a link to the in-book
heading, with the page number after it under the rules of US-018 (page numbers
on, the folios on, the link's heading level within `linkPageLevel`).

The quick reference and the encounter sheet read entries only and are not
affected. A heading inside an entry's body gets its row in the flow.

## The Obsidian preview and the drawing API

In reading view and live preview an `o2t-details` block is drawn as the same
row from the same model as the PDF (`src/core/details/model.ts`), with the
**active** preset's `details` group and `colorMode`. Instead of the row the
raw block is shown with one notice:

| Case | Notice |
|---|---|
| no valid active preset, or no `details.items` | `No details row: the active preset has no details settings.` |
| YAML that does not parse or is not a mapping | `DETAIL_YAML_INVALID (line N)` |
| the block is in a quote or callout | `DETAIL_BLOCK_IN_CONTAINER` |

A block with no badge draws nothing. Value checks (`DETAIL_VALUE_UNMAPPED:
pace: soon`) are a notice line under the row. A link value is drawn as an
Obsidian internal link (`a.internal-link`, `data-href`); a Markdown link as
an external link.

### The API (version 1)

```js
const api = app.plugins.plugins["obsidian2typst"].api;
api.version; // 1 — unchanged
const {badges} = await api.renderDetails(el, data, {heading: "Reed Weaving"});
```

- `el`: the element to draw into (Obsidian's `HTMLElement`).
- `data`: a plain object of note properties; keys in any case. Values are
  strings, numbers or booleans (a link as its text `[[Note|text]]`, as
  `String(link)` gives it); the preset decides what is drawn.
- `options.heading`: only the name in the notices; optional.
- Returns `{badges}`, the badge elements in drawn order (the API adds no click
  handler). Without a `details` group it draws the notice and returns an
  empty list.
- `api.clearIconCache()` forgets the icons of both kinds of drawing.
