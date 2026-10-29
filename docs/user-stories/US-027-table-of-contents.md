# US-027 — Table of contents

**Status:** Done (M17 passed 2026-10-29)
**Introduced:** v0.10.0 (planned; a new feature bumps the minor version)
**Implemented:** v0.10.0 (test build `0.10.0-m17.1`, M17 passed 2026-10-29)
**Supersedes:** the backlog item "Table of contents" (row "Front and back
matter")

---

## Story

**As an** author,
**I want** a table of contents generated from the headings, as deep as I
choose, at a place I pick,
**so that** readers of the printed book and of the PDF find their way.

Decided by the user (`docs/state/00_governance.md`, 2026-10-28, rounds 1 to 4
and 9 of the Book structure G0): no contents unless the preset or the Defaults
set `toc.depth` 1 to 6 (0 = none); the place is picked with an editor menu
item on an H1 heading (before or after it) and stored in the active preset
(as US-022 does); without a pick the contents go after the colophon and
before the first chapter (US-026); glossary terms, headings in callouts and
unnumbered headings are left out; the colophon and the back notes are listed
when their heading is printed (US-026: hidden by default); page numbers and
dot leaders are switches, on by default; entries link in the PDF, show the
heading numbers when numbering is on, and deeper levels are indented; a title
line, default `Contents`, a preset text (empty = no title); no running header
on the contents pages; roman folios there when the front matter has them.
Third of four stories (US-025 to US-028).

Measured 2026-10-28 with the bundled compiler (Typst 0.14.2) and the plugin's
heading forms (scratch probe `p027/probe.test.ts`; SCAR-024):

- `#outline(title: none, depth: 2)` lists the headings of levels 1 and 2 with
  their numbers, dot leaders and page numbers, deeper levels indented; every
  entry is a link in the PDF (O1). `#set outline.entry(fill: none)` removes the
  dot leaders (O2); `#show outline.entry: it => link(it.element.location(),
  it.indented(it.prefix(), it.body()))` removes the page numbers and keeps the
  links (O3). With `#set heading(numbering: none)` the entries have no numbers
  (O5).
- A heading written with `outlined: false` is not listed: the heading inside a
  glossary term already is (US-017 AC-14), a glossary term is no heading at
  all (O1). `outlined: false, bookmarked: true` keeps the heading in the PDF
  bookmarks (B1); `outlined: false` alone removes it from them.
- An entry's page number is the folio as printed: `iii` for a colophon heading
  in roman front matter, `1` for the first chapter (O4).
- A plain text block above `outline(title: none)` is a title that is no
  heading: it is not in the bookmarks and not in the running title.
- Both switches set inside a block with the outline stay in that block: an
  outline after the block keeps its dot leaders and page numbers (S1).

---

## Acceptance criteria

- **AC-1 (the fields):** Preset fields and Defaults: `toc.depth` (0 to 6,
  built-in 0), `toc.title` (text, built-in `Contents`, empty = no title),
  `toc.pageNumbers` and `toc.dotLeaders` (switches, built-in `true`). Preset
  notes only (like `cover`, US-011): `toc.heading` (the visible text of an H1)
  and `toc.position` (`before`, `after`), written by the menu items (AC-7);
  a `toc.heading` without `toc.position` is read as `before` (decision 6).
  Invalid values make the preset invalid (US-008 AC-4): `toc.depth must be a
  whole number from 0 to 6 (line 3)`, `toc.position must be before or after
  (line 5)`.

- **AC-2 (what is written):** With `toc.depth: 2` and the defaults:
  ```
  #block(below: 1em)[#text(size: 1.4em, weight: "bold")[Contents]]
  #outline(title: none, depth: 2)
  ```
  The title text goes through the escaping of US-013; an empty title writes no
  block. `toc.dotLeaders: false` adds `#set outline.entry(fill: none)` before
  the outline; `toc.pageNumbers: false` adds the show rule of O3. Both are
  scoped to the contents (inside a block with the outline) so that nothing
  else changes (measured, S1).

- **AC-3 (what is listed; measured):** Headings of the body down to
  `toc.depth`, in order, with the numbers of US-002 when numbering is on.
  Not listed: glossary terms (no headings), headings inside a glossary term
  (already `outlined: false`), headings inside a callout, quote or list item
  — with the contents on, these are written `#heading(level: 2, outlined:
  false, bookmarked: true)[Boxed] <h-boxed>` so they stay in the bookmarks
  (decision 4) — and a hidden colophon or back-notes heading (US-026). A
  printed colophon heading is listed with its number and its folio (`1
  Colophon … iii`; US-026 decision 8). Example, depth 2,
  numbering `1.1`: `1 Rules … 2`, `1.1 Combat … 2`, `2 Glossary … 2`; not
  `1.1.1 Attacks` (depth 3), not `Boxed`, not `Grit`.

- **AC-4 (the default place):** Without `toc.heading`, the contents are front
  matter (US-026): after the colophon, on the page after it (p. 4 after a
  cover and a colophon); without a colophon on the next right page, like the
  colophon (decision 2: after a cover p. 3 with p. 2 blank, without a cover
  p. 1). The first chapter
  then follows by US-026's spread rule (contents ending on p. 4: chapter on
  p. 6, or p. 5 with `book.firstChapter: right`).

