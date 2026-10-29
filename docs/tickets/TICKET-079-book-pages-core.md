# TICKET-079 — Book pages: front matter, first chapter, signature padding (core)

**Status:** Done (2026-10-28)
**User story:** [US-026](../user-stories/US-026-book-parts-and-signatures.md)
**ACs addressed:** AC-3, AC-4, AC-5, AC-6, AC-7, AC-9 (the fields), AC-10
**Depends on:** TICKET-078
**SCARs:** SCAR-001, SCAR-002, SCAR-008, SCAR-009, SCAR-010, SCAR-015,
SCAR-017, SCAR-018, SCAR-019, SCAR-021, SCAR-023, SCAR-024, SCAR-028

---

## Description

The `book` fields and the pages they make: the colophon on the next right
page (the cover's back fully blank), roman folios for the front matter, the
first chapter on the left page of the next free spread (or the first empty
right page), the back notes ending on the last page, blank pages before them
so the total is a multiple of the signature, every added page with its folio
only, no running header on colophon and back notes, facing pages off.

---

## Acceptance criteria (from user story)

- **AC-3, AC-4:** the page table (cover p. 1, blank p. 2, colophon p. 3
  `iii`, chapter p. 4 `1`; the other rows); roman off: no folio in the front
  matter, `1` at the chapter.
- **AC-5:** `book.signature` 0, 4, 8, 16, 32; the measured padding block.
- **AC-6:** folio only on added pages; no header on colophon and back notes.
- **AC-7:** facing pages off.
- **AC-9:** the fields, their messages (written at G2) and built-in values.
- **AC-10:** the composed book.

---

## Implementation notes

- `src/core/presets/schema.ts`, `parse.ts`, `merge.ts`: the group `book`
  (`readBook`, five fields, the messages of AC-9); `EffectiveSettings.book`
  with all five values; `ConvertSettings.book?`.
- `src/core/emit/breaks.ts` (the one writer of `#pagebreak(`): the first
  chapter's break (`to: "even"` or `to: "odd"`, not weak, between markers so
  the added page prints its folio only), the colophon's break to the next
  right page, the back notes' break, and the padding block measured at G1
  (a `context` block reading the padding start and the back notes' length
  from two markers; `place(hide[.])` and `pagebreak()` per page). Each text
  measured with the compiler before it is written (SCAR-024); the padding
  swept again over the AC-5 cases (SCAR-021).
- `src/core/emit/furniture.ts`: `o2t-blank` reads every break pair (the
  first chapter's and the padding's too); a part marker pair around the
  colophon and the back notes lets the header print nothing there; roman
  numbering `#set page(numbering: "i")` from the start and the switch to
  `"1"` with `#counter(page).update(1)` at the first chapter (measured R1).
- `src/core/cover/emit.ts`: with a colophon the cover's back page is always
  written, with `numbering: none` and nothing on it (AC-3; `blankPageAfter`
  without a colophon unchanged).
- `src/core/convert/index.ts`: the order cover → colophon → contents (US-027)
  → body → padding → back notes; the first chapter rule replaces a
  `page.breakBefore.h1` rule for that one heading (US-025 AC-5).
- A new `#let` (if the padding becomes a helper) joins `PLUGIN_NAMES` and the
  US-016 list test.

### Guards searched before the ticket (SCAR-023)

- `tests/unit/us-008-presets.test.ts`: the effective settings' keys (AC-1)
  and the whole object (AC-12) gain `book` (the class list; extended here).
- `tests/unit/us-025-page-breaks.test.ts`: only `breaks.ts` writes
  `#pagebreak(` — every new break goes there.
- `tests/unit/us-019-folios-headers.test.ts`: the furniture text without book
  parts stays as it is; the roman rule only with `romanFrontMatter` and front
  matter.
- `tests/unit/us-011-cover-convert.test.ts`: the cover pages with
  `blankPageAfter` and without a colophon stay as they are.
- `tests/unit/us-016-callouts-convert.test.ts` (`PLUGIN_NAMES`): extended if
  a name is added.
