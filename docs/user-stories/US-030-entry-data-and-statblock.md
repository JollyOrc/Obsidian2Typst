# US-030 — Entry data and the statblock

**Status:** Ready (G1 2026-11-06; decisions 1 to 4 answered the same day, G1 re-check)
**Introduced:** v0.12.0 (planned; a new feature bumps the minor version)
**Implemented:** —
**Supersedes:** —

Epic #121 (entry layouts). First of seven stories: US-030 entry data and the
statblock; US-031 layouts on facing pages; US-032 fit, overflow and the
automatic choice; US-033 openers, navigation and quick reference; US-034
print checks; US-035 the preview of entry blocks in Obsidian; US-036 the
encounter sheet. Drafts D-01, D-02, D-04, D-05, D-17, D-19 in
`docs/drafts/entry-layouts-tickets.md`.

---

## Story

**As an** author of a catalogue chapter (creatures, items, spells),
**I want** each entry's data, written by the Obsidian Vault Compiler as an
`o2t-entry` block under the entry's heading, typeset as a framed statblock
beside the entry's first paragraph, with tick boxes and a state track the
reader can mark in pencil,
**so that** a reader sees an entry's numbers at a glance and can track it in
play, without the author laying out each entry by hand.

Decided by the user (G0 for #121, 2026-11-05; spikes and revisions
2026-11-06; the decisions are recorded in the author's private spec and
summarised here):

- **Generic feature (G0-C1).** Game terms live in the preset, never in code.
  The built-in defaults are empty: no stat keys → no statblock; no tag map →
  no tags and no warnings; no track → no state track.
- **One input (G0-C14).** The `o2t-entry` block is the only source of entry
  data. A note's own frontmatter is never read as entry data.
- **Block contract (G0-A1 to A8).** The block holds every property of the
  note except the Vault Compiler's exclusion list, `tags` included, with
  lowercase keys. Its YAML is the fixed form measured on 2026-11-06 (below).
  The fence is one backtick longer than the longest backtick run in the
  content. The picture credit is the alt text of the illustration; values
  may hold bold and italic; links were flattened to text by the writer.
- **Look (G0-C6, C7, C12).** The preset wins over the template (as in
  US-023). A preset is grayscale only when it says `colorMode: grayscale`.
  The title band never shows a heading number.
- **Settings surface (G0-C8, C9).** `entries.*` appear in preset notes and
  the Details view (US-021) only. The 45/55 split, the 10-word lede
  threshold and the box row's spacing are named constants in one place.
- **Tracks (D48, D49, D52, D53; revised 2026-11-06).** A row of tick boxes,
  one per point of the value named by `entries.statblock.boxes`, and a state
  track of framed cells with icons; the leftmost unmarked cell is the
  current state. The track's block key and label are preset settings.

Measured (SCAR-024; code in `spikes/`, git-ignored):

- **YAML (2026-11-06).** What Obsidian's Properties panel writes for 13
  invented properties: one key per line, two-space indent, lists in block
  style, double quotes only where YAML needs them; a Number property plain
  (`3`), a Text property that looks like a number quoted (`"11"`). `yaml`
  2.9.1 (this plugin's dependency) reads every value with that type (YAML
  1.2: plain `yes` is the string `"yes"`, `empty:` is `null`) and
  `stringify(value, {nullStr: ''})` gives Obsidian's text back byte for
  byte. A list item typed by hand without quotes, `- B: 2d6`, is a map
  `{"B": "2d6"}`, not a string. The Properties panel refuses a key that
  differs from another only in case.
- **Icons in WASM (2026-11-06).** The bundled compiler reads an SVG file with
  `read()`, recolours it by replacing its `fill` text, and draws it with
  `image(bytes(...), format: "svg")`; the PDF's content stream fills with
  `0.478 0.290 0.180` for `#7a4a2e`. Measured with one synthetic icon.
- **`measure()` (2026-11-06,** `docs/technical/spike-entry-measure.md`**).**
  Used by US-031 and US-032, not here.

---

## Acceptance criteria

The examples use one invented entry, `Fen Hare`, and a preset with these
`entries` settings (synthetic field names; the built-in defaults are empty):

```yaml
entries:
  statblock:
    stats: [{key: might, label: Might}, {key: wits, label: Wits}, {key: speed, label: Speed}]
    traits: [{key: move, label: Move}, {key: guard, label: Guard}]
    boxes: vigour
    track: [{label: Fine, icon: "Icons/fine.svg"}, {label: Hurt, icon: "Icons/hurt.svg"},
            {label: Down, icon: "Icons/down.svg"}, {label: Fading, icon: "Icons/fading.svg"},
            {label: Gone, icon: "Icons/gone.svg"}]
    trackKey: states
    trackLabel: STATE
    trackDefault: [Fine, Hurt, Down, Gone]
  tagLabels: {beast: Beast, magical: Magical}
```

