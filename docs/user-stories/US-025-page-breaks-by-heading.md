# US-025 — Page breaks by heading level

**Status:** Done (2026-10-28)
**Introduced:** v0.10.0 (planned; a new feature bumps the minor version)
**Implemented:** v0.10.0 (test build `0.10.0-m15.1`, M15 passed 2026-10-28)
**Supersedes:** the backlog item "Break before heading level N" (row "Page
breaks and structure")

---

## Story

**As an** author of a printed book,
**I want** to say per heading level whether a heading starts a new page, a
right-hand page or a new spread,
**so that** chapters and sections open where a reader of a bound book expects
them.

Decided by the user (`docs/state/00_governance.md`, 2026-10-28, rounds 5, 8
and 9 of the Book structure G0): each level 1 to 6 takes `none`, `page`,
`right` or `left` (`left` starts a new spread); the built-in default is `none`
for every level, so today's output does not change; a blank page added to
reach a side prints its folio only; where rules meet there is one break, and
the strongest side counts; with facing pages off every side acts as `page`.
First of four stories (US-025 to US-028); US-026 (book parts) builds on the
side rules here.

Measured 2026-10-28 with the bundled compiler (Typst 0.14.2) and the plugin's
furniture of US-019 (scratch probe `p025/probe.test.ts`; SCAR-024):

- `pagebreak(to: "odd")` and `to: "even"` follow the **physical** page: after a
  cover with `#counter(page).update(1)` (US-011 AC-5) the body starts on p. 2
  with folio 1, and a break `to: "odd"` there goes to p. 3 (folio 2) without a
  blank page. A right-hand page is an odd page of the PDF (p. 1 is right-hand,
  US-011 AC-5).
- A page Typst inserts to reach a side prints the page's header and footer: the
  folio **and the running title** of the chapter before. Two `metadata`
  markers around each break let the header tell an inserted page from a real
  one; with them the inserted page prints its folio only (measured). The
  header only reads where the markers fell and does not change the layout,
  so it cannot oscillate (SCAR-021).
- `weak: true` adds nothing when the page is already empty; a weak break to a
  side at the top of a page of the wrong side still adds the blank page (cover,
  then the body's first heading on p. 2 with `to: "odd"`: p. 2 blank, the
  heading on p. 3).
- A page break inside a box (callout, quote, list item) is a compile error
  (`pagebreaks are not allowed inside of containers`), so only top-level
  headings can break.

---

## Acceptance criteria

- **AC-1 (the field):** A preset note, or the Defaults, may hold
  `page.breakBefore` with the keys `h1` to `h6` (decision 3), each one of
  `none`, `page`, `right`, `left`. Missing keys and a missing field mean
  `none`. It merges key by key like the other page fields (US-008 AC-1): a
  preset with `breakBefore: {h2: page}` keeps the Defaults' `h1`.
  ```yaml
  page:
    breakBefore:
      h1: right
      h2: page
  ```
  Any other value makes the preset invalid (US-008 AC-4) with
  `page.breakBefore.h1 must be none, page, right or left (line 5)`; an
  unknown key (`h7`, `chapter`) with `page.breakBefore has no key "h7"
  (line 6)`.

- **AC-2 (what is written):** Before a top-level heading whose level has a rule
  other than `none`, the body gets three lines, then the heading line as
  today:
  ```
  #metadata(none) <o2t-break-before>
  #pagebreak(to: "odd", weak: true)
  #metadata(none) <o2t-break-after>
  = Two <h-two>
  ```
  `right` writes `to: "odd"`, `left` writes `to: "even"`, `page` writes
  `#pagebreak(weak: true)`. With `page.facingPages: false` every rule writes
  `#pagebreak(weak: true)` (sides need a spread). Measured results (A5,
  facing pages, folios and running header on, no cover; the third row
  measured again at G2 with decision 1 and AC-4, 2026-10-28):

  | Note | Rules | Pages |
  |---|---|---|
  | `# One` / `## A` / text / `# Two` / `## C` / text | `h1: right` | p. 1 `One`, `A`; p. 2 blank (folio `2`, no header); p. 3 `Two`, `C` |
  | the same | `h1: right`, facing pages off | p. 1 `One`, `A`; p. 2 `Two`, `C` (no blank page) |
  | `# One` / `## A` / text / `## B` / text / `## C` / text | `h2: left` | p. 1 blank (folio `1`); p. 2 `One`, `A` (the break before `One`, AC-4, AC-5); p. 3 blank (folio `3`); p. 4 `B`; p. 5 blank (folio `5`); p. 6 `C` |
  | the first row | `h1: right`, folios off | p. 1; p. 2 blank (no folio, no header); p. 3 |

- **AC-3 (which headings break):** Only top-level headings of the body break.
  None for a heading inside a callout, quote, list item or footnote (a break
  there cannot compile), for a glossary term or a heading inside a term
  (US-017: the rules are not looked at inside a glossary section), or for an
  empty heading (US-002 AC-7). The heading of a glossary section itself
  breaks by its level. Example: `h2: page` with `# Glossary` / `## Action` /
  text gives no break before `Action` (a term); with `> [!note]` / `> ## Boxed`
  none before `Boxed`.

- **AC-4 (one break where rules meet):** Headings that follow each other with
  no block between them get one break, before the first of them. Its kind is
  the strongest of their rules: a side (`right`, `left`) beats `page`, `page`
  beats `none`; of two different sides, the first heading's counts.

  `# Two` directly followed by `## C`:

  | Rules | Written before `Two` | Before `C` |
  | --- | --- | --- |
  | `h1: right`, `h2: page` | `to: "odd"` | nothing |
  | `h1: page`, `h2: right` | `to: "odd"` | nothing |
  | `h1: right`, `h2: left` | `to: "odd"` | nothing |
  | `h1: none`, `h2: left` | `to: "even"` | nothing |

  A heading that already starts a page breaks no further (`weak: true`).

- **AC-5 (the start of the body; decision 1):** The rules apply to the first
  block of the body too. Measured (facing pages, folios on):

  | Start of the PDF | First block | Rule | Pages |
  | --- | --- | --- | --- |
  | no cover | `# One` | `h1: left` | p. 1 blank (folio `1`); p. 2 `One` |
  | no cover | `# One` | `h1: right` or `page` | p. 1 `One` (nothing added) |
  | cover | `# One` | `h1: right` | p. 1 cover; p. 2 blank (folio `1`); p. 3 `One` (folio `2`) |
  | cover and its blank page | `# One` | `h1: right` | p. 1 cover; p. 2 blank; p. 3 `One` (folio `1`, nothing added) |
  | cover and its blank page | `# One` | `h1: left` | p. 1 cover; p. 2 blank; p. 3 blank (folio `1`); p. 4 `One` (folio `2`) |

  With every rule `none` (the default) nothing changes. When there is front
  matter, US-026 places the first chapter and its rule wins for that heading.

- **AC-6 (blank pages added to reach a side):** A page Typst adds prints its
  folio when folios are on and nothing else: no running header (the
  helper `o2t-blank` in the furniture rule of US-019 reads the two markers;
  `o2t-blank` joins `PLUGIN_NAMES`, US-016 AC-11). The page counts in the
  numbering (AC-2 table: folio `2`, then `Two` on folio `3`). The running
  title on the pages around it is the one of US-019 (unchanged).

- **AC-7 (settings rows; SCAR-016, SCAR-017; decision 2):** The rows module
  (`plugin/settings/rows.ts`, shared by the Defaults section of the settings
  tab and the style panel, US-012) gets a dropdown row kind for a field with
  fixed values. Six rows `Break before H1` … `Break before H6` use it, with
  the options `—` (not set: the value comes from the Defaults or the built-in
  `none`), `none`, `page`, `right`, `left`. A choice is saved at once, as
  switches are (US-008 AC-20). Each row has the reset icon of the Defaults
  rows with its question (US-008 AC-18): `Reset "Break before H1"?` with the
  value as chosen (`right`). In the style panel a row that the active preset
  sets shows `right; set by preset "…"; change it in the preset note` and is
  not editable (US-012 AC-2). The details pop-up (US-021 AC-6) lists the six
  rows as text with their sources. A change reaches the next preview (US-012
  AC-5) and export; every screen that shows a rule redraws on a change of the
  preset or the Defaults (the existing listeners of US-012 and US-020).

- **AC-8 (composed; SCAR-002):** The composed note of US-015 with a cover and
  its blank page, a glossary section, a callout with a heading, footnotes,
  page references (US-018) and folios and running header (US-019), with
  `h1: right`, `h2: page`, compiles; every text of the note is in the PDF;
  every page reference prints the page its target is on; every inserted page
  has its folio and no header; the template hook (US-023) keeps working.

- **AC-9 (settings at their values; SCAR-019):** Tests cover each of `none`,
  `page`, `right`, `left`, at the levels 1, 2 (where the running header
  usually is), 3 and 6, and with facing pages on and off.

- **AC-10 (the preview is the export):** The preview compiles the same
  document (US-012 AC-13), so the breaks and blank pages show there as in
  the PDF.

---

## Decisions (answered 2026-10-28)

1. **The first block of the body** (AC-5). *Decided: the rule applies there
   too.* Proposed was: it never breaks, so a
   note that starts with a heading set to `left` does not begin with a blank
   page, and the body after a lone cover stays where it is today (round 10:
   with only a cover the layout stays as today). Alternative: the rule
   applies there too (measured: after a cover, an H1 set to `right` moves from
   p. 2 to p. 3, p. 2 blank).
2. **The settings rows** (AC-7). *Decided: a new dropdown row kind.*
   Proposed was: six text rows with a hint, as the
   other page rows (the rows know no dropdown today). Alternatives: one text
   row (`h1: right, h2: page`); or a new dropdown row kind (more code, the
   rows, panel and pop-up learn it).
3. **The keys** (AC-1). *Decided: `h1` to `h6`.* Proposed: `h1` to `h6`
   (readable, and YAML reads them
   as text). Alternative: `1` to `6` (YAML reads them as numbers).

---

## Notes

- Out of this story: the first chapter's page and the front matter (US-026),
  the table of contents (US-027), images that do not fit (US-028), manual
  break markers and keep-together blocks (backlog).
- New call sites (SCAR-001): the furniture rule of US-019 (the header's blank
  test), `findGlossary` (roles: terms and in-term headings), the page-field
  parser and merge of US-008 / US-009, the rows module of US-008 / US-012
  (a new row kind: every place that draws a row — the settings tab's Defaults
  section, the style panel — and the reset icon of US-008 AC-18 learn it; the
  details pop-up of US-021 shows rows as text and needs no change).
- Worst misplaced click (SCAR-014): none; nothing is written into the vault.

---

## Related tickets

- [TICKET-075](../tickets/TICKET-075-page-breaks-core.md) — the field, the
  break lines, the blank-page test in the furniture (AC-1 to AC-6, AC-8,
  AC-9; AC-10 follows).
- [TICKET-076](../tickets/TICKET-076-dropdown-rows-and-break-rows.md) — the
  dropdown row kind and the six rows (AC-7).
- [TICKET-077](../tickets/TICKET-077-page-breaks-build-and-m15.md) — test
  build `0.10.0-m15.1`, manual check M15 (AC-7, AC-10 by eye).
