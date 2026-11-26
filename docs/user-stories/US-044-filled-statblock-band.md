# US-044 — A filled name band on the statblock

**Status:** Done (0.18.0, 2026-11-26; M35 passed, step 6 corrected)
**Introduced:** 0.18.0
**Implemented:** 0.18.0
**Amends:** US-030 AC-8 (the look keys), AC-10 item 1 (the title band), AC-15 (the look, greyscale); US-035 AC-1 (the band in the preview)
**Control project:** `spec/Name Band Questions.md` (NB-1 to NB-8, answered 2026-11-26), TP-1 (b) of `spec/Tapestry Palette Questions.md`

The author's palette (2026-11-20) showed the creature's name in a filled band; the statblock
could not draw one (TP-1). After a measured mockup (today, a red band, an umber band; colour and
greyscale) the author chose the umber band (2026-11-26).

---

## Story

**As** an author who prints creature statblocks,
**I want** the statblock's name band filled with a colour of my preset, the name and its marks in a
second colour,
**so that** each creature's name stands out as the head of its statblock, in the book, the preview and on cards.

### Measured (2026-11-26, Typst 0.14.2, Libertinus Serif, built-in sizes)

A statblock 57.75 mm wide (A5 text width 105 mm × 55 %), a band and one traits line, drawn with the
helper of 0.17.0 and with the mockup's filled band (fill reaching the frame on three sides, 1.6 mm
padding below the name, no rule under the band):

| Name (invented) | Lines | Height today | Height filled | Difference |
|---|---|---|---|---|
| Fen Hare | 1 | 10.69 mm | 11.09 mm | +0.40 mm |
| Old Marsh Dragon of the Grey Reaches | 2 | 16.00 mm | 16.40 mm | +0.40 mm |

Colour distances (ΔE76) of umber `#8A4A2A` to the author's tag colours: nearest Dwarf `#B88A68` at 26 (the
offered red was 9 from ChakraHips). These numbers hold for these inputs (SCAR-032); the tests measure
again with the fixture's fonts.

### Who relies on the band or the look keys today (SCAR-017, SCAR-027)

| User | What it assumes | After this story |
|---|---|---|
| `src/core/emit/entry.ts` (`o2t-sb-box`, `statblockLookValues`, `statblockLook`) | band text in the accent, a rule under it; look without band keys | AC-2 to AC-5 |
| `src/core/markers/entries.ts` (`StatblockSettings`, `STATBLOCK_BUILTINS`) | the look keys `fill` … `boxFill` | two optional keys, **no** built-in value (AC-1, SCAR-037) |
| `src/core/presets/parse.ts` (reading the look) | reads `fill`, `boxFill` | reads the two keys, same colour rules (AC-1) |
| `src/plugin/settings/details.ts` (Details rows) | lists the look keys | lists the two keys (AC-1) |
| `src/plugin/entries/processor.ts`, `styles.css` (`.o2t-sb-band`) | band in the accent, a border under it | AC-6 |
| `api.statblockTypst`'s answer (US-039): prelude and look | Game Card Creator compiles them as given, passing the look through (`..sb.look`) | prelude and look change (AC-8); GCC is checked, not changed (AC-7) |
| `tests/plugin/us-039-statblock-typst.test.ts` (prelude pinned by pieces), `us-035-preview*.test.ts`, `tests/unit/us-030-entry-settings.test.ts`, `tests/integration/us-030-statblock-pdf.test.ts` | the band's piece, the look keys | amended or kept (AC-8) |
| `manual/entries.md` (the look table) | six look keys | eight, with the example (AC-9) |
| The encounter sheet and quick reference titles (`emit/encounter.ts`, `entries/sheet.ts`) | the band *font* and accent only | unchanged |
| the control project's palette script (its list of places) | writes the look colours | two rows added there (control project, after release) |

## Acceptance criteria

Terms. *Band* is the statblock's title band (the name between its ◆ marks, US-041). *Inset* is the
statblock's inner margin, 2 mm. *Frame width* f is `frame.width` (built-in 0.75 pt).

