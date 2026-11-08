# Spike: text wrapping around the statblock (0.13.0, G0)

**Date:** 2026-11-08. **Typst:** 0.14.2, the official CLI
(`/usr/local/bin/typst`, `--ignore-system-fonts --font-path assets/fonts`)
and the bundled WASM compiler (typst.ts, the plugin's own
`typst_ts_web_compiler_bg.wasm`, fonts `BOOK_FONTS`). **Machine:** Apple M1
Pro. **Code:** `spikes/entry-wrap/` (git-ignored): `wrap.typ` (the candidate
helper), `gen.mjs` (generator), `run.sh` (CLI runs), `check.spike.ts` (PDF
checks with the plugin's own reader, `src/core/pdf` and US-034's gap
formula), `wasm.spike.ts`, `edge.typ` (hand-made edge cases),
`grow.typ`, `subhead.typ`, `qr-header.spike.ts` (changes 2 to 4). All text
is generated nonsense words or `lorem`; no real data (SCAR-035).

## Question

Today (US-030 AC-16) the opening is a non-breakable two-column grid: the
first block of the body in the 45 % column, the statblock in 55 %; the rest
of the body starts full width below whichever is taller. The wanted
behaviour: the body fills the column beside the statblock until the
statblock ends, then runs full width; a paragraph that reaches the
statblock's lower edge is split there; a block that cannot be split (an
image) goes full width below. Typst 0.14 has no text wrap around a placed
box. Can this be done in one compile, deterministically, without losing or
doubling text, with justification and hyphenation intact?

## Candidates

- **W, split inside the compile at a word boundary (`wrap.typ`).** The
  converter hands the body to the helper as a list of blocks with a kind
  (`par`, `heading`, other). Inside `layout()`, the helper measures the
  statblock (`measure()`), then puts whole blocks into the column while the
  column stays no taller than the statblock. For the first `par` that does
  not fit, it splits the paragraph's content into atoms (top-level
  children; `text` split at spaces; bold, links, footnotes, quotes and any
  other inline element kept whole) and finds by binary search the most
  words whose part, ended by `linebreak(justify: par.justify)`, still fits.
  The column holds that part, justified to its edge; the rest of the
  paragraph starts full width below the statblock with no first-line
  indent, followed by the other blocks. A sub-heading goes into the column
  only when the start of what follows fits there too. Anything else that
  does not fit whole goes below. Only `measure()` and `layout()`, no
  `query`, `locate` or state.
- **I, the package `wrap-it` 0.1.1** (Typst Universe, Unlicense, 5 KB; the
  same idea: split content by its structure, linear search over words).
  Tried with the CLI only: the plugin's WASM compiler fetches no packages,
  so it would have to be vendored.
- **base, today's layout** (US-030 AC-16), for comparison.
- Not tried: splitting in the converter (TypeScript) — it cannot know where
  lines break; a two-compile read-back of line positions — US-028 showed
  the cost of read-back loops and the measure route made it unnecessary;
  clipping a full paragraph in two boxes — the column and the full width
  break lines differently, so the second box cannot continue the first.

## Set-up

A5 page, 105 × 165 mm text area, 10.5 pt Libertinus Serif, justified,
hyphenation on, paragraph spacing 0.65 em. Each entry: a blank statblock box
25–95 mm high (8 % of entries: 70–120 mm with a short text) at 55 % with a
4 mm gutter, then 1 to 7 blocks: paragraphs of 3 to 160 words with now and
then a bold phrase, a link, a footnote, quotes and an em dash; level-4
sub-headings (sticky, as US-031 AC-11); bulleted lists of 2–6 items (kept
whole); grey image blocks 20–60 mm high. Chapters of 40 entries, 10 seeds
(400 entries per variant; 54–62 pages a chapter). Variants: `W`, `base`;
`W-j`, `base-j` with US-034's built-in narrow-column justification limits
(spacing 80–150 %, tracking −0.01 to 0.03 em) in the column; `W-nl`,
`I-nl` with lists turned into paragraphs (wrap-it aborts on lists, below);
`W-flow`, where each opening follows a filler paragraph in the flow instead
of starting a page (the case of nested entries and entries outside the
chapter, which are inline).

