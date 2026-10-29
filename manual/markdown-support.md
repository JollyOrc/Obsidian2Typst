# Markdown support

[Back to the manual](manual.md)

The plugin converts one note. Everything that is printed comes from that
note; other notes are not pulled in. Special characters in your text are
always printed as written (a `#`, `*` or `$` in the text never turns into
Typst code).

## Contents

- [Text](#text)
- [Headings](#headings)
- [Lists, quotes and code](#lists-quotes-and-code)
- [Tables](#tables)
- [Footnotes](#footnotes)
- [Links](#links)
- [Images and callouts](#images-and-callouts)
- [Left out or not converted](#left-out-or-not-converted)

## Text

| In the note | In the PDF |
| --- | --- |
| `**bold**` | **bold** |
| `*italic*`, `_italic_` | *italic* |
| `~~gone~~` | struck through |
| `==marked==` | highlighted in the highlight colour (built-in `#ffeb3b`, setting `highlightColor`) |
| `` `code` `` | in the code font |
| `<u>text</u>` | underlined |
| two spaces or `\` at the end of a line | a line break |
| `---` between paragraphs | a horizontal line |
| `#tag` | printed as the text `#tag` |

## Headings

`#` to `######` become headings, numbered automatically (see
[Page layout](page-layout.md#heading-numbering)). Every heading is a link
target. Two headings with the same text are both printed; a link to that
text goes to the first one (`LINK_AMBIGUOUS`).

A skipped level (`#` then `###`) is kept and reported
(`HEADING_LEVEL_SKIPPED`). An empty heading is left out (`HEADING_EMPTY`).
A heading under a glossary heading may become a glossary term, see
[Glossary and heading rules](glossary-and-heading-rules.md).

## Lists, quotes and code

- Bulleted, numbered and nested lists are converted with their nesting.
- Task lists (`- [ ]`, `- [x]`) print ☐ and ☒ if the body font has them,
  else `[ ]` and `[x]`.
- Quotes (`>`) become indented quote blocks; they can hold lists, tables and
  further quotes.
- Code blocks keep their content exactly, in the code font.

## Tables

Tables keep their column alignment (`:---`, `:---:`, `---:`). Cells can hold
formatting, links and images. A row with more cells than the header is cut
(`TABLE_ROW_LONG`); missing cells are left empty.

## Footnotes

`[^1]` with its definition `[^1]: text`, and inline footnotes `^[text]`,
become footnotes at the bottom of the page. Numbering starts again at 1 with
every `#` heading. Footnote problems are reported (`FOOTNOTE_UNDEFINED`,
`FOOTNOTE_UNUSED`, `FOOTNOTE_UNCLOSED`, `FOOTNOTE_NESTED`).

## Links

**Web links** stay clickable. Because a reader of the printed book cannot
click, the address is also printed as a footnote:
`[Site](https://example.org)` prints `Site¹` with the footnote
`https://example.org`. Switch this off with **Footnotes for external links**
(`externalLinkFootnotes: false`). A link whose text is the address gets no
footnote.

**Internal links** point to headings of the same note and become links in the
PDF, optionally with the page number (see
[Page layout](page-layout.md#page-numbers-after-links)):

| In the note | Goes to |
| --- | --- |
| `[[Tessera]]`, `[[#Tessera]]`, `[[Rules#Tessera]]` | the heading `Tessera` |
| `[[Tessera\|fighting]]` | the heading `Tessera`, shown as `fighting` |
| `[x](#tessera)` | the heading `Tessera` |
| `[x](Other%20note.md#Tessera)` | the heading `Tessera` in this note |

Links to other notes are looked up as headings **of this note**. This suits a
note that was compiled from several notes, where each note became a heading.
A link that matches no heading is printed as plain text with
`LINK_UNRESOLVED`; block references (`[[Note#^id]]`) are never resolved.

**Links to other files** (for example a PDF in the vault) print their text
with the path as a footnote; the file is not copied.

## Images and callouts

See [Images and the cover](images-and-cover.md) and
[Callout styles](callouts.md).

## Left out or not converted

| In the note | What happens |
| --- | --- |
| Frontmatter (properties) | left out |
| HTML comments `<!-- -->` | left out, with one `COMMENT_DROPPED` warning |
| Other HTML tags | the tag is dropped, the text kept (`HTML_UNSUPPORTED`) |
| `![[Other note]]` | not included; the note's name is printed (`EMBED_NOTE_UNEXPANDED`) |
| Math (`$…$`) | not converted yet; printed as written, dollar signs included |
