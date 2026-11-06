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

## Sweep: the whole chapter layout in one compile (2026-11-06)

**Code:** `spikes/entry-measure/sweep.mjs` (generator), `check.mjs` (rules),
`sweep.spike.ts` (WASM). The chapter rules are written with `measure()` and
parity page breaks only (`pagebreak(to: "even")`, `pagebreak(weak: true, to:
"odd")`), with no `locate`/`query` in the layout:

- a section opener (heading and intro) takes a right page; a free right page
  is reused because the break to an odd page is weak
- the chapter heading and intro share the first section's opener page
- the section's first entry starts on the next left page
- a spread-sized entry starts on a left page
- page-sized entries pair left + right in order, never across a section; an
  unpaired one takes a left page

Swept: 1 to 3 sections × 1 to 10 entries per section × 4 seeds = 120
chapters, lengths a third each under one page, around one page and near two
pages (CLI). A checker reads each entry's first and last page from
`metadata` and tests every rule.

| | Result |
|---|---|
| Chapters that keep every rule | 120 of 120 |
| Compiles that did not converge | 0 |
| Entries | 895 spread-sized (70 of them overflow to a third page), 74 pairs, 277 unpaired page-sized |
| WASM vs CLI (12 chapters) | identical marks; 31–259 ms per chapter |

**Finding:** the parity breaks keep every rule even after an entry overflows,
because they place the next entry from where the previous one really ended.
So a `measure()` miss near the two-page boundary needs **no second compile**:
it shows up as `ENTRY_OVERFLOW`, read from the real positions, and the rest
of the chapter stays correct.

## Fit with an illustration, and the "(continued)" line (2026-11-06)

**Code:** `spikes/entry-measure/fit.mjs`, `fitcheck.sh`, `fitw.spike.ts`.
`page-landscape` entries (text 15–75 % of a page, a statblock, an
illustration of ratio 4:3, 3:2 or 2:1 at full width and at most 40 % of the
text height, drawn as a grey box of that ratio). Inside the compile, the
entry is shrunk in 5 % steps from 100 % down to `minScale` and the largest
scale at which `measure()` of **the whole entry as laid out** (heading,
statblock row, body, gap, illustration block) fits the text height is used;
an entry that fits at no step overflows. On every page after an entry's first
that the entry still runs on, the page header shows "<name> (continued)" — in
the header, outside the body, so it cannot move the text; the header finds
the entry with `query` of the entries' start and end `metadata`.

| `minScale` | Chapters × entries | Fit (of them shrunk) | Overflow | Fit predicted wrong | "(continued)" lines wrong | Did not converge |
|---|---|---|---|---|---|---|
| 70 | 6 × 30 | 63 (35) | 117 | 0 | 0 | 0 |
| 10 | 3 × 30 | 80 (68) | 10 | 0 | 0 | 0 |
| 100 | 3 × 30 | 12 (0) | 78 | 0 | 0 | 0 |

WASM gives the same decisions, pages and lines as the CLI (3 chapters at 70).

**Finding:** measuring the parts and adding them is wrong (a first run that
added the text height, a gap and the image height mispredicted up to 20 of 30
entries: paragraph spacing and the line an inline box sits in were missing);
measuring the composed entry at each candidate scale is exact. The
"(continued)" line in the header settles in one compile because it changes
nothing in the body.

## Consequence for D-11 (proposal for G1)

- **Decide inside the compile with `measure()`**: page-sized or spread-sized,
  and where the left-page starts and blank pages go. No read-back loop is
  needed for the choice.
- **Report from the real positions** read after the compile
  (`ENTRY_SPREAD_EMPTY`, `ENTRY_OVERFLOW`, `ENTRY_AUTO`), not from the
  estimate.
- **Place with parity breaks, not computed page numbers:** with them, the
  rare miss near the two-page boundary (5 in 1000 with the D-06 rules) needs
  no second compile (sweep above); it is reported as `ENTRY_OVERFLOW`. Whether
  a spread more than about 84 % full should be shrunk first (BL-C5) is
  decided at G1.
- **One compile for entries.** The US-028 read-back stays for body images
  only (they are off inside entries, G0-C5).

## Not covered

- The portrait column (45 %) and the full-page slot; `page-landscape` and
  its shrink are covered above.
- Section intros longer than a page (`SECTION_INTRO_OVERFLOW`) and the
  running header on opener pages.
- `justification-limits` in narrow columns, the book's own fonts.
- Time in Obsidian's worker for a real chapter (here: Node).
