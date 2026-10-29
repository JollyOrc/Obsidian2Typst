# Book structure

[Back to the manual](manual.md)

These settings turn a long note into a book: chapters that start on a new or
a right page, a colophon and a table of contents at the front, notes at the
end, roman page numbers in the front matter, and a page count that fits the
printer's sheets.

All of them are off by default, so a note exports as a plain document until
you switch them on. They are set in a preset note or in the Defaults rows of
the settings tab (except where noted).

## Contents

- [Page breaks before headings](#page-breaks-before-headings)
- [Colophon and back notes](#colophon-and-back-notes)
- [Front matter and the first chapter](#front-matter-and-the-first-chapter)
- [Signatures](#signatures)
- [Table of contents](#table-of-contents)
- [A complete example](#a-complete-example)

## Page breaks before headings

`page.breakBefore` sets, per heading level, what happens before a heading:

| Rule | Effect |
| --- | --- |
| `none` (built-in) | no break |
| `page` | the heading starts a new page |
| `right` | the heading starts on the next right (odd) page |
| `left` | the heading starts on the next left (even) page |

```yaml
page:
  breakBefore:
    h1: right
    h2: page
```

In the settings tab these are the rows **Break before H1** to **Break before
H6** (`—` means not set).

- To reach a left or right page, a blank page may be added. It prints its
  page number (if page numbers are on) and nothing else.
- Without facing pages, `right` and `left` act like `page`.
- When headings follow each other with nothing between them, there is one
  break, before the first. The stronger rule wins: a side beats `page`; of
  two different sides, the first heading's counts. A heading that already
  starts a page gets no further break.
- Only headings at the top level of the note break, not headings in callouts,
  quotes, lists or footnotes, and not glossary terms.
- The rule applies to the first heading of the note, too: a note that starts
  with `# One` and `h1: left` begins with a blank page.

## Colophon and back notes

The **colophon** (imprint) is the page at the front with the title, credits
and copyright. The **back notes** are pages at the very end of the book.

Mark them with a heading. The built-in heading rules are:

```markdown
# Colophon

© 2026 The Author. Printed by …

# Rules
…

# Back notes

Notes for the game master.
```

Any other heading text works with a [heading rule](glossary-and-heading-rules.md)
in the preset:

```yaml
headingRules:
  Imprint: colophon
  Notes for the table: back-notes
```

The section runs from the heading to the next heading of the same or a higher
level. It is taken out of the body and placed:

- the colophon on the next right page at the front: after a cover, page 3
  (page 2, the back of the cover, stays empty);
- the back notes on a new page after the body, ending on the last page.

The headings are **hidden** by default: the text of the section is printed,
its heading is not. Set them to `printed` to show them (then they are
numbered and listed in the table of contents):

```yaml
book:
  colophonHeading: hidden      # hidden or printed
  backNotesHeading: hidden
```

Links to a hidden heading still work. The colophon and the back notes print
their page number, but no running header.

Two sections of one kind are joined into one, with the warning
`BOOK_PART_JOINED`. A section with a hidden heading and no text is left out
(`BOOK_PART_EMPTY`).

If your note has a heading `Colophon` or `Back notes` that should stay where
it is, switch the rule off in the preset: `Colophon: none`.

## Front matter and the first chapter

The **front matter** is everything before the first chapter: the colophon,
the table of contents (at its default place) and any text before the first
`#` heading. The **first chapter** is the first `#` heading of the body.

When the book has front matter, the first chapter starts on a new spread:

```yaml
book:
  firstChapter: left       # left (built-in) or right
  romanFrontMatter: false  # true: i, ii, iii in the front matter
```

`firstChapter` replaces the `breakBefore.h1` rule for that heading.

With `romanFrontMatter: true`, the front matter pages are numbered `i`,
`ii`, `iii`, … (counting from the first page, so the colophon after a cover
is `iii`) and the first chapter is `1`. With `false`, the front matter
pages print no number and the first chapter is `1`. A page reference to a
front matter page then prints the count of that page in the PDF, cover
included.

Example with a cover, a colophon and one page of contents, roman numbers on:

| Page | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| `firstChapter: left` | cover | empty | colophon `iii` | contents `iv` | blank `v` | chapter `1` |
| `firstChapter: right` | cover | empty | colophon `iii` | contents `iv` | chapter `1` | |

Without front matter (no colophon, no contents) these settings change
nothing.

## Signatures

A printed book is bound from sheets folded into **signatures** of 4, 8, 16 or
32 pages. Set the number of pages per signature, and the plugin adds blank
pages so that the total page count, cover included, is a multiple of it:

```yaml
book:
  signature: 16     # 0 (built-in, no padding), 4, 8, 16 or 32
```

The blank pages go before the back notes (which stay on the last pages), or at
the end when there are none. They print their page number only.

## Table of contents

```yaml
toc:
  depth: 2           # 0 (built-in, no contents) to 6
  title: "Contents"  # "" for no title
  pageNumbers: true
  dotLeaders: true   # dots between entry and page number
```

The settings tab rows are **Contents depth**, **Contents title**, **Contents
page numbers** and **Contents dot leaders**.

The table lists the headings of the body down to `depth`, with their numbers
and pages; each entry is a link. It does not list glossary terms, headings
inside callouts, quotes or lists (they stay in the PDF bookmarks), or hidden
colophon and back-notes headings. The contents start on a new page and print
their page number but no running header.

### Where the contents go

By default the contents are front matter: on the page after the colophon, or,
without a colophon, on the next right page (page 3 after a cover).

To place them at a heading, click into a top-level `#` heading in the editor,
right-click, and choose **Table of contents before this heading** or **Table
of contents after this heading**. After the question this writes, into the
active preset:

```yaml
toc:
  heading: "Rules"
  position: before     # or after
```

If the depth is still 0, the same question also sets `depth: 2`. On the
heading and side already chosen, the item reads **Remove table of contents
placement**.

- `before`: right before that heading.
- `after`: after that heading's whole section, before the next `#` heading
  (or before the back notes, if it is the last).

Contents placed after the first chapter are part of the body and get arabic
page numbers. If the heading is not found, the contents go to the default
place with the warning `TOC_HEADING_MISSING`. `toc.heading` and
`toc.position` exist only in preset notes.

## A complete example

```yaml
---
schemaVersion: 1
page:
  breakBefore:
    h1: right
book:
  signature: 16
  romanFrontMatter: true
  firstChapter: right
toc:
  depth: 2
images:
  minScale: 70
---
```

With a cover image at the start of the note, a `# Colophon` section and
`# Back notes` at the end, this gives: the cover, an empty page 2, the
colophon on page iii, the contents on page iv (if they fit on one page),
every chapter on a right page
starting with chapter 1, blank pages to reach a multiple of 16, and the back
notes on the last pages.
