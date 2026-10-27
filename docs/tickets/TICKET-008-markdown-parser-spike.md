# TICKET-008 — Markdown parser spike and decision

**Status:** Done
**User story:** [US-014](../user-stories/US-014-markdown-parsing.md)
**ACs addressed:** AC-1 (decision), AC-2 to AC-6 (measured per candidate)

---

## Description

Compare markdown-it (with plugins), the unified/mdast stack and a small own parser against the constructs of `The Rules/compiledtext.md`, and record the decision in `docs/technical/markdown-parser.md`. No converter ticket starts before this is closed.

---

## Acceptance criteria (from user story)

- **AC-1:** decision recorded with candidates, size added to `main.js`, licence, and AC-2 result per candidate; library accepted only if AC-2 to AC-5 pass and size is within the agreed limit.
- **AC-2:** every construct in the US-014 AC-2 list is distinguishable in the tree.
- **AC-3:** every block carries its 1-based source line (frontmatter counted).
- **AC-4:** the real file parses without loss or exception; malformed input becomes literal text.
- **AC-5:** pure and deterministic.
- **AC-6:** nested constructs have the right parent kinds.

---

## Implementation notes

- Throw-away code under `spikes/markdown-parser/`; nothing from it goes into `src/` (SCAR-008 style: check outputs programmatically, not by eye).
- Measure size by bundling each candidate with esbuild (same settings as `esbuild.config.mjs`).
- Report counts per construct on the real file next to the census (149 anchor links, 15 inline footnotes, 41 comments, ~400 tags, 7 tab-indented lists, 18 `<br>` table rows).

---

## Tests

- `tests/unit/us-014-markdown-parsing.test.ts` — one stub per AC of US-014, written after the decision; the spike itself has no tests, only the findings file.

---

## Findings (2026-10-16)

Outcome: **markdown-it 15.0.3 chosen by the user** (candidate A). The full write-up with the decision is `docs/technical/markdown-parser.md`; this section records everything the spike measured, including what was not measured. Code: `spikes/markdown-parser/` (throw-away, not part of the gate). Input for all real-file numbers: `The Rules/compiledtext.md`, 5443 lines.

### Candidates and set-up

| | A. markdown-it | B. remark | C. own parser |
|---|---|---|---|
| Packages (exact) | markdown-it 15.0.3, markdown-it-footnote 4.0.0, markdown-it-mark 4.0.0, markdown-it-task-lists 2.1.1 | unified 11.0.5, remark-parse 11.0.0, remark-gfm 4.0.1, remark-frontmatter 5.0.0, unist-util-visit | not built |
| Own code for Obsidian syntax | wikilink and embed inline rule, 25 lines; frontmatter strip, 4 lines | text-node transform for `==mark==`, `[[wikilink]]`, `![[embed]]`, about 40 lines; source pre-pass turning `^[x]` into a footnote definition, about 12 lines | n/a |
| Adapter size (normalizing walk included) | 95 lines | 89 lines | n/a |
| Licences in the bundle | MIT; ISC (task-lists); BSD-2-Clause (entities) | MIT | n/a |

The own parser was **not prototyped**. It was rejected by reasoning (CommonMark lists, nested quotes, emphasis rules and GFM tables are thousands of lines; the libraries needed 25 to 90 lines for the Obsidian additions). This is an estimate, not a measurement.

### Measurements

| Measure | markdown-it | remark |
|---|---|---|
| Bundle added to `main.js` (esbuild, minified, browser, CJS) | 108.1 kB (gzip 44.4 kB) | 115.7 kB (gzip 34.6 kB) |
| Construct fixtures (US-014 AC-2, AC-4, AC-6; 38) | 38/38 | 38/38 |
| Hostile cases (10) | 10/10 | 8/10 |
| Parse time, real file | 106 ms | 531 ms |
| Source line of inline nodes | after the fix below: exact | exact natively |

Both stay under the 200 kB limit of US-014 AC-1. Bundled markdown-it packages: markdown-it, mdurl, uc.micro, entities, linkify-it, punycode.js and the three plugins; `argparse` (CLI only) is not in the bundle.

### The 38 fixtures

Strong, emphasis with `*` and `_`, delete, mark, inline code, link, autolink, bare URL, wikilink with alias and with anchor, embed with size, image, footnote reference and definition, inline footnote, task items, `*` list, tab-indented nested list (depth 3), inline and block comments, `<u>`, `<br>`, hard break, table with alignment, table with `<br>`, a `#tag` (stays text, no heading), heading, list in blockquote, frontmatter, link in heading, footnote in table cell, emphasis in link label, list in quote in list item, unclosed `**`, unclosed `^[`, empty input, frontmatter only. File: `fixtures.mjs`; run `node run-fixtures.mjs`.

