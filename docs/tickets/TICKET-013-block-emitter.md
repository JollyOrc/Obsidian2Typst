# TICKET-013 — Block emitter: paragraphs, lists, quotes, code, rules, HTML blocks, comments

**Status:** Done
**User story:** [US-001](../user-stories/US-001-convert-markdown-to-typst.md)
**ACs addressed:** AC-1, AC-1d, AC-5, AC-5b, AC-6, AC-6b, AC-7, AC-7b, AC-8 (`---`), AC-9d, AC-10, AC-12 (block part), AC-15 (block part), AC-15b, AC-16; US-015 AC-12 (block fallback)
**Depends on:** TICKET-012 (`emitInline`, `EmitContext`), TICKET-006 (`rawBlock`), TICKET-010 (tree)

---

## Description

Add `emitBlocks(blocks, ctx)` to `core/emit`: the function that turns the block nodes of a document, a list item or a quote into Typst with the layout that Typst reads back correctly (probes `s23`, `s24`, `s25`). Headings, tables, footnote definitions and task items are converted by other stories; until then they keep their text and report `NODE_UNSUPPORTED` (AC-16).

---

## Acceptance criteria (from user story)

See US-001: AC-1, AC-1d, AC-5, AC-5b, AC-6, AC-6b, AC-7, AC-7b, AC-8, AC-9d, AC-10, AC-12, AC-15, AC-15b, AC-16 (exact examples are in the story and the tests).

---

## Implementation notes

- **API:** `emitBlocks(blocks: readonly BlockNode[], ctx: EmitContext): string` in `src/core/emit/blocks.ts`; no trailing newline. Blocks of one level are joined by one blank line; a block with empty output is skipped before joining (AC-1d). A list that directly follows a paragraph inside an item or a quote is joined by one newline (AC-5b, AC-6).
- **Paragraph:** `emitInline(children, ctx)`. Soft breaks inside produce newlines, which the container indentation then indents (the line-start state of `emitInline` already treats them as line starts; indentation is blanks, which `escapeMarkup` skips).
- **Lists:** marker `- ` or `${start + index}. `; content lines after the first are indented by the marker width, empty lines are not (no trailing blanks). The first block of an item is on the marker line; an item without blocks is the marker alone, written without a trailing blank. Task items (`checked !== null`): plain item plus `NODE_UNSUPPORTED` "No emitter for task item; its text is kept".
- **Quotes:** `#quote(block: true)[`, content indented by 2, `]`; an empty quote is dropped.
- **Code:** `rawBlock(value, lang)` (never escaped); indentation applies to every non-empty line of the result, so the one-line `#raw(block: true, …)` form is untouched. Typst removes the indentation relative to the fence (probe `s25`), so leading blanks of the code stay exact.
- **`---`:** `#line(length: 100%)`.
- **HTML blocks (AC-9d):** tokenize the value with `/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/` into text, comment and tag nodes (`html-inline` with `name`, `closing`), turn newlines into soft breaks, track the line (`block.line` plus the newlines before the tag) and call `emitInline`; the result goes through the normal rules. Block comments (`comment`) call `ctx.commentDropped(line)`.
- **Fallback (AC-16):** `heading` → paragraph (`atBlockStart: true`); `table` → one paragraph per row, cells joined by ` | `; `footnote-def` → its blocks; any other unexpected kind → its inline text if any. One `NODE_UNSUPPORTED` per node, message `No emitter for <kind>; its text is kept`.
- Join hazards (SCAR-010) are the ones measured: nothing precedes or follows a block on its line, so the call-separator rule is not needed between blocks; adjacent lists are not separated (Typst reads them as one list, content unchanged).
- Register: add `emitBlocks` to `docs/user-stories/README.md` (uses `rawBlock`, `escapeMarkup` through `emitInline`).

---

## Tests

- `tests/unit/us-001-blocks.test.ts` — exact strings for every example of AC-1d, AC-5, AC-5b, AC-6, AC-6b, AC-7, AC-7b, AC-8, AC-9d, AC-10, AC-15, AC-15b, and the US-015 AC-12 block fallback, plus purity and determinism
- `tests/integration/us-001-blocks-roundtrip.test.ts` — compiler round trips: 4 containers × 12 contents, two and three containers deep, ordered numbers, exact code text in containers, and the whole of `The Rules/compiledtext.md` compiles with zero errors and one `COMMENT_DROPPED` for 41 comments
- `tests/support/blocks.ts` — helpers (`blocks`, `typ`, `blockReading`, `squashBlocks`); `tests/support/typst-node.ts` now reads an ordered item as `<nN>`

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each of the layout rules switched off alone is caught by a test.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story file updated if ACs were refined during implementation.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

## Implementation result

- `src/core/emit/blocks.ts` implements `emitBlocks`; 37 unit tests and the block round trip (4 containers x 12 contents, two and three levels deep, ordered numbers, exact code text) pass against the Typst compiler.
- The whole real note converts to Typst that compiles with zero errors; its 41 block comments are summarized as one `COMMENT_DROPPED`.
- Mutation check B1 to B10: every layout rule switched off alone is caught by a test (B9 was a no-op and was replaced).
- Decisions: HTML blocks per AC-9d; fallbacks per AC-16; adjacent lists are not separated; task items fall back with a warning; a lone `<br>` block is dropped.
