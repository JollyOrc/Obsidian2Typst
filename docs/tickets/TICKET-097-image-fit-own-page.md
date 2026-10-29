# TICKET-097 — A float never on its probe's page: the room corrected by the float's own height (defect fix)

**Status:** Done (2026-10-29)
**User story:** [US-028](../user-stories/US-028-image-fit.md)
**ACs addressed:** AC-3 (the floated figure's label, the room lines), AC-4
(no float on its own page); decision 13
**Depends on:** TICKET-096 (done)
**SCARs:** SCAR-011, SCAR-018, SCAR-021, SCAR-023, SCAR-024, SCAR-025,
SCAR-030

---

## Description

Found while preparing M18 a third time (TICKET-094, stopped): in the
sample's `Book.md` single-sided at 70, `figure-10.png` was decided `float`
and stood at the top of p. 68, above the text it follows, though at 100 it
fits after that text. A float on the probe's page pushes the probe down by
its own height; the room read there is too small and the decision confirms
itself (SCAR-021).

Fix (F1, measured 2026-10-29, decision 13): the floated figure is labelled
`o2t-fit-N-f`; when that label stands on the probe's page, the room gets
back the float's height, caption and clearance before the decision.

---

## Implementation notes

- `src/core/emit/image.ts` `FIT_FLOW_HELPER`, two changes, as AC-3 writes
  them:
  - after `let room = …`:
    `let own = query(label(str(at) + "-f")).filter(e => e.location().page() == pos.page).len() > 0`
    and `if own { room = room + h + cap(w) + 1em.to-absolute() }`;
  - the float branch:
    `place(top, float: true, clearance: 1em, [#fig(w) #label(str(at) + "-f")])`.
- The doc comment of `FIT_FLOW_HELPER` (decision 13, the label).
- `docs/user-stories/README.md` register row of the image emitter.
- No change in the probe, the block of decision 12, the arguments, the
  plugin or the warnings.

### Guards searched before the ticket (SCAR-023)

- By function name: `FIT_FLOW_HELPER` (read by `preamble.ts` rule 81; its
  text by the AC-3 tests of decisions 12 and 13: the decision-12 test reads
  the head, `let body`, the last line — unchanged by this ticket);
  `emitImage` (unchanged); `PLUGIN_NAMES` (the prefix `o2t-fit` covers the
  new label; no whole-list change); the PDF `judge` (unchanged: the new test
  reads pages back itself).
- The AC-5 warning tests read the decisions by the label
  `o2t-fit-decision` only; the new label is a different one (`-f` suffix).

---

## Tests

- `tests/unit/us-028-image-fit.test.ts` › "US-028 AC-3 (decision 13): a
  floated figure is labelled and the room gets back its height on the
  probe's page" (red now).
- `tests/integration/us-028-image-fit-pdf.test.ts` › "US-028 AC-4 (decision
  13): every floated image stands on the page after its probe;
  figure-10.png is kept where it stands at 100" (red now; red by behaviour
  with the label only; green with F1).
- Mutation checks (backups by full path with checksums): the correction
  line left out; the correction without `h` (caption and clearance only);
  the label left out of the float.

---

## SCAR check (2026-10-29, item by item against the Prevention lists)

- **SCAR-001** (1–4) no new call site of a shared utility; the register row
  updated.
- **SCAR-002** (1–7) composed: the sample's `Book.md` with contents, parts,
  cover, signature, folios, page references, single-sided (the test); the
  facing run and every PDF sweep unchanged (35 green with F1).
- **SCAR-003** (1–3) red tests for AC-3 and AC-4; map rows.
- **SCAR-006** (1–4) full gate, counts in the result.
- **SCAR-007** (1–3) the exact lines in AC-3 and the unit test.
- **SCAR-008** (1–5) `query`, `label`, `location().page()` measured with the
  real compiler (the spike, the new test); the result checked by program.
- **SCAR-009, 010** (1–4, 1–6) the label is inside the float's content
  block; no new join with the text around.
- **SCAR-011** (1–4) the label `o2t-fit-N-f`: the plugin's prefix, heading
  labels start with `h-`; one per call, numbered as the probe.
- **SCAR-012** n/a here (TICKET-094 after this one).
- **SCAR-013, 014, 016, 022** n/a (no dialog, data change, control,
  callback).
- **SCAR-015** (1–5) the test names the image, its line, its page and place.
- **SCAR-017** (1–8) one helper text; grep at G4.
- **SCAR-018** (1–10) mutation run from backups with checksums, checked
  after each restore.
- **SCAR-019** (1–5) `minScale` values unchanged; the new test at 70 and 100.
- **SCAR-020** (1–3) the alternatives marked not measured in decision 13.
- **SCAR-021** (1–3) the defect is a self-confirming layout; the criterion
  is a page relation and the place at 100; two fresh compiles agree (the
  stability test unchanged).
- **SCAR-023** (1–11) guards above; the new test red by behaviour with the
  label only, green with F1; three mutants.
- **SCAR-024** (1–4) why the layout reaches the wrong fixed point is not
  verified.
- **SCAR-025** (1–4) p. 68 of `Book.md` single-sided looked at at 3× against
  the output at 100.
- **SCAR-026, 027, 029** n/a.
- **SCAR-028** (1–4) the PDF reader unchanged.
- **SCAR-030** (1–4) the new test's two whole-book compiles: 15.2 s alone,
  the time under the full run from the gate log; limit 600 s.

---

## Definition of done

- [x] Tests named above green; all US-028 tests green (unit, PDF, plugin:
      88/88)
- [x] Mutation checks run; full gate counts in the result
- [x] `Book.md` single-sided p. 68 at 3× against 100; facing still 70 `full`
- [x] Map rows name this ticket as passing; index row `Done`

## Result (2026-10-29)

- `FIT_FLOW_HELPER` as AC-3 writes it (the `own` line and the correction
  after `let room`; the floated figure labelled); doc comment; register row.
  One writer (grep: `image.ts` only).
- Mutation checks (backup scratchpad `m094b/bak097/image.f1.ts`, checksum
  checked after each restore, OK each time): the correction left out, the
  correction without `h`, the label left out — each 2 red (the unit test
  and the `Book.md` PDF test). All three killed.
- With the code: `Sample/Book.md` (the `Contents` settings, M18's Defaults)
  facing at 70: 70 `full`, 424 pages; single-sided at 70: 416 pages, 4
  floats (`figure-28.png`, `figure-34.png`, `figure-52.png`,
  `plates/figure-53.png`, each on the page after its probe) and 1 shrink
  (`figure-38.png`); `figure-10.png` `full`. P. 68 at 3× pixel-identical to
  the output at 100; read at reading size (the image after its text).
- Full gate: typecheck, build (`main.js` `787b899cdbea…`), lint green;
  `npm test` 2031 passed, 1 todo; `npm run test:integration` 480 passed, 1
  skipped (US-007 AC-5, no `typst` CLI: `skipIf`, TICKET-019). The `Book.md`
  test 24.1 s under the full run (limit 600 s).
