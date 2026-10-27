# US-001 — Convert text, inline formatting, lists, quotes, and code to Typst

**Status:** Done (2026-10-17, AC-by-AC check: every AC has a passing test)
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author with a compiled single-file Markdown note,
**I want** the plugin to convert the text content of the note into valid Typst,
**so that** the text of my book survives the conversion unchanged in meaning
and compiles without errors.

---

## Acceptance criteria

Notation: `md` is the input Markdown, `typ` the expected Typst output.

- **AC-1 (paragraphs and inline formatting):**
  ```
  md : **bold**, *italic*, _italic_, `code`, ~~gone~~, ==marked==
  typ: *bold*, _italic_, _italic_, `code`, #strike[gone], #highlight[marked]
  ```
  Paragraphs are separated by exactly one blank line in the output.

- **AC-1d (blocks and the blank line between them):** The blocks of one level
  (the document, a list item, a quote) are separated by exactly one blank line,
  and the output has no blank line at its start or end. A block that produces
  no output (a paragraph that only held dropped comments or tags, an empty
  quote, a block comment) leaves no blank line behind. Two exceptions inside
  items and quotes are in AC-5b.
  ```
  md : a⏎⏎<!-- c -->⏎⏎b        typ: a⏎⏎b
  md : > ⏎⏎text                typ: text
  ```