- **AC-1 (the setting).** `entries.statblock` takes two optional keys: `bandFill` (a colour `#rrggbb`
  or `none`) and `bandColor` (a colour `#rrggbb`). They are read, checked and reported like `boxFill`
  (same colour forms, same warning for a bad value, a Details row each). **Neither has a built-in
  value:** a preset without `bandFill`, or with `bandFill: none`, draws the band exactly as 0.17.0
  (byte-identical Typst and PDF, AC-8). Without `bandColor` a filled band's text is the accent.
  Example: `bandFill: "#8A4A2A"`, `bandColor: "#F3EEE3"` (the author's presets).
- **AC-2 (the filled band).** With `bandFill` set, the band is drawn on a rectangle of that colour
  that reaches the inside of the frame on the left, top and right (no paper gap; it ends at the
  inner edge of the frame's line, f/2 inside its centre line, so the frame is drawn whole), and extends **1.6 mm** below the
  name's last line. The name and both marks are in `bandColor`; font, size, the marks' rules (US-041
  AC-1 to AC-5) unchanged. Example: `Fen Hare` in 57.75 mm: one line `◆ Fen Hare ◆`, parchment on umber.
- **AC-3 (no rule under a filled band).** The rule between the band and the next part is not drawn
  when the band is filled; the next part starts **1.2 mm** below the rectangle's lower edge (the statblock's spacing between parts; *corrected at G4 2026-11-26 from 2.4 mm, a misreading of the mockup; the measured +0.40 mm already held it*). Every other
  rule stays. At built-in sizes the statblock is **0.40 mm** taller than in 0.17.0 (the table above;
  ± 0.05 mm).
- **AC-4 (names that wrap; SCAR-002).** A name of two or more lines (US-041 AC-2, AC-3) has the
  rectangle around all its lines; the marks stay level with the middle of the name block. Example:
  `Old Marsh Dragon of the Grey Reaches`, two lines, one rectangle, 16.40 mm statblock.
- **AC-5 (greyscale).** With `colorMode: grayscale` and `bandFill` set, the rectangle is `#4d4d4d`
  and the name and marks white `#ffffff`; with `bandFill` unset or `none`, greyscale is as 0.17.0
  (no fill, band text `#4d4d4d`).
- **AC-6 (the preview; SCAR-046).** The preview's band has the same fill and text colour (CSS
  variables beside `--o2t-sb-box-fill`), reaching the frame on three sides, and no border under it;
  without `bandFill` the preview is unchanged. The vault's creature notes, which draw through
  `api.renderStatblock`, follow. Checked by hand in Obsidian (SCAR-045), not only in the fake DOM.
- **AC-7 (the statblock beside text and on cards; SCAR-021, SCAR-024).** The wrap (US-030 AC-16a)
  measures the new height: a chapter with a filled band compiles to the same bytes twice (clock
  fields set aside, #183) and `<o2t-wrap>`'s statblock height is the measured one. Game Card
  Creator's creature cards, which pass the look through, show the filled band and its equal-title-band
  rule still gives equal heights — measured with its code at G2 (a test compile of its prelude with
  ours), not assumed; a fault there is a Game Card Creator ticket.
- **AC-8 (nothing else changes).** Without `bandFill`: the Typst, the PDF, the preview, the
  `api.statblockTypst` answer and `api.version === 1` are byte-identical to 0.17.0 for the same
  input, except the helper's text in the prelude (the band's piece and the final stack). With
  `bandFill`: only the band, the first rule and the heights that follow from them differ.
- **AC-9 (release 0.18.0).** Versions in `package.json`, `manifest.json`, `versions.json`; notes
  `releases/v0.18.0.md`, a `RELEASES.md` row; `manual/entries.md` look table with both keys and the
  example; US-030 and US-035 marked amended; a manual check (PDF printed at reading size, SCAR-025;
  preview in Obsidian; a Game Card Creator creature card).

## Decisions (the author, 2026-11-26: "Yes, all proposals")

- **D1 (NB-1).** Two keys `bandFill`, `bandColor`; unset = as today.
- **D2 (NB-2).** The author's presets: umber band, parchment text, both from the palette (no new colour).
- **D3 (NB-3).** No rule under a filled band.
- **D4 (NB-4).** Greyscale keeps the band filled, `#4d4d4d` / white.
- **D5 (NB-5, NB-6).** Marks kept in the band text colour; a wrapping name's band grows.
- **D6 (NB-7).** No Game Card Creator story; its next manual check looks at a creature card.
- **D7 (NB-8).** The book's flow may move by the 0.40 mm per statblock; checked at the author's next book export.

## Not covered

A band border or rounded corners; a band on the encounter sheet or the quick reference; per-creature
band colours (by tag); Game Card Creator's own title bars. Measured: Typst 0.14.2, Libertinus Serif,
built-in sizes (SCAR-032).

## Tickets

- #187 T1 — the band keys (AC-1, AC-5, AC-8)
- #188 T2 — the filled band in the PDF (AC-2 to AC-5, AC-7, AC-8)
- #189 T3 — the preview and its stylesheet (AC-5, AC-6, AC-8)
- #190 T4 — documents, manual check M35, release 0.18.0 (AC-9)
