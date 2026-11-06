# Draft tickets — Entry layouts (epic #121)

**Status:** Draft, 2026-11-05. **Not filed yet.** Amended 2026-11-05 with the G0 decisions (C1 to C14, the block contract A1 to A9) and the statblock tracks (D48 to D56: Grit boxes, Condition track, encounter sheet). Each amended draft cites its decision as G0-xx or Dnn. The behaviour spec is "Bestiary Layout User Stories" (BL-C1 to BL-C15) in the private spec repository; the stories written at G1 restate it in generic terms.

These drafts become `ticket` issues (form `.github/ISSUE_TEMPLATE/ticket.yml`, label `ticket` plus `US-NNN`) only after these steps, each with its gate:
1. step 0 / G0: SCAR review (done 2026-11-05, 27 gaps; questions answered)
2. step 1 / G1: the stories
3. step 2 / G2: the tests

Each draft follows the form. The **SCAR check** field is filled at G3, not here. The SCARs named below are the ones expected to matter, as a starting point for G3 and not instead of it. `docs/tickets/` stays a read-only archive, so the drafts live here (git-ignored, G0-C13).

## Proposed stories

| Story | Title | Drafts |
|---|---|---|
| US-030 | Entry data and statblock (with Grit boxes and Condition track) | D-01, D-02, D-04, D-05, D-17, D-19 |
| US-031 | Entry layouts on facing pages | D-06, D-07, D-08, D-10 |
| US-032 | Fit, overflow and automatic layout choice | D-11, D-12, D-13 |
| US-033 | Section openers, navigation and quick reference | D-09, D-14 |
| US-034 | Print checks: image resolution and word gaps | D-15, D-16 |
| US-035 | Statblock preview of `o2t-entry` blocks in Obsidian (G0-A9) | D-20 |
| US-036 | Encounter sheet: A4 file and book page (D50, D56) | D-21 |
| US-024 (amendment) | Synthetic public fixture | D-03 |
| all | Build, documents, manual test | D-18 |

## Order

D-01, D-02, D-03 → D-04, D-19, D-05, D-17 → D-06, D-07, D-08, D-10 → D-11 → D-12, D-13 → D-09, D-14 → D-21 → D-15, D-16 → D-20 → D-18.

D-15 and D-16 don't depend on the entry work and can be done any time after D-02. D-20 needs D-04 and D-19 (it reuses their drawing rules) but nothing of the page layout. D-21 needs D-19 (box and cell drawing) and the quick-reference position from D-14.

## G0 decisions applied (2026-11-05)

1. **Generic plugin (G0-C1, confirmed).** Game terms live in the preset, not in code: `entries.statblock.stats`, `.traits`, `.boxes`, `.track`, `.trackDefault`, `entries.tagLabels`, the sum check of D-17. The built-in defaults are empty: no stat keys → no statblock; no tag map → no tags and no `TAG_UNMAPPED`; no track → no Condition track. The examples below use synthetic fields (`might`, `wits`, `speed`, total `vigour`).
2. **Which chapter holds entries (G0-C2).** A preset heading, `entries.chapterHeading`. Tentative until the chapter-recognition spike.
3. **Measured layout.** Still open: the read-back mechanism of US-028 or Typst `measure()`, decided by the spike. Must be checked for stability (SCAR-021).
4. **Warning codes.** `ENTRY_*`, `STAT_*` (now including `STAT_BOXES_MANY` and `STAT_GRIT_NOT_NUMBER`), `TAG_UNMAPPED`, `IMAGE_LOW_DPI` and `TEXT_WIDE_GAP`. Each one goes into `docs/technical/warning-codes.md` with a source location (agent rule 8).
5. **Settings surface (G0-C9).** `entries.*` appear in preset notes and the Details view only, with no rows in the settings tab or style panel.
6. **Constants (G0-C8).** The 45/55 split, the 60 % narrow-column threshold, 10 list items, 10 lede words and the 40 % landscape height are named constants in one place, documented, not settings.
7. **Preview (G0-C10).** The preview runs the full entry layout, so its pages match the export (US-012 AC-13). Only the PDF word-gap scan is export-only.
8. **Only input (G0-C14).** The `o2t-entry` block is the only source of entry data. A note's own frontmatter is never read as entry data.

## Spikes before G1

- measured layout by read-back vs Typst `measure()`
- the three chapter-recognition rules (confirms G0-C2)
- sweeps across page edges and entry counts under the 8-compile limit
- time of the PDF word-gap scan on a 260+ page PDF

---

## D-01 — The `o2t-entry` block: specification and reading

