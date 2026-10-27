# US-019 — Page numbers and a running header with the chapter title

**Status:** Done (2026-10-20)
**Introduced:** v0.4.0 (planned; a new feature bumps the minor version)
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author of a rulebook,
**I want** every body page of the PDF to carry its page number at the outer
edge and, at the top, the title of the chapter the reader is in,
**so that** the printed book can be navigated by page (and later by the page
references of US-018) and by chapter, as Style Guide §2.4 asks.

Decided by the user (`docs/state/00_governance.md`, 2026-10-19): scope is
page numbers and running headers (ornaments, chapter symbols, crop marks and
blank-page handling stay in their backlog rows); US-018 (page numbers for
internal links) waits for this story. Header title: the first H2 that starts
on the page; with none, the last H2 before the page; pages before the first H2
of a section get the last H1 title; with no H1 either, the header is empty;
the title as written, without its number. Numbering starts at 1 on the first
body page; the cover and its blank page have neither folio nor header and are
not counted. A page on which an H1 starts has no header; its folio stays.
Preset fields (also in the Defaults): folios on/off, running header on/off,
header level (default 2). Body font, a little smaller; numbers at the outer
edge on facing pages, centred on single pages; header centred.

Notation as in US-001: `⏎` is a line break, `md :` the note, `typ:` the
output. "Page 3" means the third PDF page; "folio 2" means the printed number.
Measured 2026-10-19 with the bundled Typst 0.14.2 (scratch probe): the header
rule of AC-5 gives its rules 1, 2, 3 and 5 and the folios of AC-3 on an A5
note with a cover; a footnote
in a chapter title is repeated in the header and renumbers the real footnote
(AC-7).

---

## Acceptance criteria

- **AC-1 (fields):** Three fields, in preset notes and in the Defaults, with
  the precedence of US-008 AC-1 (preset, then Defaults, then built-in):
  ```
  page:
    folios: true               # page numbers; built-in true
    runningHeader: true        # chapter title at the top; built-in true
    runningHeaderLevel: 2      # whole number 1 to 6; built-in 2
  ```
  (under `page`, decided 2026-10-19, so they belong to the Page group of the
  panel and of page presets). Invalid values
  make the preset invalid (US-008 AC-4) with the line of the field:
  `page.folios must be true or false`; `page.runningHeader must be true or
  false`; `page.runningHeaderLevel must be a whole number from 1 to 6`.
  Examples: `folios: yes` (a string) → `page.folios must be true or false
  (line 5)`; `runningHeaderLevel: 7` → `page.runningHeaderLevel must be a
  whole number from 1 to 6 (line 5)`; `2.5` → the same message. `null` is
  unset.

- **AC-2 (settings tab and style panel rows):** The Defaults rows of the
  settings tab (US-008 AC-18) gain, after `Gutter (mm)`: `Page numbers`
  (toggle), `Running header` (toggle), `Running header level` (number, hint
  `1 to 6`). They are rows of the existing kinds, so they share the save rule
  (saved on leaving the field, US-008 AC-19), the reset icon with its
  question (AC-18, SCAR-014) and the redraw (SCAR-016) of every Defaults row;
  the panel (US-012) shows them in its Page group, owned by a preset that
  sets them. A refused level (`7`) shows the AC-1 message and keeps the saved
  value. Example in the order draw, change, use: open the tab, set `Running
  header level` to `3`, leave the field, click its reset icon at once: the
  question reads `The value "3" is removed from the Defaults. Presets that do
  not set this field use the built-in value.` (US-008 AC-18; corrected at G2:
  the question names the value that is removed, not the built-in one).

