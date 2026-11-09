# US-034 — Print checks: image resolution and word gaps

**Status:** Done; amendment for #139 Done (0.13.0, released 2026-11-09; M25 passed 2026-11-09 and the user checked a real chapter of 30 spreads; AC-2, AC-6, AC-13 — the column beside the statblock with the wrap, the portrait columns form only, the grown illustration's drawn width). Before: Done (M21 to M24 passed 2026-11-07; M21's findings and M23's changes merged without a re-run, the user's decision; G1 2026-11-06; decisions 1 and 2 answered the same day, G1 re-check)
**Introduced:** v0.12.0 (planned, with US-030 to US-033)
**Implemented:** v0.12.0 (released 2026-11-07), epic #121 (tickets #122 to #137); test builds `0.12.0-m21.1` (M21 to M24) and `0.12.0-m21.2` (their follow-ups); the amendment for #139 in v0.13.0 (released 2026-11-09), tickets #140 to #145, test build `0.13.0-m25.1` (M25)
**Supersedes:** —

Epic #121, fifth of seven stories (see US-030). Drafts D-15, D-16 in
`docs/drafts/entry-layouts-tickets.md`. Both checks apply to the whole
book, not only to entries.

---

## Story

**As an** author preparing a book for print,
**I want** a warning for every image that will print too coarsely and for
every justified line whose word gaps are too wide,
**so that** I can replace low-resolution art and reword gappy lines before
the book goes to the printer.