- **AC-5 (a picked place; decisions 1 and 5):** With `toc.heading: Rules` and
  `toc.position: before`, the contents stand right before the top-level H1
  whose visible text compares equal (as heading rules compare, US-017 AC-2);
  with `after`, after that heading's whole section, before the next top-level
  H1 (decision 1); when it is the last H1, after the end of the body and
  before the back notes (US-026). The first such heading counts. If none is found, the contents go to the default place and
  warning `TOC_HEADING_MISSING` (`The table of contents heading "Rules" is
  not in the note; the contents are at the default place`, line 0) is
  reported. Contents placed before the first chapter are front matter
  (roman folios when on); placed later, they are part of the body (decision
  5).

- **AC-6 (the contents pages):** The contents start on a new page and what
  follows starts on a new page; a long table of contents runs on over several
  pages. No contents page prints a running header; each prints its folio
  (roman in the front matter when on, arabic in the body). Page breaks of
  US-025 do not apply to the title (it is no heading).

- **AC-7 (the editor menu items; SCAR-013, SCAR-014, SCAR-016):** On the line
  of a top-level H1 of the body (not a glossary term, not inside a callout,
  not a colophon or back-notes heading; US-022 AC-1's line rules) the editor
  menu offers `Table of contents before this heading` and `Table of contents
  after this heading`; where the preset already places the contents at that
  heading and side, that item reads `Remove table of contents placement`
  (back to the default place). Each asks first, as US-022 AC-5 (`Change
  preset "Folios"`, `Change preset` / `Cancel`, `Cancel` focused), e.g.
  `Place the table of contents of preset "Folios" before "Rules"?`, and
  writes `toc.heading` and `toc.position` in one atomic change of the preset
  note (US-022 AC-7). No preset or an invalid one: disabled with the reason
  (US-022 AC-6). With `toc.depth` 0 or unset the item is offered and its
  question also sets `toc.depth: 2` in the same change (decision 3):
  `Place the table of contents of preset "Folios" before "Rules" and show
  headings down to level 2?`. The menu reads the
  line and the preset when it opens; the action reads the preset again at
  `Change preset` (US-022 AC-9).

- **AC-8 (settings rows; SCAR-016, SCAR-017):** A group `Contents` in the
  Defaults section and the style panel: `Contents depth` (dropdown 0–6,
  US-025's row kind), `Contents title` (text), `Contents page numbers`,
  `Contents dot leaders` (switches), each with the reset icon (renamed at G2:
  `Page numbers` is already the folio switch of US-019, and rows are told
  apart by their labels). The details pop-up (US-021) lists them and a summary row
  `Contents place` (`before "Rules"`, or `default`).

- **AC-9 (composed; SCAR-002):** The composed note of US-015 with a cover, a
  printed colophon, back notes, a glossary section, a callout with a heading,
  numbering `1.1`, roman front matter, page breaks (US-025) and a signature
  (US-026), with `toc.depth: 3`: compiles; the contents list exactly the
  expected headings with the folios they are printed on; every entry links
  to its heading; the callout heading is in the bookmarks and not in the
  contents; the preview (US-012) shows the same.

- **AC-10 (settings at their values; SCAR-019):** Tests at depth 0, 1, 2, 3
  and 6; both switches on and off; title default, empty and a custom text with
  characters that need escaping (`#`, `*`, `[`); position before and after;
  numbering on and off.

---

## Decisions (answered 2026-10-28)

1. **"After" an H1** (AC-5). *Decided: after the heading's whole section.*
   Proposed was: right after the heading's line (so a
   heading `# Contents` with `after` holds the contents; the title can then be
   set empty). Alternative: after the heading's whole section (before the
   next H1).