### The 10 hostile cases (SCAR-009: rules combined, not alone)

| Case | markdown-it | remark |
|---|---|---|
| `[[A|*b*]]` (alias with emphasis) | pass | **fail**: the delimiters sit in separate text nodes |
| `==a *b* c==` | pass | **fail**: same reason |
| `` `[[A]]` `` stays code | pass | pass |
| `` `^[x]` `` stays code | pass | passes the node check, but the pre-pass **silently rewrote the code text** to `[^__i0]`; the same happens in a fenced block |
| `^[b [c] d]` nested brackets | pass | pass |
| `==x==` in a code span | pass | pass |
| `[see [[A]]](https://a.org)` | pass | pass |
| unclosed `[[A b` | pass | pass |
| `[[A\|b]]` in a table cell | pass | pass |

The silent rewrite of code content is the decisive finding against B in its simple form; a correct B needs a micromark syntax extension, which is far more than 12 lines. File: `run-hostile.mjs`.

### Real file (both parsers agree)

headings 655, tables 261 (767 header cells), lists 128 (maximum depth 2), links 173 (149 anchor links `](#…)`), images 64, html inline 79 (of which `<br>` 59), comments 41, inline footnotes 15, footnote references 1, strong 60, emphasis 30, blockquotes 13, hard breaks 1. The regex census (149 anchor links, 15 `^[`, 41 `<!--`, 18 table rows with `<br>`) matches the parsers. The file contains **no wikilinks, no embeds, no task items and no frontmatter**; the fixtures are the only coverage for them. `#tags` stay text in both parsers.

### Source lines (US-014 AC-3)

- markdown-it gives a line (`map`) only to block tokens; inline tokens have none. Using the block line alone put 12 of 149 anchor links on the wrong line (105 of 898 paragraph-like blocks span several lines).
- Fix tested in the spike adapter: start from the block's `map` and count `softbreak` and `hardbreak` tokens; table cells take the row's `map`; the counter restarts at every token with a `map`. Result: **149/149 anchor links on the same line as remark**. A first attempt without the table-row reset gave 137/149; the reset was the missing piece.
- remark gives exact lines for every node, including inline nodes.

### No-loss check (US-014 AC-4)

A word-multiset comparison of the text content of both parsers differed by 45 words, and 85 source words were missing from the shared text. Inspecting the differing lines showed only measurement artefacts: image alt text counted by the markdown-it walk but not by remark, and a footnote definition line parsed in isolation. No text was lost by either parser. The proper check for the ticket is an exact test on the tree (TICKET-010); this comparison is a plausibility check only.

### Differences that matter for the converter

- markdown-it returns a flat token stream with open/close pairs; remark returns a tree. The converter needs a token-to-tree builder (about 40 lines, planned in TICKET-010).
- The footnote plugin appends a footnote body for each `^[…]`; it is not a definition and must be told apart from `[^1]:` (a footnote has a label, an inline note has none).
- The task-lists plugin injects an `<input>` html token; it must be mapped to `checked` and dropped. The package is old (ISC, 2.1.1) and should be replaced by an own rule later.
- markdown-it has no frontmatter support; remark-frontmatter has.
- markdown-it ships no types (`@types/markdown-it`, dev dependency).
- remark is 5 times slower on this file but still half a second.

### Not measured or open

- Memory use of the parsers (not measured; the compiler dominates, see the WASM spike).
- Behaviour on files other than `compiledtext.md` (only the other fixtures).
- Behaviour with Obsidian callouts (`> [!note]`): they parse as blockquotes in both; handling belongs to the later "Marking content" stories.
- Parse errors cannot occur in either library (both accept any text); the only failure mode is wrong structure, covered by the fixtures.

### Reproduce

```
cd spikes/markdown-parser
npm install
node run-fixtures.mjs   # 38 fixtures per candidate
node run-hostile.mjs    # 10 hostile cases
node run-real.mjs       # real-file counts, speed, line agreement
node size.mjs           # bundle sizes
node run-loss.mjs       # word-multiset plausibility check
```

---

## Definition of done

- [x] `docs/technical/markdown-parser.md` written and approved by the user (2026-10-16: markdown-it).
- [x] US-014 status set to Ready and its ACs refined with the chosen tree shape.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
- Test stubs for the story are in `tests/unit/us-014-markdown-parsing.test.ts`; they become real tests in TICKET-010.
