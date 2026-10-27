# US-005 — Convert tables, footnotes, and task lists

**Status:** Done (2026-10-17, AC-by-AC check; preamble rule by US-015, real `FontInfo` by US-010)
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author of a rules text,
**I want** tables, footnotes, and checklists to convert faithfully,
**so that** tables of stats and notes read correctly in print.

---

## Acceptance criteria

- **AC-1 (table with alignment):**
  ```
  md : | Name  | Cost |      typ: #table(
       |:------|-----:|            columns: 2,
       | Sword | 10   |            align: (left, right),
                                    table.header([Name], [Cost]),
                                    [Sword], [10],
                                  )
  ```
  Alignment `:---` = left, `:---:` = center, `---:` = right, `---` = left.

- **AC-1b (tables in lists and quotes):** A table inside a list item or a quote
  is indented with the content of its container (two blanks for a quote, the
  width of the marker for an item) and compiles. The real file has none; the
  parser can produce them.

- **AC-2 (formatting and special characters in cells):** A cell `**5** $` →
  `[*5* \$]`. A literal pipe `\|` in a cell is a literal `|`. Cells may contain
  links (US-004) and images (US-003).

- **AC-2b (line breaks in cells):** `<br>` inside a cell is a line break inside
  that cell (18 rows of `The Rules/compiledtext.md` use `<br><br>`). Two in a
  row make one empty line:
  ```
  md : | a<br>b | c<br><br>d |
  typ: [a#linebreak()b], [c#linebreak()#linebreak()d]
  ```
  Other multi-line forms (raw newlines inside a cell) do not exist in Markdown.

- **AC-3 (ragged rows):** A row with fewer cells than the header is padded with
  empty cells `[]`; a row with more cells is truncated and warning
  `TABLE_ROW_LONG` is reported with the source line.

- **AC-3b (empty cells, header-only and wide tables):** Measured with the
  bundled compiler (probe `s19`): all forms below compile.
  - An empty cell (135 in the real file) is emitted as `[]` and keeps its
    column.
  - A table with a header row and no body rows (line 5442 of the real file) is
    emitted in the layout of AC-1 with `table.header(...)` and no body rows.
  - A table with many columns keeps `columns: n` (equal automatic widths);
    cells wrap inside their column and a very long unbroken word may overflow
    its cell. No warning is reported; a layout rule for wide tables belongs to
    the style settings (backlog "Table rules").
  - A table without any header cell content (all header cells empty) is still
    emitted with `table.header`.

- **AC-4 (footnotes):**
  ```
  md : Text[^1].
       [^1]: The note.
  typ: Text#footnote[The note.];.
  ```
  (The full stop of the note stays inside the footnote; the one after the
  bracket belongs to the sentence. The `;` between the call and the `.` is the
  call separator of US-013 AC-13 and is not printed.) A note of one line is
  written `#footnote[text]`; a note of several blocks, a list or a line break
  is written in the block form `#footnote[` newline, the body indented by two
  blanks, newline `]`. The definition may appear anywhere in the file. Two references to one
  definition emit the note text twice. A reference without definition emits
  nothing and warning `FOOTNOTE_UNDEFINED`; a definition never referenced emits
  nothing and warning `FOOTNOTE_UNUSED`.

- **AC-4b (numbering restarts per chapter):** Footnote numbers restart at 1 at
  every level-1 heading. The preamble contains
  ```
  #show heading.where(level: 1): it => { counter(footnote).update(0); it }
  ```
  Example: chapter 1 contains three footnotes (1, 2, 3), chapter 2 two
  footnotes (1, 2), chapter 3 one (1). This includes the external-link footnotes
  of US-004. Footnotes before the first level-1 heading are numbered from 1 as
  well. (Decided by the user.) The test checks the printed numbers in the
  compiled PDF text.

- **AC-4c (inline footnotes):** `^[text]` is a footnote whose text is written
  in place; it behaves like AC-4 with a definition used once, shares the
  per-chapter numbering of AC-4b, and its text is parsed as inline Markdown.
  ```
  md : Text^[The *note*].
  typ: Text#footnote[The _note_].
  ```
  Brackets inside the text must balance (`^[a [b] c]`); an unclosed `^[` is
  literal text and one warning `FOOTNOTE_UNCLOSED` is reported with the line.
  `The Rules/compiledtext.md` has 15 inline footnotes.

- **AC-4d (nested notes, duplicates, parser reporting):** (Decided by the user.)
  - A footnote reference inside footnote text is omitted and warning
    `FOOTNOTE_NESTED` is reported with the line.
  - A heading inside a footnote definition becomes a plain paragraph; it is not
    indexed as a document heading (US-002).
  - If a label is defined twice, the first definition is used; each later one
    is reported as `FOOTNOTE_UNUSED`.
  - The parser reports what it drops through per-node flags (`extraCells` on a
    row, an unclosed-note flag on the inline), not through a warnings list; the
    US-014 `parse()` result keeps its shape. The emitter raises
    `TABLE_ROW_LONG` and `FOOTNOTE_UNCLOSED` from these flags.

- **AC-5 (composed: footnote text with formatting and a list):** `[^1]: *See*
  [[Tessera]]` becomes `#footnote[_See_ #link(<h-tessera>)[Tessera]]`. A footnote
  inside a table cell is emitted inside that cell.

- **AC-6 (task lists with glyph check):** The glyphs are `☐` (U+2610) and `☒`
  (U+2612). If the effective body font (US-010: body role, else default family)
  contains both:
  ```
  md : - [ ] a        typ: - ☐ a
       - [x] b             - ☒ b
  ```
  If the effective body font lacks either glyph, the plain notation is used
  instead, escaped for Typst:
  ```
  typ: - \[ \] a
       - \[x\] b
  ```
  and one warning `FONT_GLYPH_MISSING` is reported per export (not per item),
  with the message `Font "Libertinus Serif" lacks U+2610; task lists use [ ] / [x]`
  and the line of the first task item. Only the effective body font counts;
  other installed fonts that Typst might fall back to are not considered, so the
  result is deterministic. Nested task lists keep their nesting in both forms.
  If no `FontInfo` is injected, the plain notation is used silently, without
  a warning. (Decided by the user.)
  The font information is supplied through an injected `FontInfo` interface
  (`hasGlyph(family, codePoint)`); the core never reads font files (see
  US-010 AC-5 and AC-7).

---

## Notes

- Merged cells are not supported in Markdown and are out of scope; line breaks
  in cells are covered by AC-2b.
- Tables wider than the text block are a layout question: the user expects to
  handle them with layout rules (for example a page spread), see backlog "Page
  breaks and structure". No warning is raised here.

---

## Related tickets

- [TICKET-016](../tickets/TICKET-016-tables-footnotes-tasklists.md)
