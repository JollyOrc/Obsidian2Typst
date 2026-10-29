# US-026 — Book parts and signatures

**Status:** Done (M16 passed 2026-10-29); the two AC-3 rows with a table of
contents green with TICKET-085 (2026-10-29); decision 8 added 2026-10-29
**Introduced:** v0.10.0 (planned; a new feature bumps the minor version)
**Implemented:** v0.10.0 (test build `0.10.0-m16.1`, M16 passed 2026-10-29)
**Supersedes:** the backlog items "colophon pages" (row "Front and back
matter") and "blank-page handling" (row "Print output")

---

## Story

**As an** author who has a book printed in folded signatures,
**I want** the colophon on the first right-hand page after the cover, the
first chapter at the start of the next spread, the back notes on the very last
page, and the page count a whole number of signatures,
**so that** the printout folds into a proper book without hand-made blank
pages.

Decided by the user (`docs/state/00_governance.md`, 2026-10-28, rounds 1 to 3,
5, 7, 8, 10 of the Book structure G0): the colophon and the back notes are
sections of the note marked by heading rules (like `Glossary`, US-017), from
their heading to the next heading of the same or a higher level; whether their
heading is printed is a setting per part; the colophon always goes on the next
right page (after a cover: p. 3, p. 2 stays fully blank whatever
`blankPageAfter` says); the first chapter (the first H1 of the body) starts on
the left page of the next free spread, or optionally on the first empty right
page, and only when there is front matter; the back notes end on the last page
and may be of any length; pages per signature are configurable (0 = no
padding), and blank padding pages before the back notes print their folio
only; roman folios for the front matter are optional, counted from the cover
and printed from the colophon on; no running header on the colophon and the
back notes; a missing part is left out and the rest moves up; with facing
pages off the sides act as a new page. Second of four stories (US-025 to
US-028); the table of contents (US-027) is front matter placed here.

Measured 2026-10-28 with the bundled compiler (Typst 0.14.2) and the US-019
furniture (scratch probe `p026/probe.test.ts`; SCAR-024):

- `#set page(numbering: "i")` from the start of the document counts the cover
  and its back (printed with `numbering: none`) and prints `iii` on the
  colophon on p. 3; `#set page(numbering: "1")` with `#counter(page).update(1)`
  at the first chapter prints `1` there (R1).
- `#pagebreak(to: "even")` (not weak) after the front matter starts the first
  chapter on the left page of the next free spread: after a colophon on p. 3
  it goes to p. 4; after contents ending on the left p. 4 it goes to p. 6, p. 5
  blank (R1, R2). `#pagebreak(to: "odd")` goes to the first empty right page:
  p. 5 (R3).
- Signature padding: a `context` block before the back notes reads the page
  where the padding starts and the length of the back notes (two `metadata`
  markers), then adds that many blank pages that the total is a multiple of
  the signature. Swept over body lengths of 1 to 20 pages with signatures of 4
  and 8 and back notes of one and three pages (42 cases): every total is a
  whole number of signatures, the back notes always end on the last page, and
  the padding takes every value from 0 to N − 1; no case oscillated
  (SCAR-021). A padding page must hold an invisible mark (`place(hide[.])`):
  an empty page between two breaks is dropped by Typst (measured: every total
  one page short without it).
- A label on an invisible `metadata` marker (a hidden heading's label, AC-2)
  is a valid link target, and a page reference to it prints the marker's
  page (`p. 2`).

---

## Acceptance criteria

- **AC-1 (marking the parts):** Two new rule names for `headingRules`
  (US-017 AC-1): `colophon` and `back-notes` (decision 2). A top-level heading
  of the body whose text maps to one of them marks its part, from the heading
  to the next top-level heading of the same or a higher level (US-017's
  section rule). The part's blocks are taken out of the body and placed as
  below; everything else stays in the body.
  ```yaml
  headingRules:
    Impressum: colophon
    Notes for the table: back-notes
  ```
  Built-in mapping (decision 2), added to US-017's `Glossary: glossary` and
  compared the same way (US-017 AC-2): `Colophon: colophon`, `Back notes:
  back-notes`; a preset entry `Colophon: none` switches it off. A heading
  inside a glossary section, a callout or another part does not mark a part
  (US-017: rules are not looked at there). A value that is not a rule name now
  reads `headingRules.Impressum must be a rule name: glossary, colophon,
  back-notes or none (line 4)`.

  Changed behaviour: a note with a top-level heading `Colophon` or `Back
  notes` exports differently once this story ships (the section moves to its
  page). The release notes say so, with the migration `Colophon: none`. Of the
  files the project knows, only the private book (`compiledtext.md`, not in
  the repository and read by no test) has them: `# Colophon` at line 4 and
  `# Back notes` at line 5437 (searched 2026-10-28; the census of US-024 counts
  the parse tree and is not affected).

- **AC-2 (the printed heading; decision 4):** `book.colophonHeading` and
  `book.backNotesHeading`, each `hidden` or `printed`. A hidden heading is not
  written at all (its label is kept on a `metadata` marker at the part's
  start, so a link and a page reference to it still work, measured); a
  printed one is written as today, and lists in the table of contents
  (US-027). Built-in: both `hidden` (decision 4), so by default neither part
  is listed in the contents. A printed part heading keeps its number with
  numbering on (decision 8): `1 Colophon`, then `2 Rules`.

- **AC-3 (the pages, facing pages; measured):** Pages and folios with
  `book.romanFrontMatter: true`, folios on:

  | Parts | p. 1 | p. 2 | p. 3 | p. 4 | p. 5 | p. 6 |
  | --- | --- | --- | --- | --- | --- | --- |
  | cover, colophon | cover (no folio) | blank (nothing) | colophon `iii` | chapter `1` | | |
  | cover, colophon, contents of one page | cover | blank | colophon `iii` | contents `iv` | blank `v` | chapter `1` |
  | the same, `book.firstChapter: right` | cover | blank | colophon `iii` | contents `iv` | chapter `1` | |
  | colophon, no cover | colophon `i` | chapter `1` | | | | |
  | cover only | as today (US-011): cover, its blank page if set, the body | | | | | |

  The colophon starts on the next right page: after a cover always p. 3, the
  cover's back is written as a page with nothing on it whatever
  `cover.blankPageAfter` says (round 8). A colophon longer than a page runs on
  (any length, round 2); the first chapter then follows by the same spread
  rule. The first chapter is the first top-level H1 of the body; its rule
  replaces a `page.breakBefore.h1` rule (US-025) for that one heading. Text
  of the body before that H1 belongs to the front matter (after the
  colophon, roman folios when on); with no H1 in the body the first chapter
  starts at the body's first block (decision 7). Example: `Intro text.`,
  `# Colophon`, `# Rules` gives the colophon, then `Intro text.`, then the
  chapter page with `Rules`.
  Without front matter (no colophon, no contents) the body starts as today
  (round 10). A printed colophon heading gets no US-025 break: the colophon's
  own page rule decides (decision 5).

- **AC-4 (roman front matter off):** With `book.romanFrontMatter: false` (the
  built-in) the front matter prints no folio and the first chapter prints `1`
  (measured, R5): cover, blank, colophon (no folio), chapter `1`. With
  `page.folios: false` no page prints a folio at all (US-019 AC-8). A page
  reference (US-018) into the front matter then prints the arabic page count
  of its target, cover included, though that page prints no folio: a link to
  the colophon on p. 3 prints `(p. 3)` (decision 6); a reference into the body
  prints the body's folio (`1` for the first chapter).

- **AC-5 (back notes and padding):** `book.signature` is `0` (the built-in),
  `4`, `8`, `16` or `32`. The back notes start on a new page after the body
  and end on the last page. With a signature `N > 0`, blank pages are added
  before the back notes so that the total page count, cover included, is a
  multiple of `N`; without back notes they are added at the end. Examples
  (measured, signature 4, a one-page back note): a body ending on p. 2 gives
  p. 3 blank, the back notes on p. 4 (total 4); a body ending on p. 3 gives the
  back notes on p. 4, no blank page; a body ending on p. 4 gives pp. 5–7
  blank, the back notes on p. 8. Back notes of three pages after a body ending
  on p. 5 start on p. 6 and end on p. 8. A printed back-notes heading gets no
  US-025 break (decision 5): with `page.breakBefore.h1: right` the back notes
  still start on the next page (and the padding still decides the total);
  every other H1 of the body keeps its rule.

- **AC-6 (what the added pages print):** The cover's back (p. 2 before a
  colophon) prints nothing. Pages added to reach the first chapter's side and
  padding pages print their folio only (roman in the front matter when it is
  on, arabic after the first chapter), no running header (US-025 AC-6's
  marker test). No page of the colophon, the contents or the back notes
  prints a running header; the colophon prints its folio (roman when on),
  the back notes their arabic folio (round 8).

- **AC-7 (facing pages off):** Every side acts as a new page: after a cover the
  colophon is on p. 2 (or p. 3 after the cover's blank page, when set); the
  first chapter on the page after the front matter; padding still makes the
  total a multiple of the signature.

- **AC-8 (several parts of one kind, an empty part; decision 3):** Two or more
  sections marked `colophon` are joined in note order into one colophon (the
  same for back notes), with warning `BOOK_PART_JOINED` at the second heading's
  line. A part with no blocks and a hidden heading is left out with warning
  `BOOK_PART_EMPTY` at its heading's line; a link to it is written as its
  text with `LINK_UNRESOLVED` (`No heading matches "#colophon"`), as a link
  to a missing heading (decided by the user 2026-10-28, TICKET-078: keeping
  the label was offered; leaving the link pointing at a missing label made the
  Typst invalid). Texts (written at G2):
  `The colophon section "Impressum" is joined to the colophon above`, `The
  back-notes section "Notes" is joined to the back notes above`, `The
  colophon section "Colophon" is empty and is left out`, `The back-notes
  section "Back notes" is empty and is left out` (the heading's visible text
  as written).

- **AC-9 (settings; SCAR-016, SCAR-019):** `book.signature`,
  `book.romanFrontMatter`, `book.firstChapter` (`left`, `right`),
  `book.colophonHeading`, `book.backNotesHeading` are preset fields and
  Defaults rows (decision 1) in a new group `Book`: dropdown rows (US-025's
  row kind) and a switch, each with the reset icon (US-008 AC-18); the style
  panel shows them like the other rows; the details pop-up lists them. Tests
  at each value (signature 0, 4, 8, 16, 32; both sides; both heading choices;
  roman on and off). Rows and messages (written at G2, in the form of the
  other fields): `Pages per signature` (dropdown `0`, `4`, `8`, `16`, `32`),
  `Roman folios in the front matter` (switch), `First chapter` (dropdown
  `left`, `right`), `Colophon heading` and `Back notes heading` (dropdowns
  `hidden`, `printed`); `book.signature must be 0, 4, 8, 16 or 32 (line 4)`,
  `book.romanFrontMatter must be true or false (line 4)`, `book.firstChapter
  must be left or right (line 4)`, `book.colophonHeading must be hidden or
  printed (line 4)` (the same for `book.backNotesHeading`).

- **AC-10 (composed; SCAR-002):** The composed note of US-015 with a cover
  (with and without its blank page), a colophon, back notes, a glossary
  section, a callout, footnotes, page references into the colophon and the
  back notes (US-018), folios and running header (US-019), `h1: right` and
  `h2: page` (US-025), a signature of 8 and roman front matter compiles; every
  text is in the PDF; the total is a multiple of 8; the back notes end on the
  last page; every page reference prints the folio of its target page as it
  is printed (roman or arabic); the preview (US-012) shows the same pages.

- **AC-11 (the sample vault; US-024):** The generator of the sample vault gets
  a colophon and back notes in `Book.md`, marked by a preset of the sample
  vault, so the manual check and the tests use a real book.

---

## Decisions (answered 2026-10-28)

1. **The field names** (AC-2, AC-5, AC-9). *Decided: the `book` group.*
   Proposed: a group `book` with
   `signature`, `romanFrontMatter`, `firstChapter` (`left`/`right`),
   `colophonHeading`, `backNotesHeading` (`hidden`/`printed`), preset fields
   and Defaults rows. Alternative: under `page` (`page.signature`, …).
2. **The rule names** (AC-1). *Decided: `colophon` and `back-notes`, with
   the built-in mapping `Colophon: colophon`, `Back notes: back-notes`.*
   Proposed was: `colophon` and `back-notes`, and no
   built-in mapping (unlike `Glossary`, the words differ from book to book).
   Alternatives: `backnotes`; a built-in `Colophon: colophon`.
3. **Several parts of one kind and an empty part** (AC-8). *Decided: join,
   warn.* Proposed: join
   them in note order with `BOOK_PART_JOINED`; leave an empty hidden-heading
   part out with `BOOK_PART_EMPTY`. Alternative: use the first and warn about
   the others (they stay in the body).
4. **The heading defaults** (AC-2). *Decided: both hidden.* Proposed was: colophon `hidden` (a colophon
   rarely has a title), back notes `printed`.
5. **A US-025 rule on a printed part heading** (AC-3, AC-5; asked
   2026-10-28 after a TICKET-079 mutant survived). *Decided: exempt.* A
   `page.breakBefore` rule does not apply to a printed colophon or
   back-notes heading; the parts' own page rules decide. Alternative was:
   apply it (the back notes could start on a right page; the padding would
   still decide the total).
6. **A page reference into the front matter with roman off** (AC-4; asked
   2026-10-28 after TICKET-079). *Decided: the arabic count.* The reference
   prints the arabic page count of its target (`3` for a colophon on p. 3),
   though that page prints no folio. Alternative was: print no number.
7. **Text before the first H1** (AC-3; asked 2026-10-28 after TICKET-079).
   *Decided: front matter.* Text of the body before its first top-level H1
   belongs to the front matter; with no H1 the first chapter starts at the
   body's first block. Alternative was: that text belongs to the first
   chapter.
8. **The number of a printed part heading** (AC-2; asked 2026-10-29 during
   TICKET-085, US-027 AC-9). *Decided: numbered, as today.* A printed
   colophon or back-notes heading is written as every heading and counts:
   with numbering `1.1`, `1 Colophon`, then `2 Rules`, in the body, the
   bookmarks and the contents. Alternative was (measured, scratch probe
   `p027b/colnum.test.ts`): `numbering: none`, which does not step the
   counter (`Colophon`, then `1 Rules`).

---

## Notes

- Out of this story: the table of contents (US-027: placed in the front
  matter here), images (US-028), title and copyright pages other than the
  colophon, imposition (the order of pages on the printer's sheets: the
  printer does it), editor menu items for the new rules (US-022 offers
  `Use as glossary section` only).
- New call sites (SCAR-001): the heading-rule table and the section rule of
  US-017 (`findGlossary` decides sections today; the parts use the same
  decider, SCAR-017), the cover pages of US-011, the furniture rule of US-019,
  the break markers of US-025, the rows module (US-025's dropdown kind).
- Worst misplaced click (SCAR-014): none; nothing is written into the vault.
- SCAR-027: nothing is replaced; `blankPageAfter` keeps its meaning without a
  colophon.

---

## Related tickets

- [TICKET-078](../tickets/TICKET-078-book-parts-core.md) — the rules, the
  parts, hidden headings, the warnings (AC-1, AC-2, AC-8).
- [TICKET-079](../tickets/TICKET-079-book-pages-core.md) — the `book` fields,
  front matter, first chapter, padding, added pages, facing pages off (AC-3
  to AC-7, AC-9, AC-10).
- [TICKET-080](../tickets/TICKET-080-book-rows.md) — the Book rows (AC-9,
  AC-10).
- [TICKET-081](../tickets/TICKET-081-sample-book-parts.md) — the sample
  vault's colophon and back notes (AC-11).
- [TICKET-082](../tickets/TICKET-082-book-build-and-m16.md) — test build
  `0.10.0-m16.1`, manual check M16.
