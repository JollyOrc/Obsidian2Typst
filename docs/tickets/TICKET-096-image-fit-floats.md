# TICKET-096 — Floats with the look as today: the full-width block only where floats are off (defect fix)

**Status:** Done (2026-10-29)
**User story:** [US-028](../user-stories/US-028-image-fit.md)
**ACs addressed:** AC-3 (the helper's shape), AC-4 (a float's text fills the
gap), AC-8, AC-13; decision 12
**Depends on:** TICKET-095 (done)
**SCARs:** SCAR-008, SCAR-010, SCAR-017, SCAR-018, SCAR-023, SCAR-024,
SCAR-025

---

## Description

Found while preparing M18 again (TICKET-094, stopped the second time): since
TICKET-095 (V3) the helper's output is one full-width block, and a float
inside it stays in it. The image and the text after it go to the next page,
the gap stays, and the warning says `IMAGE_FLOATED` (measured: 0 of 12
floats of the top-level sweep fill the gap). The PDF test stayed green: its
float check allowed AC-8's edge for every float. TICKET-095's SCAR-008 line
("`place(float)` inside a block measured, the sweeps' floats green") rested
on that check.

Fix (C3, measured 2026-10-29 in the spike, decision 12): the helper's body
is a plain `context`; it is wrapped in `block(above: 0pt, width: 100%, …)`
only when `floats` is false (containers, the back notes, before a page
break, the note's end), and written bare at the top level.

---

## Implementation notes

- `src/core/emit/image.ts` `FIT_FLOW_HELPER`, as AC-3 writes it:
  ```
  #let fit-flow(path, at, line, name, min: 0.7, sides: true, floats: true, reserve: 0pt, caption: none, width: auto, height: auto) = {
    let body = context {
      let pos = locate(at).position()
      …
      if floats { decide(tw) } else { layout(size => decide(size.width)) }
    }
    if floats { body } else { block(above: 0pt, width: 100%, body) }
  }
  ```
  The lines between are those of today, indented two more blanks. Nothing
  else changes: not the probe, not `fig`, not the decisions or arguments.
- The doc comment of `FIT_FLOW_HELPER` and of `fitProbe` (what the block is
  for, decision 12).
- `docs/user-stories/README.md` register row of the image emitter: the
  helper's block for `floats: false` only.
- The spike's patch (`m094b/cand/cands.ts`, C3) wrote the head on one line;
  the code's multi-line form is measured again (below), not assumed equal.

### Guards searched before the ticket (SCAR-023)

- By function name: `FIT_FLOW_HELPER` (read only by `preamble.ts` rule 81
  and re-exported by `emit/index.ts`; no test reads its text before the new
  AC-3 test); `emitImage` (unchanged); the PDF `judge` (now returns `edge`;
  its callers with floats off ignore the kind, the two callers with floats on
  call `expectFloatsFill`); `#let fit-flow(` (counted once by AC-3's
  existing test, unchanged).
- No test pins a whole result that this change widens: the preamble
  registry (US-015) lists rule names, not their text.

---

## Tests

- `tests/unit/us-028-image-fit.test.ts` › "US-028 AC-3 (decision 12): the
  helper writes its full-width block only where floats are off" (red now).
- `tests/integration/us-028-image-fit-pdf.test.ts` › the five top-level
  sweeps and the captioned image and `200x300` sweeps (red now with V3,
  green with C3 patched in); every other test unchanged and green.
- Mutation checks (backups by full path with checksums, SCAR-018): the
  block for every call again (V3); no block at all (V2); the block only
  where floats are on (the condition reversed).

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** (1–4) no new call site of a shared utility; the register row
  updated.
- **SCAR-002** (1–7) composed: containers, the back notes, before a page
  break, the note's end keep the block (PDF tests); the AC-13 composed note;
  `Book.md` with the contents, parts and cover; 10 neighbour kinds × 2 × 4
  spacings (spike, measured again at G4).
- **SCAR-003** (1–3) red tests exist for AC-3 and AC-4; map rows AC-3, AC-4,
  AC-8.
- **SCAR-006** (1–4) full gate, counts in the result.
- **SCAR-007** (1–3) the helper's exact lines in AC-3 and in the unit test.
- **SCAR-008** (1–5) `block`, `context` and `place(float: true)` measured
  with the real compiler; the float's place checked by program (the
  sharpened judge), not by the decision read back.