- **AC-3 (numbering):** With `folios: true` the preamble rule `page-furniture`
  (order 45: after `text-and-fonts` 40, before `highlight` 50; US-015 AC-2;
  decided 2026-10-19) sets the page numbering `"1"` and a footer that prints
  the counter, in one `#set page(…)` line; `emitPageSetup` (US-009) stays
  geometry only. The helpers `running-text` and `running-title` are defined by the
  same rule and join `PLUGIN_NAMES` (US-016 AC-11). The cover pages keep `header: none,
  footer: none` (US-011 AC-4) and the counter reset after them, and, with
  `folios: true` only (so AC-8 holds), get `numbering: none` (decided 2026-10-19: a PDF viewer then lists them without a
  page label; measured before: label `1`, the same as the first body page), so
  the first body page is folio 1:
  ```
  cover, no blank page:  page 1 no folio, page 2 folio 1, page 3 folio 2
  cover, blank page:     pages 1 and 2 no folio, page 3 folio 1
  no cover:              page 1 folio 1
  ```
  The rule's text (facing pages, both on, level 2; measured 2026-10-19 with the
  bundled Typst 0.14.2; the same text is the expected value of the tests in
  `tests/support/furniture.ts`):
  ```
  #let running-text(it) = {
    if type(it) != content { return it }
    if it.func() == footnote { return [] }
    if it.has("children") { return it.children.map(running-text).join() }
    if it.func() == link { return link(it.dest, running-text(it.body)) }
    if it.func() in (strong, emph, highlight, underline, strike) { return (it.func())(running-text(it.body)) }
    it
  }
  #let running-title(level) = {
    let p = here().page()
    let starts(h) = h.location().page() == p
    if query(heading.where(level: 1)).any(starts) { return none }
    let starting = query(heading.where(level: level)).filter(starts)
    if starting.len() > 0 { return running-text(starting.first().body) }
    running-text(query(selector(heading).before(here())).filter(h => h.level <= level).at(-1, default: (body: none)).body)
  }
  #set page(numbering: "1", header: context { set text(size: 0.9em); align(center, running-title(2)) }, footer: context { set text(size: 0.9em); align(if calc.even(here().page()) { left } else { right }, counter(page).display()) })
  ```
  Single pages write `align(center, counter(page).display())` in the footer.
  Folios only: `#set page(numbering: "1", footer: …)` without the helpers;
  header only: the helpers and `#set page(header: …)` without `numbering`.
  Both helpers join `PLUGIN_NAMES`.

- **AC-4 (folio position and look):** On facing pages (`page.facingPages:
  true`) the folio is at the outer edge of the footer: right on odd PDF pages
  (right-hand pages), left on even ones, the same sides as the outside margin
  of US-009; on single pages (`facingPages: false`) centred. Body font at
  0.9em, no other decoration (ornaments are a later row). Example, A5 print
  with a cover and no blank page: page 2 (folio 1, even page) has the number
  at the left edge of the text area (side to be measured in G2 against the
  outside margin).

- **AC-5 (header title; every position, SCAR-009):** With `runningHeader:
  true` and level `L` (default 2; section level `L − 1`), the header of a body
  page shows, centred, in the body font at 0.9em:
  1. nothing, if a level-1 heading starts on the page (the folio stays);
  2. else the title of the first level-`L` heading that starts on the page;
  3. else the title of the last heading before the page whose level is at most
     `L`, whatever its level (for `L = 2`: the last H2, or the H1 after it);
  4. (merged into 3 on 2026-10-20: found by the M8 dry run, with `L = 3` the
     old rule showed an H2 of the previous H1 section on the pages of a new
     one; decided by the user: a new section never shows an old title);
  5. else nothing.
  "Title" is the
  heading text without its number. Worked example (A5, cover; expected values.
  Measured 2026-10-19 on a similar note: rules 1, 2, 3 and 5 and the folios;
  rule 4 is to be measured in G2):
  ```
  md : Intro.⏎# Reader Section⏎…⏎## Tessera⏎…⏎## Prism⏎… (two pages)⏎# Appendix⏎…⏎## Late chapter⏎…
  page 2  folio 1  header empty       (no heading before)
  page 3  folio 2  header empty       (# Reader Section starts here, rule 1)
  page 4  folio 3  header "Tessera"    (## Tessera starts here)
  page 5  folio 4  header "Prism"
  page 6  folio 5  header "Prism"     (last H2 before, after the last H1)
  page 7  folio 6  header empty       (# Appendix starts here)
  page 8  folio 7  header "Appendix"  (no H2 of this section yet, rule 4)
  page 9  folio 8  header "Late chapter"
  ```
  The section is called `Appendix`, not `Glossary`: under a `# Glossary`
  heading the `##` headings are glossary terms (US-017) and never titles
  (corrected 2026-10-20 while coding TICKET-050).
  Headings inside callouts, quotes and list items count (they are headings,
  US-016 AC-6); glossary terms (US-017) are not headings and never appear; a
  heading printed without number in a term (US-017 AC-14) is a heading and
  counts at its level.

