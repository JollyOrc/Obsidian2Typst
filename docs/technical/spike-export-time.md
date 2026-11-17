# Spike: how long a book export takes (UI standard, decision D3)

**Date:** 2026-11-17. **Code:** `spikes/d3-timing/time.test.ts` (git-ignored;
the `build` function of `tests/integration/us-024-sample-pdf.test.ts` with
timing lines). **Input:** the synthetic sample book (`Book.md` of US-024, A5
print, the sample images, the bundled fonts). Node 26, Apple M1 Pro,
Obsidian2Typst 0.15.3.

## Question

The preferred UI standard gives a run a **progress tab** when it takes more
than about 2 s as a whole run, and a Notice otherwise. The control project's
decision D3: measure first. Does the book export cross 2 s?

## Method

One conversion and **one** compile, three times in one process. That is a
**lower bound** for an export in Obsidian, which also runs the compiles until
the layout settles (US-028, up to 8), writes the files, scans the word gaps,
and compiles in a worker inside Obsidian.

## Results (measured)

| Run | Convert | Convert + compile | Pages | PDF |
|---|---|---|---|---|
| 1 (compiler starts) | 435 ms | 5.0 s | 301 | 3.7 MB |
| 2 | 400 ms | 2.9 s | 301 | 3.7 MB |
| 3 | 383 ms | 3.0 s | 301 | 3.7 MB |

Earlier records point the same way: the Typst spike's reference compile
inside Obsidian took 9.1 s (S7); manual check M14 says "every export takes
about 30 seconds or less". A one-page document compiles in about 0.1 s (M1).

## Findings

1. **A book export takes more than 2 s**, even as one compile without
   Obsidian: 2.9 to 5.0 s. Under D3 the export gets the progress tab.
2. The compile is most of the time (about 85 %); the conversion is
   about 0.4 s.
3. **A short note stays far under 2 s** (about 0.1 s). Whether a short note
   also gets the progress tab, or a Notice only, is a question for the
   alignment story (the time cannot be known before the run).
4. Not measured: the whole run inside Obsidian on the test machine (M1
   MacBook); not needed for the decision, since the lower bound already
   crosses the limit.
