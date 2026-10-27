# US-002 — Convert headings, number them automatically, and label them

**Status:** Done (2026-10-17, AC-by-AC check; the preamble line is written by US-015, the pattern check by US-008 AC-13, both done)
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author,
**I want** Markdown headings to become numbered Typst headings at the same
level, each with a predictable label,
**so that** the book has the right structure with automatic chapter numbers
(my compiler removes all numbers from the source), a table of contents can be
built later, and links can point to chapters.

---

## Acceptance criteria

- **AC-1 (level mapping):**
  ```
  md : # Title        typ: = Title <h-title>
       ## Chapter          == Chapter <h-chapter>
       ###### Deep         ====== Deep <h-deep>
  ```
  Level N becomes N `=` signs, for N = 1..6.

- **AC-1b (automatic numbering, default):** The preamble contains
  `#set heading(numbering: "1.1")`. Input headings (no numbers in the source):
  ```
  md : # Reader Section   ## Introduction   ## Tessera   # Steward Section   ## Intro
  PDF: 1 Reader Section   1.1 Introduction  1.2 Tessera   2 Steward Section   2.1 Intro
  ```
  The preset field `headingNumbering` holds the Typst numbering pattern
  (default `"1.1"`); the value `none` turns numbering off and emits
  `#set heading(numbering: none)`. The pattern is written as a Typst string
  (quotes and backslashes escaped). The pattern itself is checked by the preset
  (US-008 AC-13): Typst rejects a pattern without a counting symbol
  (`"x"` gives `invalid numbering pattern`, measured), while `"1.1"`, `"a.1"`
  and `"(1.1)"` work.

- **AC-1b2 (numbers on deeper levels, measured):** With the default pattern the
  levels read `1`, `1.1`, `1.1.1`, `1.1.1.1`, `1.1.1.1.1`, `1.1.1.1.1.1`; the
  second `# G` after that restarts at `2`. A heading `===` directly after `=`
  reads `2.0.1`. (Typst extends the last pattern segment.) The 218 level-4
  headings of the real file therefore read like `1.3.2.4`; a shorter pattern
  is a preset choice (`headingNumbering`).

- **AC-1c (every heading is numbered):** All headings of the input are
  numbered, including front-matter-like ones. With the top-level headings of
  the sample note `Book.md` (US-024; `headings['1']` of its manifest) in file
  order the numbers are 1, 2, 3, … (the second one is chapter 2).
  There is no exclusion list. (Decided by the user: elements such as colophon,
  index, and glossary will later come from chosen vault notes, not from the
  input file; see backlog "Common elements from the vault".)

- **AC-2 (label slug rule):** The label is `h-` + the heading's plain text,
  lower-cased, with every run of characters outside `a-z 0-9` replaced by one
  `-`, and leading/trailing `-` removed.
  ```
  "1 Reader Section"            -> <h-1-reader-section>
  "Spells & Crafts (Tessera)"    -> <h-spells-crafts-tessera>
  "Night’s Echo"             -> <h-night-s-echo>
  ```
  Non-ASCII letters are removed, not transliterated: `"Über"` → `<h-ber>`.
  If nothing remains (`"日本"`, `"???"`), the slug is `h-section`; the duplicate
  rule of AC-3 then applies (`<h-section>`, `<h-section-2>`).
  (Decided: removal, approved by the user 2026-10-16.)

- **AC-2b (the slug is stable across spellings):** Text is normalized to NFC
  first, so `café` written with a combined or a separate accent gives the same
  label; lower-casing touches only `A-Z` (no locale rules).
  ```
  "café" (e + U+0301)   -> <h-caf>      "café" (U+00E9)   -> <h-caf>
  "İstanbul"            -> <h-stanbul>  "Straße"          -> <h-stra-e>
  ```
  The same function builds the target of every link to a heading (US-004), so
  both sides always agree.

- **AC-2c (the label text is what the reader sees):** The label is built from
  the visible text of the heading: text, inline code, the text of emphasis and
  links, the alias of a wikilink (or `file#anchor`), the alt text of an image;
  footnote references, embeds, HTML tags and comments add nothing; a soft or
  hard break counts as one space; runs of blanks count as one.
  ```
  md : ## See [[Tessera#Initiative|the rules]]^[note] now   -> <h-see-the-rules-now>
  md : ## A *b* `c` [d](x) ![e](f.png)                       -> <h-a-b-c-d-e>
  ```

- **AC-3 (duplicate headings):** The second heading with slug `h-intro` gets
  `<h-intro-2>`, the third `<h-intro-3>`. Numbering follows document order.
  Example: three `## Rules` headings → `<h-rules>`, `<h-rules-2>`, `<h-rules-3>`.
  No warning is raised for repeated titles (decided by the user 2026-10-16; the
  real file repeats 47 titles 158 times). Links that hit several equal titles
  are reported by `LINK_AMBIGUOUS` (US-004).

- **AC-3b (a suffix never clashes with a title, decided 2026-10-16):** The
  suffix is the first number from 2 up whose label is not yet used, counting
  every label already given in document order. A duplicate label only fails
  once something links to it (measured: `label occurs multiple times`), so
  labels must be unique.
  ```
  ## Intro  ## Intro  ## Intro 2     -> <h-intro>  <h-intro-2>  <h-intro-2-2>
  ## Intro  ## Intro 2  ## Intro     -> <h-intro>  <h-intro-2>  <h-intro-3>
  ```
  No warning is raised.

