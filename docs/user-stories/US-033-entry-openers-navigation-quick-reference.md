# US-033 — Entry openers, navigation and the quick reference

**Status:** Ready (G1 2026-11-06; decisions 1 to 3 answered the same day, G1 re-check)
**Introduced:** v0.12.0 (planned, with US-030 to US-032)
**Implemented:** —
**Supersedes:** —

Epic #121, fourth of seven stories (see US-030). Drafts D-09, D-14 in
`docs/drafts/entry-layouts-tickets.md`.

---

## Story

**As a** reader of a catalogue chapter,
**I want** each section to open on a right page with its entries starting
opposite, every entry in the contents with its page, the section's name at
the top of its pages, and a table of all entries at the end,
**so that** I can find an entry quickly and compare entries at a glance.

Decided by the user (G0 for #121, 2026-11-05; 2026-11-06), summarised:

- **Openers (D10, D11, D16):** a section's heading and intro take a right
  page; its first entry starts on the next left page. The chapter's heading
  and intro share the first section's opener page. A free right page left by
  the previous section is used as the next opener instead of adding a page.
- **Blank pages** show the folio only (G0-C11).
- **Navigation (D29, D30; G0-C3, C4):** every entry is in the contents, and
  links to an entry always get its page number, whatever `toc.depth` and
  `linkPageLevel` are; entry pages show the section's name in the running
  header, except where an H1 starts (US-019) and on `full-image` pages.
- **Quick reference (D35; G0-C1):** a generated table after the last entry,
  on when the preset says so (off by default).

Measured (SCAR-024; `docs/technical/spike-entry-measure.md`, the sweep,
2026-11-06, CLI and WASM identical): sections opened with
`pagebreak(weak: true, to: "odd")` and their first entries with
`pagebreak(to: "even")` keep every opener rule in 120 synthetic chapters
(1 to 3 sections × 1 to 10 entries), including the chapter's heading on the
first opener page and the reuse of a free right page; no compile did not
converge. Measured 2026-11-06 (Typst 0.14.2 CLI, a synthetic outline): with
`outline(depth: none)`, headings written `outlined: false` are neither in
the contents nor in the bookmarks, and an entry at level 4 under a level-3
entry is listed; hence `bookmarked: true` in AC-6. Not measured: section
intros longer than a page, the running header on opener pages, and the
quick reference's page numbers (US-018's page-reference
helper, measured for links since US-018).

---

## Acceptance criteria

Examples use US-031's preset and outline (`headingRules: {Menagerie:
entries}`, A5, facing pages, folios and running header on with
`page.runningHeaderLevel: 2`), with each section having an intro paragraph.

### Openers

- **AC-1 (section openers, D10):** Inside an entries chapter (US-031 AC-1),
  a section heading and its intro (everything up to its first entry) are set
  on a right page (`pagebreak(weak: true, to: "odd")`); the section's first
  entry starts on the next left page. Example: `## Horrors` and its intro on
  p. 9 (right), `Bog Wight` from p. 10.

- **AC-2 (the chapter opener, D11):** The chapter's heading, its intro, the
  first section's heading and its intro share one right page, in that order.
  For this heading the entries chapter's rule replaces US-025's
  `page.breakBefore` (a `left` rule for the chapter's level becomes `right`
  here; `none` and `page` also become `right`), and US-026's book parts are
  unaffected. Example: `h1: left` in the preset → `# Menagerie` still starts
  on a right page. The same holds whatever the chapter heading's level
  (decision 1): `## Menagerie` inside `# Players` with `h2: none` still opens
  on a right page.