- **AC-1c (text directly after a function form):** `#strike[…]`,
  `#highlight[…]`, `#underline[…]` and the function form of strong/emphasis are
  Typst calls; the next character may bind to the call (`.name`, `(`, `[`) or be
  swallowed (`;`). The emitter puts the invisible separator `;` between the call
  and the following text with `callSeparator` (US-013 AC-13); other followers
  get none. The rule is checked against the compiler for every function form and
  every follower (SCAR-009).
  ```
  md : ~~gone~~.Next          typ: #strike[gone];.Next
  md : ==x==(see p. 3)        typ: #highlight[x];(see p. 3)
  md : ~~a~~; b               typ: #strike[a];; b
  md : ~~a~~, b               typ: #strike[a], b
  md : x**y**(z)              typ: x#strong[y];(z)
  md : a/**b**                typ: a/#strong[b]          (US-013 AC-12b: no `/*`)
  ```

- **AC-2 (nested inline formatting):**
  ```
  md : **bold and _italic inside_ it**
  typ: *bold and _italic inside_ it*
  ```
  Formatting nested two levels deep is preserved. The parser reads `***both***`
  as emphasis around strong, so the output is `_*both*_` (Typst renders it the
  same as `*_both_*`; confirmed by the user 2026-10-16).

- **AC-2b (emphasis next to word characters and addresses):** Typst only reads
  `*…*` and `_…_` as emphasis when no word character touches the delimiter on
  exactly one side; `a*b*c` stays literal text, and `*b*c`, `a*b*` or an
  emphasis that ends in a web address do not compile (probe `s16`, findings
  file). The emitter therefore writes the delimiter form only when the source
  character before the opening and after the closing mark is not a letter or
  digit (whitespace, punctuation, line start or line end are fine) and the
  content does not end in an address or link; otherwise it writes the function
  form (`wrapEmphasis`, US-013 AC-12). Both forms render identically.
  ```
  md : a *b* c, (*b*), *b*.        typ: a _b_ c, (_b_), _b_.
  md : a*b*c                       typ: a#emph[b]c
  md : **word**s and x**y**        typ: #strong[word]s and x#strong[y]
  md : **https://example.org**     typ: *#link("https://example.org")*
  md : **see [x](https://a.org)**  typ: *see #link("https://a.org")[x]#footnote[#link("https://a.org")]*
  md : _(inner **x**)_             typ: _(inner *x*)_
  ```
  The last line shows that nesting decides per mark: the outer mark is next to
  line start and end, the inner mark next to `(`/`)` boundaries.

- **AC-3 (escaping of Typst-special characters):** Every character that has
  meaning in Typst markup is escaped when it is literal text in the note.
  ```
  md : Price: $5 for item #3 @ home, see \<here> and [there] ~ ok
  typ: Price: \$5 for item \#3 \@ home, see \<here\> and \[there\] \~ ok
  ```
  (`<here>` without the backslash is an HTML tag and is handled by AC-9/AC-9c;
  example changed with the user's approval 2026-10-16.)
  Also escaped: `\`, `*`, `_`, `` ` `` (when literal), `//` → `\/\/`.
  ```
  md : a\\b \* \_ \` x // y
  typ: a\\b \* \_ \` x \/\/ y
  ```

- **AC-4 (escaping at line start; typographic dashes kept):**
  ```
  md : = 5 apples          (a paragraph, not a heading)
  typ: \= 5 apples
  ```
  so Typst does not turn it into a heading. A paragraph starting with `+ `,
  `- `, `/ ` or `1. ` is escaped the same way when it was not a list in the Markdown.
  Typst's automatic typography is **kept** (decided by the user):
  ```
  md : wait -- what --- really...
  typ: wait -- what --- really...
  ```
  which Typst renders as "wait – what — really…" (en dash, em dash, ellipsis).
  The sequence `-?` (a Typst soft hyphen) is escaped as `\-?` so it stays
  literal. Text inside inline code and code blocks is never altered.

- **AC-4b (a line break starts a new line in Typst):** Text after a soft or a
  hard line break is at a line start, so the rules of AC-4 apply to it, also
  inside `*…*`/`_…_` and inside the content block of a function form (where the
  first text is a block start, US-013 AC-6). Directly after the opening `*` of a
  delimiter form the text is not at a line start and is not escaped.
  ```
  md : first⏎1986. A year      typ: first⏎1986\. A year
  md : first⏎= x               typ: first⏎\= x
  md : a␣␣⏎/ term              typ: a\⏎\/ term           (hard break by two spaces)
  md : **a⏎= b**               typ: *a⏎\= b*
  md : x**a⏎= b**              typ: x#strong[a⏎\= b]
  md : ~~- x~~                 typ: #strike[\- x]
  md : **- x**                 typ: *- x*
  ```
  (`⏎` marks a line break in the source and in the output.)

- **AC-5 (lists, including nesting):** Markers `-`, `*` and `+` are all
  bullet lists; one tab or 2/4 spaces of indentation is one nesting level
  (`The Rules/compiledtext.md` has 7 tab-indented nested lists).
  ```
  md : * a                   (a tab before the next line)
       \t* b
  typ: - a
         - b
  ```
  The general example:
  ```
  md : - a
         - b
           1. c
           2. d
  typ: - a
         - b
           1. c
           2. d
  ```
  Ordered lists keep their start number (`3. x` stays `3. x`). Nesting is
  preserved at every depth up to at least 5 levels. A list inside a blockquote
  stays inside the quote (see AC-6).

- **AC-5b (layout of lists, measured with the compiler, probes `s23` and `s24`):**
  Item content is indented by the width of its marker (`- ` is 2, `10. ` is 4);
  a blank line between lines is written empty, without trailing blanks.
  Every ordered item carries its own number (start plus position), so the
  numbering is right for `0.`, for a start of 9 digits and for two lists in a
  row. The first block of an item starts on the marker line. The blocks of an
  item are separated by a blank line, except a list that directly follows a
  paragraph (also in a quote, AC-6), which starts on the next line. An empty
  item is the marker alone. Two lists in a row get no separator; Typst reads
  them as one list (same content, the spacing of a wide list), and explicit
  numbers keep ordered lists right.
  ```
  md : - a⏎- b                 typ: - a⏎- b
  md : 3. x⏎5. y               typ: 3. x⏎4. y          (the number is start + position)
  md : 1. a⏎   - b             typ: 1. a⏎   - b
  md : 10. a⏎⏎    b            typ: 10. a⏎⏎    b
  md : - a⏎  - b⏎⏎  c          typ: - a⏎  - b⏎⏎  c
  md : - ```js⏎  x⏎  ```       typ: - ```js⏎  x⏎  ```
  md : -⏎- b                   typ: -⏎- b
  md : - a⏎⏎* b                typ: - a⏎⏎- b
  md : - [ ] t⏎- [x] u         typ: - t⏎- u   + warnings NODE_UNSUPPORTED "No emitter for task item; its text is kept" (2, until US-005 AC-6)
  ```

- **AC-6 (blockquotes, composed):**
  ```
  md : > quoted *text*
       > - item
  typ: #quote(block: true)[
         quoted _text_
         - item
       ]
  ```
  A blockquote inside a list item, and a blockquote inside a blockquote,
  each produce one `#quote` per level.

- **AC-6b (layout of quotes):** A quote is `#quote(block: true)[`, its content
  indented by 2, and `]` alone on a line, at the indentation of the quote. A
  quote inside a quote or an item is indented with its parent. Lists and code
  blocks inside a quote keep working because Typst removes the common
  indentation of a raw block (probe `s23`).
  ```
  md : > a⏎> ⏎> b              typ: #quote(block: true)[⏎  a⏎⏎  b⏎]
  md : > - x⏎> > y             typ: #quote(block: true)[⏎  - x⏎⏎  #quote(block: true)[⏎    y⏎  ]⏎]
  md : > ```⏎> c⏎> ```         typ: #quote(block: true)[⏎  ```⏎  c⏎  ```⏎]
  md : - a⏎⏎  > q              typ: - a⏎⏎  #quote(block: true)[⏎    q⏎  ]
  ```

- **AC-7 (code):** Inline code and fenced blocks keep their content verbatim.
  A fenced block whose content contains a run of N backticks is emitted with a
  fence of N+1 backticks, the language tag is kept.
  ````
  md : ```js
       let a = `x`;
       ```
  typ: ```js
       let a = `x`;
       ```
  ````
  Content containing ```` ``` ```` is emitted with a four-backtick fence.

- **AC-7b (details of code blocks):** The content has no final line break
  (US-014). An empty block is the fence with one empty line. An indented code
  block (4 spaces) is a block without language; of a fence info string only the
  first word is the language (`js title="x"` → `js`). Inside an item or a quote
  every non-empty line of the block, including both fence lines, gets the
  indentation of the container (AC-5b, AC-6b); empty lines stay empty. The
  one-line form `#raw(block: true, lang: …, "…")` (AC-7, tags like `c++`) needs
  no indentation.
  ```
  md : ```⏎```                 typ: ```⏎⏎```
  md :     indented⏎    code   typ: ```⏎indented⏎code⏎```
  md : - a⏎⏎  ```⏎  x⏎⏎  y⏎  ```   typ: - a⏎⏎  ```⏎  x⏎⏎  y⏎  ```
  ```

- **AC-8 (hard breaks and rules):** Two trailing spaces or a trailing `\` in
  Markdown become `\` + newline in Typst. A thematic break (`---` between
  paragraphs) becomes `#line(length: 100%)`.

- **AC-8c (soft breaks and the edges of a paragraph):** A soft line break in
  the source stays a line break in the output, so that source lines and output
  lines keep matching for the line map (US-015 AC-9); Typst reads it as a
  space. A break at the start or the end of the inline content is dropped, and a
  soft break that directly follows another break (possible when a comment
  between them was dropped, AC-15) is dropped, so that an output paragraph never
  contains an empty line and never splits.
  ```
  md : line one⏎line two      typ: line one⏎line two
  ```

- **AC-9 (inline HTML seen in real input):** `<u>x</u>` → `#underline[x]`,
  `<span>x</span>` → `x` (unwrapped), `<br>` → line break. Any other HTML tag is
  dropped, its inner text kept, and one warning `HTML_UNSUPPORTED` is reported
  (see US-006). `The Rules/compiledtext.md` contains `[<u><span>https://…</span></u>](…)`;
  this must convert to `#link("https://…")[#underline[https://…]]`.

- **AC-9b (pairing of HTML tags):** The parser delivers `<u>` and `</u>` as two
  separate inline nodes (US-014); the converter pairs them. An opening tag is
  paired with the next closing tag of the same name within the same parent
  node (same paragraph, heading, cell or link label), with other tags
  allowed in between if they are balanced. Rules for what does not pair:
  ```
  md : a <u>b c            typ: a b c      (open tag never closed: tag dropped, text kept)
  md : a b</u> c           typ: a b c      (closing tag without opener: dropped)
  ```
  Each unpaired tag reports `HTML_UNSUPPORTED` once, with the line of the tag
  (US-006). A tag pair that is split by a block boundary (open tag in one
  paragraph, close tag in the next) counts as two unpaired tags. Markdown
  formatting inside a pair is kept: `<u>**b**</u>` → `#underline[*b*]`.
  A pair that would cross other formatting (`<u>a *b</u> c*`) is not
  defined here: the parser's tree decides, and the result must still compile and
  lose no text (US-013 AC-12).

- **AC-9c (other tags, attributes, forms of `<br>`):** Each dropped tag reports
  its own `HTML_UNSUPPORTED` with the line of the tag, so `<font>x</font>`
  reports two (decided by the user 2026-10-16 as the reading of "one warning per tag" in
  AC-9; the real input contains only `<u>`, `<span>` and `<br>`). Attributes
  are ignored (`<u class="a">x</u>` is underline), tag names are case-insensitive,
  `<br/>` and `<br />` are line breaks, `</br>` is a closing tag without opener
  (AC-9b). Markup that is not a tag (`<?x?>`, `<![CDATA[x]]>`) is kept as literal
  escaped text without a warning.
  ```
  md : a <font color="red">b</font> c
  typ: a b c
  warnings: HTML_UNSUPPORTED "Unsupported HTML tag <font> dropped"  line 1
            HTML_UNSUPPORTED "Unsupported HTML tag </font> dropped" line 1
  md : x<BR/>y                typ: x\⏎y
  md : <?x?>                  typ: \<?x?\>
  ```
  The message texts are exact: `Unsupported HTML tag <name> dropped` (closing
  tags `</name>`), `Unpaired HTML tag <name> dropped` for AC-9b.

- **AC-9d (HTML blocks):** A block of HTML (a tag alone on a line, or a
  `<div>` block; none in `The Rules/compiledtext.md`) is not Markdown: its text
  is kept, its tags are handled exactly like inline tags (AC-9, AC-9b, AC-9c:
  `<br>` a line break, `<u>` underline, `<span>` unwrapped, others dropped with
  `HTML_UNSUPPORTED`, comments dropped with the count of AC-15), each warning
  with the line of the tag inside the block. The lines of the block become
  soft breaks; an HTML block whose output is empty (only `<br>`) is dropped.
  ```
  md : <div>⏎x <b>y</b>⏎</div>    typ: x y
  warnings: HTML_UNSUPPORTED "Unsupported HTML tag <div> dropped" line 1
            HTML_UNSUPPORTED "Unsupported HTML tag <b> dropped" line 2
            HTML_UNSUPPORTED "Unsupported HTML tag </b> dropped" line 2
            HTML_UNSUPPORTED "Unsupported HTML tag </div> dropped" line 3
  ```

- **AC-10 (frontmatter):** A leading YAML frontmatter block is removed from the
  output body and does not produce text.

- **AC-11 (validity gate):** For every note of the sample vault
  `tests/fixtures/sample/` (US-024: `Book.md`, `Other.md`), the generated
  `.typ` compiles with zero errors using the bundled compiler (US-007).

- **AC-12 (determinism):** Converting the same input twice with the same
  settings yields byte-identical `.typ` output.

- **AC-14 (Obsidian tags are literal text):** `#tag` is not a Typst
  construct and not converted to anything special; it is escaped as text. About
  400 tags occur in `The Rules/compiledtext.md`, many inside table cells.
  ```
  md : Needs #tessera and #prism/fire.     typ: Needs \#tessera and \#prism/fire.
  md : | #a | b |                         typ: [\#a], [b]
  ```
  No warning. Styling of tags is a later feature.

- **AC-15 (HTML comments are dropped, with one summary warning):** `<!-- … -->`
  (also across lines, also inside table cells and inside list items) is removed
  and leaves no text and no empty line. One warning `COMMENT_DROPPED` per export
  with the count and the line of the first comment:
  ```
  md : Text <!-- TBLFM: $3=$1*2 --> more
  typ: Text  more                      (the two spaces stay; Typst collapses them)
  warning: COMMENT_DROPPED  "41 HTML comments dropped"  line of the first one
  ```
  The message is `N HTML comments dropped`, and `1 HTML comment dropped` for a
  single one (confirmed by the user 2026-10-16); the line is that of the first comment in document order. The
  count is collected while the text is emitted and the one warning is created
  when the export ends (`EmitContext.finish()`). A comment alone on a line removes that line. `The Rules/compiledtext.md`
  contains 41 comments (render failures of the diagram tool and table formulas),
  so the warning appears for it.

- **AC-15b (block comments):** A comment that stands alone on its lines is a
  block of its own (all 41 of the real file). It is removed and counted for the
  `COMMENT_DROPPED` summary of AC-15, also inside a list item or a quote, and
  leaves no empty line (AC-1d).
  ```
  md : a⏎⏎<!-- c -->⏎⏎b        typ: a⏎⏎b          + COMMENT_DROPPED "1 HTML comment dropped" line 3
  ```

- **AC-16 (blocks that other stories convert; historic, superseded by US-005):**
  The wording below described the state before US-005. Tables, footnote
  definitions and task items now have their emitters (US-005); the fallback
  (`NODE_UNSUPPORTED`, text kept) stays for node kinds without an emitter and is
  tested as US-015 AC-12. Until US-005 (tables,
  footnote definitions, task items) provides its emitters, these blocks keep
  their text and report `NODE_UNSUPPORTED` once per node (US-015 AC-12, message
  `No emitter for <kind>; its text is kept`): a table is one paragraph per row
  with the cells separated by ` | `, a footnote definition is its blocks, a task
  item is a normal item. (Headings were converted by US-002, TICKET-014, and no
  longer fall back.)
  ```
  md : | a | b |⏎|---|---|⏎| c | d |   typ: a | b⏎⏎c | d   + NODE_UNSUPPORTED table
  ```

- **AC-13 (configurable highlight colour):** The preset field `highlightColor`
  (hex, default `#ffeb3b`, a yellow) is emitted once in the preamble:
  ```
  #set highlight(fill: rgb("#ffeb3b"))
  ```
  Setting it to `#a5d6a7` emits `rgb("#a5d6a7")` and `==marked==` keeps
  producing `#highlight[marked]`. A value that is not `#` plus 6 hex digits is
  rejected in the settings UI and the previous value is kept.

---

## Notes

- Math (`$…$`, `$$…$$`) is not covered here. LaTeX math and Typst math are
  different syntaxes; see backlog item "Math (LaTeX subset)" in the index.
- The escaping lives in `core/emit` and is specified by [US-013](US-013-typst-safe-output.md)
  (AC-3/AC-4 here stay as end-to-end examples; US-013 adds the cases they missed:
  `@`, numbered-list markers `1. `, indented line starts, line starts after a
  newline and inside `[…]` blocks). Every new call site must document its
  transforms (SCAR-001).
- Blockquote appearance is deliberately plain here; it is controlled later by
  the style system (backlog "Marking content"), as decided by the user.
- All HTML other than `<u>`, `<span>`, `<br>` is dropped with a warning
  (decided by the user). HTML comments are the exception (AC-15, decided by the
  user 2026-10-16).
- TICKET-013 builds the block emitter (AC-1d, AC-5, AC-5b, AC-6, AC-6b, AC-7, AC-7b, AC-8
  `---`, AC-9d, AC-10, AC-15b, AC-16).
- Scope of the converter-core tickets for this story: TICKET-012 builds the inline
  emitter (AC-1 marks, AC-1c, AC-2, AC-2b without link output, AC-3, AC-4,
  AC-4b, AC-8 hard break, AC-8c, AC-9, AC-9b, AC-9c, AC-14, AC-15 inline). Block
  elements (paragraph spacing, lists, quotes, code blocks, `---`, frontmatter,
  block-level comments) follow in later tickets; links, images, wikilinks and
  footnote references are emitted by the stories that own them (US-003 to
  US-005) and until then reach the output through the `NODE_UNSUPPORTED`
  fallback of US-015 AC-12 with their text kept.
- Which Markdown parser produces the syntax tree is decided by
  [US-014](US-014-markdown-parsing.md). The ACs here describe the behaviour
  independent of that choice.

---

## Related tickets

- [TICKET-011](../tickets/TICKET-011-call-separator-and-slash-rule.md) — shared emit rules this story relies on (AC-1c, AC-2b)
- [TICKET-012](../tickets/TICKET-012-inline-emitter.md) — inline text emitter
- [TICKET-013](../tickets/TICKET-013-block-emitter.md) — block emitter (lists, quotes, code, rules, HTML blocks, block comments)
