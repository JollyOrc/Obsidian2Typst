# US-014 — Markdown parsing: choose and specify the parser

**Status:** Done
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** —

---

## Story

**As a** maintainer of the converter,
**I want** one documented, tested way to turn Markdown (with the Obsidian
extensions found in real books) into a syntax tree with source lines,
**so that** US-001 to US-005 convert from a reliable tree instead of ad-hoc text
matching, and every warning can name its line.

---

## Acceptance criteria

- **AC-1 (decision recorded):** Decided by the user 2026-10-16: **markdown-it
  15.0.3** with the footnote, mark and task-lists plugins and own rules,
  recorded in `docs/technical/markdown-parser.md` (candidates, 108 kB added,
  licences, results). The size limit is 200 kB. Dependencies are listed in
  `docs/technical/dependencies.md`.

- **AC-1b (tree shape):** `parse(source)` in `core/parse` returns
  `{frontmatter: string | null, root: Block[]}`. The parser builds a tree from
  markdown-it's flat token stream: every node is
  `{kind, line, children?, ...fields}` with `line` 1-based in the original file
  (frontmatter counted). Inline nodes get their line from the block start plus
  the soft and hard breaks before them (exact on the real file: 149 of 149
  anchor links), table cells use the row line. Kinds: `paragraph`, `heading`
  (`depth`), `list` (`ordered`, `start`), `item` (`checked: boolean | null`),
  `blockquote`, `code` (`lang`, `value`), `thematic-break`, `table` (`align[]`),
  `row`, `cell`, `html-block`, `footnote-def` (`label`), `text`, `strong`,
  `emph`, `delete`, `mark`, `code-inline`, `link` (`href`), `image`
  (`src`, `alt`), `wikilink` and `embed` (`file`, `anchor`, `alias`),
  `footnote-ref` (`label`), `inline-footnote`, `comment`, `html-inline`
  (`name`, `closing`), `break`, `softbreak`. Tags (`#x`) stay `text`.
  Decisions found while implementing: `[^label]` is always a `footnote-ref`,
  also without a definition, and definitions stay in the tree at their place
  (also unreferenced ones), so US-005 can report FOOTNOTE_UNDEFINED and
  FOOTNOTE_UNUSED; a bare address needs a scheme (`compiledtext.md` is not a
  link); `href` and `src` are kept as written; image `alt` is plain text; a
  block that is exactly one comment is a `comment` block, other html is
  `html-block`.

- **AC-2 (constructs of the real input):** The tree distinguishes every
  construct that `The Rules/compiledtext.md` uses, each shown by a fixture
  string and the expected node kind:
  ```
  **a** / *a* / _a_ / ~~a~~ / ==a== / `a`        strong, emph, emph, delete, mark, code
  [x](u) / <https://a.org> / bare https://a.org  link, link, link
  [[A]] / [[A|b]] / [[A#B]] / ![[a.png|300]]     wikilink (target, anchor, alias), embed (size)
  [^1] and [^1]: text / ^[text]                  footnote reference, definition, inline footnote
  - [ ] a / * a / tab-indented nested list       task item, bullet list, nesting depth
  <!-- c -->  / <u>x</u> / <br>                  comment, html inline (name kept), break
  | a | b | with :---: alignment and <br>        table (alignment per column)
  #tag                                           text (US-001 AC-14), not a heading
  ```

- **AC-3 (source lines):** Every block node carries its 1-based start line in
  the original file (frontmatter included in the count). Example: a link on
  line 412 yields a warning with `line: 412` even when the file starts with a
  20-line frontmatter block.

- **AC-4 (no crash, no loss):** Parsing the sample note `Book.md` (US-024;
  the author's real file at the time of the spike) produces a tree whose
  text content, concatenated, contains every non-markup character of the input
  (a character-count check with the known markup removed); no input throws,
  including empty files, a file of only frontmatter, unclosed `**` and an
  unclosed `^[`, which become literal text.

- **AC-5 (purity and determinism):** The parser lives in `core/parse` with no
  Obsidian, Node or I/O imports (lint rule of US-013 AC-10) and returns the same
  tree for the same input.

- **AC-6 (composed: constructs inside constructs):** Link inside a heading,
  footnote inside a table cell, emphasis inside a link label, list inside a
  blockquote inside a list item (3 levels) each appear as nested nodes with the
  right parent kinds.

---

## Notes

- Amended by US-005 (2026-10-17): a `row` node has `extraCells` (only when the
  parser cut cells beyond the header) and a `text` node has `unclosedNote: true`
  (only for the `^[` of a note that is never closed). Both are absent otherwise,
  so existing trees are unchanged.

- Open: library candidates for the spike are markdown-it (plugins for
  footnotes, mark, task lists) and the unified/mdast stack; an own parser
  covering only AC-2 is the third candidate. The spike measures each against
  AC-2 to AC-6 on the real file, not on a general test suite.
- Known limit: a wikilink inside a Markdown link label breaks the outer link
  (CommonMark does not nest links); the text stays visible, nothing is lost.
- Obsidian-only syntax (wikilinks, embeds, `==`, `^[…]`, callouts, `%%`
  comments) is expected to need extensions in any library.

---

## Related tickets

- [TICKET-008](../tickets/TICKET-008-markdown-parser-spike.md) — parser spike and decision (Done)
- [TICKET-010](../tickets/TICKET-010-markdown-parser-core.md) — parser in `core/parse` (Done)
