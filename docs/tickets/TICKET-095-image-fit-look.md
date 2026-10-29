# TICKET-095 — The look as today: the probe's space and the full-width figure (defect fix)

**Status:** Done (2026-10-29)
**User story:** [US-028](../user-stories/US-028-image-fit.md)
**ACs addressed:** AC-3 (the probe line, the blocks), AC-13; decision 11
**Depends on:** TICKET-090, TICKET-091 (done)
**SCARs:** SCAR-008, SCAR-017, SCAR-023, SCAR-024, SCAR-025

---

## Description

Found while preparing M18 (TICKET-094, stopped): with `images.minScale`
below 100 every image the rule writes overprints the last text line above it
and loses the space above it, and a captioned image is not centred like
today's figure. Fix (V3, measured 2026-10-29): the probe line keeps the
normal space above it; the helper's output is one full-width block with
`above: 0pt`; the image or figure inside it is a full-width block with
`above: 0pt`. An image whose space above no longer fits at the page bottom
starts the next page after its text, decided `full` without a warning.

---

## Implementation notes

- `src/core/emit/image.ts` `fitProbe`: `#block(height: 0pt, below: 0pt,
  width: 100%)[] <label>` (no `above: 0pt`).
- `FIT_FLOW_HELPER`: `= block(above: 0pt, width: 100%, context { … })`
  (the closing `})`); `fig(iw) = block(above: 0pt, width: 100%, if caption …)`.
  Nothing else changes in the helper (the measured text of TICKET-091).
- `docs/user-stories/README.md` register row of the image emitter: the probe
  line as written.
- No change in the decision rules, the arguments, the plugin or the tests of
  the decisions.

### Guards searched before the ticket (SCAR-023)

- `tests/unit/us-028-image-fit.test.ts` `PROBE` (AC-3, the label test, the
  look-alike heading test) — amended to the new line (G2).
- Searched by function name: `emitImage` (US-003 tests at 100: unchanged),
  `FIT_FLOW_HELPER` (no test reads its text; AC-3's "written once" counts
  `#let fit-flow(`).
- The PDF judge (`judge` in the US-028 PDF tests) gains the page-turn case;
  every sweep keeps its other rules.

---

## Tests

- `tests/unit/us-028-image-fit.test.ts` › AC-3 (the probe line, 2 red now).
- `tests/integration/us-028-image-fit-pdf.test.ts` › AC-13 (red now), the
  reader guard (`x`, `y`), every sweep with the page-turn case.
- Mutation checks: the probe with `above: 0pt` again; the helper's outer
  block left out; the figure's `width: 100%` left out; the outer block
  without `above: 0pt`.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** (1–4) no new call site of a shared utility; the register row
  updated.
- **SCAR-002** (1–7) composed: captioned, after a table in a quote, callout,
  list item, plain (the AC-13 test); `Book.md` with the contents, the parts
  and the cover (measured); templates' spacing (measured).
- **SCAR-003** (1–3) red tests exist; map row AC-13.
- **SCAR-006** (1–4) full gate, counts in the result.
- **SCAR-007** (1–3) the exact probe line in the test.
- **SCAR-008** (1–5) `block`, `context`, `place(float)` inside a block
  measured (the sweeps' floats green with V3); output checked by program.
- **SCAR-009, 010** (1–4, 1–6) the probe and the call stay two whole lines;
  measured that a blank line or one line changes nothing.
- **SCAR-011** n/a (labels unchanged).
- **SCAR-012** n/a here (TICKET-094).
- **SCAR-013, 014, 016** n/a.
- **SCAR-015** (1–5) the AC-13 test names every image's place and the pages'
  text.
- **SCAR-017** (1–8) one helper text, one probe writer (`fitProbe`).
- **SCAR-018** (1–10) mutation run with backups.
- **SCAR-019** (1–5) the default and three template spacings measured;
  minScale values as in AC-12.
- **SCAR-020** (1–3) V0, V1, V2, V3 and V7 measured; the page-top warning
  marked not measured.
- **SCAR-021** (1–3) the two-fresh-compiles test and the sweeps over two
  page edges, unchanged.
- **SCAR-022** n/a.
- **SCAR-023** (1–11) guards above; AC-13 red with V0 and V2, green with V3.
- **SCAR-024** (1–4) "the bare call is read as a paragraph" stated as a
  measured effect; its Typst rule not verified.
- **SCAR-025** (1–4) the look is a test now; the pages looked at again at
  3× in TICKET-094.
- **SCAR-026, 027, 029** n/a.
- **SCAR-028** (1–4) the reader's `x`, `y` checked on a known document.
- **SCAR-030** (1–4) the AC-13 test's 600 s limit; the sweeps keep theirs.

---

## Definition of done

- [x] Tests named above green; all US-028 tests green (unit 39/39, PDF
      35/35)
- [x] Mutation checks run; full gate counts in the result
- [x] The pages of `Book.md` looked at at 3× (p. 12, a captioned image; p.
      9, the quote) against the output at 100
- [x] Map row AC-13 names this ticket; index row `Done`

## Result (2026-10-29)

- Mutation checks (backup `spikes/typst-wasm/t095-backup/`, checksum checked
  after each restore): the probe with `above: 0pt` again — 2 unit (AC-3) and
  1 PDF (AC-13) red; the helper's outer block left out (both ends) — AC-13
  red; the figure without `width: 100%` — AC-13 red; the outer block without
  `above: 0pt` — AC-13 red. All four killed.
- `Sample/Book.md` through `convertNote` (`Contents` at 100 against
  `images.minScale: 70`): 70 probes, 424/424 pages, 71/71 images equal
  (page, x, y, size), 424/424 page texts equal, 70 `full`. Pages 9 and 12
  rendered at 3×: pixel-identical to the output at 100 (same PNG checksums);
  p. 12 read at reading size: space above the image, the caption centred.
- Full gate: typecheck, build (`main.js` `a1dd1b2ec244…`), lint green;
  `npm test` 2029 passed, 1 todo; `npm run test:integration` 479 passed, 1
  skipped (US-007 AC-5, the `typst` CLI is not installed: `skipIf`,
  TICKET-019).
