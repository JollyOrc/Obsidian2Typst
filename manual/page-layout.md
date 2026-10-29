# Page layout

[Back to the manual](manual.md)

This guide covers the page geometry, page numbers, the running header, page
numbers after links and heading numbering. Page breaks, the colophon and the
table of contents are in [Book structure](book-structure.md).

## Contents

- [Page size and margins](#page-size-and-margins)
- [Facing pages](#facing-pages)
- [Page numbers and running header](#page-numbers-and-running-header)
- [Page numbers after links](#page-numbers-after-links)
- [Heading numbering](#heading-numbering)

## Page size and margins

All page values are in millimetres and live under `page` in a preset note or
in the Defaults rows of the settings tab.

```yaml
page:
  trimSize: A5          # or trimWidth and trimHeight
  margins:
    top: 18
    bottom: 22
    inside: 15
    outside: 15
  gutter: 5
  bleed: 3
  slug: 0
  facingPages: true
```

**Trim size** is the size of the finished, cut page. Named sizes:

| Name | Width × height |
| --- | --- |
| `A4` | 210 × 297 mm |
| `A5` | 148 × 210 mm (built-in) |
| `A6` | 105 × 148 mm |
| `US Letter` | 215.9 × 279.4 mm |

For any other size, set `trimWidth` and `trimHeight`; they win over
`trimSize`. In the settings tab, choose `Custom` in the Trim size dropdown and
enter both values; they are saved together, never one alone. Choosing a named
size again asks before it removes the custom values.

**Bleed** is extra area on all four sides that the printer cuts away;
pictures that should reach the edge of the page must reach into it. **Slug**
is a further empty strip outside the bleed for crop marks (the plugin does
not draw crop marks yet). The PDF page is the trim size plus twice the bleed
plus twice the slug. Example: A5 with bleed 5 gives a 158 × 220 mm PDF page.

Rules that make a value invalid:

- every value is a number of at least 0;
- trim width and height are at least 50 mm;
- the text area must stay at least 30 mm wide and 30 mm high, for example
  `Text block would be only 23 mm wide (minimum 30 mm)`.

## Facing pages

With `facingPages: true` (built-in) the book has left and right pages. Page 1
is a right page. The **inside** margin is at the binding, the **outside**
margin at the outer edge, and the **gutter** is added to the inside margin
for the binding.

With `facingPages: false` every page has `inside` on the left and `outside`
on the right, and the gutter is not used. In the settings tab the Gutter row
can only be edited while the Facing pages switch of the Defaults is on. The
switch shows off while it is not set, even though the built-in value is on.

Facing pages also decide where page numbers stand and whether pages can be
added to reach a left or right page (see [Book structure](book-structure.md)).

## Page numbers and running header

```yaml
page:
  folios: true             # page numbers; built-in true
  runningHeader: true      # chapter title at the top; built-in true
  runningHeaderLevel: 2    # 1 to 6; built-in 2
```

**Page numbers** (folios) are printed in the footer at 0.9 × the body size:
at the outer edge with facing pages (right on right pages, left on left
pages), centred without. Numbering starts at 1 on the first page of the body;
the cover and the blank page after it have no number.

**The running header** shows a title, centred, at the top of a body page. For
level 2 (the built-in) the rules are, in order:

1.  On a page where a level-1 heading starts: no header.
2.  Otherwise the first level-2 heading that starts on the page.
3.  Otherwise the last heading before the page with level 1 or 2.
4.  If there is none: no header.

With another level the same rules apply with that level. The title is the
heading text without its number. Glossary terms are never used as titles.

Example (level 2):

| Page | Header |
| --- | --- |
| `# Rules` starts here | empty |
| `## Combat` starts here | Combat |
| the page after, no new heading | Combat |
| `# Appendix` starts here | empty |
| the page after, no `##` yet | Appendix |

Pages added to reach a left or right page print their page number only. The
colophon, contents and back notes pages print no header. With both switches
off, nothing is printed in header or footer. A [template](templates.md) that
sets its own header or footer keeps it for each part you switch off.

## Page numbers after links

An internal link can print the page of its target, so the reader of the
printed book can find it:

```text
see Tessera (p. 42)
```

```yaml
linkPageNumbers: true   # built-in true
linkPageLevel: 2        # whole number 1 to 6; built-in 2
linkPageWord: "p."      # built-in "p."; for German "S."
```

A link gets the page number when:

1.  `linkPageNumbers` is on **and** page numbers (`page.folios`) are on;
2.  the link is not inside a heading;
3.  its target is a heading of level 1 to `linkPageLevel`, **or** the link
    stands in a glossary term's explanation (then always).

| `linkPageLevel` | Link to | In the body | In a glossary explanation |
| --- | --- | --- | --- |
| 1 | `# Rules` | (p. N) | (p. N) |
| 1 | `## Tessera` | — | (p. N) |
| 2 | `## Tessera` | (p. N) | (p. N) |
| 2 | `### Moss` | — | (p. N) |
| 3 | `### Moss` | (p. N) | (p. N) |

A link to a glossary term counts with the level of the term's heading in the
note. Links that cannot be resolved get no number.

The number is the page number as printed on the target's page. The built-in
preset `A4 digital` switches the numbers off, since a screen PDF has
clickable links.

## Heading numbering

`headingNumbering` holds a Typst numbering pattern; headings are numbered
automatically (you do not type the numbers in the note).

| Value | Result |
| --- | --- |
| `"1.1"` (built-in) | 1, 1.1, 1.2, 2, 2.1 |
| `"a.1"` | a, a.1, a.2, b |
| `"(1.1)"` | (1), (1.1) |
| `none` | no numbers |

A pattern needs at least one counting symbol (`1`, `a`, `A`, `i`, `I` and
others Typst accepts). A pattern without one, such as `"x"`, gives the notice
`Invalid heading numbering; "1.1" is used`.

Glossary terms and headings inside a glossary term are not numbered (see
[Glossary and heading rules](glossary-and-heading-rules.md)).