**Checks, by program on the PDF** (`check.spike.ts`, the plugin's PDF
reader): (1) the letters of the entry's body text, read in page order
(lines top to bottom, left to right; footnotes and markers left out by
size), equal the generated text — nothing lost, doubled or reordered; (2)
no glyph reaches into the statblock's area; (3) at a split, the column's
last line ends at the column edge (justified), does not end with a hyphen,
and its widest word gap (US-034's formula) is compared with the other
column lines; (4) the first full-width line after a split starts at the
left edge (no indent); (5) unused height beside the statblock when text
follows below it, in lines. Facts from the compile (`<wrap>`, `<wtop>`,
`<es>`, `<ee>` metadata): split index, line counts of both parts, measures
per opening, the opening's real page.

## Results

| | base | W | W-j | W-nl | I-nl | W-flow |
|---|---|---|---|---|---|---|
| Entries | 400 | 400 | 400 | 400 | 400 | 400 |
| Text lost, doubled or out of order | **3** | 0 | 0 | 0 | 0 | 0 |
| Glyphs in the statblock's area | 0 | 0 | 0 | 0 | 388 ¹ | 0 |
| Paragraphs split at the statblock's edge | — | 288 | 289 | 299 | — | 284 |
| … column's last line justified to the edge | — | 288 | 289 | 299 | — | 284 |
| … ending with a hyphen | — | 0 | 0 | 0 | — | 0 |
| … first full-width line indented | — | 0 | 0 | 0 | — | 0 |
| Openings with text below the statblock | 320 | 332 | 332 | 327 | 303 | 302 |
| … more than one line unused beside it | **109** | 24 ² | 26 ² | 16 ² | 131 | 28 ² |
| … unused beside, median / p90 (lines) | 0.52 / 9.90 | 0.37 / 0.75 | 0.37 / 0.75 | 0.28 / 0.68 | 0.80 / 4.95 | 0.33 / 0.76 |
| Compiles that did not converge | 0 | 0 | 0 | 0 | 0 | 0 |

¹ wrap-it's grid in this configuration (fixed block 57.75 mm wide, 4 mm
gutter) drew the statblock about 7 mm past the text area's right edge
and the text column about 8 mm wider than planned (read off one rendered
page at 100 ppi); the checker flags the column text crossing the planned
column edge. Not investigated further.
² Every one of them is explained by the block after the column: an image or
a list kept whole (W: 16, W-nl: 15) or a sub-heading whose next lines did
not fit (W: 8, W-nl: 1). The largest (14 lines) is an entry that starts
with an image taller than the room beside the statblock: the column stays
empty (AC as decided; question 1).

**Today's layout loses text.** The three `base` losses are entries whose
first paragraph (about 140 words and more) in the 45 % column is taller
than the page: the grid is non-breakable, and the text below the page's
foot is not printed (seen on the rendered page; `base-j`: the same three
entries). Not reported by any warning in 0.12.1. The wrap removes the cause:
the column is never taller than the statblock.

**Word gaps** (widest gap of a line, percent of a normal space; US-034's
measure; one A5 page, Libertinus, these generated words with many long
ones):

| | Column lines (not the last) | Column's last line at a split | Full-width lines |
|---|---|---|---|
| W, no limits: median / p90 / over 200 % | 200 / 373 / 50 % | 195 / 373 / 47 % | 120 / 176 / 4 % |
| W-j, US-034 limits | 136 / 255 / 20 % | 131 / 285 / 20 % | 119 / 175 / 3 % |
| base-j, US-034 limits | 140 / 259 / 22 % | — | — |

The split line is no worse than any other line of the narrow column. What
the split costs is hyphenation across the edge: the word after the cut is
never hyphenated into the column, so that line may stay looser than Typst
would set it in a whole paragraph (one example at reading size: a column
line of four words with wide gaps, followed below by a word that a
hyphen could have split; that a whole paragraph would have set it tighter
is not measured).
US-034's word-gap scan reports such lines as for any column line.

