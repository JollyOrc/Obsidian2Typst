# Markdown parser: spike result and decision proposal

Status: **Approved by the user 2026-10-16: candidate A (markdown-it)** (TICKET-008, US-014 AC-1).
Spike code: `spikes/markdown-parser/` (throw-away; `node run-fixtures.mjs`,
`run-real.mjs`, `run-hostile.mjs`, `size.mjs`). Input: `The Rules/compiledtext.md`
(5443 lines). Measured 2026-10-16.

## Candidates

| | A. markdown-it 15.0.3 | B. unified + remark-parse 11 | C. own parser |
|---|---|---|---|
| Plugins used | footnote 4.0.0, mark 4.0.0, task-lists 2.1.1, own wikilink rule (25 lines), linkify on | remark-gfm 4.0.1, remark-frontmatter 5.0.0, own text transform (about 40 lines) and own source pre-pass (about 12 lines) | not built |
| Bundle added (minified) | **108 kB** (gzip 44 kB) | **116 kB** (gzip 35 kB) | unknown |
| Licences in the bundle | MIT, ISC (task-lists), BSD-2 (entities) | MIT | n/a |
| Fixtures, US-014 AC-2/AC-6/AC-4 (38) | 38/38 | 38/38 | n/a |
| Hostile cases (10) | **10/10** | 8/10 | n/a |
| Real file, speed | 106 ms | 531 ms | n/a |
| Source line of inline nodes | block line, plus break counting: exact (149/149 anchor links equal to remark) | exact for every node | n/a |

The own parser (C) was **not prototyped**: both libraries needed 25 to 90 lines
for the Obsidian additions, and CommonMark lists, nested quotes, emphasis
rules and GFM tables are thousands of lines to match. Rejected on that
reasoning, not on a measurement.

## Results on the real file (both candidates agree)

headings 655, tables 261 (767 header cells), lists 128 (max depth 2), links
173 (149 anchor links), images 64, `<br>` 59, html inline 79, comments 41,
inline footnotes 15, footnote references 1, strong 60, emphasis 30,
blockquotes 13, hard breaks 1. The regex census (149 anchors, 15 `^[`, 41
`<!--`) matches the parsers. No `[[wikilinks]]`, embeds, tasks or frontmatter
occur in this file (the fixtures cover them anyway). Tags `#x` stay text in
both. The word-count comparison between the candidates differed only by image
alt text and a footnote definition line parsed in isolation (adapter artefacts,
no lost text).

## Why A is proposed

1. **Robust extensions.** The wikilink rule is an inline rule, so it runs
   before emphasis and code: `[[A|*b*]]`, `==a *b* c==`, and `` `[[A]]` ``
   all behave. In B the text transform fails `[[A|*b*]]` and `==a *b* c==`
   (the delimiters sit in different text nodes) and the `^[` pre-pass **silently
   rewrites code**: `` `^[x]` `` became `[^__i0]` in the code span (a silent
   change, the SCAR-009 pattern). A correct B needs a micromark syntax
   extension, which is much more code than 25 lines.
2. Inline footnotes `^[…]` are built into the footnote plugin.
3. Five times faster; size is equal for our purposes.

Why not B: exact lines for every node and a cleaner tree (mdast), but the
cost is a hand-written micromark extension for each Obsidian construct.

## Risks and mitigations for A

- **Inline tokens have no line number.** Mitigation (tested): start from the
  block's `map` and count `softbreak`/`hardbreak` tokens; table cells use the
  row's `map`. Result 149/149 identical to remark on the real file.
- **task-lists plugin** (ISC, 2.1.1) is old and unmaintained; it injects an
  `<input>` html token. Plan: replace with an own 20-line core rule when the
  converter ticket for lists is written; until then pinned exactly.
- **No frontmatter support**: stripped before parsing with a line offset
  (done in the spike adapter, 4 lines).
- **Types**: markdown-it ships none; add `@types/markdown-it` (dev).
- Tokens are a flat stream with open/close pairs, not a tree: the converter
  needs a small tree builder (about 40 lines) before the emitter; planned as
  the first part of the parser ticket.
- Dependencies to add (exact versions, `docs/technical/dependencies.md`):
  markdown-it 15.0.3, markdown-it-footnote 4.0.0, markdown-it-mark 4.0.0,
  markdown-it-task-lists 2.1.1, `@types/markdown-it`.

## Status against US-014

AC-1 size limit 200 kB: both pass. AC-2: both pass with extensions. AC-3:
passes with the line rule above. AC-4: no crash on the real file, unclosed
`**`, unclosed `^[`, empty input, frontmatter only (both). AC-5: both are
pure and deterministic; the lint rule for `core/parse` still has to cover the
dependency imports. AC-6: both pass.

## Open for the user

Approve candidate A (markdown-it) and the dependency list, or choose B.
After approval: US-014 to Ready with the chosen tree shape, then the parser
ticket (token-to-tree builder, wikilink rule, tasks rule, frontmatter strip,
`core/parse` lint rule).