- **AC-3 (reusing a free page, D16):** If the previous section ends on a left
  page (an unpaired page entry, US-031 AC-10, or a spread's left page in a
  preset without facing pages), its right page becomes the next opener page:
  no page is added and `ENTRY_UNPAIRED` is not given. If it ends on a right
  page, the opener takes the next right page, the left page between shows
  the folio only (US-025's `o2t-blank`) and `ENTRY_BLANK_PAGE "<section>"` is
  given.

  | Previous section ends on | Next opener | Added | Warning |
  |---|---|---|---|
  | a left page | the facing right page | nothing | none |
  | a right page | the next right page | one blank left page | `ENTRY_BLANK_PAGE "Horrors"` |

- **AC-4 (long intros):** An intro that does not fit its opener page runs on
  to the next page(s); the first entry starts on the next left page after it,
  with `SECTION_INTRO_OVERFLOW "<section>"`. Example: a 1.3-page intro on
  p. 9 → runs to p. 10, `Bog Wight` from p. 12 (p. 11 blank, folio only),
  `SECTION_INTRO_OVERFLOW "Horrors"` and no `ENTRY_BLANK_PAGE` for that page.

- **AC-5 (presets without facing pages, D18):** With `page.facingPages:
  false`, each opener takes a page of its own wherever it falls; no page is
  added and no `ENTRY_BLANK_PAGE` is given.

### Navigation

- **AC-6 (the contents, D29, G0-C4):** With a contents (US-027, `toc.depth`
  1 to 6), every entry heading is listed with its page, whatever its level
  and `toc.depth`; sub-headings inside entries never are (US-031 AC-11).
  Written: when the document has an entries chapter, `#outline(title: none,
  depth: none)` (decision 3), and every heading deeper than `toc.depth` that is not an
  entry is written `outlined: false, bookmarked: true` (as US-027 AC-3 does
  for headings in callouts), so the outline lists exactly the headings to
  `toc.depth` and the entries, and the PDF bookmarks stay as today. Without an entries chapter, the
  output is US-027's, byte for byte. Example, `toc.depth: 2`: `Menagerie`,
  `Beasts`, `Fen Hare`, `Marsh Owl`, `Cave Wyrm`, `Reed Cat`, `Horrors`,
  `Bog Wight` are listed; `Habits` (a sub-heading) and a `### Notes` outside
  the chapter are not. With `toc.depth: 0` there is no contents and nothing
  is listed (US-027).

- **AC-7 (running header, D30, G0-C3):** On pages of an entries chapter, the
  running header (US-019) shows the title of the current section (the last
  section heading before or on the page), whatever
  `page.runningHeaderLevel` is, with these exceptions:
  - the chapter opener page: none (US-019 rule 1: an H1 starts there; when
    the chapter heading is not an H1, its page still shows none, decision 1);
  - a `full-image` page: none (US-031 AC-6);
  - an overflow page: the "(continued)" line (US-032 AC-8);
  - a blank page: none (US-025 AC-6).

  | Page | Header |
  |---|---|
  | chapter opener (`# Menagerie`, `## Beasts`) | — |
  | Fen Hare … Reed Cat | `Beasts` |
  | opener of `## Horrors` | `Horrors` |
  | Bog Wight text page | `Horrors` |
  | Bog Wight `full-image` page | — (no folio either) |

  Outside entries chapters the header is US-019's, unchanged.

- **AC-8 (links to entries, G0-C4):** A link to an entry gets the page
  number of the entry's first page when US-018 AC-2's conditions 1 and 2
  hold, whatever `linkPageLevel` is (condition 3 is met by any link whose
  target is an entry). Example, `linkPageLevel: 1`: `[Cave Wyrm](#cave-wyrm)`
  in Fen Hare's body → `Cave Wyrm (p. 6)` where the entry starts on p. 6,
  never the number of its overflow page.

### Quick reference

- **AC-9 (the table, D35):** With `entries.quickReference: true`, a table
  follows each entries chapter's last entry, starting on a new left page
  under a heading `entries.quickReferenceTitle` (built-in `Quick Reference`)
  at the chapter's section level; the heading is in the contents. Columns:
  Entry, Section, the `entries.statblock.boxes` key's label (when set), one
  column per `entries.statblock.stats` label, Track (when `track` is set),
  Page. One row per entry of the chapter (nested entries excluded), sorted
  by the entry's plain text in the order of the document's language (the
  preset's `lang`, US-001; `Intl.Collator(lang, {sensitivity: "base"})`,
  decision 2: `Æther`, `Bog Wight`, `cave wyrm`, `Élan`, `Zebra` with
  `lang: en`), across all sections. A
  missing value is `—`. Page is the entry's first page (as AC-8).

- **AC-10 (the Track column):** Compared with `trackDefault` (US-030 AC-13):

  | Entry's cells | Track |
  |---|---|
  | the default | empty |
  | the default plus Fading | `+ Fading` |
  | the default without Down | `− Down` |
  | `states: none` | `none` |
  | any other set (Fine, Gone) | `Fine, Gone` |

  The column tells a reader how to use the blank cells of the encounter sheet
  (US-036).

- **AC-11 (layout and repeats):** The table may break across pages; its
  header row repeats on each page. An entry heading that appears twice in the
  chapter (a repeat the writer missed) has one row, for its first
  occurrence. Example with the outline above: 5 rows — Bog Wight, Cave Wyrm,
  Fen Hare, Marsh Owl, Reed Cat; columns Entry, Section, vigour (the key, no stats label; US-030 AC-12), Might, Wits,
  Speed, Track, Page.

- **AC-12 (settings):** Two `entries` fields (US-030 AC-8's messages and
  Details view): `entries.quickReference` (switch, built-in `false`) and
  `entries.quickReferenceTitle` (text, built-in `Quick Reference`; empty →
  no heading, then the table is not in the contents).

### Warnings, composed cases, tests

- **AC-13 (warnings):** `ENTRY_BLANK_PAGE`, `SECTION_INTRO_OVERFLOW` (and
  US-031's `ENTRY_UNPAIRED`, which AC-3 suppresses) come from the real
  positions after the compile, once per section or entry, never stopping an
  export; in `warning-codes.md` with a source line.

- **AC-14 (composed, SCAR-002):**
  - a TOC placed by `toc.heading` before the entries chapter (US-027 AC-5):
    the chapter opener's parity is the PDF page's, as US-025 measured;
  - two entries chapters (`{Menagerie: entries, Relics: entries}`): each has
    its own openers and, when on, its own quick reference after its last
    entry;
  - glossary after the chapter (US-017): the quick reference ends the
    entries chapter's pages; the glossary starts by its own rules;
  - `page.runningHeader: false`: no header anywhere (AC-7 does not switch it
    on).

- **AC-15 (tests, SCAR-019):** Facing pages on and off; a previous section
  ending left and right; intros of 0.3, 1.0 and 1.3 pages; `toc.depth` 0, 1,
  2, 6; `linkPageLevel` 1, 2, 6; `page.runningHeaderLevel` 1, 2, 3; the
  quick reference on and off, with and without `boxes` and `track`; one and
  two entries chapters. The PDF tests read page parity, header text per page,
  the outline entries (bookmarks and contents text), link texts with page
  numbers and the table's rows and page numbers (SCAR-015), on the generated
  fixture (D-03).

---

## Decisions (answered by the user, 2026-11-06)

1. **An entries chapter that is not an H1:** the same opener and header rules
   whatever its level (AC-2, AC-7).
2. **Quick reference sorting:** the language's order, from the preset's
   `lang` (AC-9).
3. **The contents with an entries chapter:** the measured output of AC-6 is
   accepted.

---

## Notes` outside
  the chapter are not. With `toc.depth: 0` there is no contents and nothing
  is listed (US-027).

- **AC-7 (running header, D30, G0-C3):** On pages of an entries chapter, the
  running header (US-019) shows the title of the current section (the last
  section heading before or on the page), whatever
  `page.runningHeaderLevel` is, with these exceptions:
  - the chapter opener page: none (US-019 rule 1: an H1 starts there; when
    the chapter heading is not an H1, its page still shows none, decision 1);
  - a `full-image` page: none (US-031 AC-6);
  - an overflow page: the "(continued)" line (US-032 AC-8);
  - a blank page: none (US-025 AC-6).

  | Page | Header |
  |---|---|
  | chapter opener (`# Menagerie`, `## Beasts`) | — |
  | Fen Hare … Reed Cat | `Beasts` |
  | opener of `## Horrors` | `Horrors` |
  | Bog Wight text page | `Horrors` |
  | Bog Wight `full-image` page | — (no folio either) |

  Outside entries chapters the header is US-019's, unchanged.

- **AC-8 (links to entries, G0-C4):** A link to an entry gets the page
  number of the entry's first page when US-018 AC-2's conditions 1 and 2
  hold, whatever `linkPageLevel` is (condition 3 is met by any link whose
  target is an entry). Example, `linkPageLevel: 1`: `[Cave Wyrm](#cave-wyrm)`
  in Fen Hare's body → `Cave Wyrm (p. 6)` where the entry starts on p. 6,
  never the number of its overflow page.

### Quick reference

- **AC-9 (the table, D35):** With `entries.quickReference: true`, a table
  follows each entries chapter's last entry, starting on a new left page
  under a heading `entries.quickReferenceTitle` (built-in `Quick Reference`)
  at the chapter's section level; the heading is in the contents. Columns:
  Entry, Section, the `entries.statblock.boxes` key's label (when set), one
  column per `entries.statblock.stats` label, Track (when `track` is set),
  Page. One row per entry of the chapter (nested entries excluded), sorted
  by the entry's plain text in the order of the document's language (the
  preset's `lang`, US-001; `Intl.Collator(lang, {sensitivity: "base"})`,
  decision 2: `Æther`, `Bog Wight`, `cave wyrm`, `Élan`, `Zebra` with
  `lang: en`), across all sections. A
  missing value is `—`. Page is the entry's first page (as AC-8).

- **AC-10 (the Track column):** Compared with `trackDefault` (US-030 AC-13):

  | Entry's cells | Track |
  |---|---|
  | the default | empty |
  | the default plus Fading | `+ Fading` |
  | the default without Down | `− Down` |
  | `states: none` | `none` |
  | any other set (Fine, Gone) | `Fine, Gone` |

  The column tells a reader how to use the blank cells of the encounter sheet
  (US-036).

- **AC-11 (layout and repeats):** The table may break across pages; its
  header row repeats on each page. An entry heading that appears twice in the
  chapter (a repeat the writer missed) has one row, for its first
  occurrence. Example with the outline above: 5 rows — Bog Wight, Cave Wyrm,
  Fen Hare, Marsh Owl, Reed Cat; columns Entry, Section, vigour (the key, no stats label; US-030 AC-12), Might, Wits,
  Speed, Track, Page.

- **AC-12 (settings):** Two `entries` fields (US-030 AC-8's messages and
  Details view): `entries.quickReference` (switch, built-in `false`) and
  `entries.quickReferenceTitle` (text, built-in `Quick Reference`; empty →
  no heading, then the table is not in the contents).

### Warnings, composed cases, tests

- **AC-13 (warnings):** `ENTRY_BLANK_PAGE`, `SECTION_INTRO_OVERFLOW` (and
  US-031's `ENTRY_UNPAIRED`, which AC-3 suppresses) come from the real
  positions after the compile, once per section or entry, never stopping an
  export; in `warning-codes.md` with a source line.

- **AC-14 (composed, SCAR-002):**
  - a TOC placed by `toc.heading` before the entries chapter (US-027 AC-5):
    the chapter opener's parity is the PDF page's, as US-025 measured;
  - two entries chapters (`{Menagerie: entries, Relics: entries}`): each has
    its own openers and, when on, its own quick reference after its last
    entry;
  - glossary after the chapter (US-017): the quick reference ends the
    entries chapter's pages; the glossary starts by its own rules;
  - `page.runningHeader: false`: no header anywhere (AC-7 does not switch it
    on).

- **AC-15 (tests, SCAR-019):** Facing pages on and off; a previous section
  ending left and right; intros of 0.3, 1.0 and 1.3 pages; `toc.depth` 0, 1,
  2, 6; `linkPageLevel` 1, 2, 6; `page.runningHeaderLevel` 1, 2, 3; the
  quick reference on and off, with and without `boxes` and `track`; one and
  two entries chapters. The PDF tests read page parity, header text per page,
  the outline entries (bookmarks and contents text), link texts with page
  numbers and the table's rows and page numbers (SCAR-015), on the generated
  fixture (D-03).

---

## Open decisions

1. **A chapter heading that is not an H1 (AC-2, AC-7):** an entries chapter
   named by an `##` heading inside a larger `#` chapter — should its opener
   still force a right page and suppress the header, or follow the
   surrounding chapter's pages? Not measured: no such book exists yet.
2. **Quick reference sorting (AC-9):** by the entry's plain text with a
   simple case-insensitive comparison (`Æther` after `Zebra`), or by the
   language's collation (Typst's / the preset's `lang`)?
3. **US-027's output when an entries chapter exists (AC-6):** `depth: none`
   plus `outlined: false, bookmarked: true` on deeper headings (measured)
   changes the written outline only in documents with an entries chapter.
   Acceptable, or should the outline keep `depth: <toc.depth>` and list
   entries some other way (not measured)?

---

## Notes

- US-027's emitter (`src/core/emit/toc.ts`) and its tests
  (`tests/unit/us-027-table-of-contents.test.ts`,
  `tests/plugin/us-027-contents-menu.test.ts`) assert `depth: <n>`; they stay
  valid because AC-6 changes the output only with an entries chapter
  (SCAR-027).

---

## Related tickets

<!-- Filled in at step 3. Drafts: D-09, D-14. -->