and this compiled Markdown:

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

#### Habits

They gather at dusk.
````

### Reading the block

- **AC-1 (the block is data, never text):** A fenced code block whose info
  string is `o2t-entry` is not printed. Its YAML is the data of the nearest
  heading above it, at any level 1 to 6, when only blank lines lie between
  the heading and the block. Fences of any length (three or more backticks,
  or three or more tildes) are recognised, so a block whose content holds
  three backticks in a four-backtick fence is read whole. Example: the PDF
  text of the example contains `Fen Hare` and `Fen hares are quick` and none
  of `vigour:`, `o2t-entry`, `- "Kick: 2d6"`.

- **AC-2 (the contract is written once):** `docs/technical/entry-block.md`
  specifies the block for its writer, the Obsidian Vault Compiler
  (JollyOrc/ObsidianVaultCompiler#108): the info string, the fence rule,
  where it goes, the fixed YAML form (`yaml` 2.9.1, YAML 1.2,
  `stringify(value, {nullStr: ''})`), lowercase keys, every property except
  the writer's exclusion list, the illustration's alt text as its credit,
  and that link markup is flattened by the writer. It names this plugin as
  its reader (SCAR-040). The reader accepts any valid YAML 1.2 mapping, not
  only the fixed form.

- **AC-3 (invalid YAML):** YAML that does not parse, or a block that is not a
  mapping (a list, a single value), gives `ENTRY_YAML_INVALID "<heading>"`
  with the block's first line; the heading and body are then laid out as
  ordinary text (no statblock). Example: `vigour: [11` →
  `ENTRY_YAML_INVALID "Fen Hare" (line 2)`.

- **AC-4 (blocks in the wrong place):**
  - a block with text (not only blank lines) between it and the heading
    above, or with no heading above, gives `ENTRY_ORPHAN_BLOCK` with its
    line and is not printed;
  - a second block under the same heading gives `ENTRY_BLOCK_TWICE
    "<heading>"` with its line; the first block counts, the second is not
    printed;
  - a block inside a quote or callout (any depth) is not an entry block: it
    gives `ENTRY_BLOCK_IN_CONTAINER` with its line and is not printed (the
    writer never puts one there; SCAR-041).

- **AC-5 (values):** Keys are compared in lowercase. Unknown keys are ignored
  without a warning (the block carries every property). A key the preset
  uses whose value has the wrong shape gives `ENTRY_VALUE_NOT_TEXT
  "<heading>": <key>` and that value is left out:
  - a single value (stat, trait, box value): text or a number; `4` and `"4"`
    print the same;
  - a list (attacks, skills, tags, the track key): a list of text or numbers,
    or one text that is treated as a one-item list (decision 2:
    `states: Fine` is `[Fine]`; `none` is the one word that means no track).

  Example: `attacks: [{B: 2d6}]` (from `- B: 2d6` typed without quotes) →
  `ENTRY_VALUE_NOT_TEXT "Fen Hare": attacks`, no attack printed for it.
  `null` and empty values count as not set.

- **AC-6 (formatting in values):** `**bold**` and `*italic*` / `_italic_` in
  values are typeset (`**Bite**: 1d6` → `Bite` in bold). Link markup that
  reaches a value (`[[Quick Step]]`, `[[Skills/Keen Nose|Keen Nose]]`,
  `[Keen Nose](x.md)`) prints its display text as plain text, never as a
  link and without a page number (`Quick Step`, `Keen Nose`). All value text
  goes through the one escaping function (US-013): `#`, `$`, `<`, `@` and
  `\` in a value print as written.

- **AC-7 (the illustration value):** The value names one image as
  `![alt](path)` or `![[path|alt]]` (or a bare path). The alt text is the
  credit (`Drawn by A. Nobody`). In the wikilink form, an alias that is only
  digits, or digits `x` digits (`300`, `300x200`), is a size in Obsidian and
  not a credit. The image and its credit are used by US-031; this story only
  reads them. An image that is not found gives the existing missing-image
  warning (US-003) and counts as no illustration.

### Settings

- **AC-8 (the `entries` group):** Preset notes get a group `entries` (US-008
  AC-2: unknown fields are kept). This story adds:

  | Field | Value | Built-in |
  |---|---|---|
  | `entries.statblock.stats` | list of `{key, label}` | empty |
  | `entries.statblock.traits` | list of `{key, label}` | empty |
  | `entries.statblock.boxes` | a key | unset |
  | `entries.statblock.track` | list of `{label, icon}` (icon: vault path of an SVG) | empty |
  | `entries.statblock.trackKey` | a key | unset |
  | `entries.statblock.trackLabel` | text | unset (no label line) |
  | `entries.statblock.trackDefault` | list of track labels | all cells of `track` |
  | `entries.statblock.sum` | `{total: key, of: [keys]}` | unset |
  | `entries.statblock.fill` | colour `#rrggbb` or `none` | `none` |
  | `entries.statblock.frame` | `{color, width}` (pt, 0 to 5) | `#000000`, 0.75 |
  | `entries.statblock.rules` | `{color, width}` | `#000000`, 0.4 |
  | `entries.statblock.boxFill` | colour or `none` | `#ffffff` |
  | `entries.statblock.fonts` | `{band, values, text, skills, tags}` family names | the body font |
  | `entries.statblock.sizes` | `{band, value, label, text, attacks, skills}` in pt | 11.5, 11, 5.5, 7, 7.5, 9 |
  | `entries.tagLabels` | map tag → label | empty |
  | `colorMode` | `color` or `grayscale` (top level) | `color` |

  Invalid values make the preset invalid (US-008 AC-4) with the line of the
  field and a message naming it, in the form of US-016 AC-7. Examples (note
  starts `---`, `schemaVersion: 1`, `entries:` on line 3, `statblock:` on
  line 4): `boxes: [vigour]` on line 5 → `entries.statblock.boxes must be a
  key (line 5)`; `trackDefault: [Fine, Lost]` → `entries.statblock.trackDefault
  names "Lost", which is not in entries.statblock.track (line 5)`;
  `frame: {width: 9}` → `entries.statblock.frame.width must be a number of pt
  from 0 to 5 (line 5)`. `null` is unset.

- **AC-9 (where they show):** The Details view (US-021 AC-6) lists every
  `entries.*` field the preset sets, with its source, in the order of the
  table. The settings tab's Defaults and the style panel get no rows
  (G0-C9).

### The statblock

- **AC-10 (parts and order):** An entry whose block sets at least one stat or
  one attack gets a framed statblock. Top to bottom, separated by rules of
  `entries.statblock.rules`:
  1. **title band:** the heading's plain text (US-017 AC-2's `visibleText`),
     between ◆ ornaments, centred, in the band font. Never a heading number
     (G0-C12): with numbered headings `### 3.2 Fen Hare` prints the band
     `◆ Fen Hare ◆`.
  2. **box row** (AC-12) and **state track** (AC-13);
  3. **attributes line:** each stat of `entries.statblock.stats` that is set,
     as `<label> <value>`, joined with ` · `, centred (`Might 4 · Wits 2 ·
     Speed 5`); then the **traits line** the same way from `traits`. A line
     with no field set is left out;
  4. **attacks:** one line per item of `attacks`, the text before the first
     `: ` left and the rest right-aligned (`Kick` … `2d6`); an item without
     `: ` is left-aligned whole (decision 1: `Kick 2d6` prints `Kick 2d6` on
     the left, nothing on the right);
  5. **skills:** `Skills:` in italic, then the items joined with `, `
     (`Skills: Quick Step, Keen Nose`);
  6. **tags** (AC-14).

  Example: the PDF text of the example's statblock is, in this order,
  `◆ Fen Hare ◆`, `VIGOUR`, `11`, `STATE`, `Might 4 · Wits 2 · Speed 5`,
  `Kick`, `2d6`, `Bite`, `1d6`, `Skills: Quick Step, Keen Nose`, `Beast`.

