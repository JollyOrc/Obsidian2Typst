# TICKET-010 — Markdown parser in `core/parse`: tokens to a tree with lines

**Status:** Done
**User story:** [US-014](../user-stories/US-014-markdown-parsing.md)
**ACs addressed:** AC-1b, AC-2, AC-3, AC-4, AC-5, AC-6

---

## Description

Add markdown-it with the approved plugins and write `core/parse`: strip frontmatter, parse, and build the tree of US-014 AC-1b with exact 1-based source lines. The converter stories (US-001 to US-005) consume only this tree.

---

## Acceptance criteria (from user story)

- **AC-1b:** `parse(source)` returns `{frontmatter, root}`; node kinds and fields as listed; lines exact (inline nodes by block start plus break count, table cells by row).
- **AC-2:** every construct of the list is distinguishable (fixtures from `spikes/markdown-parser/fixtures.mjs`, all 38).
- **AC-3:** a link on line 6 of a paragraph that starts on line 5 reports line 6, also after a 3-line frontmatter.
- **AC-4:** the real file parses without exception; unclosed `**`, unclosed `^[`, empty input and frontmatter-only input become literal text or an empty tree.
- **AC-5:** `core/parse` imports nothing from Obsidian, Node or I/O (lint rule exists for `src/core`); same input gives an equal tree.
- **AC-6:** link in heading, footnote in table cell, emphasis in link label, list in quote in list item nest with the right parent kinds.

---

## Implementation notes

- Install exact versions: markdown-it 15.0.3, markdown-it-footnote 4.0.0, markdown-it-mark 4.0.0, markdown-it-task-lists 2.1.1 (runtime), `@types/markdown-it` (dev); update `dependencies.md` status line and run the licence check.
- Own inline rule for `[[target#anchor|alias]]` and `![[target|size]]` before `link`: see `spikes/markdown-parser/adapters/markdown-it.mjs` (25 lines). It must run before emphasis and code, so `[[A|*b*]]` and a wikilink inside a code span behave (hostile cases in `run-hostile.mjs`).
- Frontmatter: strip `^---\n…\n---\n` before parsing and add the line offset.
- Task items: the plugin injects an `<input>` html token; map it to `item.checked` and drop the token. Replacing the plugin with an own rule is optional here.
- Comments: `html_block`/`html_inline` starting with `<!--` become `comment`; other html becomes `html-block`/`html-inline` with the tag name and a `closing` flag.
- `footnote-def`: the inline-footnote bodies the plugin appends are not definitions; the tree has `inline-footnote` nodes with their children in place.
- The regression test on the real file asserts the counts of the spike (149 anchor links, 15 inline footnotes, 41 comments, 261 tables, 59 `<br>`) from a fixture copy of the file in `tests/fixtures/`.
- SCAR-009: also test each rule in combination (rule composed with tables, lists, quotes), not only in isolation.

---

## Tests

- `tests/unit/us-014-markdown-parsing.test.ts` — AC-1b (16) and AC-2 (30).
- `tests/unit/us-014-parse-lines-robustness.test.ts` — AC-3 (4), AC-4 (5), AC-5 (3), AC-6 (10 incl. hostile).
- Support: `tests/support/tree.ts`; fixture `tests/fixtures/compiledtext.md` (copy of `The Rules/compiledtext.md`).

---

## Definition of done

- [x] All listed tests pass (68 tests in two files).
- [x] Full quality gate passes (typecheck, lint, build, test, test:integration).
- [x] `docs/technical/tests.md` AC-to-test map updated (AC-1b added).
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

---

## Implementation result (2026-10-16)

Files: `src/core/parse/{types,markdown,build,parse,index}.ts` and `plugins.d.ts`. Differences from the spike and decisions taken while implementing (all covered by tests; the story US-014 is updated):

- **Footnote references are always nodes**, also without a definition (own inline rule replaces the plugin's), so US-005 can report FOOTNOTE_UNDEFINED. The plugin's `footnote_tail` rule is disabled, so definitions stay at their place and unreferenced ones stay in the tree (FOOTNOTE_UNUSED).
- **Bare addresses need a scheme** (`fuzzyLink`, `fuzzyEmail`, `fuzzyIP` off): `compiledtext.md` has a `.md` suffix that is also a country domain. The real-file link count did not change (173).
- **Addresses and paths are kept as written** (`normalizeLink` is the identity); the asset resolver decodes later.
- **Image alt text is plain text** (markup removed), not the raw source.
- **Task items:** `checked` is set from the plugin's `<input>` token, which is dropped together with the leading space.
- **Comments:** an html block that is exactly one comment is a `comment` block; any other html block stays `html-block`.
- **Known limit:** a wikilink inside a Markdown link label (`[see [[A]]](u)`) breaks the outer link (CommonMark does not nest links); everything stays visible as text, nothing is lost. No such case in the real file.
- **Frontmatter:** a first line `---` and a later `---` line are treated as frontmatter, as in Obsidian; a document that starts with a thematic break and has another one later is misread. Not found in the real file.
- Test counts on the real file are the spike's numbers (655 headings, 261 tables, 149 anchor links, 41 comments, 15 inline footnotes); every anchor link, image and comment reports the line that contains it (254 nodes).
