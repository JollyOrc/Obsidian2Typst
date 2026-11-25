# Encounter rows

An `o2t-encounter` block lists the creatures of a room or a scene. Obsidian2Typst
draws it as **encounter rows already filled in**: one framed row per creature,
with its name, its attributes, exactly as many tick boxes as its box value, its
own state track, every attack, and a line for notes. Print the page and tick
boxes at the table.

You normally do not write the block by hand: the Obsidian Vault Compiler
(0.26.0 or later) writes it from an `[!encounter]` callout of a room note and
copies each creature's properties into it. The format is in
[the encounter block](../docs/technical/encounter-block.md).

## What a row shows

- **The label:** the creature's name; with more than one, numbered (`Fen Hare 1`,
  `Fen Hare 2`). No two rows of a block have the same label. A dice count
  (`1d4`) prints as many rows as the highest roll and notes `1d4 (up to 4)` on
  the first.
- **The attributes** of `entries.statblock.stats`, filled in; the **traits** that
  are set, on their own line.
- **Tick boxes:** exactly the value of the box key (`entries.statblock.boxes`),
  in rows of 15; at most 45.
- **The state track:** the creature's own cells (`trackKey`), else the default
  cells; with `none`, no cells.
- **Every attack**, the name and the dice in bold; a long text wraps.
- **NOTES** and a line to write on.

A creature without properties (a plain name, or a note that is no entry) gets a
blank row: the name, empty attribute boxes, as many boxes as
`entries.encounterSheetBoxes`, every track cell, and three attack slots to fill
in by hand.

## Layout

Rows are two across when two rows of 88 mm fit the text width (an A4 page),
otherwise one across. A row never splits over a page; the list does, between
rows. For one room per page, set a page break before the room headings
(`breakBefore`, see [Page layout](page-layout.md)).

## Not drawn

A block inside a quote, a callout, a list item or a glossary term is left out
(`ENCOUNTER_IN_CONTAINER`). Without `entries.statblock` in the preset, every row
is blank (`ENCOUNTER_NO_STATBLOCK`). In Obsidian's reading view the block shows
as a code block; the rows are in the PDF and the preview panel.
