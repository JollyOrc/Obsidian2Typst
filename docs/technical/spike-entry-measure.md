# Spike: measured layout for entries — `measure()` or read-back (epic #121, D-11)

**Date:** 2026-11-06. **Typst:** 0.14.2, both the CLI and the bundled WASM
compiler (typst.ts 0.7.0). **Code:** `spikes/entry-measure/` (git-ignored):
`gen.mjs` (generator), `run.sh` (CLI runs), `wasm.spike.ts` (the same
chapters through the WASM compiler). All text is generated nonsense words;
fonts are the bundled Libertinus Serif.

## Question

The automatic layout choice (D-12), overflow (D-13) and the empty-page
warning need each entry's size. US-028 needed a read-back across up to 8
compiles because its image-fit decisions depend on where an image lands, so
one compile does not settle. Entries differ: each one starts on a new page,
so its height does not depend on its position. Can Typst's `measure()`
decide inside one compile, or is a read-back needed?

## Set-up

A5 page, 105 × 165 mm text area, 10.5 pt, justified. Each entry: a title, a
lede paragraph beside a non-breakable 30–75 mm "statblock" box (45/55 grid),
then paragraphs, h4 sub-headings and lists. Lengths cluster around one and
two pages. Variant `rules` adds the D-06 rules (sticky sub-headings, lists of
up to 10 items not broken); `plain` has none. Each entry records its
`measure()` height (at the text width) and its real first and last page and
end position (`metadata`, read with `typst query` / `world.query`).

## Results (measured)

| | `plain` | `rules` |
|---|---|---|
| Entries (25 seeds × 40) | 1000 | 1000 |
| Page count predicted right by `ceil(height / text height)` | 999 | 995 |
| Predicted to fit one page | 66, all right (6 of them at 95–100 %) | 66, all right |
| Just over one page (100–125 %) | all predicted 2, all 2 | all predicted 2, all 2 |
| Misses | 1 (1.98 → 3 pages) | 5 (1.84 to 1.98 → 3 pages) |
| Last-page fill from `measure()`: error median / p95 / max | 1.2 / 3.5 / 6.5 % | 1.2 / 3.7 / 21.2 % |
| Compiles that did not converge | 0 | 0 |

1. **The page-or-spread decision is exact** in these runs: every entry that
   `measure()` puts on one page fits one page, and every entry just over it
   needs two. At one page there is no page break inside the entry, so break
   rules cost nothing.
2. **Near the two-page boundary, `measure()` is optimistic.** A break inside
   an entry loses space (sticky headings, kept-together lists, widow and
   orphan rules): up to about 16 % of a page with the D-06 rules. So "fits a
   spread" can be wrong when the text fills more than about 84 % of the
   second page.
3. **Decisions that depend on `measure()` settle in one compile.** With
   spread-sized entries forced onto a left page (`pagebreak(to: "even")`,
   blank pages inserted), 8 chapters of 40 entries gave no `layout did not
   converge` warning, and every spread-sized entry started on a left page.
4. **WASM equals the CLI:** the same `measure()` heights (to 0.001 mm), pages
   and decisions for all 16 chapters (8 seeds, with and without decisions).
   0.5–1.6 s per chapter of about 80 pages in Node.
5. **Exact sizes are free after the compile:** the end position of each entry
   (a `metadata` at its end) gives its real last page and fill. The empty-page
   warning and overflow can be read from these instead of from `measure()`.

## Consequence for D-11 (proposal for G1)

- **Decide inside the compile with `measure()`**: page-sized or spread-sized,
  and where the left-page starts and blank pages go. No read-back loop is
  needed for the choice.
- **Report from the real positions** read after the compile
  (`ENTRY_SPREAD_EMPTY`, `ENTRY_OVERFLOW`, `ENTRY_AUTO`), not from the
  estimate.
- **The rare miss near the two-page boundary** (5 in 1000 with the D-06
  rules): either a second compile that pins those entries to the real result
  (the positions do not depend on other entries, so it cannot oscillate —
  to be confirmed at G2), or a margin: treat a spread as full above about 84 %
  of its second page. To be decided at G1.

## Not covered

- Illustration layouts: the landscape slot, the portrait column (45 %), fit
  and shrink to `entries.image.minScale` — each changes the text area, so
  each candidate layout is measured at its own width and height.
- Pairing of page-sized entries on facing pages and section openers (only the
  left-page start was tested).
- The "(continued)" heading on overflow pages, `justification-limits` in
  narrow columns, the book's own fonts.
- Time in Obsidian's worker for a real chapter (here: Node).