- **User story:** US-030, AC: block read, invalid YAML, unknown layout, layout conflict, formatting in values
- **Description:** Write the format of the `o2t-entry` block once (`docs/technical/entry-block.md`), as the contract the Vault Compiler writes to (JollyOrc/ObsidianVaultCompiler#108). Then read it in `core/parse` / `core/markers` as data for the nearest heading above it. It is never printed. The contract (G0-A1 to A8):
  - every property of the note except the Vault Compiler's exclusion list, `tags` included; keys in lowercase
  - a fixed YAML form (G0-A4, tentative until the Vault Compiler's YAML spike), and a fence one backtick longer than the longest backtick run in the content (G0-A5)
  - the picture credit is the alt text of the `illustration` image (`"![Credit](assets/hare.png)"`); there is no credit key (G0-A6)
  - values may hold bold and italic; links have been flattened to text by the Vault Compiler (G0-A7)
- **Acceptance criteria (from the story):** *(copied at step 3)*. Expected:
  - a block under `### Fen Hare` is data of that heading
  - invalid YAML → `ENTRY_YAML_INVALID "Fen Hare"` and the entry is laid out as plain text
  - `layout: sideways` → `ENTRY_LAYOUT_UNKNOWN "Fen Hare: sideways"`, treated as `auto`
  - `full-image` without an image → `ENTRY_LAYOUT_CONFLICT "Fen Hare": full-image → page-text (no illustration)`
  - `illustration: "![Drawn by A. Nobody](assets/hare.png)"` → image `assets/hare.png`, credit `Drawn by A. Nobody`; `![[hare.png|300]]` → a size, no credit
  - `attacks: ["**Kick**: 2d6"]` → `Kick` set in bold; `[[Kick]]` left in a value → printed as `Kick`, plain text (G0-A7)
  - the Vault Compiler's repeat comment `<!-- repeat of "Fen Hare" omitted -->` is dropped like any HTML comment (US-001 AC-15) and adds nothing to the entry above it
- **Implementation notes:**
  - The block is an in-band marker. List every step that reads fenced code (code emitter, markers, page breaks, image fit) and make sure only the entry reader consumes it. (SCAR-039: in-band markers read by other steps).
  - The format has a named reader, this plugin (SCAR-040: an output format names its reader).
  - Keys the reader doesn't know are ignored silently (G0-A2: the block carries every property, so unknown keys are normal).
  - Parse the block with longer fences and `~~~` fences too (G0-A5).
- **Tests:**
  - `tests/unit/entry-block.test.ts`:
    - read keys
    - each warning, with its line
    - a block not directly under a heading → `ENTRY_ORPHAN_BLOCK`
    - two blocks under one heading → the second warns
    - a four-backtick fence holding a value with three backticks
    - alt text as credit; a numeric alias as size, not credit
    - bold and italic kept; link markup printed as text
  - `tests/integration/entry-block-pdf.test.ts`: the PDF holds none of the block's text (SCAR-015)
- **SCAR check:** *(at G3; expected focus 007, 002, 009, 010, 015, 039, 040)*

## D-02 — `entries.*` settings, defaults and Details rows

- **User story:** US-030, all `entries.*` ACs; US-021 (Details view)
- **Description:** Define the `entries` settings in `core/settings`, read them from preset notes, set the built-in defaults, and show them in the preset Details view. No rows in the settings tab or the style panel (G0-C9).
- **Acceptance criteria (from the story):** *(at step 3)*. Expected settings:
  - `entries.chapterHeading` (G0-C2)
  - `entries.statblock.stats`, `.traits`, `.fill`, `.frame`, `.rules`, `.fonts`, `.sizes`
  - `entries.statblock.boxes` (the key whose value sets the number of tick boxes), `entries.statblock.track` (every possible Condition cell, in order: label and SVG path), `entries.statblock.trackDefault` (the cells used when an entry has no `conditions` key) (D48, D49)
  - `entries.tagLabels`, `entries.emptyWarn` (50 %), `entries.maxWordGap` (200 %), `entries.narrowJustification`, `entries.fullImageHeader` (off)
  - `entries.image.minScale` (70 %), separate from `images.minScale` (G0-C5)
  - `entries.quickReference` (off), `entries.encounterSheet` (off), `entries.encounterSheetFile` (off) (D56)
  - `colorMode: grayscale` marks a grayscale preset; no detection from colours (G0-C7)
  - `images.minDpi` (300)

  Built-in defaults are empty or off (G0-C1).
- **Implementation notes:**
  - Every setting is tested at a value other than its default (SCAR-019).
  - A preset value must win over Typst's defaults (SCAR-037), and over the template (G0-C6, as in US-023).
  - SVG paths in `entries.statblock.track` resolve like the preset's font and template paths; a missing file gives the existing missing-file warning and the cell is drawn without an icon.
  - Keep the one-way dependency rule: settings are pure data in `core/settings`.
- **Tests:**
  - `tests/unit/settings-entries.test.ts`: parse, defaults, invalid values → warning and default
  - `tests/unit/details-rows.test.ts`: the new rows and their sources
- **SCAR check:** *(at G3; expected focus 019, 020, 037)*

## D-03 — Synthetic entries chapter in the sample vault

- **User story:** US-024 (amendment)
- **Description:** The fixture generator writes a **new** generated note with a synthetic bestiary chapter that exercises every case, so that no test or manual check uses real book data (agent rule 2, SCAR-035). `Book.md` is unchanged (G0-C13).
- **Acceptance criteria (from the story):** *(at step 3)*. Expected content, generated:
  - 3 sections
  - 12 entries covering all 7 layouts
  - one unpaired page entry at a section end
  - one overflowing entry
  - one entry with a 270 px wide image (low DPI)
  - one narrow-column line that is known to gap (invented words of the same shape — a short word followed by one long unbreakable word — found by running the generator, in a 45 % column)
  - one entry with no opening paragraph
  - one with an unmapped tag
  - one repeated tag set
  - for the tracks (D48, D49): a box value of 30 (two box rows), one above 45, one non-number (`varies`), one entry with `conditions: none`, one whose `conditions` adds the optional cell
  - one value with bold and one with left-over link markup (G0-A7); one illustration with alt text (credit) and one with a numeric size alias (G0-A6)
  - one repeat comment from the Vault Compiler between two entries (G0-B3)
  - a numbered-heading variant of the chapter for G0-C12
- **Implementation notes:**
  - The fixture changes only through its generator (agent rule 2).
  - The images are generated: solid fills at fixed pixel sizes, landscape 1280 × 1006, portrait 358 × 736, small 272 × 334.
  - The track icons are generated too: six simple, distinct SVG shapes. The book's game-icons.net files are not used in the fixture.
  - The forbidden-word guard also reads a **git-ignored local word list** generated from the user's vault, so the vault's names are never committed (G0-C13).
- **Tests:** `tests/unit/fixture-generator.test.ts`: the chapter is present, the counts are as listed, and two runs give byte-identical output.
- **SCAR check:** *(at G3; expected focus 018, 035)*

## D-04 — Statblock emitter

- **User story:** US-030, statblock content, style, grayscale, never split, tall blocks, no links
- **Description:** Emit the statblock as a Typst helper call, built from the block data and the preset. The parts, top to bottom, separated by thin rules:
  - title band: the name between ◆, **without a heading number** even when headings are numbered (G0-C12)
  - the box row and the Condition track (D-19)
  - attributes line and traits line, centred, only the fields that are set (the box key is no longer in a stats row, D40)
  - attacks, name left and dice right, with a hanging indent
  - `Skills:` line
  - mapped tags
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - for `vigour: 11, might: 4, wits: 2, speed: 5` with `boxes: vigour` and `attacks: ["Kick: 2d6"]`, with labels from the preset, the PDF text contains `VIGOUR 11 … Might 4 · Wits 2 · Speed 5 Kick 2d6`
  - no traits line when no trait is set
  - with `fill: none` no fill is drawn (the fills on the page are checked)
  - with `colorMode: grayscale`, frame, rules, band and tags are `#4d4d4d` and values are black (G0-C7)
  - a preset value wins over the same value in the template (G0-C6)
  - no link annotation inside the statblock, even for left-over link markup (G0-A7)
  - the block is `breakable: false`
- **Implementation notes:**
  - All user text goes through the one escaping function (agent rule 6).
  - The helper lives in the generated prelude, and its name is added to `PLUGIN_NAMES` (template name check).
  - Reference look: the 2026-11-05 proof and the tracks print check (private spec repository, `proofs/statblock-proof/` and `proofs/print-check/`), hand-set Typst files with the same parts at A5 (sizes 11.5 / 11 / 5.5 / 7.5 / 7 / 9 pt).
  - The drawing rules (part order, what is left out when empty) are written once and shared with D-20 (G0-A9).
- **Tests:**
  - `tests/unit/emit-statblock.test.ts`: exact Typst for 3 data sets
  - `tests/integration/statblock-pdf.test.ts`: text, order, fills and colours from the PDF; no link annotations in the box (SCAR-015)
  - a rendered check at 100 % or larger (SCAR-025)
- **SCAR check:** *(at G3; expected focus 007, 010, 015, 025)*

## D-05 — Entry opening: first paragraph beside the statblock

- **User story:** US-030, position, no opening paragraph, short opening paragraph
- **Description:** Take the entry's first plain paragraph and set it in a 45 % column beside the 55 % statblock. The body continues full width below whichever of the two is taller.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - an entry starting with a list → `ENTRY_NO_LEDE "Pale Horse": starts with list`, and the list starts beside the statblock
  - an opening paragraph of 6 words → `ENTRY_LEDE_SHORT "Fen Hare": 6 words`
- **Implementation notes:**
  - "First paragraph" is decided on the parsed tree after the block is removed. A rule that reads the first line must look inside containers such as quotes and callouts. (SCAR-041 containers, SCAR-034 headers before content).
  - The 45/55 split and the 10-word threshold are named constants (G0-C8).
- **Tests:** `tests/unit/entry-opening.test.ts`: plain paragraph, list first, callout first, image first, heading first, short paragraph
- **SCAR check:** *(at G3; expected focus 002, 009, 034, 041)*

## D-06 — Typography inside entries

- **User story:** US-031, small sub-headings, keep-together lists, sticky sub-headings
- **Description:**
  - Headings below the entry heading are set small, are left out of the TOC and the running header, and never break a page.
  - Lists of up to 10 items are not split.
  - A sub-heading keeps at least two lines of what follows.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - a 10-item list is on one page
  - an 11-item list may split, with at least 2 items in each part
  - an entry's h4 is not in the TOC
- **Implementation notes:**
  - Interaction with the US-025 page-break rules: a page-break rule for h4 must not fire inside an entry. Decide this per rule (SCAR-017, class search).
  - The 10-item limit is a named constant (G0-C8).
- **Tests:** `tests/integration/entry-typography-pdf.test.ts`, with page contents read from the PDF
- **SCAR check:** *(at G3; expected focus 017, 009, 015)*

## D-07 — Spread-sized layouts

- **User story:** US-031: `full-image`, `spread-landscape`, `spread-portrait`, `spread-text`, left-page start, credit caption, image fit
- **Description:**
  - A spread-sized entry starts on a left page. Left page: heading, opening and body. Right page: the image as the layout says, with the text continuing.
  - Images are never cropped, and their slot shrinks to the image.
  - A `full-image` page has no header and no folio (setting `entries.fullImageHeader`), but counts in the numbering.
  - The credit caption is the illustration's alt text (G0-A6).
  - US-028 float/move is off inside entries: the entry layout places the illustration (G0-C5).
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - an entry that would start on a right page gets a blank right page before it and `ENTRY_BLANK_PAGE`, unless D-09 fills that page. The blank page shows **only the folio**, no header and no other content (G0-C11)
  - `full-image`: the right page has exactly one image, no header text and no footer text
  - a 3:2 image in `spread-landscape` is drawn at text width with height = width × 2/3
  - the caption text equals the alt text; no caption when there is none
- **Implementation notes:**
  - Reuse the facing-page logic of US-009 and US-026 (left or right page).
  - Image size checks use the drawn-image matrix that `tests/support/pdf.ts` already reads (US-028 AC-6).
- **Tests:** `tests/integration/entry-spread-pdf.test.ts`: page parity, image count and size, header and footer per page, the blank page's footer text is the folio only
- **SCAR check:** *(at G3; expected focus 015, 024, 025)*

## D-08 — Page-sized layouts and pairing

- **User story:** US-031: `page-text`, `page-landscape`, `page-portrait`, pairing, unpaired entry, mirrored portrait image
- **Description:**
  - Page-sized entries take one page each. Neighbours in document order share a spread (left, then right), never across a section heading.
  - A portrait image goes on the outer edge.
  - An unpaired entry leaves its right page blank, folio only (G0-C11), with `ENTRY_UNPAIRED`, unless D-09 fills it.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected sequence page, page, spread, page, then a new section:
  - spread 1: page + page
  - spread 2: the spread entry
  - spread 3: page + the next section's opener

  The portrait image's x position is at the left margin on a left page and ends at the right margin on a right page.
- **Implementation notes:** composed usage: a pair whose first entry overflows (handled by D-13) (SCAR-002). The 40 % landscape height is a named constant (G0-C8).
- **Tests:** `tests/integration/entry-pairing-pdf.test.ts`, using the D-03 fixture sequence
- **SCAR check:** *(at G3; expected focus 002, 007, 015)*

## D-09 — Section and chapter openers

- **User story:** US-033: section opener on a right page, chapter intro shared with the first section, gap reuse, long intro
- **Description:**
  - The entries chapter is the one named by `entries.chapterHeading` (G0-C2, tentative until the spike).
  - A section's heading and intro go on one right page, and its first entry starts on the next left page.
  - The chapter intro shares the first section's opener page.
  - A free right page left by the previous section is used for the opener instead of adding a page.
  - Running header: the chapter opener page has none, as US-019 prints no header on a page where an H1 starts; later section openers show their section name (G0-C3).
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - the previous section ends on a left page → the opener is on the facing right page, with no blank page
  - the previous section ends on a right page → the opener is on the next right page, the left page between is blank (folio only, G0-C11), and `ENTRY_BLANK_PAGE "<section>"` is given
  - an intro longer than one page → `SECTION_INTRO_OVERFLOW`
  - the chapter opener page has no running header; the second section's opener shows that section's name
- **Implementation notes:** this overrides `page.breakBefore` (US-025) for this chapter only. That needs an explicit precedence rule in the story.
- **Tests:** `tests/integration/entry-openers-pdf.test.ts`
- **SCAR check:** *(at G3; expected focus 017, 019, 021)*

## D-10 — Presets without facing pages

- **User story:** US-031, non-facing fallback
- **Description:** With `facingPages: false`, a spread becomes two consecutive pages, with no left-page start and no blank pages. Pairs and openers still apply as consecutive pages. The statblock and its tracks are the same as in every other preset (D51).
- **Acceptance criteria (from the story):** *(at step 3)*. Expected: the D-03 chapter with `facingPages: false` has no blank pages and no `ENTRY_BLANK_PAGE` warning.
- **Tests:** a parameterised run of D-07, D-08 and D-09 with facing pages on and off (SCAR-019)
- **SCAR check:** *(at G3; expected focus 019)*

## D-11 — Measured layout for entries

- **User story:** US-032, the measurement that the automatic choice, overflow and empty-page warning rely on
- **Description:** The compile reports, for each entry:
  - the height of its text at each candidate layout
  - the space left on its pages

  The mechanism is chosen by the spike: the US-028 read-back (fit decisions fed into a second compile) or Typst `measure()` inside one compile. The preview runs the same measured layout, so its pages match the export (G0-C10, US-012 AC-13).
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - for a fixture entry of 1 page + about 6 lines, the measurement says "does not fit `page-text`" and the second page is about 85 % empty
  - two consecutive compiles give byte-identical Typst (agent rule 7)
  - preview and export give the same page count for the D-03 chapter
- **Implementation notes:**
  - If read-back: reuse the US-028 mechanism (TICKET-092, #116 settle rules) and do not start a second one (SCAR-017).
  - Check stability: a choice that changes the layout must not flip back on the next pass (SCAR-021).
  - List what the compile callback has available when it runs (SCAR-022).
- **Tests:** `tests/integration/entry-measure.test.ts`: reported values for 4 fixture entries, settle within the US-028 pass limit
- **SCAR check:** *(at G3; expected focus 021, 022, 024, 017, 030)*

## D-12 — Automatic layout choice

- **User story:** US-032, the decision table, `ENTRY_AUTO`, layout conflicts
- **Description:** For `layout: auto` or a conflicting layout, choose from the image (none, landscape, portrait) and the measured fit:
  - fits on one page → `page-*`
  - else → `spread-*`
  - `full-image` is never chosen automatically

  Report the choice.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - no image and fits → `page-text`
  - no image and doesn't fit → `spread-text`
  - landscape and fits → `page-landscape`
  - portrait and doesn't fit → `spread-portrait`

  Each choice gives `ENTRY_AUTO "<name>": <layout>`. An image with width = height counts as landscape.
- **Tests:** `tests/unit/entry-choice.test.ts` (the full table from given measurements), plus an integration test over the fixture
- **SCAR check:** *(at G3; expected focus 007, 020)*

## D-13 — Overflow and the empty-page warning

- **User story:** US-032: shrink to `entries.image.minScale`, overflow, "(continued)" heading, pair partner moves, `ENTRY_SPREAD_EMPTY`
- **Description:**
  - When text doesn't fit, the illustration shrinks in steps down to **`entries.image.minScale`** (default 70 %, silently). `images.minScale` applies to body images only (G0-C5).
  - If the text still doesn't fit, it continues on the next page under a small "<name> (continued)" heading, with `ENTRY_OVERFLOW`.
  - A `full-image` image is never shrunk.
  - A spread whose right page is at least `entries.emptyWarn` empty gives `ENTRY_SPREAD_EMPTY`.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - the fixture's overflowing page entry: image at `entries.image.minScale`, continuation page heading "Cave Wyrm (continued)", partner on the next spread, warning naming both
  - `images.minScale` set to a different value has no effect on entries (SCAR-019)
  - `emptyWarn: 50%` fires for an 85 % empty right page and not for a 40 % empty one
  - with `emptyWarn: 90%`, neither fires (SCAR-019)
- **Implementation notes:** "(continued)" headings are not TOC entries and not link targets (D-14).
- **Tests:** `tests/integration/entry-overflow-pdf.test.ts`
- **SCAR check:** *(at G3; expected focus 002, 019, 021)*

## D-14 — Navigation and quick reference

- **User story:** US-033: TOC lists every entry, running header shows the section, links go to an entry's first page, quick-reference table
- **Description:**
  - Entries are **always** TOC entries, whatever `toc.depth` is (G0-C4).
  - Links to an entry **always** get a page number, whatever `linkPageLevel` is (G0-C4), pointing to its first page.
  - The running header on entry pages is the section name, with none on `full-image` pages and none on the chapter opener (G0-C3, D-09).
  - After the last entry, a generated table lists every entry: name, section, the box value, the attribute values from `entries.statblock.stats`, a **Track** column and the page. **Track** is empty for the default track (`trackDefault`), `+ <cell>` when the entry adds a cell, `none` for `conditions: none`, and otherwise the cells in short form. It is sorted by name, starts on a left page under a configurable heading (`Quick Reference`), is in the TOC, its header row repeats, and `entries.quickReference` switches it on (default off, G0-C1).
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - the fixture's TOC has all 12 entries, also with `toc.depth: 2`
  - a link to an h3 entry has a page number with `linkPageLevel: 2`
  - the table has 12 rows with page numbers equal to the entries' first pages
  - a missing value shows `—`; a repeated entry appears once
  - the Track column for the fixture's default, added-cell and `none` entries
- **Implementation notes:** the page numbers come from the US-018 mechanism. The table is output that depends on its own layout (SCAR-021).
- **Tests:** `tests/integration/entry-navigation-pdf.test.ts`
- **SCAR check:** *(at G3; expected focus 021, 015, 019)*

## D-15 — Image resolution check

- **User story:** US-034, `images.minDpi`
- **Description:** For every block image, compare its pixel width with its final printed width (after fit, shrink or float). Below `images.minDpi`, give `IMAGE_LOW_DPI "<file>": 187 dpi at 62 mm (min 300)`. A file used several times is checked at its largest size. `0` switches the check off.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - the fixture's 272 px image printed 50 mm wide → 138 dpi → warning
  - `minDpi: 0` → no warning
  - `minDpi: 120` → no warning (SCAR-019)
- **Implementation notes:** the printed width comes from the drawn image matrix in the PDF, the same reading as US-028 AC-6, or from the measurement of D-11. Choose by measurement (SCAR-024). The track icons (SVG) are vector and are not checked.
- **Tests:** `tests/integration/image-dpi-pdf.test.ts`
- **SCAR check:** *(at G3; expected focus 019, 024, 028)*

## D-16 — Word gaps: justification limits and the wide-gap warning

- **User story:** US-034, `entries.narrowJustification`, `entries.maxWordGap`, calibration pin
- **Description:**
  - Columns narrower than 60 % of the text width get `par(justification-limits: …)` from the preset.
  - After compiling **for export** (not in the preview, G0-C10), the plugin reads the PDF content streams. For every justified body line, each space's width is its advance plus the negative `TJ` adjustment that follows it, divided by its advance.
  - Lines over `maxWordGap` give `TEXT_WIDE_GAP "<entry>": "<line>" (264 %)`.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - calibration lines set with `text(spacing: 200%)` and `300%` measure 200 % and 300 % (±2 %)
  - the fixture's known gap line warns on export, and the preview gives no `TEXT_WIDE_GAP`
  - full-width fixture text doesn't warn at 200 %
  - quoted text never joins two columns on the same baseline
- **Implementation notes:**
  - Spike results (2026-11-05, Typst 0.14.2):
    - exact on calibration
    - a 45 % column had 7 lines over 200 % without limits and 2 with `spacing (80 %, 150 %)`, `tracking (-0.01 em, 0.03 em)`
    - full-width text peaked at 159 %
  - The 60 % threshold is a named constant (G0-C8).
  - Move the content-stream reader of `tests/support/pdf.ts` (`contentTokens`, `literalBytes`, `readCMap`) into `src/core`, as pure code on the PDF bytes, and make the tests use it (SCAR-001: document its transforms).
  - A naive regex misreads literal strings that hold balanced, unescaped parentheses.
  - Split runs on a large horizontal jump.
  - Leave out header and footer artifacts, non-justified blocks, the statblock and the encounter sheet.
  - The line → entry mapping uses the entries' page ranges from D-14.
  - The scan time on a 260+ page PDF is measured in the spike before G1.
- **Tests:**
  - `tests/unit/pdf-gaps.test.ts`: tokenizer with parentheses, gap arithmetic
  - `tests/integration/word-gaps-pdf.test.ts`: calibration pin (fails if the Typst PDF writer changes), the fixture line, no warning on full-width text
- **SCAR check:** *(at G3; expected focus 001, 015, 023, 024, 028, 030, 032)*

## D-17 — Data checks: sum rule, attacks without dice, unmapped tags

- **User story:** US-030, data warnings
- **Description:**
  - An optional sum rule from the preset (`entries.statblock.sum: {total: vigour, of: [might, wits, speed]}`) gives `STAT_SUM_MISMATCH "<name>": 20 ≠ 4+8+3`.
  - An attack without a `NdM` dice pool gives `STAT_ATTACK_NO_DICE`.
  - A tag that isn't in `entries.tagLabels` is not printed. It gives `TAG_UNMAPPED` **only when the map is not empty** (G0-C1).
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - the three warnings on the fixture's prepared entries
  - no sum rule set → no sum warning
  - an empty tag map → no tags printed and no `TAG_UNMAPPED`
- **Tests:** `tests/unit/entry-checks.test.ts`
- **SCAR check:** *(at G3; expected focus 007, 019)*

## D-18 — Build, documents and manual test

- **User story:** US-030 to US-036, end to end
- **Description:**
  - update the manual (entries chapter, encounter sheet, the Obsidian preview), `docs/technical/warning-codes.md`, `architecture.md` and `tests.md`
  - make a test build
  - hand over a manual test with the sample vault and an environment checklist
- **Acceptance criteria (from the story):** *(at step 3)*. Expected: the M-check of the D-03 chapter at 100 % zoom, with every layout, opener, pair, warning, the tracks, the quick-reference table, both encounter-sheet forms (one printed at 100 % and marked with a pencil) and the reading-view preview checked against a list.
- **Implementation notes:**
  - The environment must be ready and the build identifiable before handover (SCAR-012).
  - Inspect rendered output at 100 % or larger (SCAR-025).
  - The full quality gate must pass (SCAR-006).
- **Tests:** the full quality gate
- **SCAR check:** *(at G3/G4; expected focus 006, 012, 018, 025, 028, 029, 030)*

## D-19 — Tick boxes and Condition track in the statblock

- **User story:** US-030, tracks (D48, D49, D51, D52)
- **Description:** Two parts of the statblock, drawn between the title band and the attributes line:
  - **Box row:** on the left, the label of the `entries.statblock.boxes` key above its value, in the accent colour. On the right, one empty box per point of the value, 15 per row in three groups of 5, filling from the top left. The boxes share the remaining width, so their size follows from the statblock width (about 2.4 mm in A5 MU; the print check of 2026-11-05 found 2.0 mm still fine). The value is the base value only (D52).
  - **Condition track:** the label `CONDITION`, then one framed cell of equal width per cell of the entry's track, in one row, each with its SVG icon recoloured to the frame colour and drawn at 75 % opacity. The track is `entries.statblock.trackDefault` unless the entry has a `conditions` key: a list of cell labels, matched case-insensitively against `entries.statblock.track`, or `none` for no track.
  - Boxes and cells are filled with the page colour, not the statblock fill, so pencil marks stay visible (white with a `#4d4d4d` frame in grayscale).
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - value 11 → 11 boxes in one row; 30 → two rows of 15; 45 → three rows
  - value 46 → printed without boxes and `STAT_BOXES_MANY "<name>": 46`
  - value `0` → printed as written, no boxes, no warning; `varies` → printed as written, no boxes, `STAT_GRIT_NOT_NUMBER "<name>"` (the code names the configured key's role, not RoA's Grit; the final code name is decided at G1)
  - no `entries.statblock.boxes` → no box row, and the value stays in the attributes line
  - no `conditions` → the `trackDefault` cells; `conditions: none` → no track; a `conditions` list with an unknown label → that cell is left out with a warning
  - no statblock (no stats and no attacks) → no track either
  - grayscale: icons and frames `#4d4d4d`, boxes white
- **Implementation notes:**
  - Read the SVG once per export and recolour it by replacing its fill, as in the print check (`read()` + `bytes()` in Typst); check that this works in the WASM compiler with the vault's file access (SCAR-022).
  - The box row's label column width and gaps are named constants (G0-C8): column 7.5 mm, 0.35 mm between boxes, 0.9 mm between groups.
- **Tests:**
  - `tests/unit/emit-tracks.test.ts`: box counts and rows, track selection, every warning
  - `tests/integration/tracks-pdf.test.ts`: number and size of the drawn boxes and cells read from the PDF, icon count, colours in colour and grayscale (SCAR-015)
  - a rendered check at 100 % (SCAR-025)
- **SCAR check:** *(at G3; expected focus 007, 015, 019, 022, 025)*

## D-20 — Statblock preview of `o2t-entry` blocks in Obsidian

- **User story:** US-035 (G0-A9)
- **Description:** Register a Markdown code-block processor for `o2t-entry`. In reading view and live preview it draws the statblock (title band, box row, Condition track, attributes, traits, attacks, skills, tags) from the block's YAML, with the `entries.*` settings of the active preset, as HTML and CSS.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - the fixture's `Fen Hare` block shows a statblock with its name, 11 boxes, the default track and its attacks
  - a missing value shows `—`, an attack without dice is highlighted
  - invalid YAML shows the raw block with an `ENTRY_YAML_INVALID` notice, never hidden
  - the boxes and cells are drawn but do not react to clicks (interactive tracks are vault content, BL-A3 and the `Encounter Tracker` note)
  - no active preset, or one with empty `entries.*` → the block shows as a plain code block with a one-line notice
- **Implementation notes:**
  - Share the drawing rules with D-04 and D-19 (part order, what is left out when empty, track selection) as pure functions in `src/core`, so the PDF and the preview can't drift (SCAR-017). The vault's DataviewJS view (BL-A3) is meant to use the same code; how it gets it (a published module, or a copy checked by a test) is decided at G1.
  - The SVG icons are loaded through the vault adapter, never from the network.
  - The renderer must not slow down opening a long compiled book: measure the time for a note with 40 blocks (SCAR-030).
- **Tests:**
  - `tests/unit/entry-preview.test.ts`: the HTML for 3 data sets, the invalid and empty cases
  - a manual check in reading view and live preview (D-18)
- **SCAR check:** *(at G3; expected focus 016, 017, 022, 030)*

## D-21 — Encounter sheet: A4 file and page in the book

- **User story:** US-036 (D50, D56; spec BL-C15 AC-1, AC-2, AC-2a, AC-2b, AC-4)
- **Description:** Generate a sheet of blank tracker rows in two forms:
  - **(a) standalone A4 file** (`entries.encounterSheetFile`): a separate one-page A4 portrait PDF written next to the book PDF as `<book file name> - Encounter Sheet.pdf`, whatever the book's page size. Margins 12 mm at the sides and top, 10 mm at the bottom. Rows **two across** (each 91 mm wide, 4 mm apart), as many lines as fit.
  - **(b) page in the book** (`entries.encounterSheet`): a page of its own after the quick-reference table, in the TOC. One column at the text width; two across when the text width allows two rows of at least 88 mm.

  Every row, framed with a 0.4 pt line and 2.5 mm padding, has three lines:
  1. a write-in line for the name, then small write-in boxes (7 × 4.5 mm) for each attribute in `entries.statblock.stats` (Body, Mind, Agility in A5 MU)
  2. 30 tick boxes (two rows of 15 in groups of 5) and next to them **every** cell of `entries.statblock.track`, with icons
  3. two attack slots, `ATTACK` (write-in line) and `DICE` (10 mm field): side by side when the row is at least 100 mm wide, one above the other in narrower rows

  Both forms have the heading `Encounter Sheet` with a write-in field for the round, a one-line icon key with the marking rule, and the icon credit at the foot of the page. The number of rows follows from the measured row height and a 2 mm gap: 8 lines × 2 = 16 rows on A4, 5 rows on an A5 MU page.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - with `encounterSheetFile: true`, the export writes two PDFs; the second has exactly one A4 page with 16 rows
  - with `encounterSheet: true`, the book has the sheet page right after the quick reference, in the TOC, with 5 rows in an A5 preset
  - each row has 30 boxes and one cell per track entry; the boxes are at least 2.0 mm
  - with both off (the built-in default), neither appears
- **Implementation notes:**
  - Reuse the box and cell drawing of D-19; the row is a second caller, not a copy (SCAR-017).
  - The A4 file is a second compile with its own page setup. Decide at G1 whether it shares the book's prelude and fonts, and how the export reports two output files (US-007 export path, overwrite rules).
  - The icon key text, the round label and the credit line come from the preset (generic plugin, G0-C1).
  - Reference mockup: private spec repository, `proofs/encounter-sheet/` (`encounter-sheet-mockup.typ` and its PDF), compiled with Typst 0.15.1.
- **Tests:**
  - `tests/unit/encounter-sheet.test.ts`: row count from given heights, one and two columns, stacked and side-by-side attacks
  - `tests/integration/encounter-sheet-pdf.test.ts`: page size, row and box counts, box size from the PDF, the second file's name (SCAR-015)
  - a rendered check at 100 % and one printed check in the manual test (SCAR-025)
- **SCAR check:** *(at G3; expected focus 012, 015, 017, 019, 025)*