- **SCAR-009** (1–4) the call stays one line after the probe; the helper's
  body starts with `let`, no markup at a block start.
- **SCAR-010** (1–6) join hazards: a top-level image after 10 block kinds,
  adjacent and after a blank line, under 4 spacings (spike: 80/80), run
  again with the code.
- **SCAR-011** n/a (labels unchanged).
- **SCAR-012** n/a here (TICKET-094 after this one).
- **SCAR-013, 014, 016, 022** n/a (no dialog, no data change, no control, no
  callback).
- **SCAR-015** (1–5) the sweeps name the pages of the text before, the
  image and the text after.
- **SCAR-017** (1–8) one helper text (`FIT_FLOW_HELPER`) is the only writer
  of the block; grep at G4.
- **SCAR-018** (1–10) mutation run from backups with checksums, checked
  after every restore; the state to return to is the fixed code.
- **SCAR-019** (1–5) `minScale` 10, 50, 70, 99 and facing pages off as the
  sweeps have them; spacings default and three template values.
- **SCAR-020** (1–3) C2 and C4 measured and dropped (decision 12).
- **SCAR-021** (1–3) the float rule reads a sweep's run of cases; the
  two-fresh-compiles test unchanged.
- **SCAR-023** (1–11) guards above; the float check red with V3, green with
  C3; three mutants.
- **SCAR-024** (1–4) "a float stays in its block" a measured effect, its
  Typst rule not verified; the panic after many compiles not verified (not
  in this ticket).
- **SCAR-025** (1–4) the check note's float page and `Book.md` p. 9 and 12
  looked at at 3× against the output at 100.
- **SCAR-026, 027, 029** n/a (no search-and-replace, nothing replaced, no
  manual-check file).
- **SCAR-028** (1–4) the PDF reader unchanged; `pageOf` on known text.
- **SCAR-030** (1–4) no new compiles in the tests; limits unchanged.

---

## Definition of done

- [x] Tests named above green; all US-028 tests green (unit, PDF, plugin:
      86/86)
- [x] Mutation checks run; full gate counts in the result
- [x] `Book.md` at 70 against 100 and the joins measured again with the
      code; the float page looked at at 3×
- [x] Map rows name this ticket as passing; index row `Done`

## Result (2026-10-29)

- `FIT_FLOW_HELPER` as AC-3 writes it; doc comment; register row. One
  writer of the block (grep: `image.ts` only).
- Mutation checks (backup scratchpad `m094b/bak096/image.c3.ts`, checksum
  checked after each restore, OK each time): the block for every call (V3)
  — 8 red (the unit test, 5 top-level sweeps, the captioned image,
  `200x300`); no block (V2) — 2 red (the unit test, AC-13); the condition
  reversed — 9 red. All three killed, each also by a PDF test.
- With the code (no patch): `Sample/Book.md` through `convertNote`
  (`Contents` at 100 against 70) 71/71 images, 424/424 page texts, 70
  `full`; under `#set block(spacing: 2em)`, `#set block(above: 0.6em)`,
  `#set par(spacing: 0.9em)` the same rows as the spike's C3 (the first
  difference after the first image the rule changes); the joins 80/80. Pages
  9 and 12 at 3× pixel-identical to the output at 100; p. 12 read at reading
  size. The M18 check note's float: `AFTER IMAGE 2.` on p. 4, the image at
  the top of p. 5 (pixel-identical to the spike's pages).
- Full gate: typecheck, build (`main.js` `4ea3406081c9…`), lint green;
  `npm test` 2030 passed, 1 todo; `npm run test:integration` 479 passed, 1
  skipped (US-007 AC-5, no `typst` CLI: `skipIf`, TICKET-019).
