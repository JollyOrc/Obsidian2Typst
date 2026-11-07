<!-- Filed 2026-11-06 as #125 on the user's go (epic #121, ticket 4 of 16). -->

### User story

[US-030](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-030-entry-data-and-statblock.md), ACs addressed AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-23

### Description

Draw the statblock: a shared drawing model in `src/core/entries/model` (used by the PDF and the Obsidian preview), the Typst helper `o2t-statblock` with the box row, the state track and its recoloured icons, attributes, traits, attacks, skills and tags, the look from the preset, the opening paragraph beside it, and the data checks.

### Acceptance criteria (from the user story)

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

- **AC-18 (data checks):**
  - with `entries.statblock.sum: {total: vigour, of: [might, wits, speed]}`,
    a total that differs from the sum gives `STAT_SUM_MISMATCH "<heading>":
    20 ≠ 4+8+3`; a value that is not a number on either side skips the
    check silently; no `sum` → no check;
  - an attack whose text after `: ` (or whole text) contains no `NdM` dice
    pool (regex `\b\d+d\d+\b`) gives `STAT_ATTACK_NO_DICE "<heading>":
    "<item>"`. Example: `"Glare: frightens"` →
    `STAT_ATTACK_NO_DICE "Fen Hare": "Glare: frightens"`.

- **AC-23 (tests, SCAR-019):** Each setting of AC-8 is tested at its
  built-in value and at least one other value, numeric ones also at both
  ends of their range (`frame.width` 0 and 5); the box row at 0, 1, 15, 16,
  45, 46; the track with the default, a full list, `none` and an unknown
  label; grayscale and colour. The PDF tests read the statblock's text, its
  order, the number and size of boxes and cells, the icon count and the
  fills from the PDF (SCAR-015), on a generated fixture note with invented
  entries (US-024 amendment, draft D-03). A rendered check at 100 % (SCAR-025)
  is part of the story's manual check.

## Decisions (answered by the user, 2026-11-06)

1. **Attack text without `: `:** printed whole on the left; `Name: dice` is
   the documented form (AC-10). `STAT_ATTACK_NO_DICE` still applies (AC-18).
2. **Track key as one word:** a one-item list, as every list key (AC-5);
   `none` means no track (AC-13).
3. **A block under a glossary term:** not supported; not read as an entry,
   `ENTRY_IN_GLOSSARY` (AC-21).
4. **Strict mode:** ~~no entry warning stops the export~~ — revised by
   the user 2026-11-06 at #123's G4: entry warnings abort a strict-mode
   export like every conversion warning (US-006 AC-4 unchanged; AC-19).

### Implementation notes

- `src/core/entries/model.ts`: `statblockModel(data, entries, {heading, fileName, missing})` → parts, boxes, rows, cells (label, icon), attributes, traits, attacks (`noDice`), skills, tags, notices; `recolourSvg(svg, colour)`. Pure; the emitter and US-035's preview both use it (SCAR-017).
- The helper `o2t-statblock` in the generated prelude (a `PLUGIN_NAMES` entry, added with #123): band, box row (15 per row, groups of 5; box size from the width; label column 7.5 mm; named constants), state track (equal cells, icons via `read()` of the copied SVG, recoloured, 75 % opacity), rules, attributes and traits lines, attacks with a 1 em hanging indent, skills, tags; `breakable: false`; 55 % width beside the 45 % opening-paragraph column (4 mm gutter).
- Test interface: the helper writes `metadata((band, boxes, rows, cells, parts))` labelled `<o2t-statblock>`.
- Icons: the preset's SVG paths resolved and copied as assets like images (US-003); a missing one → the missing-image warning and an empty cell.
- First paragraph (US-030 AC-16): decided on the parsed tree after #123 removed the block; the kinds of the warning text.
- Checks: `STAT_BOXES_MANY`, `STAT_BOXES_NOT_NUMBER`, `ENTRY_TRACK_UNKNOWN`, `TAG_UNMAPPED` (only with a non-empty map), `ENTRY_NO_LEDE`, `ENTRY_LEDE_SHORT`, `STAT_SUM_MISMATCH`, `STAT_ATTACK_NO_DICE`: rows in `warning-codes.md`.
- Grayscale (`colorMode: grayscale`): no fill; frame, rules, band, box label and value, icons and tags `#4d4d4d`; boxes white.

### Tests

- `tests/unit/us-030-statblock.test.ts` (all)
- `tests/integration/us-030-statblock-pdf.test.ts` (all)
- `tests/unit/us-030-entry-block.test.ts`: `US-030 AC-19: a composed note gives each warning once, in order`
- `tests/unit/us-035-model.test.ts` (all: the shared model)
- `tests/integration/us-035-model-vs-pdf.test.ts` (all: the model equals the PDF)

### SCAR check

- SCAR-017: one model for the PDF and the preview, proved equal by `us-035-model-vs-pdf`.
- SCAR-008 (silent misuse of a drawing API): the box and cell geometry checked through `<o2t-statblock>` and the PDF (sizes, counts), not by eye.
- SCAR-022, SCAR-024: `read()` and recolouring of SVG in the bundled WASM compiler is measured (2026-11-06, one synthetic icon); the copied icon path is what the compile reads.
- SCAR-025: a rendered check at 100 % or larger (manual check of #121).
- SCAR-034, SCAR-041: the first paragraph is decided after the block is removed, looking into containers.
- SCAR-015, SCAR-019, SCAR-028: content read from the PDF and the test interface; box values 0 to 46 and non-numbers; colour and grayscale.
- SCAR-038: the checks report once per entry, not once per measurement.
- Not applicable: UI SCARs.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