- **AC-6 (title text):** The header shows the heading body as the document
  prints it (markup, code, a link as its text), without its number. A long
  title wraps; it is not cut. An empty heading (US-002 AC-7) is omitted and so
  never a title.

- **AC-7 (footnotes in a title; measured hazard):** A footnote call in a
  heading is not repeated in the header: the header shows the title without
  the footnote mark, and the footnote keeps its number. Measured 2026-10-19:
  without this rule the header of the next pages shows `Footnoted chapter 1`
  and the real footnote is numbered `2`. Guard test: the plain header form
  shows the duplicate number.

- **AC-8 (switches off):** `folios: false` writes no numbering and no footer;
  `runningHeader: false` writes no header. With both off, the preamble has no
  `page-furniture` rule, and the PDF of a note is the same as today (rule 7).
  A template that sets its own `header` or `footer` (US-008) keeps it for
  every part that is switched off; a part that is on replaces it (the
  preamble comes after the template import).

- **AC-9 (composed export, content; SCAR-015):** A test note with a cover,
  the worked example of AC-5, a footnote in a chapter title, a callout with an
  H2 and a glossary section (US-017) compiles with no error, and the PDF:
  - prints folios `1` to `n` on pages 2 to `n + 1` and none on page 1, each in
    the footer, at the side of AC-4;
  - shows the header titles of AC-5 page by page, and never a glossary term;
  - has as many footnote marks as footnote calls in the note (AC-7).
  Guard test: the same note with both switches off has no folio and no header
  text on any page.

- **AC-10 (preview):** The preview (US-012) shows folios and headers as the
  export; a change of `runningHeaderLevel` in the active preset note reaches
  the next preview request (SCAR-016, as US-016 AC-16).

- **AC-11 (the sample note):** `Book.md` of the sample vault (US-024)
  exports with folios on every page and its `##` chapter titles in the headers
  of their pages; the pages where its `#` headings (the manifest's
  `headings['1']`, at least 8) start have no header. The export is
  deterministic (rule 7). Unit tests use fixtures under `tests/fixtures/`.

---

## Decisions (2026-10-19)

The three open decisions of the Draft were approved by the user: (1) rule
`page-furniture`, order 45, `emitPageSetup` unchanged, AC-3; (2) the fields
under `page`, AC-1; (3) `numbering: none` on the cover pages, AC-3. To be
measured in G2: the header font equals the body font (a `set text` of rule 40
before the `set page` of rule 45), rule 4 of AC-5, and the folio side of AC-4.

---

## Notes

- Not in this version: ornaments and chapter symbols in header and footer
  (backlog "Decoration"); different first pages of a chapter beyond the H1
  rule; roman numbers for front matter; blank-page handling (backlog "Print
  output"); page references in links (US-018, waits for this story).
- New call sites (SCAR-001): the US-008 field reader for three new fields;
  the Defaults rows of US-008 AC-18/19 for three new rows (no new row kind);
  `emitCoverPages` of US-011 (`numbering: none` on the cover pages).
- New piece type for the join table (SCAR-010): none in the body; the rule is
  one preamble line.
- Labels (SCAR-011): none.
- Worst misplaced click (SCAR-014): the reset icon of a new row, already
  behind the AC-18 question.
- SCAR-017: the new rows reuse the row helpers; a text check shows that every
  Defaults row goes through them (as for the existing rows).

---

## Related tickets

- [TICKET-049](../tickets/TICKET-049-page-furniture-fields-and-rows.md) — Page fields, built-ins, effective settings, Defaults rows
- [TICKET-050](../tickets/TICKET-050-page-furniture-rule-and-cover.md) — Preamble rule `page-furniture`, cover numbering, helper names
- [TICKET-051](../tickets/TICKET-051-folios-preview-build-and-m8.md) — Preview, test build `0.4.0-m8.1`, manual check M8