- **AC-11 (no data, partial data):** Each part is left out when it has no
  data. With no stat set and no attacks, there is no statblock at all (no
  box row, no track) and the first paragraph runs full width. Examples: only
  `attacks: ["Kick: 2d6"]` → a statblock with band, track and the attack;
  only `skills` and `tags` → no statblock.

- **AC-12 (box row, D48, D52):** With `entries.statblock.boxes: vigour`, the
  row shows on the left the key's label in upper case (`VIGOUR`; the label is
  the key when it has no entry in `stats`) above its value, and on the right
  one empty box per point, 15 per row in three groups of 5, filled from the
  top left. The boxes share the remaining width (box size = (width − 12 ×
  0.35 mm − 2 × 1.25 mm) / 15; label column 7.5 mm; named constants). The
  box value is not repeated in the attributes line.

  | Value | Result |
  |---|---|
  | `11` | 11 boxes, one row |
  | `15` | 15 boxes, one row |
  | `16` | two rows: 15 + 1 |
  | `45` | three rows of 15 |
  | `46` | `46` printed, no boxes, `STAT_BOXES_MANY "Fen Hare": 46` |
  | `0` | `0` printed, no boxes, no warning |
  | `"varies"`, `2d6` | printed as written, no boxes, `STAT_BOXES_NOT_NUMBER "Fen Hare"` |
  | `-3`, `2.5` | printed as written, no boxes, `STAT_BOXES_NOT_NUMBER "Fen Hare"` |
  | not set | no box row |

  With `boxes` unset in the preset, there is no box row and a stat with the
  same key prints in the attributes line as any other.

