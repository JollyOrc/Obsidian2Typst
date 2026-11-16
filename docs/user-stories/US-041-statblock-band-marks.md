# US-041 — The ◆ marks of the statblock band sit beside the name

**Status:** Ready 2026-11-16 (G0 and G1 done; D1 to D5 decided by the author 2026-11-16); tests written (G2, 2026-11-16: 19 red by design); tickets #171 (Typst), #172 (preview), #173 (documents, M30, release) written (G3)
**Introduced:** 0.15.2
**Implemented:** —
**Amends:** US-030 AC-10 item 1 (the title band), US-035 AC-1 (the band in the preview)
**Backlog issue:** #170

Found by the author on a creature card of Game Card Creator
(<https://github.com/JollyOrc/GameCardCreator>, a sibling plugin that draws the
statblock through this plugin's API): a creature name that wraps over two lines
has the left ◆ at the start of its first line and the right ◆ at the end of its
last line, so the marks flow with the text and the name does not look centred.
The drawing is this plugin's, so the book, the Obsidian preview, the website and
the cards all show it.

---

## Story

**As** an author whose creature names are long enough to wrap in the statblock's band,
**I want** the two ◆ marks to stand at the left and the right of the name, level
with its middle, and not run on with the text,
**so that** the band looks centred around the name on a card, in the book and in the preview.

### How the band is drawn today, measured (2026-11-16, Typst 0.14.2, Libertinus Serif)

The band is one text, `◆ name ◆`, centred in the statblock's inner width, in the
band font at the band size (default 11.5 pt) and the accent colour. The inner
width is the statblock's width less 2 × 2 mm of inset: at an A5 text width of
105 mm the statblock is 55 % = 57.75 mm wide (US-030 AC-16), the inner width
**53.75 mm**. At 11.5 pt: a ◆ is **2.7 mm** wide, a space **1.01 mm**.

| Name (invented) | Name alone | `◆ name ◆` | Today in 53.75 mm |
|---|---|---|---|
| Fen Hare | 15.1 mm | 22.5 mm | one line `◆ Fen Hare ◆` |
| Marsh Reed Warden | 33.7 mm | 41.1 mm | one line |
| Pneumonoultramicroscopic | 45.6 mm | 53.0 mm | one line (fits by 0.75 mm) |
| Old Marsh Dragon of the Grey Reaches | 65.1 mm | 72.6 mm | two lines: `◆ Old Marsh Dragon of the` / `Grey Reaches ◆` |
| Giant Swamp Chieftain of the Reeds | 60.0 mm | 67.4 mm | two lines: `◆ Giant Swamp Chieftain of the` / `Reeds ◆` |
| Pneumonoultramicroscopically | 51.7 mm | 59.1 mm | three lines: `◆` / the name / `◆` (each mark alone on a line) |

The width the name has beside two marks and their gaps is
**W<sub>name</sub> = inner width − 2 × (◆ + space) = 53.75 − 7.42 = 46.33 mm** here.

### Who relies on the band's drawing today (SCAR-017, SCAR-027)

| User | What it assumes | After this story |
|---|---|---|
| `src/core/emit/entry.ts` (`STATBLOCK_HELPER_DEF`, the Typst helper `o2t-sb-box`) | the band is one text `◆ #d.band ◆` | the new drawing (AC-1 to AC-5) |
| `src/plugin/entries/processor.ts` (`draw`) and `styles.css` (`.o2t-sb-band`) | one `span` with the text `◆ name ◆` | three parts (AC-6) |
| `api.statblockTypst`'s answer (US-039): the prelude holds the helper | Game Card Creator compiles the prelude as given | the prelude text changes (AC-8); its fixture is copied again |
| `tests/plugin/us-035-preview.test.ts` (`◆ — ◆`), `us-035-preview-cases.test.ts` (class `o2t-sb-band`), `tests/integration/us-030-statblock-pdf.test.ts` (no number in the band) | the band text and the class | kept or amended (AC-6, AC-8) |
| `docs/user-stories/US-030` AC-10 item 1 and its examples, `US-035` AC-1, `manual/entries.md` (item 1 of the parts) | "between ◆ ornaments, centred" | amended, pointing here |
| `docs/technical/manual-checks/M21.md`, `M22.md`, `M29.md` | name the band | read again; a new check M30 |
| The website export (obsidian-webpage-export) | shows the plugin's own drawing and CSS | follows; nothing to change there |
| The encounter sheet's title (`src/core/entries/sheet.ts`) | its own text, not the band | unchanged |

## Acceptance criteria

Terms. *Band* is the statblock's title band. *Inner width* W is the width of the
band's content. A *mark* is `◆` in the band font, at the band size, in the accent
colour; a *gap* is the width of one space of that font and size. W<sub>name</sub>
= W − 2 × (mark + gap).

- **AC-1 (a name that fits on one line: nothing changes).** When `◆ name ◆` (mark,
  gap, name, gap, mark) is not wider than W, the band is drawn as before: one line,
  centred, the marks next to the name with one space between. Example: `Fen Hare`
  (22.5 mm) in 53.75 mm: one line, the left mark's left edge 15.6 mm from the
  band's left edge, the right mark's right edge 15.6 mm from its right edge
  (± 0.1 mm); `Pneumonoultramicroscopic` (53.0 mm): one line.
- **AC-2 (a name that wraps: the marks stand beside it).** When `◆ name ◆` is wider
  than W and every word of the name fits in W<sub>name</sub>, the band has three
  parts side by side: the left mark, the name, the right mark. The left mark's left
  edge is at the band's left edge and the right mark's right edge at its right edge;
  between a mark and the name block there is one gap; the name is set in
  W<sub>name</sub>, wrapped as text, each line centred between the marks; **each
  mark is centred vertically on the name block** (the middle of the height of all
  its lines, ± 0.1 mm). The band is as high as the name's lines. Examples (53.75
  mm): `Old Marsh Dragon of the Grey Reaches` is two lines `Old Marsh Dragon of the`
  / `Grey Reaches` with a mark at each end at the height between the two lines;
  `Giant Swamp Chieftain of the Reeds` is two lines `Giant Swamp Chieftain of` /
  `the Reeds` (the breaks are those of the name alone in 46.33 mm); a name of
  three lines has the marks level with the middle of the second line.