- `tests/integration/us-026-book-parts-pdf.test.ts` AC-3 rows with contents
  stay red until US-027 (TICKET of US-027).

---

## Tests

- `tests/unit/us-026-book-parts.test.ts` AC-9; `tests/integration/us-026-book-parts-pdf.test.ts`
  (all but the two rows with contents).
- US-008, US-011, US-015, US-016, US-018, US-019, US-023, US-025 tests green.
- Mutation checks: the colophon on the next page instead of the next right
  page; the cover's back kept only with `blankPageAfter`; roman off ignored;
  the counter not reset at the chapter; `to: "even"` and `"odd"` swapped;
  the padding one page short or long; padding written with signature 0; the
  back notes not on a new page; a header on the colophon; a padding page with
  a header; facing pages off still writes sides.

---

## SCAR check (2026-10-28, item by item against the Prevention lists)

- **SCAR-001** (1–4) `breaks.ts` and the furniture helper get new call sites;
  their register rows list them; edge inputs: no cover, no colophon, back notes
  only, a long colophon.
- **SCAR-002** (1–6) composed in AC-10 (cover with and without its blank
  page, glossary, callout, footnotes, page references into both parts,
  furniture, US-025 rules, signature 8, roman); the decision items re-read.
- **SCAR-003** (1–3) red tests exist; map.
- **SCAR-006** (1–4) full gate, counts.
- **SCAR-007** (1–3) page tables and messages in the tests.
- **SCAR-008** (1–6) every Typst text measured with the bundled compiler; PDF
  facts read by program (folios, headers, page count).
- **SCAR-009** (1–4) breaks at the start, after the cover, before the back
  notes, at the end.
- **SCAR-010** (1–6) the pieces are whole lines; the padding block joined by
  line breaks; tested as written.
- **SCAR-011** (1–5) the marker labels (`o2t-pad-start`, `o2t-back-start`,
  `o2t-part-*`) cannot be heading labels (`h-`).
- **SCAR-012** n/a here (TICKET-082).
- **SCAR-013, SCAR-014** n/a.
- **SCAR-015** (1–5) the tests assert texts, folios, headers, totals; guard:
  no book settings give today's output.
- **SCAR-016** n/a.
- **SCAR-017** (1–8) one writer of breaks; one blank-page test; the furniture
  learns the parts in one place.
- **SCAR-018** (1–10) backups with checksums for the mutation run.
- **SCAR-019** (1–5) signature 0, 4, 8, 16, 32; both sides; roman on and off;
  both heading choices.
- **SCAR-020** n/a.
- **SCAR-021** (1–3) the padding reads its own layout: the sweep over body
  lengths and back-note lengths; two fresh compiles agree.
- **SCAR-022** n/a.
- **SCAR-023** (1–10) guards above, including the whole-list tests of the
  effective settings.
- **SCAR-024** (1–5) each Typst text measured before it is written; the
  padding formula's inputs printed when a case fails.
- **SCAR-025** n/a here (TICKET-082).
- **SCAR-026** n/a.
- **SCAR-027** n/a (`blankPageAfter` keeps its meaning without a colophon).
- **SCAR-028** (1–4) the PDF reader's tokenizer (fixed at G2) is used; a page
  that reads short is checked against a render before the converter is blamed.

---

## Definition of done

- [x] Tests named above green (the two contents rows excepted, named)
- [x] Mutation checks run, results in the result
- [x] ESLint and Prettier clean; pass counts in the result
- [x] Register rows updated; whole-list tests extended

---

## Result (2026-10-28)

Measured first (scratch probe `p079`, Typst 0.14.2): F1 the first chapter's
break (`to: "even"`/`"odd"`, plain without facing pages) with the numbering
switch and the markers after it adds no page (colophon p. 3 → chapter p. 4 or
p. 5; colophon pp. 3–5 → p. 6; no cover → p. 2); F2 with roman off the footer
must ask `here().page-numbering()` (unasked it prints `3` on the colophon);
F3 a page reference in the target's numbering prints `iii` and `1`; F4 the
padding before the back notes and at the end, swept over 30 body lengths ×
(signature 4, 8; back notes of one and several pages; none): 150 cases, every
total a multiple, padding pages blank with folio and no header, back notes
last and headerless.

