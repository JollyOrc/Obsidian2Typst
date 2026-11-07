# The `o2t-entry` block

Owned by [US-030](../user-stories/US-030-entry-data-and-statblock.md) AC-1 to
AC-7 (decided at G0 for epic #121, A1 to A9; measured 2026-11-06). This page
is the one contract between the block's writer and its reader (SCAR-040):

- **Writer:** the Obsidian Vault Compiler
  ([JollyOrc/ObsidianVaultCompiler#108](https://github.com/JollyOrc/ObsidianVaultCompiler/issues/108)),
  which inlines each entry note into the compiled note.
- **Reader:** this plugin, Obsidian2Typst (`src/core/markers/entries.ts`; the
  preview of US-035 uses the same reader).

## What the block is

One fenced code block per entry, holding the entry note's properties as
YAML. It is data, never text: the plugin does not print it.

````markdown
### Fen Hare
```o2t-entry
vigour: 11
might: 4
attacks:
  - "Kick: 2d6"
  - "**Bite**: 1d6"
skills:
  - Quick Step
tags:
  - beast
illustration: "![Drawn by A. Nobody](assets/hare.png)"
layout: auto
```
Fen hares are quick and shy. They live in reed beds and flee at the first sound.
````

## Rules for the writer

1. **Info string:** exactly `o2t-entry`.
2. **Fence:** backticks, one more than the longest run of backticks in the
   content, at least three (a value holding ```` ``` ```` gets a
   four-backtick fence).
3. **Place:** directly under the entry's heading, only blank lines between
   them; one block per heading; never inside a quote, callout or list item.
4. **Form:** the fixed YAML form, `yaml` 2.9.1 (YAML 1.2) with
   `stringify(value, {nullStr: ''})`. This is byte for byte what Obsidian's
   Properties panel writes (measured 2026-11-06): one key per line, two-space
   indent, lists in block style, double quotes only where YAML needs them, a
   Number property plain (`3`), a Text property that looks like a number
   quoted (`"11"`), an empty property as `key:`.
5. **Keys:** lower case.
6. **Content:** every property of the note except the writer's exclusion
   list, `tags` included. A note's frontmatter outside the block is never
   read as entry data.
7. **Illustration:** the image as `![credit](path)` or `![[path|credit]]`;
   the alt text is the picture credit. In the wikilink form an alias of
   digits or digits `x` digits (`300`, `300x200`) is a size, not a credit.
8. **Links:** link markup in values is flattened to its display text by the
   writer. Bold and italic stay as Markdown.

## What the reader does

- Accepts any valid YAML 1.2 mapping, not only the fixed form (flow lists,
  other key orders, other quoting give the same result). An empty block is
  an empty mapping.
- Compares keys in lower case; the first of two keys that differ only in
  case wins. Unknown keys are kept and ignored without a warning.
- Reads the keys its preset uses (`entries.statblock.stats`, `.traits`,
  `.boxes`, `.trackKey`, and `attacks`, `skills`, `tags`): a single value is
  text or a number (`4` and `"4"` are the same); a list is a list of text or
  numbers, or one text that is a one-item list; `null` and empty text are
  not set. Anything else gives `ENTRY_VALUE_NOT_TEXT` and is left out.
- Typesets bold and italic in values, prints link markup that still reaches
  it as its display text (never a link), and escapes every value.
- Warns and converts on (in strict mode a warning aborts the export, as
  every conversion warning does): `ENTRY_YAML_INVALID`, `ENTRY_ORPHAN_BLOCK`,
  `ENTRY_BLOCK_TWICE`, `ENTRY_BLOCK_IN_CONTAINER`, `ENTRY_VALUE_NOT_TEXT`,
  `ENTRY_IN_GLOSSARY` (a block under a glossary term is not an entry). See
  [warning-codes.md](warning-codes.md).
- Takes the block out of the tree right after parsing, before any other
  step reads it (SCAR-034, SCAR-039): no other step sees an `o2t-entry`
  code node.

## The Obsidian preview and the drawing API (US-035, #134)

In reading view and live preview a `o2t-entry` block is drawn as a
statblock from the same model as the PDF (`src/core/entries/model.ts`), with
the **active** preset's `entries` and `colorMode`. Code:
`src/plugin/entries/processor.ts`; styles: `styles.css` (`o2t-sb-*`).

Instead of a statblock, the raw block is shown with one notice:

| Case | Notice |
|---|---|
| no valid active preset, or no `entries.statblock.stats` | `No statblock: the active preset has no entries settings.` |
| no stat and no attack set | `No statblock: no stats or attacks.` |
| YAML that does not parse or is not a mapping | `ENTRY_YAML_INVALID (line N)` |
| the block is in a quote or callout | `ENTRY_BLOCK_IN_CONTAINER` |

The data checks of the statblock (`STAT_BOXES_MANY: 46`, …) are a notice
line under it. A missing value is shown as `—`; an attack without dice has
the class `o2t-sb-nodice`. Sizes: 1 pt of the preset = 1/10.5 em of the
editor's text. Boxes and cells have no click handlers.

A change of the active preset, or a save of its note, forgets the icons and
redraws the open notes that hold a block (reading views at once; live
preview through a refresh of the editor options — checked by hand).

### The API (version 1)

For the author's own vault views (a note preview, an encounter tracker):

```js
const api = app.plugins.plugins["obsidian2typst"].api;
api.version; // 1 — raised by a change that breaks callers
const {boxes, cells} = await api.renderStatblock(el, data, {heading: "Fen Hare"});
```

- `el`: the element to draw into (Obsidian's `HTMLElement`).
- `data`: a plain object of note properties; keys in any case (`Vigour`
  is `vigour`). Read with the active preset, as the block is.
- `options.heading`: the band; else `data.name`; else `—`.
- Returns the boxes and the track cells (`aria-label` = the cell's label)
  in their drawn order, so the caller can add its own click handlers; the
  API adds none. Without a statblock it draws the notice and returns two
  empty lists.
- `api.clearIconCache()` forgets the icons it has read.
