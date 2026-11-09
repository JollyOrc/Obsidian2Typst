# US-038 — Detail rows: note properties drawn as a row of icon badges under a heading

**Status:** Code done (2026-11-09; #153 to #155 committed, #156 the documents and test build `0.14.0-m27.1`); waiting for manual check M27
**Introduced:** v0.14.0
**Implemented:** v0.14.0 (not released); tickets #153 to #156, test build `0.14.0-m27.1` (M27)
**Supersedes:** —

Epic #152 (the Vault Compiler's epic: ObsidianVaultCompiler#118). The format
of the block is the contract [`details-block.md`](../technical/details-block.md)
(the examples of this story are the contract's examples).

---

## Story

**As an** author of a book whose notes carry a few facts as properties (a
pace, a kind, a requirement, a flag),
**I want** those properties drawn as one row of small icon-and-label badges
directly under the note's heading, in the PDF and in Obsidian,
**so that** the facts are read at a glance and I no longer keep them as a
table in the note's body.

Decided by the author (G0 questions 1 to 11, 2026-11-09, all proposals
accepted; question 4 = (a)): the Vault Compiler writes a new generic block
`o2t-details` from the properties it is told to list (setting
`detailMarkerKeys`); this plugin reads it, draws the row from a new preset
group `details`, and offers the same drawing to the author's vault views as
`api.renderDetails`. Obsidian2Typst ships first (0.14.0); the Vault Compiler
follows.

### What reads the block (SCAR-040)

- The **PDF**: Typst 0.14.2 compiles the row; the readers of that PDF are
  not involved (a row is text and images).
- **Obsidian 1.x** (reading view, live preview): the code-block processor
  and `api.renderDetails`, drawn into the DOM. *Measured:* the existing
  statblock processor (US-035, same mechanism) in the scratch vault.
  *Not measured:* the published site (the author's statblock view is known
  to work there); a view line `dataviewjs` is vault-side (question 8).

### Today (inventory, SCAR-017, SCAR-027)

- An `o2t-details` block given to 0.13.1 is printed as a code block with its
  YAML and no warning (measured at G0); the reader must ship before the
  writer.
- `o2t-entry` would make these notes entries (a page each, or
  `ENTRY_OUTSIDE_CHAPTER`) and flattens links (measured at G0).
- **A link inside a value, measured 2026-11-09** (`convert` through the test
  rig, Typst text read, synthetic note, `linkPageNumbers` on, folios on,
  `linkPageLevel: 6`): in body text `[[#Reed|Reed]]`, `[[Reed]]` and
  `[x](#Reed)` all give `#link(<h-reed>)[…]` followed by `#page-ref(<h-reed>)`
  (without the switch no `#page-ref`); the entry block's reader flattens the
  same markup to its text (`flattenLinks`). Not measured: the link inside a
  `box`; covered by AC-9's compile.
- Users of the readers of `o2t-` blocks (SCAR-017 class): `scanEntryBlocks`
  and `ENTRY_BLOCK_LANG` (`markers/entries.ts`), `planEntries`, the
  glossary (`glossary.roles`), the statblock model and emitter, the preview
  processor and API (`plugin/entries/processor.ts`), the quick reference and
  the sheet (entries only), `trimLines` (code fences in the converter's
  output), the settings details view (`ENTRY_ROW_PATHS`), the plugin names
  (`plugin-names.ts`), the preamble registry, the warning registry.

---

## Acceptance criteria

All examples use the invented preset **E**:

```yaml
details:
  items:
    - key: pace
      icons: {slow: Icons/slow.svg, brisk: Icons/brisk.svg, swift: Icons/swift.svg}
      labels: {slow: Slow, brisk: Brisk, swift: Swift}
    - key: kind
      icon: Icons/kind.svg
      labels: {craft: Craft, lore: Lore, feat: Feat}
    - key: needs
      icon: Icons/lock.svg
    - key: starter
      icon: Icons/sprout.svg
      label: Known from the start
```

and a note whose block sits under `###### Reed Weaving`.

### The block

- **AC-1 (place):** A code block whose info string is `o2t-details` and that
  stands directly under a heading (blank lines make no node) is that
  heading's details block. It is taken out of the tree right after parsing
  (before the entry scan and every other step; no other step sees an
  `o2t-details` code node) and is never printed, under a heading of every
  level 1 to 6 (the examples: levels 6, 5 and 1). A fence of any length and
  tilde fences read the same. The details scan runs before the entry scan;
  an `o2t-entry` block next to it does not change a block's place.
- **AC-2 (YAML):** Any valid YAML 1.2 mapping is read, not only the fixed
  form; an empty block is an empty mapping (no row, no warning). Keys are
  compared in lower case, the first of two keys that differ only in case
  wins (`Pace: slow` + `pace: swift` → `slow`); keys no item names are
  ignored without a warning. YAML that does not parse, or is not a mapping,
  gives `DETAIL_YAML_INVALID "Reed Weaving"` at the block's first line and
  no row.
- **AC-3 (places that are not read):** Each case gives its warning at the
  block's first line, and the block is never printed:
  - text before the block, no heading above: `DETAIL_ORPHAN_BLOCK`;
  - a second block under the same heading (the first counts):
    `DETAIL_BLOCK_TWICE "Reed Weaving"`;
  - inside a quote or callout, at any depth, or in a list item's quote:
    `DETAIL_BLOCK_IN_CONTAINER` (the container is known from the tree,
    SCAR-041);
  - under a glossary term or inside a term's explanation:
    `DETAIL_IN_GLOSSARY "<term>"`, and the block's own warnings dropped;
  - under a heading that also has an `o2t-entry` block, in either order:
    the entry is read as before, the details block is dropped,
    `DETAIL_BLOCK_WITH_ENTRY "Reed Weaving"`.
- **AC-4 (values):** Per item, in the preset's order (`key` compared in lower
  case):
  - a **text or number** value (`4` and `"4"` alike) is matched without case
    and surrounding spaces: `pace: brisk`, `pace: " BRISK "` → label
    `Brisk`, icon `Icons/brisk.svg`;
  - the label is `labels[value]`, else `label`, else **the value as
    written** (typeset: bold, italic, links); the icon is `icons[value]`,
    else `icon`, else none;
  - a **flag** (YAML `true`) shows the label and icon of the item;
    `starter: false`, no key, `null` and empty or blank text show nothing; a
    flag item with neither icon nor label shows nothing;
  - **unmapped:** a value the item's `labels` (and no single `label`) or
    `icons` (and no single `icon`) do not know is printed as written, with
    the icon or label that exist, and `DETAIL_VALUE_UNMAPPED "Reed
    Weaving": pace: soon` at the block's line, once per item;
  - a **list or map** value of a key an item names is left out with
    `DETAIL_VALUE_NOT_TEXT "Reed Weaving": kind`, once per key; the other
    items are not affected;
  - an empty `labels` or `icons` map counts as not set.
  Examples with preset E (badges as `icon: label`; `-` = no icon):

  | Block | Badges | Warnings |
  |---|---|---|
  | `pace: brisk` `kind: craft` `needs: Basket Knots` | `brisk: Brisk`, `kind: Craft`, `lock: Basket Knots` | none |
  | `kind: lore` | `kind: Lore` | none |
  | `starter: true` | `sprout: Known from the start` | none |
  | `needs: has woven for a full season and keeps a loom of their own` (57 characters) | `lock: has woven for a full season and keeps a loom of their own` | none |
  | `{}` (empty) | no row | none |
  | `pace: soon` | `-: soon` | `DETAIL_VALUE_UNMAPPED "Reed Weaving": pace: soon` |
  | `kind: [craft, lore]` | no row | `DETAIL_VALUE_NOT_TEXT "Reed Weaving": kind` |
  | `starter: false` | no row | none |
  | `needs: 3` | `lock: 3` | none |
  | `kind: " Lore "` `Kind: feat` | `kind: Lore` (first key wins) | none |

### The preset group

- **AC-5 (the group):** `details` is a top-level group of a preset note (as
  `entries`: preset notes only, not the Defaults), with `items` (a list in
  print order), `color` (`#rrggbb`) and `size` (pt, greater than 0, at most
  the font-size limit of the other groups). Each item: `key` (required text,
  unique without regard to case), and optional `icon` (text: the vault path
  of an SVG file), `icons` (a map value → path), `label` (text), `labels`
  (a map value → text). A wrong type or a repeated key is a problem at its
  own line, in the form of US-016 AC-7. The messages: `details must be a
  group of settings`; `details.items must be a list of items {key, icon,
  icons, label, labels}`; `details.items[1].key must be a key`;
  `details.items[1].icon must be text` (also `label`);
  `details.items[2].labels must be a map of value → text`;
  `details.items[1].icons must be a map of value → path`;
  `details.items[2].key "pace" is listed twice`;
  `details.color must be a colour "#rrggbb"`; `details.size must be a
  number of pt greater than 0 and at most 200` (the number is the item's
  position, from 1); unknown fields are ignored; `null` is unset. A
  preset without the group, or with an empty `items`, draws **no row for any
  block, without a warning** (the block is read and dropped). The settings
  screen's details pop-up (US-021, US-029) lists `details.items`,
  `details.color` and `details.size` as rows with the source `preset`, when
  the note sets them.
- **AC-6 (the look, mockup 2a):** The row is set at `size` (built-in 9.5 pt)
  in `color` (built-in `#7a4a2e`); the icons are 0.95 em square, recoloured to
  the row's colour (every fill and stroke but `none`), and sit on the text's
  baseline raised by 0.15 em; the gap between badges is 1.1 em; the row is one
  paragraph, **not justified**, with 0.45 em below it and nothing above it.
  With `colorMode: grayscale` (US-030 AC-15) text and icons are `#4d4d4d`,
  whatever `color` says. At `size` 6, 9.5 (default) and 14 and with one,
  three and ten items the row keeps these rules.

### The PDF

- **AC-7 (order and content):** The row stands directly after the heading's
  line (before any other block of the heading, after the heading's own
  figures) and holds the badges in the preset's order, each as its icon, a
  non-breaking space and its label (or value). Example (note with
  `pace: brisk`, `kind: craft`, `needs: Basket Knots`): the heading line,
  then a blank line, then
  `#o2t-details((color: rgb("#7a4a2e"), size: 9.5pt, items: ((icon: "<written path>", body: [Brisk]), (icon: "<written path>", body: [Craft]), (icon: "<written path>", body: [Basket Knots]))))`;
  the printed text of the page reads `Brisk Craft Basket Knots` in that
  order, after the heading's text and before the first word of the body.
  Every label and value goes through the one Typst escaping function (a
  value `a_b #c` prints as written). A badge whose icon file is not found
  keeps its text and gives the usual missing-asset warning once (as the
  statblock's track icons do).
- **AC-8 (one row that wraps, icon and text):** The row is breakable: a row
  longer than the line wraps between badges (at the gap) or inside a label
  (at a space), unjustified. An icon is never left alone at a line end:
  *measured 2026-11-09, Typst 0.14.2, bundled fonts, 121 text widths from
  40 to 100 mm, 11 one-word labels:* with a plain space or a gap between the
  icon and its label the icon was parted from its word in 260 to 290 of 1,331
  placements; with a non-breaking space or a word joiner in 0 of 1,331. The
  row uses the non-breaking space. Example: a 57-character requirement
  (the one of the table above) at A5 print (text width 105 mm) wraps inside the row on a second line, and its
  icon stands before its first word on the first line it prints. A value of
  **400 words** (more than a page holds) prints every word, in order, on the
  pages the row spans (SCAR-015; the row is a breakable block, not a box).
- **AC-9 (links):** A link in a value that no label replaces stays a link:
  `needs: "[[#Basket Knots|Basket Knots]]"` gives `#link(<h-basket-knots>)[Basket
  Knots]` inside the badge; with `linkPageNumbers` on and the folios on, the
  page number follows under the body-text rule of US-018 (the same
  `linkPageLevel`, so a link to a heading of a level deeper than the setting
  gets none; an entry's heading always does, US-033 AC-8) and is a
  `#page-ref(<label>)`; without the switch none. `[x](#Basket%20Knots)`
  gives the same; an unresolved link gives `LINK_UNRESOLVED` as in body text,
  at the block's line, and keeps its text. A value replaced by a label
  (`labels`) is plain text, never a link. An image or an embed in a value
  prints its alt text or its name, never an image (decision: a row has icons
  only from the preset). In the PDF the link works (a link annotation).
- **AC-10 (stays with its heading and text):** The heading, the row and the
  first lines of the text never part across a page edge: the row is
  `sticky`, as the heading. Swept with filler paragraphs of 1 to 60 lines
  before a heading of each level 1 to 6 with a row of one line and of three
  lines: in every case the heading's page equals the row's page, and the
  row's page equals the page of the text's first line (SCAR-021: `sticky`
  only, no read-back, so no convergence question; Typst's convergence
  warning is read in the sweep). The row is not a heading: it is not in the
  outline, the contents or the bookmarks (their counts are those of the same
  note without the block), at any heading level.
- **AC-11 (composed):** One note, converted with every other story's built-in
  rules and compiled, shows the row in each of these places with the text
  intact: directly under a heading that is first in a chapter (with a page
  break before it); with a footnote call in the text after it; before a
  list, a table, a quote, a code block and a callout (each the first block
  after the row; the row's text is not parsed as part of them, SCAR-009,
  SCAR-010); a value that starts with `-`, `#`, `[`, `1.` or `>`; bold in a
  value; facing pages; `colorMode: grayscale`; a template (US-023) that
  sets the text colour; a heading inside a chapter entry's body (its row in
  the flow, below the small heading); the entries chapter on with the quick
  reference and the encounter sheet (they list only entries and are the
  same as without the details blocks: byte-identical pages for them);
  an entry of the same note with `o2t-entry` is unchanged by the details
  blocks of its neighbours; twice in one note under two headings.
- **AC-12 (warnings and strict mode):** Every `DETAIL_*` code is in the
  warnings file with its line; in strict mode a `DETAIL_*` warning stops the
  export like every conversion warning (US-006). Each condition of AC-3 and
  AC-4 gives its warning exactly once for one block (the reports are read by
  their exact list, SCAR-038: no duplicates, no false ones).
- **AC-13 (no change without the group):** A note without `o2t-details`
  blocks, or with them and a preset without the group, converts to the same
  Typst as 0.13.1 would for the note with the blocks removed (byte for
  byte); the preamble holds no details helper. The warnings about the place
  and the YAML of a block (AC-2, AC-3) do not depend on the preset: they are
  reported with or without the group.

### Obsidian

- **AC-14 (the code-block processor):** `registerMarkdownCodeBlockProcessor`
  draws every `o2t-details` block as the row, from the same model as the
  PDF (`src/core/details/model.ts`), with the **active** preset's `details`
  group and `colorMode`, read each time a block is drawn (SCAR-016,
  SCAR-022): `div.o2t-dt` with one `span.o2t-dt-item` per badge (an `img`
  of the recoloured icon as a data URI, 0.95 em, then the text), custom
  properties for colour and size (1 pt = 1/10.5 em as the statblock), flex
  wrapping with a 1.1 em column gap. A link value is an `a.internal-link`
  with `data-href` (a wikilink; the text its alias or target) or an
  external link (`[t](url)`). Instead of the row the raw block is shown with
  one notice: `No details row: the active preset has no details settings.`,
  `DETAIL_YAML_INVALID (line N)` or `DETAIL_BLOCK_IN_CONTAINER`; a block
  with no badge draws nothing; the value checks (AC-4) are a notice line
  under the row. A change of the active preset forgets the icons and
  redraws open notes, as for statblocks. At widths from 190 to 900 px the
  row's right edge never passes its container's (SCAR-025, measured by
  program in a browser harness).
- **AC-15 (the API):** `api.renderDetails(el, data, options?)` draws the
  same row for a plain object of note properties (keys in any case, values
  strings, numbers or booleans) with the active preset, and returns
  `{badges}`, the badge elements in drawn order; no click handler is added;
  `options.heading` names the heading in the notices. Without a `details`
  group it draws the notice and returns an empty list. `api.version` stays
  `1`; `api.renderStatblock` is unchanged; `api.clearIconCache()` forgets
  the icons of both. A value that is not text, a number or a boolean (a
  list, an object) is left out with `DETAIL_VALUE_NOT_TEXT` in the notice
  line, as in the PDF.

### One place (SCAR-017, SCAR-031)

- **AC-16 (one model, one scan, one name):** The PDF emitter, the processor
  and the API draw from one function, `detailsModel` (`src/core/details/
  model.ts`); key matching, value matching, the unmapped and not-text checks
  exist only there. The block's language name `o2t-details` is written in
  one source file (`src/core/markers/details.ts`) besides `main.ts`'s
  registration line; `src/plugin/main.ts` and the processor's wiring only
  hand objects over (text-checked); no other `src` file reads a code node
  with an `o2t-` language but the two scans.
- **AC-17 (documentation):** The contract page `details-block.md`, the
  manual (`manual/details.md`, linked from the index and `presets.md`),
  `warning-codes.md` (eight `active` rows), `tests.md` (the AC map),
  `architecture.md`, the shared-utilities register of the stories' README
  and the plugin names (`o2t-details`, `o2t-detail-icon`) are updated in the
  same change; every public text uses invented examples and passes the
  private word list.

---

## Notes

- **Decisions of the author** (2026-11-09; the G0 questions): (1) block and
  setting; (2) both keys → entry only (compiler side; AC-3 gives the
  reader's rule); (3) the preset group; (4a) links stay links; (5)
  unmapped and not-text; (6) no icon credit (the book's own credits);
  (7) API and processor; (8) the vault view is vault-side; (9) edge cases;
  (10) Obsidian2Typst first.
- **Decisions made while writing (for the author to confirm at the manual
  check):** a flag with neither label nor icon shows nothing; `false` and
  empty values show nothing and give no warning; **no group = no row and no
  warning** (the block is dropped silently, so one book can be compiled with
  a preset that has no row); the row is not justified; a link in a value
  follows the body-text page-number rule (level included); a value replaced
  by a label is not a link; an image in a value prints its alt text; an
  unmapped value warns once per item, not per badge shape.
- **Not measured:** the published site; Preview-style viewers are not
  involved; a row at a page edge in a real book (the sweep of AC-10 is on
  generated notes, 1 to 60 lines, one compiler); the browser harness for
  AC-14 is Chromium only.
- **Whole-tree checks** (SCAR-044): `tsc --noEmit`, `build-output` and the
  word-list check can be green only after the last code ticket.

---

## Related tickets

- [#153](https://github.com/JollyOrc/Obsidian2Typst/issues/153) — the block reader, the details model and the preset group (AC-1 to AC-5, AC-12, AC-16)
- [#154](https://github.com/JollyOrc/Obsidian2Typst/issues/154) — the row in the PDF (AC-6 to AC-13)
- [#155](https://github.com/JollyOrc/Obsidian2Typst/issues/155) — the Obsidian preview and the drawing API (AC-14 to AC-16)
- [#156](https://github.com/JollyOrc/Obsidian2Typst/issues/156) — documents, manual check M27 and the test build `0.14.0-m27.1` (AC-17)