**Short parts** (lines of the split paragraph, from `measure()`): of 288
splits (W), 11 leave one line in the column and 32 leave one line below it
(question 2).

**Measure of the whole opening.** For the 109 openings of seeds 1–5 that
stand on one page, `measure()` of the opening at the text width equals the
laid-out height (largest difference 0.000 mm). US-032's fit and automatic
choice measure whole entries, so they keep working with the wrap inside.

**One compile, deterministic.** No query or state: the split is decided
while laying out, in one pass; 0 non-converging compiles in 2 800
openings. The Typst text does not depend on the measurement (the converter
writes the same text; `gen.mjs` twice → the same SHA-256). Three compiles
of each W chapter with `--creation-timestamp 0` gave byte-identical PDFs
(10 of 10).

**WASM equals the CLI.** The `<wrap>`, `<es>` and `<ee>` facts (split
index, line counts, column height, pages, positions to 0.001 mm) are
identical for the 10 W and 10 base chapters.

**Time** (40-entry chapter, 54–62 pages):

| | CLI, 30 compiles, median / p90 | WASM, first compile of a chapter, median of 10 (range) |
|---|---|---|
| base | 81 / 88 ms | 337 ms (209–458) |
| W | 153 / 190 ms | 748 ms (575–1089) |
| W-nl | 145 / 158 ms | — |
| wrap-it (I-nl) | 558 / 743 ms | not runnable |

W costs about 70 ms (CLI) or 400 ms (WASM) more per 40 openings: a median
of 8 and at most 13 `measure()` calls an opening. A repeated compile of
the same source in WASM takes 1–2 ms (memoised).

**wrap-it 0.1.1** aborts the compile (`expected content, found array` in
its `_rewrap`) when a list reaches the statblock's edge; with lists turned
into paragraphs it compiles, keeps all text, but in this configuration
draws the statblock past the text area, leaves more than a line unused in
131 of 303 openings (it stops at the first child that does not fit), and
is 3.6 times slower than W (linear search). It also needs a package
download the plugin's compiler cannot do.

### Edge cases (`edge.typ`, read at 120 ppi, full page)

| Case | Result (W with US-034 limits) |
|---|---|
| Statblock taller than all the text | All text beside it, nothing below; the page continues below the statblock |
| A link, a footnote and a bold phrase near the edge | Kept whole and in order; the footnote numbered and set at the page foot; the cut falls between atoms |
| Ragged-right template with a first-line indent (`all: true`) | Column's last line not stretched (`linebreak(justify: par.justify)`); the continued part not indented; the next paragraph indented as the template says |
| A 48-letter word in the column | Hyphenated inside the column as usual; the line before it loose, as in any narrow column |
| An image first, taller than the room beside the statblock | Goes full width below; the column stays empty |
| A list reaching the edge | Kept whole below; the paragraph before it split, one line of it below (question 2) |
| Opening in the flow near a page's foot (`W-flow`) | The statblock and its column move to the next page whole, as today's grid does; nothing lost (165 of 400 openings started at a page top after the page before ended more than 6 mm above its foot; footnote areas included in that figure) |

## Recommendation

Use **W**: a Typst helper that fills the column with whole blocks while
they fit, splits the first paragraph that does not at the most words that
still fit (binary search with `measure()`), and sets the rest full width
below. Measured above: no lost, doubled or overlapping text in 2 800
openings, every split at a justified line end, one compile, byte-identical
output, WASM equal to the CLI, about 1.8 ms (CLI) / 10 ms (WASM) per
opening. Do not add wrap-it.

For the stories (G1):

- The converter passes the body as a list of `(kind, body)` blocks instead
  of one lede block (a side channel, not markers in the text; SCAR-039);
  `kind` says what may be split (`par`), what is sticky (`heading`) and
  what is kept whole (lists ≤ 10 items per US-031 AC-12, images, tables,
  code, callouts, quotes).
