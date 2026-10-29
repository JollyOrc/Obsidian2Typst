# US-028 — Images that stay with their text

**Status:** Done (M18 passed 2026-10-29)
**Introduced:** v0.10.0 (planned; a new feature bumps the minor version)
**Implemented:** v0.10.0 (test build `0.10.0-m18.1`, M18 passed 2026-10-29)
**Supersedes:** the backlog item "keep image with its text" (row "Image
rules")

---

## Story

**As an** author of a printed book,
**I want** an image that does not quite fit under its text to shrink a little,
or else to let the text flow past it within the same spread,
**so that** the book has no large, mostly blank page in front of an image.

Decided by the user (`docs/state/00_governance.md`, 2026-10-28, rounds 6 to 9
of the Book structure G0): an image that does not fit in the space left on the
page shrinks in place down to `images.minScale` (a percentage of the size it
would otherwise get); if it still does not fit and the next page is on the
same spread (the image is on a left page), the text after it flows up and the
image goes to the top of the next page (it floats); on a right page it moves
to the next page and the gap stays; with facing pages off it may float; the
rule applies to block images, also inside callouts (there it only shrinks,
no float), not to the cover, images in tables or images inside text; a warning
when an image could not be kept with its text (moved or floated), shrinking
is silent; `images.minScale` 100 (no shrinking) by default. Last of four
stories (US-025 to US-028).

Measured 2026-10-28 with the bundled compiler (Typst 0.14.2), an A5 page and
a 300 × 200 px image after k = 0 to 26 filler paragraphs (scratch probes
`p028/probe.test.ts`, `sweep2.test.ts`, `float.test.ts`, `query.test.ts`;
positions from Typst's own report on p. 1, because the PDF text reader of
that day dropped text on pages that carry an image — the reader was rewritten
for SCAR-028 and reads them since, checked 2026-10-29; SCAR-023, SCAR-024):

- **The probe.** The space left on the page is read in `context` from a
  zero-height block written on its own line before the image
  (`#block(height: 0pt, above: 0pt, below: 0pt, width: 100%)[] <o2t-fit-1>`).
  The block stays on the page where the text before it ends in all 81 cases;
  a `metadata` marker in its place moves to the next page together with the
  image at exactly the edges that matter (k = 7–10, 17–20), and `locate` of a
  label fails inside a `layout` callback.
- **The helper** (no `layout`; sizes from `page.width`, `page.height` and
  `page.margin` in `context`): full size when it fits; shrunk to the space left
  when that is at least `min` of its size; else floated (`place(top, float:
  true, clearance: 1em)`) when floats are allowed and the probe is on an even
  (left) page or sides are off; else moved (a block on the next page). Images
  are blocks: written as inline content, full and shrunk images went to the
  next page.
- **Results.** Limit 70 % and 50 % with facing pages, 70 % single-sided: 77 of
  81 cases right (17 shrinks, 11 floats, 5 moves; the rest full size). The 4
  others are floats at the tightest edge (k = 10; k = 20 single-sided): the
  image is at the top of the next page as decided, but the paragraph after it
  also starts there, so the gap stays — a plain `place(top, float: true)`
  without the helper does the same (likely Typst's paragraph breaking; not
  verified, SCAR-024).
- **Captions and sizes.** A captioned figure (`figure(…, caption: […],
  numbering: none)`; the caption's height counted in the room), an image with
  an Obsidian width (`|200`, i.e. 150 pt; written `200pt` in the probe) and
  both together: 27 of 27 cases right each (k = 0 to 26, 70 %, facing pages).
- **Callouts.** With floats off and the room reduced by the box's bottom inset
  and border (`reserve: 8.75pt` for inset 8 pt and border 0.75 pt): every
  case right; without the reserve one case (k = 6) decided `shrink` and the
  image went to the next page.
- **The decision is readable after the compile.** Each decision is written as
  `#metadata("shrink") <o2t-fit-decision>`; typst.ts
  `runWithWorld({mainFilePath}, async (world) => { await world.compile();
  return world.query({selector: '<o2t-fit-decision>', field: 'value'}); })`
  returns the values in document order as JSON (measured). The plugin's
  worker does not call `query` today.
- `figure(placement: auto)` was compared and left out: it put the image at the
  top of the current page, before the text it follows.

Measured at G2, 2026-10-28 (scratch probe `p028/g2.test.ts`, the same page,
k = 0 to 26, 70 %, facing pages; a 300 × 200 and an 800 × 400 image, the
latter wider than the text; every case also compiled for diagnostics: none):

- **The helper's final form.** In a container (floats off) the width comes
  from `layout` (the container's width), the position from `locate` outside
  it; at the top level from the page as before. The image block is written
  with `above: 0pt`, so it starts at the probe. Both images, top level: 27 of
  27 each; the wide image is never wider than the text or the container.
  *Amended 2026-10-29 (decision 11): these measurements judged pages only.
  At reading size the probe written with `above: 0pt` sat on the last text
  line's baseline, so every image overprinted that line's descenders and lost
  the space above it, and a captioned image was not centred like today's
  figure (M18 preparation, SCAR-025). The probe now keeps the normal space
  above it and the image block is full width (AC-3, AC-13).*
- **Containers:** a callout (reserve = bottom inset + border, 8.75 pt), a
  callout in a callout (reserve = both, 17.5 pt), a list item (reserve 0):
  27 of 27 each, with both images. A quote (`#quote(block: true)[…]`, the
  plugin's form): 21 and 22 of 27 with reserve 0 (decided `full` or `shrink`,
  the image on the next page; the room is overestimated by 25 to 26.4 pt; 25
  pt still fails, 30 pt holds); with reserve `2.4em` 27 of 27 at text sizes
  9, 11 and 14 pt. Why a quote needs it is not verified (SCAR-024: 2.4 em is
  twice Typst's default block spacing, 1.2 em; the plugin sets no spacing,
  a template could).
- **Width and height** (`|300x200`, `|400x100`, `|200x300` px; the box
  scaled by one factor): 27 of 27 each.
- **An image right before a heading with a page break** (US-025, `right`
  and `page`): where the helper decided `float` (k = 8 to 10), the image went
  to the top of the next page and the heading to the page after it, the gap
  before the image stayed — the same pages as a move (`page`: image p. 3,
  heading p. 4; `right`: image p. 3, heading p. 5, p. 4 blank). A float only
  helps when text follows it.

---

## Acceptance criteria

- **AC-1 (the field):** Preset field and Defaults row `images.minScale`, a
  whole number from 10 to 100 (percent), built-in 100. Any other value makes
  the preset invalid (US-008 AC-4): `images.minScale must be a whole number
  from 10 to 100 (line 4)`. With 100 the rule is off (decision 1).

- **AC-2 (which images):** The rule applies to an image or file embed that is
  a block of its own (US-003: an image is split out of its paragraph) at the
  top level of the body and of the colophon (decision 6), and, shrinking
  only, at the top level of the back notes (decision 7) and inside a callout,
  a quote or a list item (decision 3; AC-6). Not to: the cover (US-011), an image in a
  table cell (US-005 AC-2), an image inside a link (US-004 AC-1d), an image in
  a heading (placed after it, US-003), an image in a footnote, a missing or
  refused image (its red placeholder, US-003 AC-6). Those are written as
  today. Example: in `> [!example]` / `> ![[map.png]]`, in `> ![[map.png]]`
  and in `- ![[map.png]]` the rule applies (shrink only); in
  `| ![[map.png]] |` it does not.

- **AC-3 (what is written):** With `images.minScale: 70`, facing pages on, the
  image `![[map.png]]` at line 12 as the first image of the rule:
  ```
  #block(height: 0pt, below: 0pt, width: 100%)[] <o2t-fit-1>
  #fit-flow("assets/map.png", <o2t-fit-1>, 12, "map.png", min: 0.7, sides: true, floats: true)
  ```
  The probe gets the normal space above it, as the image gets it today
  (decision 11; not `above: 0pt`). With `floats: false` the helper's output
  is one block `block(above: 0pt, width: 100%, …)` (written bare in a
  container, the call's content was read as a paragraph's and got its
  spacing on top); with `floats: true` it is written bare, since a float
  inside that block stays in it and the text after it no longer fills the
  gap (decision 12, measured 2026-10-29). The helper reads:
  `let body = context { … }` and then `if floats { body } else {
  block(above: 0pt, width: 100%, body) }`. The image or figure is written
  as `block(above: 0pt, width: 100%, …)`, so the image starts at the probe
  and a captioned figure is centred as today (measured 2026-10-29, AC-13).
  A floated figure is written `[#fig(w) #label(str(at) + "-f")]` (the label
  `o2t-fit-N-f`), and before the decision the room gets back the float's own
  height when it stands on the probe's page (decision 13):
  `let own = query(label(str(at) + "-f")).filter(e => e.location().page() == pos.page).len() > 0`
  and `if own { room = room + h + cap(w) + 1em.to-absolute() }`.
  The
  arguments are the copied file's path, the probe's label, the source line
  and the file name as written (both for the warning, AC-5; the name through
  `typstString`; added at G2 to match AC-5). The labels are numbered `o2t-fit-1`, `o2t-fit-2`, … in document order
  (deterministic, rule 7; the plugin's labels of headings start with `h-`, so
  no heading label can take this form, SCAR-011). `sides: false` with facing
  pages off; inside a callout, quote or list item `floats: false, reserve:
  <length>` (AC-6), for nested containers the sum of their
  reserves, the pt parts added into one length and the em parts into a
  second, a zero part left out (`8.75pt + 2.4em` for a callout in a quote and
  for a quote in a callout, `17.5pt` for a callout in a callout, `4.8em` for a
  quote in a quote, `0pt` when nothing is reserved); `floats: false, reserve: 0pt` in the back notes (decision 7);
  `floats: false` also when the next top-level block starts with a written
  page break: a US-025 heading break, the first chapter after the front matter
  and the start of the back notes (US-026), contents placed in the body
  (US-027), and when no top-level block follows (the note's end, also before
  US-026's end padding; decision 10) (AC-4). Only the paragraph's last
  image: an image with text after it in its paragraph may float (that text
  fills the gap). A caption gives `caption: [Map]` (escaped as
  today, US-013); an Obsidian size gives `width: 150pt` (and `height:` when
  given, AC-7). The helper `fit-flow` is written once into the preamble when
  an image uses it (like `fit-image`, US-015 AC-2) and joins `PLUGIN_NAMES`
  (US-016 AC-11), as do the labels' prefix `o2t-fit` and `o2t-fit-decision`.

- **AC-4 (the decisions; measured):** With the space left on the page measured
  at the probe (the page's bottom margin, minus the caption, minus the
  reserve):

  | The image at its size | Space left | Page of the probe | Result |
  | --- | --- | --- | --- |
  | fits | any | any | full size, after its text |
  | does not fit; at `minScale` it fits | — | any | shrunk to the space left, after its text, no warning |
  | does not fit even at `minScale` | — | left (even), or facing pages off | full size at the top of the next page; the text after it fills the gap; warning `IMAGE_FLOATED` |
  | does not fit even at `minScale` | — | right (odd) | full size on the next page; the gap stays; warning `IMAGE_MOVED` |
  | does not fit even at `minScale`; the next block starts with a page break | — | any | as on a right page: moved, `IMAGE_MOVED` (measured: a float there leaves the same gap — for a US-025 heading break at G2, and on 2026-10-29 for the first chapter's break `left` and `right`, the back notes' start at signature 0 and 8, and contents in the body: 27/27 each) |
  | does not fit even at `minScale`; no top-level block follows (decision 10) | — | any | moved, `IMAGE_MOVED` (measured 2026-10-29: a float there gives the same pages as a move, 27/27 with floats on and off, at the note's end and before the end padding of signature 8, which holds in every case) |

  "Its size" is the size it gets today: `fit-image`'s natural size, never wider
  than the text area and never taller than the page's text height (US-003
  AC-2b), or the Obsidian size. Left and right are physical pages (p. 1 is
  right, as in US-025). Measured example (A5, 70 %): k = 6 shrunk on p. 2;
  k = 8 floated from p. 2 to the top of p. 3, the text after it on p. 2; k = 18
  moved from p. 3 to p. 4, the gap on p. 3.

  A float's text fills the gap (decision 12): the text after a floated image
  starts on the page of its text. Only the last case of a run of floats in a
  sweep of the text before it (one paragraph more each) may leave the gap —
  the tightest edge of AC-8. Measured 2026-10-29 (the PDF test's top-level
  sweep, k = 0 to 30, 70 %): with decision 12 12 of 12 floats fill the gap;
  with the helper of decision 11 0 of 12; with the helper as written at G2
  12 of 15, the other 3 each the last of its run. Example (the M18 check
  note, A5, 70 %, facing pages): `IMAGE 2 follows.` ends p. 4, the image
  `map.png|400` floats to the top of p. 5, `AFTER IMAGE 2.` and the next
  paragraph start on p. 4 under it.

  A floated image never stands on its probe's page (decision 13): it is on
  the page after it. An image that fits after its text at 100 is not floated
  above that text. Example (measured 2026-10-29): the sample's `Book.md`
  single-sided at 70 with the `Contents` settings and M18's Defaults —
  `figure-10.png` (line 1126) fits after its text on p. 68 (y 90.41 pt) at
  100; it is decided `full` and stands there at 70; the other floats
  (`figure-28.png`, `figure-34.png`, `figure-52.png`,
  `plates/figure-53.png`) are each on the page after their probe.

- **AC-5 (the warnings; decision 2):** After a compile (export and preview),
  the plugin reads the decisions with `query` (measured) and reports, at the
  image's source line:
  - `IMAGE_FLOATED`  `Image "map.png" did not fit after its text; placed at the top of the next page (line 12)`
  - `IMAGE_MOVED`  `Image "map.png" did not fit after its text; moved to the next page, the space before it stays empty (line 12)`

  Shrinking gives no warning. In strict mode (US-006) the two warnings are
  reported but never stop the export or the preview: they exist only after
  the compile; strict mode acts on the conversion warnings as before
  (decision 8). The preview's warning count includes them. The decision's metadata value carries the
  source line and the shown file name (`(d: "move", line: 12, name:
  "map.png")`), written through `typstString` (US-003 paths). The warning
  joins the warning-codes table. A failed query (an old engine) gives no
  warning and does not fail the export.

- **AC-6 (callouts, quotes and list items; decision 3; measured):** Inside
  a callout, a quote or a list item the helper never floats (a float would
  leave the box or the item): an image that does not fit even shrunk is
  placed as today — the box breaks and the image goes to the next page —
  with warning `IMAGE_MOVED`. Its width is the container's (never wider). The
  reserve subtracted from the room:

  | Container | Reserve | Measured |
  | --- | --- | --- |
  | callout | its style's bottom inset + border width (`8.75pt` for 8 + 0.75) | 27/27, both images; also at the style's bounds 0 + 0, 50 + 0, 0 + 10, 50 + 10 pt (2026-10-29) |
  | callout in a callout | the sum over the enclosing callouts (`17.5pt`) | 27/27, both images |
  | list item | `0pt` | 27/27, both images |
  | quote | `2.4em` | 27/27 at 9, 11 and 14 pt; 21/27 with `0pt`; 27/27 with a template's `#set block(spacing: 0.6em)` and `2em` (2026-10-29) |
  | a callout in a quote, a quote in a callout | the sum (`8.75pt + 2.4em`) | 27/27, both images (2026-10-29) |
  | a quote in a list item | `2.4em` | 27/27, both images (2026-10-29) |
  | the back notes (decision 7) | `0pt`, no float | 27/27 with signature 8; with floats 25/27 (2026-10-29) |

  The reason for the quote's `2.4em` is not verified (SCAR-024); it held
  under every block spacing measured. The measurements of 2026-10-29 used the
  G2 helper recovered from the session transcript (scratch probe
  `g3028/probe.ts`; it reproduced the G2 baseline 27/27 first).

- **AC-7 (an image with an Obsidian size):** The size is the size "it would
  otherwise get"; the rule shrinks it as any other image (measured with a
  width: 27 of 27). With width and height (`|300x200`) both are scaled by the
  same factor (measured at G2: `|300x200`, `|400x100`, `|200x300` px, 27
  of 27 each).

- **AC-8 (the limit at the tightest edge; stated, not fixed):** When the
  floated image fills the next page's top so that the paragraph after it no
  longer fits in the gap, Typst puts that paragraph on the next page and the
  gap stays (measured: 4 of 81 cases, the same without the helper). The
  warning is `IMAGE_FLOATED` as decided; the help text of the warning says
  that the gap can stay at the edge.

- **AC-9 (settings rows; SCAR-016, SCAR-017):** A group `Images` in the
  Defaults section and the style panel with the row `Smallest image size`
  (number, `%`, 10–100) and the reset icon (US-008 AC-18); the style panel
  shows a preset's value as set by the preset (US-012 AC-2); the details
  pop-up (US-021) lists it. A change reaches the next preview and export.

- **AC-10 (today's output; rule 7):** With `images.minScale: 100` (the
  built-in) every note exports byte-identical to today: a text check over
  the sample vault's export shows no `fit-flow` and no `o2t-fit` (decision 1).

- **AC-11 (composed; SCAR-002):** The composed note of US-015 with a cover, a
  colophon and back notes (US-026), page breaks `h1: right` (US-025), the
  contents (US-027), a callout with an image, a captioned image, an image with
  a size, an image in a table cell, footnotes, page references (US-018) and
  folios and running header (US-019), `images.minScale: 70`: compiles without
  diagnostics; every text and every image is in the PDF; each image's page and
  decision as listed in the test; the signature total and the back notes on
  the last page still hold (US-026 AC-5); an image just before a heading with a
  page break (US-025) is moved, not floated (AC-4, measured); the preview
  shows the same.

- **AC-13 (the look as today; decision 11; SCAR-025):** An image the rule
  keeps at full size has the page, the position and the size it has with
  `images.minScale: 100`, and a captioned one is centred with its caption as
  today. Measured 2026-10-29 (scratch probe `m094/look2.test.ts`):
  `Sample/Book.md` with the `Contents` preset at 70 against 100 — all 71
  images equal (page, x, y, width, height) and all 424 pages' text equal.
  When the space above the image no longer fits at the bottom of the page
  (measured: 3 to 22 pt left), the probe and the image start the next page
  right after the text, where today's output puts any block: decided `full`,
  no warning (the space left is less than the block spacing). Under a
  template's spacing (`#set block(spacing: 2em)`, `#set block(above:
  0.6em)`, `#set par(spacing: 0.9em)`) every image before the first one the
  rule shrinks, floats or moves equals the output at 100 (measured; the
  first difference is each time a shrunk image). Example: a note with a
  captioned image, an image after a table in a quote, one in a callout, one
  in a list item and a plain one, all with small sizes so none comes near a
  page bottom: at 70 every image and every page's text as at 100.

- **AC-12 (settings at their values; SCAR-019, SCAR-021):** Tests at
  `minScale` 10, 50, 70, 99 and 100; facing pages on and off; a sweep of the
  text length before the image over two page edges for each, checked for a
  stable result (the decision read from its own layout, SCAR-021).

---

## Decisions (answered 2026-10-28; 6 to 8 on 2026-10-29)

1. **The rule at 100** (AC-1, AC-10). *Decided: as proposed.* Proposed:
   `images.minScale: 100` turns the whole rule off, floats and moves
   included, so today's exports stay byte-identical (round 8: new settings
   are off by default). Alternative: 100 only turns shrinking off.
2. **The warnings** (AC-5). *Decided: as proposed.* Proposed: two codes,
   `IMAGE_FLOATED` and `IMAGE_MOVED`, texts as in AC-5. Alternative: one
   code `IMAGE_NOT_KEPT` with the result in the text.
3. **Images in quotes and list items** (AC-2, AC-6). *Decided: like
   callouts (shrink only), measured at G2 first.* Proposed was: as today
   (not measured).
4. **The row** (AC-9). *Decided: as proposed.* A number row `Smallest image
   size` in a new group `Images`, 10 to 100 %. Alternatives: the lower bound
   50; a dropdown with US-025's row kind.
5. **An image before a page break** (AC-3, AC-4). *Decided: kept as
   proposed after the G2 measurement.* When the next top-level block starts
   with a written page break, the image does not float but moves
   (`IMAGE_MOVED`): a float there leaves the same gap (measured).
6. **Images in the colophon and the back notes** (AC-2; asked 2026-10-29 at
   G3). *Decided: like the body.* The rule applies to them; neither option
   was measured when asked. Measured afterwards: in the colophon floats are
   harmless (27/27, the first chapter stays on its page).
7. **Floats in the back notes** (AC-2, AC-6; asked 2026-10-29 after the
   measurement). *Decided: never float.* A floated image in the back notes
   lands after their end marker: the signature padding counts one page short
   (2 of 27 cases) and the page lies outside their no-header range. In the
   back notes an image shrinks or moves (27/27). Alternative was: keep floats
   and change US-026's padding (not measured).
8. **Strict mode and the fit warnings** (AC-5; asked 2026-10-29 at G3).
   *Decided: report, don't stop.* `IMAGE_FLOATED` and `IMAGE_MOVED` are
   listed in the report, the notice and the preview's count, and never stop
   an export or the preview, also in strict mode. Alternative was: in strict
   mode compile, read the decisions and write no PDF when an image floated or
   moved.

9. **The name in the warning** (AC-3, AC-5; asked 2026-10-29 at G2). *Decided:
   as written.* The name is the link target as the note writes it:
   `![[map.png]]` gives `map.png`, `![A map](assets/map.png)` gives
   `assets/map.png`. Alternative was: the file name only (the last part of
   the path).
10. **The last image of the note** (AC-3, AC-4; asked 2026-10-29 in
   TICKET-090). *Decided: never float.* A paragraph's last image with no
   top-level block after it (the note's end, also before US-026's end
   padding, whose page breaks are written inside a `#context` loop) is
   written `floats: false`: nothing follows to fill the gap, so it is moved
   and reported `IMAGE_MOVED`, as decision 5. Asked first for the end padding
   with the reason "the padding may break" (not measured); measured
   afterwards (scratch probe `g3028/padend.test.ts`): the padding holds
   27/27 with floats on and off and a float gives the same pages as a move;
   asked again with the measurement and kept. Alternative was: let it float
   (`IMAGE_FLOATED`, though the gap stays).
11. **The look as today** (AC-3, AC-4, AC-13; found 2026-10-29 while
   preparing M18; the user chose "Fix first, then M18" and, after the spike,
   "Adopt V2"). *Decided: the probe keeps the normal space above it and the
   figure is full width (V2); refined to V3 while writing the tests.*
   Measured: V0 (as written at G2) 1 of 71 images of `Book.md` equal to the
   output at 100; V1 (space above only) 54 of 71; V2 71 of 71 and all pages
   equal, but in a composed note an image after a table in a quote stood
   24 pt lower (the bare call read as a paragraph); V3 (V2 with the helper's
   output in a full-width block) 71 of 71 and the composed note 5 of 5, all
   35 PDF tests green, and under three template spacings equal up to the
   first image the rule changes. Decided with it: when even the space above
   no longer fits at the page bottom, the image starts the next page after
   its text as any block today, decided `full` without a warning. The known
   limit V2 had under a template's block spacing is gone with V3.
   Alternatives were: warn in that case (a detection of the page top, not
   measured); continue the spike on templates (V3 made it unnecessary). V7
   (the probe glued to the text, the space added by the helper) was
   measured and dropped: it adds space at a container's start and once ended
   in a Typst panic.
12. **Floats with the look of decision 11** (AC-3, AC-4, AC-13; found
   2026-10-29 while preparing M18 again; the user chose "Spike first, then
   decide" and "Adopt C3"). *Decided: the full-width block only where floats
   are off (C3).* With V3 every float stays inside the helper's block: the
   image and the text after it go to the next page and the gap stays,
   reported `IMAGE_FLOATED` (measured 0 of 12 floats fill the gap; the PDF
   test accepted it, its float check allowed AC-8's edge for every float).
   C3 writes the block for `floats: false` only (containers, the back notes,
   before a page break, the note's end) and the helper bare at the top
   level: 12 of 12 floats fill the gap, the 35 PDF tests green, `Book.md`
   at 70 as at 100 (71 of 71 images, 424 of 424 pages; under three template
   spacings as V3 up to the first image the rule changes), a top-level image
   after each of 10 kinds of block, adjacent and after a blank line, at the
   default and three spacings: 80 of 80 as at 100 (V2: 72 of 80). Why
   Typst keeps a float in its block is not verified. Alternatives measured
   and dropped: C2 (`scope: "parent"` on the float: 0 of 12), C4 (the float
   in a sibling `context` outside the block: floats fill, but the AC-13
   composed note's image after a table in a quote 24 pt off, as V2). Seen
   in the spike, not verified: a Typst panic (`unreachable`) after about nine
   whole-book compiles in one compiler instance; each of those compiles in a
   fresh process succeeds.
13. **A float above its own text** (AC-3, AC-4; found 2026-10-29 while
   preparing M18 a third time; the user chose "Spike first, then decide"
   and "Adopt F1"). *Decided: the room gets back the float's own height when
   the float stands on the probe's page (F1).* Measured: in `Book.md`
   single-sided at 70 `figure-10.png` was decided `float` and stood at the
   top of p. 68, above the text it follows, though at 100 it fits after that
   text. A float on the probe's page pushes the probe down by its own
   height, so the room read there is too small and the decision confirms
   itself (a second fixed point of a self-referential layout, SCAR-021); why
   the layout reaches it is not verified. With F1 `figure-10.png` is `full`
   at its place at 100 (x, y and size equal), the other 4 floats and the
   shrink unchanged, all 416 page texts as before, the 35 PDF tests green.
   Not reached by 3,216 synthetic cases (the text before swept by 3 words,
   three images, facing on and off, with and without page-referenced links)
   nor by `Book.md` cut after line 1140; the test is the sample's `Book.md`
   with the M18 settings. Alternatives not measured: forcing a float to the
   next page; accepting it and documenting the case.
---

## Notes

- Out of this story: images inside text, in tables and on the cover (as
  today); moving an image *before* its text; keeping an image with the text
  *after* it; a per-image override (a later story could read an Obsidian
  alias such as `|keep`).
- New call sites (SCAR-001): `emitImage` (today it does not know whether it
  is inside a callout, a table cell, a link or a quote — the emitter learns
  its container, one decider, SCAR-017), the preamble rule registry (a new
  helper), `typstString` (the name in the decision), `escapeMarkup`
  (caption, as today), the callout style values (the reserve), the compile
  path of the worker (a new `query` call: export and preview, SCAR-008: its
  options read from the type definitions, `compiler.d.mts:209`), the warning
  list of US-007.
- Worst misplaced click (SCAR-014): none; nothing is written into the vault.
- SCAR-027: nothing is replaced; `fit-image` stays for every image the rule
  does not apply to.

---

## Related tickets

- [TICKET-089](../tickets/TICKET-089-image-fit-field.md) — The field `images.minScale` (core)
- [TICKET-090](../tickets/TICKET-090-image-fit-lines.md) — The lines written for an image and which images get them (core)
- [TICKET-091](../tickets/TICKET-091-image-fit-helper.md) — The helper `fit-flow` and its decisions (core)
- [TICKET-092](../tickets/TICKET-092-image-fit-decisions-read-back.md) — Reading the decisions back; the warnings in export and preview (plugin)
- [TICKET-093](../tickets/TICKET-093-image-fit-row.md) — The row `Smallest image size` (plugin)
- [TICKET-094](../tickets/TICKET-094-image-fit-build-and-m18.md) — Test build and manual check M18 (image fit)
- [TICKET-095](../tickets/TICKET-095-image-fit-look.md) — The look as today: the probe's space and the full-width figure (defect fix)
- [TICKET-096](../tickets/TICKET-096-image-fit-floats.md) — Floats with the look as today: the full-width block only where floats are off (defect fix)
- [TICKET-097](../tickets/TICKET-097-image-fit-own-page.md) — A float never on its probe's page: the room corrected by the float's own height (defect fix)
