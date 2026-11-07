# Entries: statblocks, layouts and the encounter sheet

[Back to the manual](manual.md)

An **entry** is a creature, an item or anything else with numbers: a heading,
a block of data under it, and its text. The plugin prints the data as a
**statblock** beside the entry's opening paragraph and, inside an **entries
chapter**, gives every entry a page or a spread of its own, with its
illustration. Obsidian shows the same statblock in reading view. A quick
reference table and a printable encounter sheet can follow each chapter.

## Contents

- [The entry block](#the-entry-block)
- [Setting up the statblock](#setting-up-the-statblock)
- [The entries chapter](#the-entries-chapter)
- [Layouts](#layouts)
- [Openers, contents and the running header](#openers-contents-and-the-running-header)
- [The quick reference](#the-quick-reference)
- [The encounter sheet](#the-encounter-sheet)
- [Print checks](#print-checks)
- [The statblock in Obsidian](#the-statblock-in-obsidian)
- [The drawing API for your own views](#the-drawing-api-for-your-own-views)
- [Warnings](#warnings)

## The entry block

Put a fenced code block with the info string `o2t-entry` directly under the
entry's heading. It holds the entry's properties as YAML; it is data and is
never printed as it is.

````markdown
### Fen Hare
```o2t-entry
vigour: 11
might: 4
wits: 2
speed: 5
attacks:
  - "Kick: 2d6"
  - "**Bite**: 1d6"
skills:
  - Quick Step
  - Keen Nose
tags:
  - beast
illustration: "![Drawn by A. Nobody](assets/hare.png)"
layout: auto
```
Fen hares are quick and shy. They live in reed beds and flee at the first sound.
````

- Keys are compared without case (`Might` is `might`). A key the preset does
  not use is ignored.
- A value is text or a number; `**bold**` and `*italic*` are printed as such,
  a link as its text.
- `attacks` is a list of `name: dice` items; `skills` and `tags` are lists.
- `illustration` is one image, `![credit](path)` or `![[path|credit]]`; the
  credit is printed as a small caption under the picture.
- `layout` chooses the [layout](#layouts); missing means `auto`.
- One block per heading, never inside a quote, callout or list.

If you compile your book from separate notes with the Obsidian Vault
Compiler, it writes these blocks from each entry note's properties.

## Setting up the statblock

The statblock is configured in the preset note, in the group `entries`.
Without `entries.statblock.stats` no statblock is printed.

```yaml
entries:
  statblock:
    stats: [{key: might, label: Might}, {key: wits, label: Wits}, {key: speed, label: Speed}]
    traits: [{key: move, label: Move}, {key: guard, label: Guard}]
    boxes: vigour
    track:
      - {label: Fine, icon: "Icons/fine.svg"}
      - {label: Hurt, icon: "Icons/hurt.svg"}
      - {label: Down, icon: "Icons/down.svg"}
      - {label: Fading, icon: "Icons/fading.svg"}
      - {label: Gone, icon: "Icons/gone.svg"}
    trackKey: states
    trackLabel: STATE
    trackDefault: [Fine, Hurt, Down, Gone]
    sum: {total: vigour, of: [might, wits, speed]}
  tagLabels: {beast: Beast, magical: Magical}
colorMode: color
```

From top to bottom the statblock shows:

1. the **band** with the entry's heading, `◆ Fen Hare ◆`;
2. the **box row**: the `boxes` key's value as tick boxes, 15 to a row in
   groups of five (at most 45);
3. the **state track**: one cell per `track` item with its SVG icon,
   recoloured to the frame colour. An entry lists its cells under
   `trackKey` (`states: [Fine, Down]`), `none` for no track; without it
   the cells of `trackDefault` are used;
4. the **attributes** (`stats`) and the **traits** in one line each,
   `Might 4 · Wits 2 · Speed 5`;
5. the **attacks**, name and dice;
6. the **skills**, `Skills: Quick Step, Keen Nose`;
7. the **tags**, by their labels from `tagLabels`.

A part without data is left out. With `sum`, the plugin checks that the
total equals the sum of the other keys and warns when it does not.

The look: `fill`, `frame` (`{color, width}`), `rules`, `boxFill`, `fonts`
(by role: `band`, `values`, `text`, `skills`, `tags`) and `sizes` (in pt:
`band`, `value`, `label`, `text`, `attacks`, `skills`), all under
`entries.statblock`. `colorMode: grayscale` draws the statblock in gray for
black-and-white printing.

| Field | Built-in |
| --- | --- |
| `fill` | `none` |
| `frame` | `#000000`, 0.75 pt |
| `rules` | `#000000`, 0.4 pt |
| `boxFill` | `#ffffff` |
| `sizes` | band 11.5, value 11, label 5.5, text 7, attacks 7.5, skills 9 |

The statblock is never split across pages; it sits beside the entry's
opening paragraph.

## The entries chapter

Name the chapter's heading in `headingRules` with the rule `entries`:

```yaml
headingRules:
  Menagerie: entries
  Relics: entries
```

Inside it, a heading with an `o2t-entry` block is an **entry**; another
heading that holds entries is a **section** (`## Beasts`). An entry inside
another entry is printed inline in its parent's text. An entry outside every
entries chapter keeps its statblock but gets no page of its own
(`ENTRY_OUTSIDE_CHAPTER`).

## Layouts

**Page layouts** take one page; consecutive page entries of one section pair
up on facing pages. **Spread layouts** take a left and a right page.

| Layout | What it looks like |
| --- | --- |
| `page-text` | heading, statblock beside the opening paragraph, text |
| `page-landscape` | as `page-text`, the illustration at full width at the foot, at most 40 % of the page |
| `page-portrait` | the text in a 45 % column, the illustration in a 55 % column on the outer edge |
| `spread-text` | the text over two pages |
| `spread-landscape` | the text, then the illustration in the lower half of the right page |
| `spread-portrait` | the right page in two columns: text 45 %, illustration 55 % on the outer edge |
| `full-image` | the text on the left page, the illustration alone on the right page (no header or folio unless `entries.fullImageHeader: true`) |
| `auto` | chosen for you (see below) |

**`auto`** takes the page layout that matches the illustration (none →
`text`, wider than tall → `landscape`, taller → `portrait`) when the entry
fits one page, else the spread layout of the same kind. `full-image` is never
chosen. The plugin tells you what it chose (`ENTRY_AUTO "Marsh Owl":
page-landscape`), so you can write it into the block.

An illustration is scaled to fit its place and never cropped. To make an
entry fit, it may shrink down to `entries.image.minScale` (built-in 70 %).
An entry that still does not fit runs on to the next page; that page's
header reads `<heading> (continued)` and you get `ENTRY_OVERFLOW`.

A layout that needs an illustration the entry does not have, or whose shape
does not match the picture, is replaced by the `auto` choice
(`ENTRY_LAYOUT_CONFLICT`). A page entry without a partner leaves its right
page blank (`ENTRY_UNPAIRED`) unless the next section's opener can use it. A
spread whose right page stays mostly empty gives `ENTRY_SPREAD_EMPTY` when it
is at least `entries.emptyWarn` % empty (built-in 50; 0 turns it off).

Without facing pages, every entry simply starts on a new page.

## Openers, contents and the running header

The chapter heading opens a right page together with its first section.
Every later section opens the next right page, or the free right page of the
previous section's last entry (`ENTRY_BLANK_PAGE` when a blank left page has
to be added; `SECTION_INTRO_OVERFLOW` when a section's intro runs over its
page). With a table of contents, every entry is listed with its page,
whatever its heading level; headings inside an entry (`#### Habits`) are not.
Inside the chapter the running header shows the section's title. A link to
an entry gets its page number at any heading level (with page numbers in
links on).

## The quick reference

With `entries.quickReference: true`, a table follows each entries chapter on
a new left page: Entry, Section, the box value, each stat, Track (when a
track is set) and Page, one row per entry in the note's order. Its heading is
`entries.quickReferenceTitle` (built-in `Quick Reference`; empty for none),
at the level of the chapter's sections and in the contents. The Track column
reads `+ Fading` or `− Down` for one cell more or less than `trackDefault`,
`none`, or the list of cells. The table may run over several pages; its
header row repeats.

## The encounter sheet

A sheet of blank tracker rows for the table: a name and the stats, the tick
boxes and every track cell, and three attack slots per row. Unused boxes are
struck out by hand.

| Field | Value | Built-in |
| --- | --- | --- |
| `entries.encounterSheet` | the sheet as a page in the book | `false` |
| `entries.encounterSheetFile` | the sheet as an A4 file next to the PDF | `false` |
| `entries.encounterSheetBoxes` | 15, 30 or 45 tick boxes a row | 30 |
| `entries.encounterSheetText` | `{title, name, attack, dice, rule, credit}` | `Encounter Sheet`, `NAME`, `ATTACK`, `DICE`, no rule, no credit |

`rule` is one line under the icon key (how to mark the cells); `credit` is a
line at the foot of the page (your icons' licence). The sheet needs a state
track or a box key; without both you get `ENCOUNTER_SHEET_EMPTY` and no
sheet.

- **In the book:** after the quick reference (or the chapter's last entry),
  on a new page with a heading at the section level, as many rows as fit
  (5 on A5). On a wide page the rows stand two across.
- **The A4 file:** `<note> - Encounter Sheet.pdf` and `.typ` in the export
  folder, one A4 page, two rows across, as many as fit (14 with three stats
  and five track cells). A sheet that fails to compile gives
  `ENCOUNTER_SHEET_FAILED`; the book is written anyway.

Boxes smaller than 2.0 mm are hard to mark; when the page is too narrow, the
boxes shrink and you get `ENCOUNTER_SHEET_SMALL_BOXES`.

## Print checks

Two checks for print, both reported but never stopping an export, also in
strict mode:

- **Image resolution:** `images.minDpi` (built-in 300; 0 turns it off; the
  row **Print resolution** in the Book section) warns about every block image
  and the cover that prints below it, at its largest size:
  `IMAGE_LOW_DPI "assets/map.png": 138 dpi at 50.0 mm (min 300)`. Vector
  images are not checked. The preview checks this too.
- **Word gaps:** when your template justifies the text, narrow columns (the
  portrait columns and the opening paragraph beside the statblock) are set
  with `entries.narrowJustification` (built-in spacing 80 to 150 %, tracking
  −0.01 to 0.03 em). After the export, the PDF is scanned for justified lines
  whose widest gap is over `entries.maxWordGap` (built-in 200 %; 0 turns the
  scan off): `TEXT_WIDE_GAP "Reed Cat": "Reed cats are quiet" (264 %)` names
  the entry, or `p. 41` outside entries. Reword the line or add a hyphen.
  The preview does not scan.

## The statblock in Obsidian

In reading view and in live preview (with the cursor outside the block) an
`o2t-entry` block is drawn as the statblock, with the **active** preset.
Missing values show as `—`, an attack without dice is highlighted, and the
data warnings appear in a small line under it. When the preset has no
`entries` settings, the YAML is invalid or the block sits in a quote, the
block stays as it is with a notice above it. A change of the active preset,
or of its note, redraws open notes at once. The boxes and cells cannot be
clicked.

## The drawing API for your own views

Your own views in the vault, such as a note preview or an encounter tracker
written with DataviewJS, can draw the same statblock and add their own
clicks:

```js
const api = app.plugins.plugins["obsidian2typst"].api;
if (api?.version === 1) {
  const {boxes, cells} = await api.renderStatblock(dv.container, dv.current(), {heading: dv.current().file.name});
  for (const box of boxes) box.addEventListener("click", () => box.classList.toggle("marked"));
}
```

- `renderStatblock(el, data, options)` draws into `el` with the active
  preset; `data` is an object of note properties (keys in any case); the
  band is `options.heading`, else `data.name`, else `—`.
- It returns the boxes and the track cells in the order they are drawn
  (each cell has its label as `aria-label`). The API adds no clicks.
- `api.version` is `1`; a change that breaks your code raises it.

## Warnings

Every warning of entries is listed in [Warnings and strict mode](warnings.md).
The warnings of the blocks themselves (invalid YAML, a block in the wrong
place, data checks such as `STAT_BOXES_MANY` or `TAG_UNMAPPED`) come from the
conversion and stop a strict export. The layout warnings, the print checks
and the sheet's warnings are found after the compile and never do.
