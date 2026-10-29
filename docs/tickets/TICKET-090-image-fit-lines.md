# TICKET-090 — The lines written for an image and which images get them (core)

**Status:** Done (2026-10-29)
**User story:** [US-028](../user-stories/US-028-image-fit.md)
**ACs addressed:** AC-2, AC-3, AC-6 (the reserves written), AC-7 (the size
arguments), AC-10, AC-12 (the arguments at their values); decisions 1, 3, 5
to 7, 9
**Depends on:** TICKET-089 (the field)
**SCARs:** SCAR-001, SCAR-002, SCAR-009, SCAR-010, SCAR-011, SCAR-017,
SCAR-019, SCAR-023

---

## Description

With `images.minScale` below 100, every image the rule applies to is written
as the probe line and one `#fit-flow(…)` call with its arguments (path,
label, line, name as written, `min`, `sides`, `floats`, `reserve`, caption,
size). Which images (AC-2), where floats are off (containers, the back
notes, a written page break next), the reserve of each container and their
sums (AC-6, AC-3), the labels `o2t-fit-1`, … in document order. At 100 the
output is byte-identical to today (AC-10). The helper itself is TICKET-091.

---

## Implementation notes

- `src/core/emit/image.ts`: `emitImage` gains a `fit` option (null: today's
  `fit-image` call, unchanged); with it, the image writes the probe line and
  the call. The size arguments come from the same reading of the Obsidian
  size as today (px × 0.75); the caption through `escapeMarkup` at a block
  start as today; the path and the name through `typstString` (US-003). The
  name is the link target as written (decision 9).
- `src/core/emit/inline.ts`: the split of an image out of its paragraph
  (the `{t: 'block'}` piece) passes the fit option only for an image that
  becomes a block; an image in a link, a heading, a table cell, a footnote,
  a missing or refused image gets none (AC-2; the existing cases of US-003).
- `src/core/emit/blocks.ts`: one decider of the container (SCAR-017): the
  block environment carries the reserve of the enclosing containers (pt and
  em sums apart; a callout's from its style's `inset` and `border.width`
  through the callout recorder, a quote `2.4em`, a list item `0pt`) and
  whether floats are allowed (top level only). The label counter lives in
  the emit context (one per document, document order).
- `src/core/convert/index.ts`: one set of the top-level blocks that start
  with a written page break, built where those lines are made: the US-025
  breaks (`addBreaks` rules), the first chapter after the front matter, the
  back notes' start (`bookLines`), contents in the body; an image that is
  the last piece of the block before such a block gets `floats: false`. The
  back notes' blocks get `floats: false, reserve: 0pt` (decision 7); the
  colophon's keep floats (decision 6). The cover's image is never a body
  block (US-011).
- `sides` from the page's facing pages; `min` the field / 100 written as a
  number (`0.7`, `0.99`, `0.1`).

### Guards searched before the ticket (SCAR-023)

- US-003 image tests (`tests/unit/us-003-images.test.ts`, the roundtrips):
  run without `images` (100): unchanged.
- `tests/unit/us-015-conversion-pipeline.test.ts` (one `#let fit-image`,
  order): unchanged at 100; TICKET-091 adds the helper's rule.
- US-016, US-017 callout and term forms: unchanged at 100.
- Searched by function name: `emitImage`, `emitInline`, `emitBlocks`,
  `convert` — the tests that pin their whole output run at 100.

---

## Tests

- `tests/unit/us-028-image-fit.test.ts` › AC-2, AC-3, AC-6, AC-10, AC-12 and
  the amendment of 2026-10-29 (reserves at the bounds, nested sums, the
  parts and the page breaks of US-026, US-027, the sample vault, the path
  name) — all but AC-5's warnings function (TICKET-091).
- Mutation checks: a table-cell image gets the call; floats on in a quote;
  the callout reserve without the border; the em part added to the pt part;
  no `floats: false` before the back notes; the back notes floating; labels
  numbered per container; the name reduced to the file name.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** (1–4) new call sites: `typstString` (path and name, as
  US-003), `escapeMarkup` (caption, as today), the callout style values (the
  reserve), the Obsidian size reading; each transform fits; edge inputs: a
  name with a quote, a caption with markup.
- **SCAR-002** (1–7) composed: callout, callout in callout, quote, list item,
  their combinations, table cell, link, heading, footnote, cover, colophon,
  back notes, before each written page break (US-025, US-026, US-027); the
  decisions of those stories listed in AC-3, AC-4 (the 2026-10-29 addendum).
