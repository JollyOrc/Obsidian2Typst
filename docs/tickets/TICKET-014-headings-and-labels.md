# TICKET-014 — Headings: slug, heading index, heading emitter, numbering rule

**Status:** Done
**User story:** [US-002](../user-stories/US-002-headings-and-structure.md)
**ACs addressed:** AC-1, AC-1b, AC-1b2, AC-1c, AC-2, AC-2b, AC-2c, AC-3, AC-3b, AC-4, AC-4b, AC-4c (without the address example), AC-5, AC-6, AC-7; US-008 AC-13 (stub only)
**Depends on:** TICKET-012 (`emitInline`), TICKET-013 (`emitBlocks`), TICKET-010 (tree)

---

## Description

Turn heading nodes into `= Text <h-label>` with unique labels, report skipped levels and empty headings, and give the pipeline the numbering rule line. Labels and levels of all headings are computed once from the tree (`indexHeadings`), so that the emitter and the link resolver of US-004 use the same labels, including links that point forward.

---

## Acceptance criteria (from user story)

See US-002: AC-1, AC-1b, AC-1b2, AC-1c, AC-2, AC-2b, AC-2c, AC-3, AC-3b, AC-4, AC-4b, AC-4c, AC-5, AC-6, AC-7 (exact examples are in the story and the tests). Decided by the user on 2026-10-16: first free suffix (AC-3b), breaks become one space (AC-4b), emptiness rule (AC-7), pattern check lives in the preset (US-008 AC-13).

---

## Implementation notes

- **`src/core/parse/headings.ts`** (pure, tree only): `slug(text)`, `visibleText(nodes)`, `indexHeadings(blocks)`, types `HeadingInfo` and `HeadingIndex`, exported from `core/parse`.
  - `slug`: NFC, lower-case `A-Z` only, runs outside `a-z0-9` to `-`, trim `-`, empty gives `section`, prefix `h-`.
  - `visibleText`: text, code, children of emphasis and links, image alt, wikilink alias or `file#anchor`; footnote references, embeds, tags and comments add nothing; breaks and blank runs are one space; trimmed.
  - `indexHeadings`: walks quotes and items in document order. An empty heading (no visible text and no content node: embed, footnote reference, image) is left out of the index. Labels by AC-3b with a set of used labels and a per-base counter. `skippedFrom` is the previous indexed level when the jump is more than one, else null (first heading: null).
- **`src/core/emit/heading.ts`**: `headingNumberingRule(pattern)` (`none` gives `numbering: none`, else `typstString(pattern)`).
- **`emitInline` option `breaks: 'space'`**: soft and hard breaks become one space, none doubled; used for headings with `atBlockStart: false`.
- **`emitBlocks(blocks, ctx, options?)`**: `options.headings` is the index (default: built from `blocks`). Heading: info missing → `HEADING_EMPTY` (message `Empty heading omitted`), the children still go through `emitInline` so that comments are counted, output dropped; else `HEADING_LEVEL_SKIPPED` when `skippedFrom` is set (message `Heading level jumps from X to Y`), output `${'='.repeat(depth)} ${text} <${label}>`. Joined like other blocks (a blank line); the `NODE_UNSUPPORTED` fallback for headings is removed.
- Join hazard (SCAR-010): the label is always separated from the text by one blank; measured with the compiler for text ending in emphasis, a call, raw, an address, a backslash (probe `s27`). A heading in a quote or list item is a document heading (probes `s26`, `s27`).
- Register: add `indexHeadings`, `visibleText`, `headingNumberingRule`; update the `Heading slug` row.

---

## Tests

- `tests/unit/us-002-headings.test.ts` — exact strings and warnings for every example of the ACs, the slug table, a property test over 2000 generated strings, index order, purity and determinism
- `tests/integration/us-002-numbering-pdf.test.ts` — numbers read from the compiled document: worked example, deeper levels, skipped levels, `none`, other pattern, and the 655 headings of the real file (Imprint is chapter 2)
- `tests/integration/us-002-labels-roundtrip.test.ts` — 26 heading sources × 4 containers compile, read back as the tree, and every label resolves; guard test for duplicate labels; the 655 labels of the real file resolve
- `tests/unit/us-008-presets.test.ts` — stub for AC-13 (implemented with US-008)
- `tests/support/headings.ts` — helpers; `tests/support/blocks.ts` reads a heading as `<heading>…</>`

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each rule switched off alone (NFC, ASCII lower-casing, suffix counter, used-label check, empty rule, `skippedFrom`, break replacement, label separator, level count) is caught by a test.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story file updated if ACs were refined during implementation.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

## Implementation result

- `src/core/parse/headings.ts` (`slug`, `visibleText`, `indexHeadings`), `src/core/emit/heading.ts` (`headingNumberingRule`), option `breaks: 'space'` of `emitInline`, option `headings` of `emitBlocks`; the `NODE_UNSUPPORTED` fallback for headings is gone (the US-015 AC-12 block test for it was removed).
- Measured on the real file: 655 headings, 655 different valid labels, all resolve in the compiled document, Imprint is chapter 2, all 655 are numbered.
- Mutation check M1 to M18 (NFC, ASCII lower-casing, free-suffix loop, registering suffixed labels, empty rule, jump rule, empty heading changing the level, breaks, block start, level count, embed in label, double blank, `none` literal, embed counts as content, quotes not visited, closing `</br>`, label separator, comment counting in empty headings): every one is caught by a test.
- Decisions of the user (2026-10-16): first free suffix, breaks become one space, emptiness rule, pattern check in the preset. Defaults still to confirm with the story: NFC and ASCII-only lower-casing (AC-2b), the label from the visible text (AC-2c).
- Gate: typecheck, lint, build, `npm test` 278 passed / 177 todo, `npm run test:integration` 64 passed / 20 todo.
