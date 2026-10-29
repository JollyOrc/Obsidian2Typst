# TICKET-092 — Reading the decisions back; the warnings in export and preview (plugin)

**Status:** Done (2026-10-29)
**User story:** [US-028](../user-stories/US-028-image-fit.md)
**ACs addressed:** AC-4, AC-5 (decision 8), AC-6, AC-7, AC-11, AC-12 (the
PDF tests)
**Depends on:** TICKET-091 (the helper)
**SCARs:** SCAR-008, SCAR-015, SCAR-017, SCAR-022, SCAR-023, SCAR-024

---

## Description

After a compile the worker reads the values of `<o2t-fit-decision>` with
typst.ts' `query` and the compile result carries them as `fitDecisions` (PDF
and vector compile; absent when the document has none or the query fails).
The export adds `fitDecisionWarnings(fitDecisions)` to the conversion
warnings before the report; the preview adds their count to its status line.
Strict mode reports them and never stops on them (decision 8).

---

## Implementation notes

- `src/plugin/compiler/worker-core.ts`: after a successful compile,
  `runWithWorld({mainFilePath}, async (world) => { await world.compile();
  return world.query({selector: '<o2t-fit-decision>', field: 'value'}); })`
  (the form measured at G1; its options read from `compiler.d.mts:209`,
  SCAR-008) only when the source holds `o2t-fit-decision`; a thrown query is
  caught (no decisions, no failure). The message `compiled` /
  `vector-compiled` carries the values.
- `src/core/compile` `CompileResult` (`ok: true`) and `PreviewCompile` gain
  an optional `fitDecisions`; the service copies it only when present (the
  US-007 service tests pin `{ok: true, pdf}`).
- `src/plugin/run-export.ts`: after the compile, before `finishExport`
  writes the report, the fit warnings join the warnings (order by line, as
  the report sorts); `finishExport`'s strict check stays before the compile
  and acts on the conversion warnings only (decision 8).
- `src/plugin/preview/controller.ts`: the status line's count is the
  conversion warnings plus the fit warnings of that run.
- Callback data (SCAR-022): the worker message is not a framework callback;
  everything is in the message.

### Guards searched before the ticket (SCAR-023)

- `tests/plugin/us-007-compiler-service.test.ts`: four tests pin a compile
  result `toEqual({ok: true, pdf: PDF})` — kept: the field only when the
  worker sends values.
- `tests/plugin/us-007-export-run.test.ts`: the order of writes and the
  strict-mode abort before the compile — unchanged.
- `tests/plugin/us-012-controller.test.ts` status line counts — unchanged
  without decisions.
- `tests/support/fake-worker.ts` (`LoopbackWorker`) runs the real worker
  core: the query runs in the integration tests.
- Searched by function name: `compile`, `runExport`, `finishExport`,
  `createPreviewController`.

---

## Tests

- `tests/plugin/us-028-fit-warnings.test.ts` (4).
- `tests/integration/us-028-image-fit-pdf.test.ts` (all: the sweeps, the
  containers, the parts and page breaks, sizes, AC-5 read back, AC-11).
- `tests/unit/us-028-image-fit.test.ts` stays green.
- Mutation checks: the query skipped; the decisions not passed by the
  service; the fit warnings stopping a strict export; the preview count
  without them; a failed query failing the export.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** (1–4) `fitDecisionWarnings` gets its call sites (export,
  preview); its transforms (shape check, two codes) fit both.
- **SCAR-002** (1–7) AC-11 composes cover, colophon, back notes, breaks,
  contents, callout, caption, size, table cell, footnotes, page references;
  strict mode (US-006) and the preview (US-012) named.
- **SCAR-003** (1–3) red tests exist; map rows.
- **SCAR-006** (1–4) full gate.
- **SCAR-007** (1–3) exact texts in the tests.
- **SCAR-008** (1–5) `runWithWorld`/`query` options from the type
  definitions; the values checked by program (the service test with known
  metadata).
- **SCAR-009, 010, 011** n/a (no generated text).
- **SCAR-012** n/a here (TICKET-094).
- **SCAR-013, 014** n/a.
- **SCAR-015** (1–5) the tests name the warning texts and the PDF written.
- **SCAR-016** (1–8) the preview count is computed per run from that run's
  result.
- **SCAR-017** (1–8) one place adds fit warnings for each consumer (export,
  preview) through one function.
- **SCAR-018** (1–10) mutation run with backups.
- **SCAR-019** (1–5) strict on and off; with and without decisions.
- **SCAR-020** n/a.
- **SCAR-021** (1–3) the two-fresh-compiles test.
- **SCAR-022** (1–4) the worker message carries every datum; no read after.
- **SCAR-023** (1–11) guards above; the "no decisions" test shows the other
  side (green before the code).
- **SCAR-024** (1–4) the query's behaviour measured at G1; a failed query is
  caught, its cause not assumed.
- **SCAR-025 to 029** n/a.
- **SCAR-030** (1–4) the PDF sweeps keep their limits; the plugin tests use
  fakes.

---

## Definition of done

- [x] Tests named above green; US-007, US-012 tests green
- [x] Mutation checks run; full gate counts in the result
- [x] Map rows AC-4, AC-5, AC-11, AC-12 name this ticket; index row `Done`

## Result (2026-10-29)

- Code: `src/core/emit/fit-label.ts` (the label alone, so the worker bundle
  does not take the image emitter; `image.ts` re-exports it);
  `readFitDecisions` and the query after a successful compile, only when the
  source holds the label (`src/plugin/compiler/worker-core.ts`);
  `fitDecisions` on the `compiled` / `vector-compiled` messages and on the
  results only when a list was sent (`compiler/index.ts`,
  `core/compile` `CompileResult`, `VectorResult`); `writeOutput` returns the
  fit warnings (`run-export.ts`); `finishExport` merges them by line after
  the strict check, into the report, the vault note and the notice count
  (`warning-flow.ts`); `PreviewCompile.fitDecisions` and the status count
  (`preview/controller.ts`, `main.ts`).
- Test changes: the export order test compares the messages (the user's
  answer of 2026-10-29: the code also stands in the summary table, so the
  check could never pass); two tests of `readFitDecisions` with fake
  compilers added at the mutation run (a thrown query; text, list and other
  results, and the selector and field asked).
- The PDF tests now read the decisions through the real worker: 34/34 (the
  two-fresh-compiles test compares real decisions again).
- Measured cost of the query (sample vault `Book.md` at 70, through the
  service; scratchpad `p092/cost.test.ts`): cold 2241 ms vs 2008 ms at 100,
  warm 139 ms vs 135 ms; 71 decisions (68 full, 2 float, 1 move).
- Mutation run (`mut092/run.py`; backups with `SHA256SUMS`, checked after
  every restore): 10/10 caught — the query skipped; the decisions not passed
  by the service; the fit warnings stopping a strict export; the preview
  count without them; a failed query failing the export (survived the first
  run: no test made the query throw; tests added); the merge not sorted;
  the notice counting the conversion only; a text result not parsed; the
  list check dropped; the report without them.
- Gate (scratchpad `gate092.log`): typecheck, build (`main.js`
  `97dcaab0636c…`), lint green; `npm test` 2025 passed, 4 failed, 1 todo
  (the row tests of TICKET-093); integration 478 passed, 1 skipped.