Changed: `presets/schema.ts` (`BookPresetFields`, `PresetFields.book`,
`PRESET_FIELDS` + `book`), `parse.ts` (`readBook`, the AC-9 messages; preset
notes and the Defaults), `merge.ts` (`book` field by field into
`ResolvedFields` and `EffectiveSettings`); `emit/breaks.ts`
(`chapterBreakLines`, `backNotesStartLines`, `backNotesEndLines`,
`paddingEndLines`, `partStartLine`, the part labels); `emit/furniture.ts`
(`O2T_PART_HELPER`, `BookFurniture`, front numbering `"i"`/`none`, the asked
footer; a misplaced doc comment moved to `pageFurnitureRule`);
`emit/page-refs.ts` (`roman`); `emit/blocks.ts` (option `book`: `BookLines`,
`noBreak`); `cover/emit.ts` (`resetCounter`), `convert/cover.ts`
(`frontMatter`); `convert/parts.ts` (colophon, back notes, chapter anchor,
part headings); `convert/index.ts` (`bookLines`; the glossary plan and parts
computed before the cover, their warnings reported in the old place);
`template/plugin-names.ts` (`o2t-part`).

- Gate (scratchpad `gate079b.log`): typecheck, build (`main.js` sha256
  `9122e670959e…`), lint green; `npm test` 1924 passed, 68 failed, 1 todo;
  integration 429 passed, 34 failed, 1 skipped. Every red test is of
  TICKET-080 (rows), TICKET-081 (AC-11), US-027 or US-028; the two red US-026
  PDF rows are the rows with contents (US-027).
- Tests changed: US-008 (`PRESET_FIELDS`, effective keys, the AC-12 object
  gain `book`), US-016 (`PLUGIN_NAMES` + `o2t-part`); US-026 PDF: the
  `firstChapter: right` row now asserts the contents on p. 4 (it had passed
  with no contents at all, SCAR-023) and a new AC-3 test: the first chapter's
  rule replaces `h1: right` (guard: the next chapter on a right page).
- Mutants (scratchpad `mut079/run.py`, `rerun.py`; US-026, US-025, US-019,
  US-011, US-018, US-008 tests; known red 3): 22, 21 caught. Survivors read as
  input questions (SCAR-023): (1) the first chapter keeping its `h1` rule — no
  test had a side rule with a front matter; the AC-3 test added, caught on the
  rerun; (2) part headings getting US-025 breaks — not a missing test: the
  story does not say whether an `h1` rule applies to a printed back-notes
  heading (with it the padding still makes the total right; the back notes
  would start on a right page). Put to the user; the code exempts part
  headings. Decided 2026-10-28: exempt (story decision 5); three unit tests
  (`decision 5`) added, both mutants of the exemption caught (scratchpad
  `mut080d/run.py`). Restores checked with `shasum -a 256 -c` (7 files OK).
- Determinism: a composed book (cover with blank page, colophon, back notes,
  signature 8, roman, `h1: right`, `h2: page`) converted and compiled in two
  fresh processes: the same Typst (sha256 `ec93cf7b705a…`) and folios
  `–, –, iii, 1 … 5`.
- Decided 2026-10-28 (story decision 6): a page reference into the front matter
  with roman off prints the counter in arabic (`3` for a colophon on p. 3,
  whose page prints no folio) — kept as is; a PDF test (`decision 6`) added,
  two mutants caught (scratchpad `mut080e/run.py`).
- Decided 2026-10-28 (story decision 7): text before the first H1 of the
  body belongs to the front matter; with no H1 the body's first block starts
  the chapter — kept as is; two unit tests (`decision 7`) added, three
  mutants caught (scratchpad `mut080g/run.py`).