- The splitting reads Typst's content structure (sequence children, `text`
  split at spaces, a space element `[ ]`). That is a statement about Typst
  0.14.2 (SCAR-024): a test must pin it with the converter's real paragraph
  output (escapes, smart quotes, inline images, page references after links,
  spans), not only `lorem`.
- US-034's narrow-column limits apply to the whole column, in measuring and
  drawing alike (the spike sets them in both).
- US-031's `split(e)` for `spread-portrait` and `full-image` (whole blocks
  onto the left page) has to account for blocks already used beside the
  statblock.

## Changes 2 to 4: brief checks

- **Change 2, the illustration under the text, grown.** `block(height:
  1fr)` with `layout()` inside, placed after text that ran on from the left
  page, gives the exact free height of the rest of the page in one compile
  (`grow.typ`: 117.7, 69.2 and 25.6 mm free on three pages; the image drawn
  directly under the text, filling it). When the free height is smaller
  than today's slot, the block still gets only that height and the image
  ran past the page's foot in the probe: the story needs the fallback rule
  (today's shrink and overflow), decided before the block is drawn, and a
  sweep across the page edge at G1 (SCAR-021). Note: a landscape image is
  already at full text width in today's slot when it is wider than the
  slot's ratio (`spread-landscape` 105 : 82.5 = 1.27, `page-landscape`
  105 : 66 = 1.59), so a 3 : 2 picture cannot grow there; it only moves
  up (question 8).
