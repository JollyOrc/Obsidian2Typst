# TICKET-015 — Links: resolver, link, wikilink and note-embed emitters

**Status:** Done
**User story:** [US-004](../user-stories/US-004-links-and-references.md)
**ACs addressed:** AC-1, AC-1b, AC-1c (option only), AC-1d, AC-1e, AC-1f, AC-2, AC-3, AC-4, AC-5 (without the table cell), AC-6, AC-7, AC-8, AC-8b, AC-9, AC-10
**Depends on:** TICKET-014 (`indexHeadings`), TICKET-012 (`emitInline`), TICKET-011 (`callSeparator`)

---

## Description

Convert links, wikilinks and note embeds: external links stay clickable with their address in a footnote, internal links become `#link(<label>)[text]` through one resolver (text, GitHub-style slug, number-stripped), local files keep their text with the path in a footnote. Warnings: `LINK_UNRESOLVED`, `LINK_AMBIGUOUS`, `LINK_URL_NOT_SPELLED`, `EMBED_NOTE_UNEXPANDED`.

---

## Acceptance criteria (from user story)

See US-004 (exact examples are in the story and the tests). Decided by the user on 2026-10-16: one resolver for every internal link (AC-8b), a link inside footnote text keeps the parenthesis form (AC-6), every URL scheme is external (AC-1f), an unresolved link keeps the formatting of its text (AC-4).

---

## Implementation notes

- **`src/core/parse/links.ts`** (pure, tree only): `classifyHref(href)` (`empty`, `anchor`, `note`, `external`, `file`), `resolveHeading(target, index)` (rule 1 text, 2 slug, 3 number-stripped; returns `{rule, matches}` or null), `wikilinkTarget(node)` (text after the last `#`, null for a block reference), `unescapeAddress(text)` (backslash before ASCII punctuation), `isNoteEmbed(file)`.
- **`emitInline` options:** `links: {headings, externalLinkFootnotes}` (when absent the old fallback with `NODE_UNSUPPORTED` stays, so direct callers are unchanged) and `where: 'body' | 'heading' | 'footnote'` (default `body`).
- **New item `link`** in `prepare`/`render`: destination (`<label>` or a Typst string), optional body (rendered as a block start like `#strike[`), a suffix (`#footnote[…]` or ` (…)`) and whether it ends in a call; `callSeparator` handles the join like for every call.
- **`emitBlocks`:** option `externalLinkFootnotes` (default true); passes the heading index and the environment to every `emitInline` call (paragraphs, headings with `where: 'heading'`, table fallback, HTML blocks).
- Join hazards (SCAR-010), measured in probe `s28`: after `#link("u")` a `(` calls its argument and a `[` becomes its body; `.` and `;` are handled by the existing separator rule; a link followed by a footnote needs nothing between them. A footnote in a heading, a table cell, a quote, a list item or a link body compiles.
- Measured: Typst 0.14.2 compiles a footnote inside a footnote without error or warning (probe `s29`); AC-6 keeps the parenthesis form as a design choice.
- Register: add `resolveHeading`, `classifyHref` and the link emitter to `docs/user-stories/README.md`.

---

## Tests

- `tests/unit/us-004-links.test.ts` — exact strings and warnings for every example of the ACs, the resolver rules, the real-file regression (149 anchors: 52 / 51 / 36 by rule, 14 ambiguous, 10 unresolved), purity
- `tests/integration/us-004-links-roundtrip.test.ts` — compiler round trips: every link kind × every following character, emphasis around links, internal links resolve (a missing label is a compile error), text-only cases, and the whole real file
- `tests/support/blocks.ts` — `blocks(md, options)`
- Stub left for US-005: a link inside a table cell

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each rule switched off alone (separator, rules 1 to 3, number strip, slug, document order, mailto/tel strip, bodyless link, footnote switch, heading and footnote context, unescape, scheme test, note embed test, `.md` test, decode) is caught by a test.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story file updated if ACs were refined during implementation.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

## Implementation result

- `src/core/parse/links.ts` (resolver and address helpers), `LinkEnv` and `where` options of `emitInline`, items `link` and `raw`, `externalLinkFootnotes` option of `emitBlocks`.
- Measured on the real file: 149 anchors resolve as 52 / 51 / 36 by rule, 10 unresolved (5 distinct targets), 14 ambiguous; all 22 external links, the e-mail link and the file link convert; the whole file compiles with zero errors.
- Mutation check L1 to L23 (separator, the three rules, number pattern, ambiguity warning, `mailto:` strip, bodyless link, footnote switch, heading and footnote context, unescape, scheme test, note embed test, `.md` test, decode, document order, last `#` segment, local-file switch, heading text for an empty body, embed warning, block reference, autolink footnote): every one is caught by a test; L23 (autolinks never get a footnote) first survived and led to the test for `<mailto:a@b.de>`.
- Measured: Typst 0.14.2 accepts a footnote inside a footnote (probe `s29`); AC-6 keeps the parenthesis form as the user decided, with the reason corrected in the story. The story examples that showed `#link("…").` without the call separator were corrected (SCAR-010), and the `www.` example was removed because the parser leaves `www.example.org` as text.
- Gate: typecheck, lint, build, `npm test` and `npm run test:integration` green.