- **AC-13 (state track, D49, D53):** With a non-empty
  `entries.statblock.track`, the statblock has a state track under the box
  row: the `trackLabel` line (if set), then one framed cell of equal width
  per cell, in one row, in the order of `track`. Which cells:
  - no `trackKey` value in the block → the `trackDefault` cells
    (example: Fine, Hurt, Down, Gone — four cells);
  - `states: [Fine, Hurt, Down, Fading, Gone]` → those five, in `track` order
    whatever their order in the block;
  - `states: none` → no track;
  - a label not in `track` → that cell left out,
    `ENTRY_TRACK_UNKNOWN "Fen Hare": Lost`.

  Labels match case-insensitively. Each cell holds its SVG icon (`read()` of
  the vault path, every `fill="…"` and `stroke="…"` colour other than
  `none` replaced by the frame colour), drawn at 75 % opacity, so a pencil
  slash over it stays readable. An icon that is missing or not an SVG gives
  the existing missing-image warning and its cell is drawn empty. The
  marking rule (the leftmost unmarked cell is the current state) is
  explained by the book's text, not by the plugin.

- **AC-14 (tags, D38):** Tags print as their labels from `entries.tagLabels`
  (tags compared case-insensitively, a leading `#` ignored), in the order of
  the block, joined with ` · ` in the tags font. A tag without a label is not
  printed. When `tagLabels` is not empty, each such tag gives
  `TAG_UNMAPPED "<heading>": <tag>`; when it is empty, there is no tags part
  and no warning (G0-C1). Example: `tags: [beast, Magical, rare]` with the
  example's map → `Beast · Magical` and `TAG_UNMAPPED "Fen Hare": rare`.

- **AC-15 (look, G0-C6, C7):** The look comes from `entries.statblock.*`;
  a template may define defaults for it, and the preset wins over the
  template (US-023). Tick boxes and track cells are filled with `boxFill`,
  not with `fill`, with a 0.5 pt frame in the frame colour. With
  `colorMode: grayscale`: no fill, and the frame, rules, band, box label and
  value, icons and tags are `#4d4d4d`; values, attacks and skills are black;
  box and cell fill white. Example: `colorMode: grayscale` with
  `fill: "#fbe2c5"` → no fill is drawn (the PDF has no fill in that colour).
  The Typst helpers that draw the statblock are plugin names: a template
  that defines one gets `TEMPLATE_NAME_TAKEN` and the plugin's definition is
  used (US-016 AC-11, `PLUGIN_NAMES`; SCAR-017).

- **AC-16 (position, the opening paragraph, D28):** The statblock sits at
  the top right of the entry, 55 % of the text width, beside the entry's
  first paragraph in the remaining 45 % (4 mm gutter); the rest of the body
  starts full width below whichever of the two is taller. The first
  paragraph is the first block after the `o2t-entry` block, read on the
  parsed tree:
  - a plain paragraph → it is the opening paragraph;
  - anything else (a list, an image, a callout, a quote, a heading, a table,
    code) → no opening paragraph: that block and what follows start beside
    the statblock, `ENTRY_NO_LEDE "<heading>": starts with <list|image|
    callout|quote|heading|table|code>`;
  - an opening paragraph of fewer than 10 words → used as normal,
    `ENTRY_LEDE_SHORT "<heading>": <n> words`.

  Examples: the example's opening paragraph (17 words) is beside the
  statblock and `#### Habits` is below it; an entry whose body starts with
  `- Fast` → `ENTRY_NO_LEDE "Fen Hare": starts with list`.

- **AC-17 (never split, tall blocks, D42):** The statblock is never broken
  across pages or columns (`breakable: false`) and stays at 55 % however
  tall it is (vigour 45 gives three box rows, eight attacks eight lines). An
  attack whose name is too long for the line wraps with a hanging indent of
  1 em and its dice stay on its first line.

### Checks