2. **The contents without a colophon** (AC-4). *Decided: the next right
   page.* Proposed: the first part of the
   front matter starts on the next right page, like the colophon (after a
   cover: p. 3, p. 2 blank). Alternative: on the next page (after a cover:
   p. 2, or p. 3 after its blank page).
3. **The menu item while the contents are off** (AC-7). *Decided: offered,
   also sets depth 2.* Proposed: the item is
   offered and its question says it also sets `toc.depth: 2` (`… and show
   headings down to level 2?`), written in the same change. Alternative: the
   item is disabled with `(contents off)`.
4. **Headings in callouts** (AC-3). *Decided: as proposed.* Proposed: written with `outlined: false,
   bookmarked: true` only while the contents are on (today's output stays the
   same otherwise; they stay in the bookmarks either way). Alternative: always
   written that way.
5. **Contents placed after the first chapter** (AC-5). *Decided: as
   proposed.* Proposed: part of the
   body (arabic folios, the body's numbering). Alternative: always front
   matter (roman when on), wherever they stand.
6. **`toc.heading` without `toc.position`** (AC-1, AC-5; asked 2026-10-29
   during TICKET-085). *Decided: read as `before`*, no warning. The menu
   items always write both; only a hand-edited preset lacks it.
   Alternative was: the preset is invalid (`toc.position is needed when
   toc.heading is set`).

7. **An empty `Contents title` row** (AC-1, AC-8; asked 2026-10-29 after
   TICKET-087). *Decided: kept as every text row.* An empty field in the
   settings tab is saved as unset, so the built-in `Contents` applies; no
   title is set only in a preset note (`title: ''`). Alternative was: an
   empty row saves `title: ''` (no title), with the reset icon back to
   `Contents`.
---

## Notes

- Out of this story: an index, a glossary page from marked entries (backlog
  "Front and back matter"), lists of figures or tables.
- New call sites (SCAR-001): the heading forms of US-002 and US-017, the
  escaping of US-013 (the title), the front matter and spread rule of
  US-026, the menu entries, question and atomic write of US-022 (a new kind
  of preset change), the rows module (US-025's dropdown kind).
- Worst misplaced click (SCAR-014): a menu item on the wrong H1 — the
  question names the heading text and the side; `Cancel` is the default.

---

## Related tickets

- [TICKET-083](../tickets/TICKET-083-contents-fields.md) — The contents fields (core)
- [TICKET-084](../tickets/TICKET-084-contents-lines-and-entries.md) — The contents lines and what they list (core)
- [TICKET-085](../tickets/TICKET-085-contents-place-and-pages.md) — The place of the contents and their pages (core)
- [TICKET-086](../tickets/TICKET-086-contents-menu-items.md) — The editor menu items that place the contents (plugin)
- [TICKET-087](../tickets/TICKET-087-contents-rows.md) — The Contents rows, the details pop-up and the preview (plugin)
- [TICKET-088](../tickets/TICKET-088-contents-build-and-m17.md) — Test build and manual check M17 (table of contents)
