# TICKET-020 — Conversion pipeline `convert`: preamble registry, asset first pass, line map

**Status:** Done
**User story:** [US-015](../user-stories/US-015-conversion-pipeline.md)
**ACs addressed:** AC-1 to AC-13
**Depends on:** TICKET-013 to TICKET-018 (emitters, assets, page setup, report)

---

## Description

Join the finished parts into one pure function, `convert(input)`, that turns
one note into the `.typ` text, the list of assets to copy, the warnings and a
line map. The vault is read only through an injected `AssetIndex`. The command
that starts an export, the settings screen and the export folder are wired by
US-007, US-008 and US-010 to US-012; this ticket delivers what they call.

Decided by the user on 2026-10-17: `AssetIndex` with a file list and
`readHead`, a first pass over the tree that reads only heads of files whose
name a reference uses; the image helper is written only when a found image is
placed; the warning registry gets a Status column (`active` / `reserved`).

---

## Acceptance criteria (from user story)

See US-015.

---

## Implementation notes

- **`src/core/convert/index.ts`:** `convert`, `ConvertInput`, `ConvertResult`, `ConvertSettings`, `AssetIndex`; settings validation (`TypeError`), LF normalisation, header comment, assembly, trailing-space strip outside raw blocks.
- **`src/core/convert/preamble.ts`:** `PreambleRule`, `PREAMBLE_RULES` (ids and order numbers of AC-2), `checkPreambleRules`, `renderPreamble`.
- **`src/core/convert/references.ts`:** the first pass: image references of the whole tree, and `readHeads` over the `AssetIndex`.
- **`src/core/convert/line-map.ts`:** sentinel marks and `extractLineMap`.
- **Emitters:** `BlockOptions.mark` (and the table emitter) put a mark before a block when asked; `EmitContext` records that `fit-image` was placed.

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each rule switched off alone is caught by a test.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story file updated if ACs were refined during implementation.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

## Implementation result

- `core/convert`: `convert`, `preamble` (registry with the ids and order numbers of AC-2, `checkPreambleRules`, `renderPreamble`), `references` (first pass over the tree, `readHeads`), `line-map` (private-use marks that the source does not contain), `types`.
- Emitters: `BlockOptions.mark` and the table emitter put a mark before every heading, paragraph, item, quote, code block, rule, table and row (never inside a footnote definition); `EmitContext.markFitImagePlaced` tells the pipeline whether the helper is needed; a node kind without an emitter is reported and its text kept (AC-12).
- Found by the tests: `emitInline` was quadratic for many marks in a row (`Array.from(out).at(-1)` copied the whole text for each mark; 200 000 characters took 65 s). Now `lastChar`; the same input takes about 2 s.
- Four test expectations written before the code were wrong and were corrected: the line map of the note without the image (8 entries, the table starts at line 16), the fonts test (`hasGlyph` returning false gives the same text; now true), the coverage note (it had no soft line break, so no `softbreak` node), and the settings test (now also checks the message).
- Redundant code found by the mutation check and removed: the extra LF normalisation (the parser already gives LF), a separate return for an empty body, and the file-type filter in `readHeads`.
- Mutation check (55 mutants of the pipeline, preamble, first pass, line map and the emitter changes): all caught; eight gaps led to new tests (the message for missing page geometry, percent-encoded names, line-break characters of Typst in the note name, trailing space left by a dropped comment, nested line-map entries, empty item, private-use characters in the source, value-only unknown node).
- The stubs of other stories that waited for the pipeline are now tests: US-001 AC-11 (every fixture compiles), US-001 AC-13 (default and chosen highlight colour), US-005 AC-4b (footnote restart rule in the preamble). One stub stays (US-001 AC-13, previous value kept: US-008).
- Left for other stories: the command and the export folder (US-007 AC-1, with US-008), the end-to-end tests US-007 AC-6 and AC-7 (need the command), the `AssetIndex` over the Obsidian vault (plugin), fonts (US-010, rule 40) and cover (US-011, rule 90).
