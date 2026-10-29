# TICKET-091 — The helper `fit-flow` and its decisions (core)

**Status:** Done (2026-10-29)
**User story:** [US-028](../user-stories/US-028-image-fit.md)
**ACs addressed:** AC-3 (the helper and its names), AC-4, AC-5 (the decision
values and `fitDecisionWarnings`), AC-6, AC-7, AC-8
**Depends on:** TICKET-090 (the lines)
**SCARs:** SCAR-008, SCAR-010, SCAR-021, SCAR-023, SCAR-024

---

## Description

The Typst helper `fit-flow` as measured (G1, G2, 2026-10-29): reads the room
at its probe in `context`, decides full, shrink, float or move, writes the
image block with `above: 0pt`, and records each decision as
`#metadata((d: …, line: …, name: …)) <o2t-fit-decision>`. It is written once
into the preamble as rule `fit-flow` (order 81, after `fit-image`) when an
image uses it, and joins `PLUGIN_NAMES` with `o2t-fit` and
`o2t-fit-decision`. `fitDecisionWarnings` in `core/emit` turns decision values
into `IMAGE_FLOATED` / `IMAGE_MOVED` warnings; both codes get rows in the
warning registry, the help of `IMAGE_FLOATED` saying the gap can stay at the
tightest edge (AC-8).

---

## Implementation notes

- `src/core/emit/image.ts` (beside `FIT_IMAGE_HELPER`): `FIT_FLOW_HELPER`,
  the text of the measured helper (scratch probe `g3028/probe.ts`, which
  reproduced the G2 results): width from the page at the top level, from
  `layout` in a container; `reserve.to-absolute()`; a caption's height in
  the room; the Obsidian size scaled by one factor; the decision metadata
  with the line and the name the call passes. Each part of the text measured
  again before it is written (SCAR-008, SCAR-024).
- `src/core/convert/preamble.ts`: rule `fit-flow`, order 81, rendered when
  the body used the helper (a flag in the emit context, as `fit-image`).
- `src/core/template/plugin-names.ts`: `fit-flow`, `o2t-fit`,
  `o2t-fit-decision`.
- `src/core/emit` `fitDecisionWarnings(values)`: one warning per `float` /
  `move` value of the right shape, in order; other shapes ignored.
- `docs/technical/warning-codes.md`: the two rows (US-028 AC-5, AC-8).

### Guards searched before the ticket (SCAR-023)

- `tests/unit/us-015-conversion-pipeline.test.ts` › `the registry has these
  ids and order numbers` pins the whole registry: gains `['fit-flow', 81]`.
- `tests/unit/us-016-callouts-convert.test.ts` › `PLUGIN_NAMES are …` pins
  the whole list (and its title): gains the three names.
- `tests/unit/us-015-warning-registry.test.ts`: every code `src/core` can
  produce has a row.
- US-023 template tests that scan for plugin names: a template defining
  `fit-flow` is warned like `fit-image`.

---

## Tests

- `tests/unit/us-028-image-fit.test.ts` › AC-3 (the helper once, its
  names), AC-5 (`fitDecisionWarnings`, 2), AC-5/AC-8 (registry rows).
- The PDF sweeps of `tests/integration/us-028-image-fit-pdf.test.ts` need
  the decisions read back (TICKET-092); this ticket runs them through the
  probe's reader (`query` in a test helper) before 092, to check the helper
  alone.
- Mutation checks: no `above: 0pt`; the reserve not resolved; a float from a
  right page; the caption's height left out; the decision without its line.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** (1–4) the helper's measured text is its own; no shared
  utility changes.
- **SCAR-002** (1–7) the sweeps cover every container, size, caption and
  page break of the story.
- **SCAR-003** (1–3) red tests exist; map rows.
- **SCAR-006** (1–4) full gate.
- **SCAR-007** (1–3) the exact warning texts in the tests.
- **SCAR-008** (1–5) `measure`, `layout`, `locate`, `place(float)`,
  `to-absolute` read from the Typst docs and measured (G1, G2, 2026-10-29);
  output checked by program (the sweeps).
- **SCAR-009** (1–4) the image block at the probe; a caption as a block.
- **SCAR-010** (1–6) the decision metadata and the image block are joined
  inside the helper; the preamble rule a block of its own.