- **AC-4 (formatting in headings):** `## The *Great* `Hall`` →
  `== The _Great_ `Hall` <h-the-great-hall>`; the label uses plain text only.

- **AC-4b (a heading stays on one line, decided 2026-10-16):** A heading cannot
  span lines in Typst (measured: `== A⏎B` is a heading `A` plus a paragraph
  `B`). A soft or hard break inside heading text (setext heading over two
  lines, `<br>`) becomes one space, in the heading and in its label; a space
  that is already there is not doubled.
  ```
  md : A⏎B⏎===          typ: = A B <h-a-b>
  md : ## A<br>B        typ: == A B <h-a-b>
  md : ## A <br> B      typ: == A B <h-a-b>
  md : ## *A<br>B*      typ: == _A B_ <h-a-b>
  ```

- **AC-4c (the label follows the text safely):** The label is separated from the
  text by one blank, whatever the heading ends with: emphasis, a `#strike[…]`
  call, inline code, an address, a backslash (measured: the label attaches in
  all of these). Heading text starting with `=`, `-`, `+`, `/` or a digit stays
  text.
  ```
  md : ## A #b            typ: == A \#b <h-a-b>
  md : ## see https://x.y typ: == see #link("https://x.y") <h-see-https-x-y>
  md : ## = x             typ: == = x <h-x>
  ```

- **AC-5 (composed: heading inside a blockquote or list item):** A heading
  inside a blockquote keeps its level and is emitted inside the `#quote` content
  block; the label is still unique document-wide.
  ```
  md : > ## Inside
  typ: #quote(block: true)[
         == Inside <h-inside>
       ]
  md : - ## X⏎  y
  typ: - == X <h-x>⏎⏎  y
  ```
  A heading inside a list item or a quote is a heading of the document (it
  takes part in the numbering and its label resolves; measured). A heading
  after a paragraph inside an item is separated by a blank line.

- **AC-6 (skipped levels are kept and reported):** `#` followed directly by
  `###` yields `=` then `===`; no heading is invented. One warning
  `HEADING_LEVEL_SKIPPED` is reported for the second heading with the message
  `Heading level jumps from 1 to 3` and its source line. The first heading of
  the document may start at any level without a warning. A level drop (`###`
  followed by `#`) is never reported.
  Composed: in `# A`, `### B`, `##### C` two warnings are reported (B: 1→3,
  C: 3→5), in that order. Headings inside quotes and list items count in
  document order (`# A` then `> ### B` warns 1→3). The jump is measured from
  the previous heading that was emitted (AC-7).

- **AC-7 (empty heading):** `##` with no text emits no heading and one warning
  `HEADING_EMPTY` (message `Empty heading omitted`) with the source line. A
  heading is empty when nothing is left
  of it after dropping comments, tags, breaks and blanks: `## <!-- x -->` and
  `## <br>` are empty (the comment is still counted by `COMMENT_DROPPED`); a
  heading holding only an embed, a footnote reference, or an image with empty
  alt text is not empty (its label is `h-section`; a wikilink gives its alias or
  `file#anchor`). An omitted heading gets no label, no
  duplicate suffix, and does not change the previous level of AC-6.
  ```
  md : # A⏎##⏎### B   -> = A <h-a>⏎⏎=== B <h-b>   warnings: HEADING_EMPTY line 2,
                                                     HEADING_LEVEL_SKIPPED line 3 (1 to 3)
  ```

---

## Notes

- The label prefix `h-` avoids labels starting with a digit.
- Automatic numbering was decided by the user: the vault compiler strips all
  numbers from the source text. How Typst counts when levels are skipped is
  checked in the test for AC-6 and documented there.
- Measured on the parsed tree of `The Rules/compiledtext.md` (2026-10-16): 655
  headings (8 / 64 / 98 / 218 / 190 / 77 for levels 1 to 6), **no skipped
  level**, 47 titles that occur more than once (158 repeats). An earlier count
  of 36 skipped levels and 56 repeated titles was wrong and is replaced.
- Measured with the compiler (probe `s17`): with `numbering: "1.1"` a level-3 to
  level-6 heading reads `1.1.1`, `1.1.1.1`, `1.1.1.1.1`, `1.1.1.1.1.1` (the
  pattern extends); a skipped level reads with a zero (`=`, `===` after `=`
  gives `2` then `2.0.1`).
- Depth > 6 cannot occur in Markdown input; the existing vault compiler already
  clamps and reports (see `The Rules/warnings_*.md`).

---

- Decided by the user 2026-10-16: first free suffix (AC-3b), breaks become one
  space (AC-4b), emptiness rule (AC-7), the pattern is checked in the preset
  (US-008 AC-13). The label text rule (AC-2c) and NFC (AC-2b) are the
  recommended defaults, to be confirmed with this story.
- Real file (census `spikes/markdown-parser/census-headings.mjs`): 655 headings,
  all plain text, none empty or multi-line, none with an empty slug, 655 unique
  labels with the AC-3 rule, longest label 63 characters; a label of 300
  characters works in Typst (measured).
- The labels and levels of all headings are computed once, before emission, by
  `indexHeadings` (document order), so that links can point forward (US-004).

---

## Related tickets

- [TICKET-014](../tickets/TICKET-014-headings-and-labels.md) — `slug`,
  `indexHeadings`, the heading emitter and `headingNumberingRule`.