- **Change 3, the larger picture wins.** Both forms can be measured inside
  the compile (`measure()` of the text at 45 % and at full width; the
  image's fitted size follows from the free height), so the choice needs no
  second compile. Not measured yet.
- **Change 4a, running header.** Reproduced with the test rig (sample
  preset, entries at level 2 and 3): with `runningHeaderLevel` 3 or 4 the
  first quick-reference page shows the last entry's name; with 1 it shows
  the chapter's name; with 2 it shows `Quick Reference`. The sheet page
  shows `Quick Reference` at 3 and 4, the chapter's name at 1. Cause
  (from the code, consistent with every run): the quick reference and the
  sheet come after `<o2t-chapter-end>`, so US-019's rule applies there,
  which looks for headings of exactly the header level on the page and
  else the last heading at or above it before the page. Not the
  "(continued)" logic.
- **Change 4c, section rows.** Typst 0.14's leveled table headers
  (`table.header(level: 2, repeat: true, …)` per section) repeat the
  section's row after the column header on a page that starts inside the
  section (`subhead.typ`, CLI, 95 rows over 4 pages). WASM not run.

## Not covered

- Real statblocks (their heights come from the preset; here blank boxes),
  the book's own fonts, templates other than the two above.
- The converter's real paragraph output in the atoms function (see above).
- Change 2's fallback and its sweep; change 3 not run; change 4c in WASM.
- Time inside Obsidian's worker (here: Node and the CLI).

## G1 measurements (2026-11-08, after the user's answers)

**Code:** `spikes/entry-wrap/g1/` (git-ignored). Typst 0.14.2.

### 1. The converter's real paragraphs through the wrap

`real.spike.ts`: 31 entries converted by the plugin (`convert`, the test
rig of US-030 to US-036), each opening paragraph built from emphasis,
strong, highlight, strike, inline code, a heading link and a wikilink to
another entry, a footnote, straight quotes, an em dash, escaped `#`, `$`,
`@`, `*`, text that looks like a list (`1.`, `- `, `+ `), a long italic and
a long bold phrase, a hard line break, and in every third entry an inline
image (which the converter turns into a block of its own between two
paragraphs); 0 to 14 attacks so the statblock's height moves the cut
through the paragraph. The statblock helper's last line in the converted
Typst was replaced by the spike's wrap; compiled with the bundled WASM
compiler, with `linkPageNumbers` off and on (US-018's `(p. N)`).

| | page numbers off | page numbers on |
|---|---|---|
| Openings / paragraphs split | 31 / 23 | 31 / 24 |
| Plain text of the two parts differs from the paragraph's (checked in the compile) | 0 | 0 |
| PDF letters (as a multiset) equal to the plugin's own layout of the same note | yes (12 055) | yes (12 110) |
| Errors / did not converge | 0 / 0 | 0 / 0 |

Found and fixed in the helper on the way: the converter writes a paragraph
as `[` newline … newline `]`, so the content starts and ends with a space;
without trimming, the first possible cut was an empty first part. The
helper now drops leading and trailing spaces before it lists the cuts. A
template that does not justify was used here (the test rig's): the
column's last line stayed ragged, as `linebreak(justify: par.justify)`
should.

### 2. Change 2: the illustration under the text, grown, centred

`grow/`: 600 `spread-landscape` right pages (10 chapters × 60 entries; text
of 0.9 to 1.8 pages with sticky sub-headings and lists kept whole; ratios
1, 1.15, 1.27, 1.5, 2 and 4 : 1). Today's slot: full text width, at most
half the text height. Approaches:

- **T** today's code (`v(1fr)`, the slot);
- **P** the free height from a position probe (`here()`) after the text;
- **B** `block(height: 1fr)` + `layout()`, grown when `measure()` says the
  slot fits, else today's placement;
- **S** `block(height: 1fr)` + `layout()`: when the real free height holds
  the slot, the picture is fitted into it (text width × free height) and
  centred in it; when not, the block draws nothing and sets a state, and
  the picture follows the block at today's size (so on the next page, as
  today).

| | T | P | B | S |
|---|---|---|---|---|
| Chapters that did not converge | 0/10 | **10/10** | 0/10 | 0/10 |
| Picture past the page's foot | 0 | 0 | 0 | 0 |
| Picture moved to the next page | 191 | 364 | 172 | 191 |
| … where today's layout does not move it | — | 173 | 0 | 0 |
| Picture smaller than today's slot | 0 | 0 | **19** | 0 |
| Picture larger than today's slot | 0 | 91 | 167 | 169 |
| Picture not filling the free height, centred in it | — | 4/236 | 388/391 | 391/391 |

**S keeps every rule**: today's fallback exactly (191 = 191), never smaller
than the slot, centred whenever it cannot fill the free height (every
width-limited picture), one compile. B's estimate from `measure()` misses
the space lost at the page break (19 pictures squeezed below the slot); P
does not converge (SCAR-021). S reads a state set in the same flow; the
picture it moves never changes the block's height, so it settles (0 of 10
chapters, 60 decisions each).

A probe artefact on the way (SCAR-028): a bare `metadata` after the text
moved with the following content to the next page; the text-end marker is
now a zero-height block.

### 3. Change 3: the portrait forms in one compile

`portrait/`: 700 `spread-portrait` right pages (10 × 70; remaining text of
0 to about 330 words, 15 % none; ratios 0.25 to 1.0). Both forms decided
with `measure()` only (the text at the column's width and at full width; the
picture's fitted size), the stacked picture drawn in `block(height: 1fr)` +
`layout()` and centred.

| | Result |
|---|---|
| Did not converge / errors | 0 / 0 (10 chapters) |
| Forms chosen | stacked 599, columns 101 |
| Stacked picture's drawn size equal to its measured size | 599 of 599 |
| Picture on another page than its text | 0 |
| No text: stacked picture fills the text area | 104 of 119 (the other 15 are very tall pictures, the same size in both forms: a tie, so the columns) |
| Chosen because the column's text overflows (answer 13) | 300 |
| … stacked picture's area against the columns slot: min / p10 / median | **0.03 / 0.08 / 0.40** |
| … smaller than the columns picture at 70 % (`minScale`) | 176 of 300 |

So a form that fits wins even with a stamp-sized picture (3 % of the
columns slot's area): see the open questions in the report of 2026-11-08.

### 4. Change 4c in WASM, and a section row at a page's foot

`subhead.spike.ts`: the leveled headers of `subhead.typ` in the bundled
WASM compiler give the same 4 pages and the same first rows as the CLI
(the section's row repeated under the column header on pages 2 to 4).
`orphan.spike.ts`: the first section 24 to 40 rows long (17 tables, CLI):
no page ends with a section row; Typst keeps the row with the rows under
it.