- **SCAR-011** (1–5) `o2t-fit-decision` is no heading label (`h-` prefix).
- **SCAR-012** n/a here.
- **SCAR-013, 014, 016** n/a.
- **SCAR-015** (1–5) the sweeps check every image is on its page.
- **SCAR-017** (1–8) one helper text; one warnings function.
- **SCAR-018** (1–10) mutation run with backups.
- **SCAR-019** (1–5) `min` 10, 50, 70, 99; facing on and off (sweeps).
- **SCAR-020** n/a.
- **SCAR-021** (1–3) the decision reads its own layout: the sweeps over two
  page edges and the two-fresh-compiles test; diagnostics empty (no "did not
  converge").
- **SCAR-022** n/a.
- **SCAR-023** (1–11) guards above; the sweeps' rules proven reachable at G2
  (simulated helper) and by the measurements of 2026-10-29.
- **SCAR-024** (1–4) every Typst statement of the story measured; the
  quote's `2.4em` reason and AC-8's paragraph breaking marked not verified.
- **SCAR-025** (1–4) the shrunk and floated pages looked at in M18.
- **SCAR-026, 027, 029** n/a.
- **SCAR-028** (1–4) the PDF reader checked on a page with an image
  (2026-10-29).
- **SCAR-030** (1–4) the sweeps sit in blocks with 600 to 900 s limits.

---

## Definition of done

- [x] Unit tests named above green; the helper alone through the probe's
      query green for the sweeps
- [x] Mutation checks run; full gate counts in the result
- [x] Registry rows; map rows AC-4, AC-5, AC-8 name this ticket; index row
      `Done`

## Result (2026-10-29)

- Code: `FIT_FLOW_HELPER`, `FIT_DECISION_LABEL`, `fitDecisionWarnings`
  (`src/core/emit/image.ts`, exported from `core/emit`); preamble rule
  `fit-flow`, order 81, from `usesFitFlow` (`convert/preamble.ts`,
  `convert/index.ts`); `PLUGIN_NAMES` gains `fit-flow`, `o2t-fit`,
  `o2t-fit-decision`; registry rows `IMAGE_FLOATED`, `IMAGE_MOVED`. The
  helper is the G2/G3 probe's text with the call's `line` and `name`, the
  decision as `(d, line, name)` under `<o2t-fit-decision>`, the probe's
  `<img>` marker removed.
- Guards extended: the preamble registry (US-015, `['fit-flow', 81]`),
  `PLUGIN_NAMES` (US-016, three names and the test title).
- The sweeps through a scratch reader (`p091/reader.ts`: typst.ts
  `runWithWorld` + `query`, checked first on a known document — two values
  in order, a foreign label ignored, none for a plain page; SCAR-028) and a
  scratch copy of the PDF tests (`p091/sweeps.test.ts`): 33/34 green; the
  one left is the compiler service test (TICKET-092).
- Test changes on the user's answers (2026-10-29): the line test expects
  `wide.png` at line 11 (the test counted 9; `filler(2)` is three lines);
  the PDF reader (`tests/support/pdf.ts`) reads each page's drawn image
  sizes (`images`, from the `cm` before each `Do`), with a guard test on a
  known document (100 pt and a 40 pt box image in order, 66.7 pt high, none
  on a page without one); the AC-6 container sweeps and the callout bounds
  test assert the width: never wider than the text, a callout's image no
  wider than the text less 2 × its inset — the stroke takes no room in
  Typst (measured: 304.3 = 320.3 − 16; 220.3 = 320.3 − 100).
- Code simplified at the mutation run: the `d` type check of
  `fitDecisionWarnings` removed (equivalent: only `float` and `move` warn).
- Mutation run (`mut091/run.py`, the unit tests and the scratch sweeps;
  backups with `SHA256SUMS`, checked after every restore): 7/9 caught — the
  reserve left out, a float from a right page, the caption's height left
  out, the decision without its line, no `layout` in a container (survived
  the first run: no test read a width; the reader and the asserts added),
  the rule never rendered, the codes swapped. Survived, measured as without
  effect: no `above: 0pt` (the image top equals the probe's y with and
  without it at the top level, in a callout and a list item:
  `p091/above.test.ts`; the probe's `below: 0pt` already gives no space;
  why not verified, SCAR-024); the 0.5 pt margin left out (a 1 pt sweep of
  301 positions at the page edge holds 301/301 with and without it:
  `g3028/margin.test.ts`). Both kept as measured at G2.
- Gate (scratchpad `gate091.log`): typecheck, build (`main.js`
  `2c72954cc320…`), lint green; `npm test` 2020 passed, 7 failed, 1 todo;
  integration 447 passed, 31 failed, 1 skipped. Red by file: plugin
  fit-warnings 3 (092), image-rows 4 (093), PDF 31 (092: the decisions come
  from the compiler service). The PDF test "two fresh compiles agree"
  passes again without testing anything until 092 (no decisions read back).
