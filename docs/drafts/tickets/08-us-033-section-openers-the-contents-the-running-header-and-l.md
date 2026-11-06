<!-- Filed 2026-11-06 as #129 on the user's go (epic #121, ticket 8 of 16). -->

### User story

[US-033](https://github.com/JollyOrc/Obsidian2Typst/blob/main/docs/user-stories/US-033-entry-openers-navigation-quick-reference.md), ACs addressed AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-13, AC-14, AC-15

### Description

Open each section of an entries chapter on a right page (sharing the chapter's opener, reusing a free page), list every entry in the contents and keep the bookmarks, show the section's name in the running header, give every link to an entry its page number, and report the opener warnings.

### Acceptance criteria (from the user story)

Examples use US-031's preset and outline (`headingRules: {Menagerie:
entries}`, A5, facing pages, folios and running header on with
`page.runningHeaderLevel: 2`), with each section having an intro paragraph.

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

## Decisions (answered by the user, 2026-11-06)

1. **An entries chapter that is not an H1:** the same opener and header rules
   whatever its level (AC-2, AC-7).
2. **Quick reference order (revised 2026-11-06 at G2):** the order of the
   note, with no further sorting (AC-9). The first answer ("the language's
   order, from the preset's `lang`") rested on a setting that does not
   exist: Obsidian2Typst has no document language.
3. **The contents with an entries chapter:** the measured output of AC-6 is
   accepted.

### Implementation notes

- Openers: `pagebreak(weak: true, to: "odd")` before each section (not before the first, which shares the chapter's opener page); the first entry on the next left page; for the chapter heading the entries rule replaces US-025's `page.breakBefore` whatever its level (decision 1).
- Test interface: `<o2t-section>` (section, opener page, intro end page).
- `src/core/entries/report.ts`: `sectionWarnings(sections, places, ends)` → `ENTRY_BLANK_PAGE "<section>"`, `SECTION_INTRO_OVERFLOW`, `ENTRY_UNPAIRED` (suppressed when an opener fills the right page); once each.
- Contents (with an entries chapter only): `#outline(title: none, depth: none)` and every heading deeper than `toc.depth` that is not an entry written `outlined: false, bookmarked: true`; without an entries chapter, `src/core/emit/toc.ts`'s output byte for byte as today.
- Running header (US-019): on entries-chapter pages the current section's title, whatever `runningHeaderLevel`; none on the chapter opener page, full-image pages and blank pages; the overflow line of #128 on overflow pages.
- Links (US-018 AC-2): condition 3 holds for any link whose target is an entry; the page is the entry's first page.

### Tests

- `tests/unit/us-033-openers.test.ts` (all)
- `tests/integration/us-033-openers-pdf.test.ts`: the tests of AC-1 to AC-8 and AC-14 (the quick reference tests are #130)
- Guards: `tests/unit/us-027-table-of-contents.test.ts`, `tests/plugin/us-027-contents-menu.test.ts` (unchanged without an entries chapter), the US-018, US-019, US-025 tests.

### SCAR check

- SCAR-027: US-027's outline output unchanged without an entries chapter; its emitter and two test files named.
- SCAR-024: `outlined: false` also removes the PDF bookmark (measured 2026-11-06), hence `bookmarked: true`.
- SCAR-021: the header and the outline read the layout (`query`) but do not change it; the tests assert settling.
- SCAR-017: the header rule stated for every kind of page in the chapter.
- SCAR-019: `breakBefore.h1` unset/left/none/page; `runningHeaderLevel` 1 to 3; `toc.depth` 0 and 2; facing pages on and off.
- SCAR-009, SCAR-010: openers and entries join as pages; the tests read parity and page text.
- Not applicable: UI SCARs.

### Definition of done

- [ ] The listed tests pass; the other planned reds of #121 unchanged (none newly red).
- [ ] Full quality gate passes (typecheck, build, lint, `npm test`, `npm run test:integration`) except the named planned reds.
- [ ] User story file updated if ACs were refined during implementation.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] G4 entry in `docs/state/30_scar_checks.md`.
