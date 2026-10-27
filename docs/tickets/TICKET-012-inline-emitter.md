# TICKET-012 — Inline emitter: text, marks, breaks, HTML, comments

**Status:** Done
**User story:** [US-001](../user-stories/US-001-convert-markdown-to-typst.md)
**ACs addressed:** AC-1 (marks), AC-1c, AC-2, AC-2b (without link output), AC-3, AC-4, AC-4b, AC-8 (hard break), AC-8c, AC-9, AC-9b, AC-9c, AC-12 (inline part), AC-14 (text), AC-15 (inline comments)
**Depends on:** TICKET-011 (`callSeparator`, slash rule), TICKET-010 (tree), TICKET-009 (`wrapEmphasis`)

---

## Description

Add `emitInline(nodes, ctx, options?)` to `core/emit`: the function that turns the inline nodes of a paragraph, heading or table cell into Typst, with the warnings that belong to inline content. It is the first caller of `escapeMarkup`, `wrapEmphasis`, `rawInline` and `callSeparator` together, so it carries the SCAR-009 round-trip tests. Block elements, links, images, wikilinks and footnotes are later tickets; until then those nodes keep their text and report `NODE_UNSUPPORTED` (US-015 AC-12).

---

## Acceptance criteria (from user story)

See US-001: AC-1 (marks only), AC-1c, AC-2, AC-2b (rows without link output), AC-3, AC-4, AC-4b, AC-8, AC-8c, AC-9, AC-9b, AC-9c, AC-12, AC-14, AC-15. Exact examples are in the story and in the tests.

---

## Implementation notes

- **API:** `emitInline(nodes: readonly InlineNode[], ctx: EmitContext, options?: {atBlockStart?: boolean}): string` (default `atBlockStart: true`; headings pass `false`). New file `src/core/emit/context.ts`: `Warning {code, message, line}` and `class EmitContext` with `warn(code, message, line)`, `commentDropped(line)` and `finish(): Warning[]` (the warnings plus one `COMMENT_DROPPED` summary, sorted stably by line; callable twice). New file `src/core/emit/inline.ts`.
- **Prepare, then render.** `prepare(children, ctx)` runs once per children list, recursively, and does everything that reports: pair `<u>`/`<span>` by nesting with a stack (unpaired tags and unsupported tags dropped with their exact messages), unwrap `<span>`, turn `<br>` into a hard break, drop comments and count them, turn nodes without an emitter into text with `NODE_UNSUPPORTED`, drop empty formats, trim leading/trailing breaks, collapse a soft break after another break, then merge adjacent text nodes (so a marker split by a dropped comment is still seen). Rendering is pure, which lets the form of a mark (delimiter or function) be decided first and the content rendered once with the right line-start state.
- **Rendering state:** `lineStart` is true at the start (`options.atBlockStart`) and after every break, false after any non-blank output; shared across nesting so a marker after a soft break inside `*…*` is escaped. In function form (`#strong[`, `#strike[`, `#highlight[`, `#underline[`) the content starts as a block start; right after a delimiter `*`/`_` it does not.
- **Form of a mark:** ask `wrapEmphasis` with the real neighbours (last character of the output so far, first character of the next non-empty sibling's output; a parent edge counts as a non-word character) and `endsWithAddress` (last non-empty descendant is a link). Also use the function form when the content starts or ends with a blank. Neighbour decisions never depend on another mark's form (both forms start and end with a non-word character).
- **Calls:** every piece that ends in a call (`#strike[…]`, `#highlight[…]`, `#underline[…]`, function-form strong/emphasis, `#raw(…)` from `rawInline`) is followed by `callSeparator(first character of the next output)`. Keep a `endsWithCall` flag on each rendered piece so later tickets (links, footnotes) reuse it.
- **Fallback text** (until their tickets): link and inline footnote → children; image → alt; wikilink → alias or `file#anchor`; embed → `file#anchor`; footnote reference → `[label]`. All escaped.
- `<br>` is `\` + newline here; table cells (US-005 AC-2b) use `#linebreak()` through a later option.
- Messages: `Unsupported HTML tag <name> dropped` (`</name>` for closing), `Unpaired HTML tag <name> dropped`, `N HTML comments dropped` / `1 HTML comment dropped`, `No emitter for <kind>; its text is kept`.
- Register: add `emitInline` to the call-site table of `escapeMarkup` in `docs/user-stories/README.md` (SCAR-001): paragraph and cell text `atBlockStart: true`, heading text `false`, inside delimiter marks `false`, content of function forms `true`, after a break `true`.
- Add the codes `HTML_UNSUPPORTED`, `COMMENT_DROPPED`, `NODE_UNSUPPORTED` used by `core/emit` to the typed list when the warnings story (US-006) arrives; until then `code` is a string.

---

## Tests

- `tests/unit/us-001-text-conversion.test.ts` — 43 unit tests (+18 stubs for the block elements and the stories that follow) (AC-1 to AC-15 inline, US-015 AC-12 fallback, purity)
- `tests/integration/us-001-inline-roundtrip.test.ts` — compiler round trips: followers after calls, line starts, neighbours (about 900 cases), every printable character in 8 positions, composed HTML/marks, every inline fragment of `The Rules/compiledtext.md`
- `tests/support/inline.ts` — helpers (`inline`, `typ`, `paragraphs`, `emitNodes`, `reading`)

---

## Definition of done

- [x] All listed tests pass.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story file updated if ACs were refined during implementation.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

---

## Implementation result

- Gate: typecheck, lint, build, `npm test` (182 passed, 208 todo), `npm run test:integration` (38 passed, 23 todo) all green.
- Mutation check (9 mutations, each switched on alone, each caught by at least one test): no call separator, soft break not a line start, hard break not a line start, function-form content not a block start, previous neighbour ignored, next neighbour ignored, address flag ignored, no blank guard, no text merging.
- The 41 comments of `The Rules/compiledtext.md` are all block-level in the tree, so the real file gives no inline `COMMENT_DROPPED`; the block ticket reports them with the same `EmitContext.commentDropped`.
- Decided while specifying (written into US-001): `***x***` reads as `_*x*_`; AC-3's example uses `\<here>`; one `HTML_UNSUPPORTED` per dropped tag (AC-9c); `1 HTML comment dropped` for one comment.
- Typst ignores a blank at the start of a line after a `\` line break; the round-trip helper `squash` accounts for it.