Decided by the user (G0 for #121, 2026-11-05; 2026-11-06), summarised:

- **Resolution (D24):** `images.minDpi`, default 300, `0` switches the check
  off; an image used at several sizes is checked at its largest.
- **Narrow columns (D46):** text in columns narrower than 60 % of the text
  width stays justified, with Typst's `justification-limits` from the preset;
  after compiling, every justified line is measured and lines with gaps wider
  than `entries.maxWordGap` (default 200 %) are reported, quoting the line.
- **Export only (G0-C10):** the word-gap scan runs on export, not in the
  preview.
- **In the worker (2026-11-06):** the scan runs after the export's last
  compile, in the compile worker, with an indexed object lookup.

Measured (SCAR-024):

- **Gap arithmetic (2026-11-05, Typst 0.14.2 as bundled, Node):** a justified
  space is the font's space glyph followed by a negative `TJ` adjustment;
  gap % = (space advance − adjustment) / space advance × 100, with the
  advance from the font's `/W` table and the text from its `ToUnicode` map.
  Calibration lines set with `text(spacing: 100%, 200%, 300%)` and `250%`
  measure exactly that. A 45 % column had 7 lines over 200 % without
  `justification-limits` and 2 with spacing 80–150 % and tracking −0.01 to
  0.03 em; full-width text peaked at 159 %. (One proof page, two fonts;
  SCAR-032: the 7 → 2 is one column.)
- **Scan time (2026-11-06, `docs/technical/spike-gap-scan-time.md`):**
  synthetic books of 261 and 407 pages scan in 120 and 173 ms with an
  object-offset index (241 and 491 ms with a regex per object, growing faster
  than the page count).
- **Not measured:** the drawn width recorded by the image helper (AC-2) on
  every path (fit, shrink, float, entries' slots); the scan on a PDF with
  images, footnotes and tables (the synthetic books had text only).

---

## Acceptance criteria

### Image resolution

- **AC-1 (setting):** `images.minDpi`: whole number 0 to 2400, built-in 300;
  `0` = off. In preset notes and the Defaults (US-008 AC-1 precedence).
  Settings screen (US-029 AC-1, AC-2): a feature row `Print resolution`,
  description `Warns about images below this dpi; off at 0.`, with a gear
  whose modal holds the number field `Minimum print resolution` (hint
  `dpi, 0 to 2400`; named at #132) — the form of the `Contents` row
  (`off while its depth is 0`). The row is placed after `Image fit`. Invalid
  values make the preset invalid (US-008 AC-4): `images.minDpi must be a
  whole number from 0 to 2400 (line N)`. A digital preset may set it lower.

- **AC-2 (what is checked):** Every block image of the body, entry
  illustrations included, and the cover (US-011): its effective resolution is
  its pixel width divided by its drawn width in inches, after fit, shrink,
  float or an entry slot. The drawn width comes from the compile: the image
  helper records each image's file and drawn width as `metadata`, read after
  the compile (as US-028 AC-5's decisions); an image whose drawn width is
  fixed by its call (a size written in the note, the cover filling the sheet)
  is recorded by the conversion instead (refined at #132, so these calls stay
  as before); the pixel width from the image file's header (PNG, JPEG, WebP,
  GIF). SVG and other vector images are not checked. An image written inside
  text is set as a block of its own (US-003) and is checked like one
  (refined at #132: the converter draws no image inline); drawn icons
  (callout icons, track cells) and a refused image (US-003 AC-6) are not
  checked. Amended for #139: an entry illustration grown into the free
  space or drawn in the stacked portrait form (US-031 AC-7a, AC-7b) is
  checked at its drawn, grown width; the growth is not capped by
  `images.minDpi` (G0 answer 10). Example: a 1 200 px wide 1:1 image grown
  from 82.5 to 105 mm → `IMAGE_LOW_DPI "assets/hare.png": 290 dpi at 105.0
  mm (min 300)` (at 82.5 mm it had 369 dpi and no warning).

- **AC-3 (the warning):** Below `images.minDpi`:
  `IMAGE_LOW_DPI "<file>": <d> dpi at <w> mm (min <m>)`, with `d` rounded to
  a whole number and `w` to 0.1 mm. A file drawn several times is checked once,
  at its largest drawn width, and named once. Examples (a 272 px wide image):

  | Drawn width | dpi | `minDpi` | Warning |
  |---|---|---|---|
  | 50 mm | 138 | 300 | `IMAGE_LOW_DPI "assets/small.png": 138 dpi at 50.0 mm (min 300)` |
  | 50 mm | 138 | 120 | none |
  | 20 mm | 345 | 300 | none |
  | 50 mm and 20 mm (twice) | 138 | 300 | one warning, at 50.0 mm |
  | any | — | 0 | none |

- **AC-4 (preview and export):** The check runs wherever the compile runs —
  preview and export (it needs no PDF scan). It never stops an export, also
  in strict mode (decision 1).

### Word gaps

- **AC-5 (settings):** Two `entries` fields (US-030 AC-8's messages and
  Details view):

  | Field | Value | Built-in |
  |---|---|---|
  | `entries.narrowJustification` | `{spacing: {min, max}, tracking: {min, max}}` (percent; em) | `{spacing: {min: 80, max: 150}, tracking: {min: -0.01, max: 0.03}}` |
  | `entries.maxWordGap` | whole percent, 100 to 1000; `0` = no scan | 200 |

  Example message: `maxWordGap: 50` → `entries.maxWordGap must be 0 or a
  whole number from 100 to 1000 (line 4)`.

- **AC-6 (narrow columns):** Text in a column narrower than 60 % of the text
  width (a named constant; today the 45 % text column of `page-portrait` and
  `spread-portrait` in their columns form, US-031 AC-7b, and the 45 % column
  beside the statblock, US-030 AC-16a, decision 2; amended for #139: the
  stacked form's text and the wrap's full-width part are full width and get
  no limits) is set with
  `par(justification-limits: (spacing: (min: 80%, max: 150%), tracking:
  (min: -0.01em, max: 0.03em)))` from `entries.narrowJustification`;
  full-width text is not. (Noted at #133: the plugin sets no `justify` of
  its own; the text is justified by the book's template, US-023, and the
  limits apply where it is. Without justification no line is adjusted and
  the scan finds none.)

- **AC-7 (the scan):** After the export's last compile (US-028's settle loop
  included), in the compile worker, the plugin reads the PDF: every text line
  (text runs on one baseline in one column) whose spaces carry `TJ`
  adjustments is measured; each gap is computed as in the measured formula
  above; a line whose widest gap is over `entries.maxWordGap` gives
  `TEXT_WIDE_GAP "<where>": "<line text>" (<gap> %)`. `<where>` is the
  entry's heading when the line is on an entry's pages (US-031's real
  positions), else `p. <folio>`. Runs on one baseline separated by a gap wider
  than the column gutter are different lines (two columns are never joined).
  Header and footer artifacts are skipped. Examples:
  `TEXT_WIDE_GAP "Reed Cat": "Reed cats are quiet" (264 %)`;
  `TEXT_WIDE_GAP "p. 41": "Every rule has" (231 %)`.

- **AC-8 (export only, G0-C10):** The preview never scans; the export always
  does unless `entries.maxWordGap: 0`. `TEXT_WIDE_GAP` never stops an
  export, also in strict mode (as decision 1). A failed scan (an unreadable PDF part)
  gives one `TEXT_GAP_SCAN_FAILED` and the export completes.

- **AC-9 (the reader is core code):** The PDF content-stream reader moves from
  `tests/support/pdf.ts` (`contentTokens`, `literalBytes`, `readCMap`) into
  `src/core`, as pure code on the PDF bytes with an object-offset index
  (one pass over the file, then direct slices), its transforms documented
  (SCAR-001); the tests use the core reader. Literal strings with balanced,
  unescaped parentheses are read correctly; fonts are read once per font
  object.

- **AC-10 (measurement is pinned):** An integration test compiles a line set
  with `text(spacing: 200%)` and one with `text(spacing: 300%)` with the
  bundled compiler and expects 200 % and 300 % (±2 %). A Typst upgrade that
  changes how the PDF is written fails this test.

- **AC-11 (time):** The scan of a generated 400-page text PDF takes less than
  2 s in the test (measured 173 ms; the bound is generous on purpose,
  SCAR-030), and runs in the worker so Obsidian's main thread is never
  blocked longer than 100 ms by it (governance limit).

### Composed cases and tests

- **AC-12 (composed, SCAR-002):**
  - a line in a callout box (US-016) or a quote: measured like body text;
    `<where>` as AC-7;
  - a table cell (US-005): cells are columns of their own; a cell's line is
    measured within its cell;
  - footnotes: measured; `<where>` is the page;
  - the statblock (US-030), the quick reference (US-033) and the encounter
    sheet (US-036): not justified, so no adjustments and no warning;
  - an image drawn by US-028's float: its drawn width is the floated one.

- **AC-13 (tests, SCAR-019):** `images.minDpi` 0, 1, 120, 300, 2400;
  `entries.maxWordGap` 0, 100, 200, 1000; `narrowJustification` built-in and
  one other; the calibration pin; a generated narrow-column line known to gap
  (invented words, D-03) warns, full-width fixture text does not at 200 %;
  for #139 the column beside the statblock carries the limits in measuring
  and drawing, the full-width part after it and the stacked form's text
  none;
  two columns on one baseline never joined; the warnings as an exact list
  (SCAR-038), on the generated fixture.

---

## Decisions (answered by the user, 2026-11-06)

1. **Strict mode:** neither `IMAGE_LOW_DPI` nor `TEXT_WIDE_GAP` stops an
   export (AC-4, AC-8); print checks are fixed at the author's pace.
2. **The lede column:** gets the narrow-column limits like every column
   under 60 % (AC-6); the scan shows whether it helps.

---

## Notes

- The proof measurements were made on the author's private proof; this
  story quotes only their numbers, never its text (SCAR-035).

---

## Related tickets

<!-- Filled in at step 3. Drafts: D-15, D-16. -->
- #140 (AC-6, the column beside the statblock), #141 (AC-2), #142 (AC-6, the columns form), #145; amendment for #139.
