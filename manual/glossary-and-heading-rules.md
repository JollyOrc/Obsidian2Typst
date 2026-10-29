# Glossary and heading rules

[Back to the manual](manual.md)

A **heading rule** gives a section of your note a special role, chosen by the
heading's text. There are three rules:

| Rule | What it does | Built-in heading |
| --- | --- | --- |
| `glossary` | The headings one level below become glossary entries. | `Glossary` |
| `colophon` | The section becomes the colophon at the front of the book. | `Colophon` |
| `back-notes` | The section goes to the very end of the book. | `Back notes` |

This guide covers the glossary and how to set up heading rules. The colophon
and back notes are described in
[Book structure](book-structure.md#colophon-and-back-notes).

## Contents

- [Setting heading rules](#setting-heading-rules)
- [Which headings match](#which-headings-match)
- [The glossary](#the-glossary)
- [Using the menu](#using-the-menu)

## Setting heading rules

Heading rules are set in preset notes only, under `headingRules`. Each line
maps a heading text to a rule, or to `none` to switch a rule off:

```yaml
headingRules:
  Glossar: glossary          # a German glossary heading
  Imprint: colophon
  Notes for the table: back-notes
  Glossary: none             # switch the built-in glossary rule off
```

The built-in rules `Glossary: glossary`, `Colophon: colophon` and
`Back notes: back-notes` always apply unless the preset maps the same text
to something else. A heading text may appear only once (compared without
case and trailing blanks).

## Which headings match

A heading matches when its visible text equals the key, ignoring case,
formatting and extra blanks:

| Heading in the note | Matches `Glossary`? |
| --- | --- |
| `# Glossary` | yes |
| `# glossary` | yes |
| `## **Glossary**` | yes (formatting is ignored) |
| `# ![x](i.png) Glossary` | yes (image text is ignored) |
| `# Glossary:` | no |
| `# The Glossary` | no |

Any heading level from 1 to 5 can match. Only headings at the top level of the
note count, not headings inside a callout, quote or list.

## The glossary

Under a matched heading of level *n*, every heading of level *n* + 1 is a
**term**. The section ends at the next heading of level *n* or higher.

```markdown
# Glossary

Terms used in this book.

## Gambit

A thing you can do. Two per round.

## Tidal Basin

The pool of dice.

# Index
```

In the PDF:

- `Glossary` stays a numbered heading.
- `Terms used in this book.` stays a paragraph (text before the first term is
  an introduction).
- Each term is printed in bold at the start of its first paragraph, followed
  by a dash: **Gambit** — A thing you can do. Two per round.
- `# Index` ends the glossary and is a normal heading.

Terms are not headings in the PDF: they have no number, no entry in the table
of contents or the PDF bookmarks, and the next heading is numbered as if they
were not there. They are never used in the running header.

More details:

- **A term without a first paragraph** (its explanation starts with a list,
  table, image, callout, or is empty) is printed in bold on its own line, kept
  with what follows, without a dash.
- **Links to terms** keep working: `[[#Tidal Basin]]` or
  `[Tidal Basin](#tidal-basin)` from anywhere in the note jump to the term,
  with a page number as described in
  [Page layout](page-layout.md#page-numbers-after-links). Every link inside a
  term's explanation gets a page number.
- **A deeper heading inside a term** (`###` under `## Gambit`) is printed as
  a heading without number and contents entry, with the warning
  `HEADING_IN_TERM`.
- **A glossary heading with no terms** below it changes nothing and gives
  `HEADING_RULE_NO_TERMS`.
- A note can have several glossary sections.
- Page breaks before headings (see [Book structure](book-structure.md)) do not
  apply to terms; the glossary heading itself breaks by its level.

## Using the menu

Instead of editing the preset, click into a heading line in the editor,
right-click, and choose **Use as glossary section**. After the question
(for example `Add "Glossar" → glossary to the heading rules of preset
"A5 print"?`) the rule is written into the active preset. On a heading that
already is a glossary, the item reads **Stop using as glossary section**.

The item is offered on headings at the top level of the note that are not
inside a glossary section. The plugin writes the smallest change: for
example, stopping the built-in `Glossary` rule adds `Glossary: none`, and
starting it again removes that line.