- **SCAR-003** (1–3) red tests exist; the AC list read again; map rows.
- **SCAR-006** (1–4) full gate.
- **SCAR-007** (1–3) exact lines in the tests (the AC-3 example).
- **SCAR-008** n/a here (the helper's Typst in TICKET-091).
- **SCAR-009** (1–4) the call at the start of a line in every container
  (indentation of a list item, a callout body); the caption at a block
  start.
- **SCAR-010** (1–6) the probe and the call are two whole lines between
  blocks; inside a list item indented as its body; a probe after a paragraph
  piece starts its own line (the split of US-003).
- **SCAR-011** (1–5) `o2t-fit-N` never equals a heading label (`h-`
  prefix); the test with a heading `o2t-fit-1`.
- **SCAR-012** n/a here.
- **SCAR-013, 014** n/a.
- **SCAR-015** (1–5) the tests name the exact lines; the 100 guard.
- **SCAR-016** n/a.
- **SCAR-017** (1–8) one decider of the container and of "a page break
  follows"; grep for every writer of `#pagebreak` (all in `breaks.ts` and
  `toc.ts`' callers, the US-025 one-writer check) to build the set.
- **SCAR-018** (1–10) mutation run with backups.
- **SCAR-019** (1–5) `min` at 10, 50, 70, 99; facing on and off; the callout
  reserve at both bounds; three nested sums.
- **SCAR-020** n/a (measured, story).
- **SCAR-021** n/a here (the helper; TICKET-091, 092).
- **SCAR-022** n/a.
- **SCAR-023** (1–11) guards above; placement tests assert both sides.
- **SCAR-024** (1–4) the reserves and page-break rows are measured
  (`g3028/`); the quote's reason stays marked not verified.
- **SCAR-025 to 029** n/a.
- **SCAR-030** (1–4) the sample-vault test has a 60 s limit.

---

## Definition of done

- [x] Tests named above green; US-003, US-015, US-016, US-017 tests green
- [x] Mutation checks run; full gate counts in the result
- [x] Map rows AC-2, AC-3, AC-6, AC-7, AC-10, AC-12 name this ticket; index
      row `Done`

## Result (2026-10-29)

- Code: `emitImage` option `fit` (`src/core/emit/image.ts`, `ImageFit`, the
  probe line and the call); `EmitContext.nextFitLabel`, `fitFlowPlaced`
  (`context.ts`); `emitInline` option `fit` (`InlineFit`), reaching only
  the paragraph's own images, `breakAfter` only for its last piece
  (`inline.ts`); the block environment's `fit`, `within` (containers),
  `fitOf`, `reserveText`, `QUOTE_RESERVE`, and `topLines` (the former
  `addBreaks` and `addBookLines` as one function that returns the lines)
  with `pageBreakAfter`, the one decider of "a page break follows"
  (`blocks.ts`); `CalloutChoice.reserve` (`callout.ts`); `imageFit`
  (`convert/index.ts`: off at 100, `min` = minScale / 100, the back notes'
  blocks never float). Deviation from the note: the page-break set is read
  in `blocks.ts` from the lines placed in front of the blocks, not built in
  `convert/index.ts` (one place sees the US-025 and the book lines).
- Shared-utility register: `typstString`, `ptLength`, the image emitter.
- Tests: the US-028 unit tests of this ticket green but two (below); one
  test added at the mutation run (text after the image in its paragraph:
  may float).
- Mutation run (scratchpad `mut090/run.py`, backups with `SHA256SUMS`,
  checked after every restore): 13/13 caught on the second run — a table-cell
  image gets the call; floats on in a quote; the callout reserve without the
  border; the em part added to the pt part; no `floats: false` before a page
  break; weak page breaks missed; the back notes floating; labels not
  counted; the name reduced to the file name; the fit in marks and links;
  every image the last piece (survived the first run: no test input had
  text after the image; test added); the rule on at 100; a missing image
  given the call.
- Gate (scratchpad `gate090.log`): typecheck, build (`main.js`
  `6e4b84194650…`), lint green; `npm test` 2013 passed, 13 failed, 1 todo;
  integration 445 passed, 32 failed, 1 skipped. All red tests of US-028.
  New red: the PDF test "two fresh compiles of each case agree", green before
  only because no call was written (both compiles had no decisions); red now
  for `unknown variable: fit-flow` (TICKET-091).
- Open (to the user): `US-028 AC-3: a caption and an Obsidian size …`
  expects `A \*bold\* map`, but the parser gives the alt text `A bold map`
  and today's figure writes `caption: [A bold map]`; `US-028 AC-6: a callout
  writes floats: false …` expects `sides: false` with facing pages on, which
  AC-3 does not state; the end padding (signature > 0, no back notes) after
  a last image is no written page break at a line start, so the image may
  float there (not measured).

### Closed after the user's answers (2026-10-29)

- The caption test expects today's caption (`A bold map`, read from today's
  output) and an escaped one (`Price \$5 \#1`); the callout test expects
  `sides: true` (sides follow the facing pages in containers too).
- Decision 10 (story amended, measured first: `g3028/padend.test.ts`, 27/27
  with floats on and off at the note's end and before the end padding of
  signature 8; a float gives the pages of a move): a paragraph's last image
  with no top-level block after it never floats. `pageBreakAfter` returns
  true when no block follows. AC-12 inputs got text after the image; one
  test added (the note's end, after a comment, before the end padding; a
  block after: may float).
- Mutation run (second version, `mut090/run.py`): 15/15 caught, including
  "the end of the note may float" and "a trailing comment counts as a
  block".
- Gate (scratchpad `gate090b.log`): typecheck, build (`main.js`
  `4da8ed1f7663…`), lint green; `npm test` 2016 passed, 11 failed, 1 todo;
  integration 445 passed, 32 failed, 1 skipped. Red by file: unit US-028 4
  (TICKET-091), plugin fit-warnings 3 (092), image-rows 4 (093), PDF 32
  (091, 092) — all US-028.
