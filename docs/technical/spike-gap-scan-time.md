# Spike: time of the PDF word-gap scan (epic #121, D-16)

**Date:** 2026-11-06. **Code:** `spikes/entry-measure/gap-scan.mjs`
(git-ignored); input: synthetic books from `sweep.mjs` (nonsense words,
bundled fonts), compiled with Typst 0.14.2. Node 22 on an Apple-silicon Mac.

## Question

D-16 scans the exported PDF for justified lines with wide word gaps. On a
whole book (260+ pages), how long does that take, and where does the time go?
The scan reads every page's content stream, maps glyphs through the fonts'
ToUnicode CMaps and widths, and computes each space's width (advance plus the
following `TJ` adjustment, over the advance) — the arithmetic of the BL-C11
spike, which was exact on its calibration lines.

## Results (measured)

Two ways to find a PDF object: **naive**, a regex search of the whole file per
object (what the BL-C11 spike script and `tests/support/pdf.ts`'s
`objectText` do), and **index**, one pass that records every object's offset.
Fonts are read once per font object and reused across pages in both.

| Book | Pages | Lines with spaces | Spaces | index | naive |
|---|---|---|---|---|---|
| 914 KB PDF | 261 | 5,346 | 44,041 | **120 ms** | 241 ms |
| 1.4 MB PDF | 407 | 8,174 | 67,080 | **173 ms** | 491 ms |

Time per part with the index (261 / 407 pages): building the index 2 / 3 ms,
inflating the streams 8 / 10 ms, reading the text runs 102 / 149 ms, the gap
arithmetic 5 / 7 ms, fonts 1 / 1 ms. With the naive lookup, the object
searches alone take 109 / 296 ms and grow faster than the page count.

## Findings

1. **The scan is cheap next to the compile:** about 0.15 s for a 260–400 page
   book, against several seconds of compiling (US-028: up to 8 compiles).
2. **The object lookup has to be indexed.** A regex per object is quadratic
   in the file size; the index makes the scan linear. When D-16 moves the
   content-stream reader from `tests/support/pdf.ts` into `src/core`, it gains
   the index (and the tests that use it get faster too).
3. **It must not run on Obsidian's main thread in one piece:** 120–173 ms is
   above the 100 ms main-thread limit (governance, 2026-10-16). Run it in the
   compile worker after the export compile, or per page with yields.
4. The share of wide lines in these books (about 10 %) says nothing about real
   text: the synthetic words are long and the 45 % lede columns are set
   without `justification-limits`.

## Consequence for D-16 (proposal for G1)

- Export only (G0-C10), after the last compile, in the worker.
- An object-offset index; fonts read once per font object.
- No time limit is needed for a book of this size; the test pins a generous
  bound on a generated 400-page PDF (SCAR-030: measured, not default).