- **AC-18 (data checks):**
  - with `entries.statblock.sum: {total: vigour, of: [might, wits, speed]}`,
    a total that differs from the sum gives `STAT_SUM_MISMATCH "<heading>":
    20 ≠ 4+8+3`; a value that is not a number on either side skips the
    check silently; no `sum` → no check;
  - an attack whose text after `: ` (or whole text) contains no `NdM` dice
    pool (regex `\b\d+d\d+\b`) gives `STAT_ATTACK_NO_DICE "<heading>":
    "<item>"`. Example: `"Glare: frightens"` →
    `STAT_ATTACK_NO_DICE "Fen Hare": "Glare: frightens"`.

- **AC-19 (warnings):** Every code of this story is in
  `docs/technical/warning-codes.md` with its text and a source line (rule
  8), is given once per entry and compile, and does not stop an export or
  the preview, also in strict mode (as US-028 decision E): `ENTRY_YAML_INVALID`,
  `ENTRY_ORPHAN_BLOCK`, `ENTRY_BLOCK_TWICE`, `ENTRY_BLOCK_IN_CONTAINER`,
  `ENTRY_VALUE_NOT_TEXT`, `ENTRY_TRACK_UNKNOWN`, `ENTRY_NO_LEDE`,
  `ENTRY_LEDE_SHORT`, `STAT_BOXES_MANY`, `STAT_BOXES_NOT_NUMBER`,
  `TAG_UNMAPPED`, `STAT_SUM_MISMATCH`, `STAT_ATTACK_NO_DICE`,
  `ENTRY_IN_GLOSSARY`.
  None of them stops a strict-mode export (decision 4).

### Composed cases (SCAR-002)

- **AC-20 (entries at several levels and in a chain):** An `o2t-entry` block
  under a level-4 heading inside a level-3 entry is a second entry: the
  inner heading gets its own statblock, and the outer entry's body ends at
  the inner heading (with `#### Habits` in the example made an entry, the
  outer statblock has the example's data and the inner one its own). Entries
  in any chapter get the statblock; whether an entry also gets the chapter
  layout is US-031 and US-033 (`headingRules` rule `entries`).
- **AC-21 (with other stories' rules):** With `headingRules` mapping the
  entry's parent heading to `glossary` (US-017), a block under a term heading
  is not read as an entry (decision 3): it is not printed, the term stays as
  US-017 prints it, and the warning is `ENTRY_IN_GLOSSARY "<term>"` with the
  block's line. An HTML comment between two entries (the writer's
  repeat comment, `<!-- repeat of "Fen Hare" omitted -->`) is dropped
  (US-001 AC-15, with its one summary warning for dropped comments) and adds
  nothing to the entry above it. A preset with
  `page.breakBefore.h3: page` (US-025) breaks before each entry heading as
  today; US-031 states the entry layout's own breaks.

- **AC-22 (determinism, rule 7):** The same note, block and preset give the
  same Typst byte for byte, also when the block's keys come in another order
  or the YAML uses flow lists (`attacks: ["Kick: 2d6"]` and the block form
  give the same statblock).

- **AC-23 (tests, SCAR-019):** Each setting of AC-8 is tested at its
  built-in value and at least one other value, numeric ones also at both
  ends of their range (`frame.width` 0 and 5); the box row at 0, 1, 15, 16,
  45, 46; the track with the default, a full list, `none` and an unknown
  label; grayscale and colour. The PDF tests read the statblock's text, its
  order, the number and size of boxes and cells, the icon count and the
  fills from the PDF (SCAR-015), on a generated fixture note with invented
  entries (US-024 amendment, draft D-03). A rendered check at 100 % (SCAR-025)
  is part of the story's manual check.

---

## Decisions (answered by the user, 2026-11-06)

1. **Attack text without `: `:** printed whole on the left; `Name: dice` is
   the documented form (AC-10). `STAT_ATTACK_NO_DICE` still applies (AC-18).
2. **Track key as one word:** a one-item list, as every list key (AC-5);
   `none` means no track (AC-13).
3. **A block under a glossary term:** not supported; not read as an entry,
   `ENTRY_IN_GLOSSARY` (AC-21).
4. **Strict mode:** no entry warning stops the export (AC-19).

---

## Notes

- The vault side (the creature template, migration, icons, the Bestiary key)
  is the author's work, outside this repository.
- Not measured here: the time to draw a chapter of 40 statblocks with icons
  in the preview (US-012 AC-13 budget); measured at G2 with the fixture.

---

## Related tickets

<!-- Filled in at step 3. Drafts: D-01, D-02, D-04, D-05, D-17, D-19. -->