- **AC-3 (a word that cannot fit beside the marks: no marks).** A *word* is a run
  of characters between spaces (a hyphenated word is one word, though Typst could
  break it at the hyphen). When the longest word of the name is wider than
  W<sub>name</sub>, **no mark is drawn**, on either
  side: the name is set alone, centred, wrapped in W, and the band is as high as the
  name's lines. Example: `Pneumonoultramicroscopically` (51.7 mm: fits W, not
  W<sub>name</sub>): one line, no marks (today: three lines).
- **AC-4 (a word wider than the band: as today).** A word wider than W is not
  broken or shrunk (as in 0.15.1): it runs over the frame; there are no marks
  (AC-3). Example: a single word of 60 mm in 53.75 mm.
- **AC-5 (the look settings; SCAR-019).** The marks and the name use the same font,
  size and colour as before (`entries.statblock.fonts.band`, `sizes.band`, the
  accent); the gap is one space of that font and size. The rule holds at another band
  size and another band font: tested at 11.5 pt (default), 8 pt and 16 pt, and with a
  second font family. A band font that lacks ◆ falls back as it does today (no
  change).
- **AC-6 (the preview and the website).** The preview draws the band as the left
  mark, the name and the right mark in a row (the classes `o2t-sb-band` for the row,
  `o2t-sb-mark` for each mark, `o2t-sb-name` for the name): marks level with the
  middle of the name block, the name centred and wrapping in the width between them;
  a name on one line looks as before. The band's text content stays `◆ name ◆`
  (the marks are text; the name is the name), so `◆ — ◆` for a statblock without a
  name. The gap between a mark and the name is **0.25 em** (CSS has no "the width
  of a space": 0.25 em is the space of the default band font; in another band font
  it differs a little from the PDF's gap). **Limit, by decision D3:** CSS cannot measure whether a word fits, so in
  the case of AC-3 the preview does not remove the marks: they wrap with the name,
  as today. The same drawing is the website's. Measured by hand in Obsidian
  (SCAR-045, manual check M30), not only in the fake DOM.
- **AC-7 (what the band's height changes; SCAR-021).** A name that took more lines
  because a mark wrapped alone (the last row of the table) now takes fewer, so the
  statblock is lower by the difference; the entry's text wraps around it and the
  pages follow (US-030 AC-16a). A chapter with such a name compiles to the same
  bytes twice, and `<o2t-wrap>`'s facts follow the new height. Example: a statblock
  beside a text, with `Pneumonoultramicroscopically` as its name: the statblock is
  two band lines lower than in 0.15.1 (the two lines that held only a mark); the
  text beside it moves up by as much.
- **AC-8 (nothing else changes).** The keys, the values and the warnings of the
  statblock data, `<o2t-statblock>`'s `band` field, the shape of `api.statblockTypst`'s
  answer, `api.version === 1`, the other parts of the statblock, the encounter sheet
  and the book outside the band are byte-identical to 0.15.1 for the same input,
  except the Typst text of the helper (it is part of the answer's prelude: the
  prelude with the band's piece cut out is byte-identical to 0.15.0's, the test that
  pinned the whole prelude by its hash is amended to say so) and,
  where a name wraps, what AC-2, AC-3 and AC-7 say.
- **AC-9 (release 0.15.2).** Version 0.15.2 in `package.json`, `manifest.json`,
  `versions.json`; notes `releases/v0.15.2.md`, a line in `RELEASES.md`; the
  amended stories, `manual/entries.md` and the manual check M30; Game Card Creator
  copies its fixture again from the new output (its own ticket).

## Decisions of G1 (the author, 2026-11-16)

- **D1.** When a name wraps, the marks stand at the **ends** of the band's inner
  width, level with the middle of the name block, in the PDF, the preview and the
  website alike. The author first chose marks hugging the longest line; that is
  possible in the PDF (a shrink-wrapped name column, measured in a spike) but not in
  the preview with CSS alone (it would need a script), so "ends everywhere" was
  chosen for one rule in all outputs.
- **D2.** A word that cannot fit beside the marks removes **both** marks (AC-3).
- **D3.** In the preview and on the website the AC-3 case cannot be detected by CSS,
  so the marks stay and wrap with the name (AC-6); the PDF follows AC-3. Accepted
  as a limit of the preview.
- **D4.** A patch release, 0.15.2: one-line names are unchanged and the book changes
  only where a name wraps.
- **D5.** A new story (this one) that amends US-030 AC-10 item 1 and US-035 AC-1.

## Not covered

Marks that hug the longest line (D1); a setting for the marks (their glyph, their
gap, none at all); the encounter sheet's title and Game Card Creator's own title bars
(its backlog #35); the other parts of the statblock; hyphenation of long names.
Measured: Typst 0.14.2, Libertinus Serif 11.5 pt, the widths of the table above
(SCAR-032: the numbers are for these inputs; the tests re-measure with the fixture's
fonts).
