# US-033 — Entry openers, navigation and the quick reference

**Status:** Done; amendment for #139 Ready (2026-11-09: AC-7, AC-9, AC-11, AC-12, AC-15 — the header of the quick reference's pages, the box column's label, section rows, entry names as links). Before: Done (M21 to M24 passed 2026-11-07; M21's findings and M23's changes merged without a re-run, the user's decision; G1 2026-11-06; decisions 1 to 3 answered the same day, G1 re-check)
**Introduced:** v0.12.0 (planned, with US-030 to US-032)
**Implemented:** v0.12.0 (released 2026-11-07), epic #121 (tickets #122 to #137); test builds `0.12.0-m21.1` (M21 to M24) and `0.12.0-m21.2` (their follow-ups); the amendment for #139 planned for v0.13.0
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

  Amended for #139 (a defect found 2026-11-08: the quick reference's first
  page showed the last entry's name at `page.runningHeaderLevel` 3 and 4, the
  chapter's name at 1): **every page an entries chapter writes after its last
  entry** — the quick reference (AC-9) and the encounter sheet page (US-036
  AC-6), and any page a later story adds there — shows that page's own title
  in the running header, whatever `page.runningHeaderLevel` is (1 to 6):
  `entries.quickReferenceTitle` on the quick reference's pages,
  `encounterSheetText.title` on the sheet page; with an empty title, an
  empty header (G0 answer 16). A page where an H1 starts still has none
  (US-019), a blank page none (US-025 AC-6); the folio stays. The page after
  them is US-019's again. One rule for the whole class (SCAR-017), written by
  the furniture's header (`src/core/emit/furniture.ts`), not per page.

  | Page | Header, at any `runningHeaderLevel` |
  |---|---|
  | quick reference, every page | `Quick Reference` |
  | quick reference with `quickReferenceTitle: ''` | — (empty) |
  | encounter sheet page | `Encounter Sheet` (its title) |

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
  at the chapter's section level; the heading is in the contents. Columns
  (amended for #139: no Section column): Entry, the
  `entries.statblock.boxes` key's label (when set), one column per
  `entries.statblock.stats` label, Track (when `track` is set), Page. One
  row per entry of the chapter (nested entries excluded), in the order the
  entries stand in the note (decision 2, revised 2026-11-06: the compiled
  note already lists them in the author's order; no further sorting). A
  missing value is `—`. Page is the entry's first page (as AC-8).
  Amended for #139:
  - **the box column's label:** the label of the `stats` field with the box
    key, if there is one; otherwise the key with its first character in
    upper case and the rest as written (G0 answer 14): `vigour` → `Vigour`,
    `hit_points` → `Hit_points`, `xVigour` → `XVigour`. Never the raw key.
    The statblock's own box row keeps its upper-case label (US-030 AC-12,
    `VIGOUR`); the label is made in one place for both (SCAR-017);
  - **section rows:** each section's entries are preceded by a row spanning
    every column with the section's name in bold. When the table breaks
    across pages, the repeated header row is followed by the current
    section's row again on a page that starts inside a section (Typst's
    leveled table headers, `table.header(level: 2, …)`; measured in the CLI
    and the bundled WASM compiler, `spike-entry-wrap.md`, "G1 measurements"
    4). A section row is never the last row of a page (measured: 17 tables,
    no page ended with one). A chapter without sections has no section rows
    (G0 answer 17); entries before a chapter's first section stand before
    the first section row, without one;
  - **entry names are links:** each name in the Entry column links to the
    entry's first page, with no page number after it (G0 answer 15; the
    Page column has the number).

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
  occurrence. Example with the outline above (amended for #139): rows
  `Beasts` (section row), Fen Hare, Marsh Owl, Cave Wyrm, Reed Cat, `Horrors`
  (section row), Bog Wight (the note's order); columns Entry, Vigour (the key
  with a capital first letter, no stats label; before #139 the raw key
  `vigour`), Might, Wits, Speed, Track, Page; `Fen Hare` links to Fen Hare's
  first page.

- **AC-12 (settings):** Two `entries` fields (US-030 AC-8's messages and
  Details view): `entries.quickReference` (switch, built-in `false`) and
  `entries.quickReferenceTitle` (text, built-in `Quick Reference`; empty →
  no heading, then the table is not in the contents, and its pages have an
  empty header, AC-7 as amended for #139).

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
  two entries chapters. For #139: the header of every quick-reference page
  and of the sheet page at `runningHeaderLevel` 1 to 6, with the sheet on
  and off, with an empty title, with the chapter at level 1 and 2; the box
  column's label with and without a stats label, for `vigour`, `hit_points`
  and a one-letter key; section rows with one and two sections, a chapter
  without sections, a table that breaks inside a section (the row repeated)
  and a section starting near a page's foot; the entry links' targets (the
  PDF's link annotations point to the entry's first page) and no page
  number in the Entry column. The PDF tests read page parity, header text per page,
  the outline entries (bookmarks and contents text), link texts with page
  numbers and the table's rows and page numbers (SCAR-015), on the generated
  fixture (D-03).

---

## Decisions (answered by the user, 2026-11-06)

1. **An entries chapter that is not an H1:** the same opener and header rules
   whatever its level (AC-2, AC-7).
2. **Quick reference order (revised 2026-11-06 at G2):** the order of the
   note, with no further sorting (AC-9). The first answer ("the language's
   order, from the preset's `lang`") rested on a setting that does not
   exist: Obsidian2Typst has no document language.
3. **The contents with an entries chapter:** the measured output of AC-6 is
   accepted.

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
- #143 (AC-7, AC-12), #144 (AC-9, AC-11), #145; amendment for #139.
