# Draft tickets — Entry layouts (epic #121)

**Status:** Draft, 2026-11-05. **Not filed yet.**

These drafts become `ticket` issues (form `.github/ISSUE_TEMPLATE/ticket.yml`, label `ticket` plus `US-NNN`) only after these steps, each with its gate:
1. step 0 / G0: SCAR review
2. step 1 / G1: the stories
3. step 2 / G2: the tests

Each draft follows the form. The **SCAR check** field is filled at G3, not here. The SCARs named below are the ones expected to matter, as a starting point for G3 and not instead of it. `docs/tickets/` stays a read-only archive, so the drafts live here.

## Proposed stories

| Story | Title | Drafts |
|---|---|---|
| US-030 | Entry data and statblock | D-01, D-02, D-04, D-05, D-17 |
| US-031 | Entry layouts on facing pages | D-06, D-07, D-08, D-10 |
| US-032 | Fit, overflow and automatic layout choice | D-11, D-12, D-13 |
| US-033 | Section openers, navigation and quick reference | D-09, D-14 |
| US-034 | Print checks: image resolution and word gaps | D-15, D-16 |
| US-024 (amendment) | Synthetic public fixture | D-03 |
| all | Build, documents, manual test | D-18 |

## Order

D-01, D-02, D-03 → D-04, D-05, D-17 → D-06, D-07, D-08, D-10 → D-11 → D-12, D-13 → D-09, D-14 → D-15, D-16 → D-18.

D-15 and D-16 don't depend on the entry work and can be done any time after D-02.

## Open points for G0

1. **Generic plugin (epic #121).** Game terms live in the preset, not in code:
   - `entries.statblock.stats` (field and label list)
   - `entries.statblock.traits`
   - `entries.tagLabels`
   - the sum check of D-17

   The examples below use synthetic fields (`might`, `wits`, `speed`, total `vigour`).
2. **Which chapter holds entries.** Entries are recognised by their `o2t-entry` block, not by a chapter name. The chapter-intro rule of D-09 needs to know the chapter: proposed, the heading that is the nearest common ancestor of all entry headings in a run.
3. **Measured layout.** The automatic choice, overflow and the empty-page warning all need sizes from Typst. Proposed: the read-back mechanism of US-028 (fit decisions reported by the compile and fed into a second compile, settling as in the #116 amendment). It must be checked for stability: output that depends on its own layout (SCAR-021).
4. **Warning codes.** The draft codes are `ENTRY_*`, `STAT_*`, `TAG_UNMAPPED`, `IMAGE_LOW_DPI` and `TEXT_WIDE_GAP`. Each one goes into `docs/technical/warning-codes.md` with a source location (agent rule 8).

---

## D-01 — The `o2t-entry` block: specification and reading

- **User story:** US-030, AC: block read, invalid YAML, unknown layout, layout conflict
- **Description:** Write the format of the `o2t-entry` block once (`docs/technical/entry-block.md`), as the contract the Vault Compiler writes to (JollyOrc/ObsidianVaultCompiler#108). Then read it in `core/parse` / `core/markers` as data for the nearest heading above it. It is never printed.
- **Acceptance criteria (from the story):** *(copied at step 3)*. Expected:
  - a block under `### Fen Hare` is data of that heading
  - invalid YAML → `ENTRY_YAML_INVALID "Fen Hare"` and the entry is laid out as plain text
  - `layout: sideways` → `ENTRY_LAYOUT_UNKNOWN "Fen Hare: sideways"`, treated as `auto`
  - `full-image` without an image → `ENTRY_LAYOUT_CONFLICT "Fen Hare": full-image → page-text (no illustration)`
- **Implementation notes:**
  - The block is an in-band marker. List every step that reads fenced code (code emitter, markers, page breaks, image fit) and make sure only the entry reader consumes it. (SCAR-039: in-band markers read by other steps).
  - The format has a named reader, this plugin (SCAR-040: an output format names its reader).
  - Keys the reader doesn't know give one warning per key, not an abort.
- **Tests:**
  - `tests/unit/entry-block.test.ts`:
    - read keys
    - each warning, with its line
    - a block not directly under a heading → `ENTRY_ORPHAN_BLOCK`
    - two blocks under one heading → the second warns
  - `tests/integration/entry-block-pdf.test.ts`: the PDF holds none of the block's text (SCAR-015)
- **SCAR check:** *(at G3; expected focus 007, 002, 009, 010, 015, 039, 040)*

## D-02 — `entries.*` settings, defaults and Details rows

- **User story:** US-030, all `entries.*` ACs; US-021 (Details view)
- **Description:** Define the `entries` settings in `core/settings`, read them from preset notes, set the built-in defaults, and show them in the preset Details view.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected settings:
  - `entries.statblock.stats`, `.traits`, `.fill`, `.frame`, `.rules`, `.fonts`, `.sizes`
  - `entries.tagLabels`, `entries.emptyWarn` (50 %), `entries.maxWordGap` (200 %), `entries.narrowJustification`, `entries.quickReference`, `entries.fullImageHeader` (off)
  - `images.minDpi` (300)
- **Implementation notes:**
  - Every setting is tested at a value other than its default (SCAR-019).
  - A preset value must win over Typst's defaults (SCAR-037).
  - Keep the one-way dependency rule: settings are pure data in `core/settings`.
- **Tests:**
  - `tests/unit/settings-entries.test.ts`: parse, defaults, invalid values → warning and default
  - `tests/unit/details-rows.test.ts`: the new rows and their sources
- **SCAR check:** *(at G3; expected focus 019, 020, 037)*

## D-03 — Synthetic entries chapter in the sample vault

- **User story:** US-024 (amendment)
- **Description:** The fixture generator writes a synthetic bestiary chapter that exercises every case, so that no test or manual check uses real book data (agent rule 2, SCAR-035).
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
- **Implementation notes:**
  - The fixture changes only through its generator (agent rule 2).
  - The images are generated: solid fills at fixed pixel sizes, landscape 1280 × 1006, portrait 358 × 736, small 272 × 334.
- **Tests:** `tests/unit/fixture-generator.test.ts`: the chapter is present, the counts are as listed, and two runs give byte-identical output.
- **SCAR check:** *(at G3; expected focus 018, 035)*

## D-04 — Statblock emitter

- **User story:** US-030, statblock content, style, grayscale, never split, tall blocks
- **Description:** Emit the statblock as a Typst helper call, built from the block data and the preset:
  - title band (name between ◆)
  - row of stat cells, with the first one in the accent colour
  - traits line, only the fields that are set
  - attacks with dice right-aligned and hanging indent
  - `Skills:` line
  - mapped tags
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - for `might: 4, wits: 2, speed: 5, vigour: 11` and `attacks: ["Kick: 2d6"]`, with labels from the preset, the PDF text contains `VIGOUR MIGHT WITS SPEED 11 4 2 5 Kick 2d6`
  - no traits line when no trait is set
  - with `fill: none` no fill is drawn (the fills on the page are checked)
  - the block is `breakable: false`
- **Implementation notes:**
  - All user text goes through the one escaping function (agent rule 6).
  - The helper lives in the generated prelude, and its name is added to `PLUGIN_NAMES` (template name check).
  - Reference look: the 2026-11-05 proof, a hand-set Typst file with the same parts at A5 (sizes 11.5 / 11 / 5.5 / 7.5 / 7 / 9 pt).
- **Tests:**
  - `tests/unit/emit-statblock.test.ts`: exact Typst for 3 data sets
  - `tests/integration/statblock-pdf.test.ts`: text, order and fills from the PDF (SCAR-015)
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
- **Tests:** `tests/integration/entry-typography-pdf.test.ts`, with page contents read from the PDF
- **SCAR check:** *(at G3; expected focus 017, 009, 015)*

## D-07 — Spread-sized layouts

- **User story:** US-031: `full-image`, `spread-landscape`, `spread-portrait`, `spread-text`, left-page start, credit caption, image fit
- **Description:**
  - A spread-sized entry starts on a left page. Left page: heading, opening and body. Right page: the image as the layout says, with the text continuing.
  - Images are never cropped, and their slot shrinks to the image.
  - A `full-image` page has no header and no folio (setting `entries.fullImageHeader`), but counts in the numbering.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - an entry that would start on a right page gets a blank right page before it and `ENTRY_BLANK_PAGE`, unless D-09 fills that page
  - `full-image`: the right page has exactly one image, no header text and no footer text
  - a 3:2 image in `spread-landscape` is drawn at text width with height = width × 2/3
- **Implementation notes:**
  - Reuse the facing-page logic of US-009 and US-026 (left or right page).
  - Image size checks use the drawn-image matrix that `tests/support/pdf.ts` already reads (US-028 AC-6).
- **Tests:** `tests/integration/entry-spread-pdf.test.ts`: page parity, image count and size, header and footer per page
- **SCAR check:** *(at G3; expected focus 015, 024, 025)*

## D-08 — Page-sized layouts and pairing

- **User story:** US-031: `page-text`, `page-landscape`, `page-portrait`, pairing, unpaired entry, mirrored portrait image
- **Description:**
  - Page-sized entries take one page each. Neighbours in document order share a spread (left, then right), never across a section heading.
  - A portrait image goes on the outer edge.
  - An unpaired entry leaves its right page blank (`ENTRY_UNPAIRED`), unless D-09 fills it.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected sequence page, page, spread, page, then a new section:
  - spread 1: page + page
  - spread 2: the spread entry
  - spread 3: page + the next section's opener

  The portrait image's x position is at the left margin on a left page and ends at the right margin on a right page.
- **Implementation notes:** composed usage: a pair whose first entry overflows (handled by D-13) (SCAR-002).
- **Tests:** `tests/integration/entry-pairing-pdf.test.ts`, using the D-03 fixture sequence
- **SCAR check:** *(at G3; expected focus 002, 007, 015)*

## D-09 — Section and chapter openers

- **User story:** US-033: section opener on a right page, chapter intro shared with the first section, gap reuse, long intro
- **Description:**
  - A section's heading and intro go on one right page, and its first entry starts on the next left page.
  - The chapter intro shares the first section's opener page.
  - A free right page left by the previous section is used for the opener instead of adding a page.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - the previous section ends on a left page → the opener is on the facing right page, with no blank page
  - the previous section ends on a right page → the opener is on the next right page, the left page between is blank, and `ENTRY_BLANK_PAGE "<section>"` is given
  - an intro longer than one page → `SECTION_INTRO_OVERFLOW`
- **Implementation notes:** this overrides `page.breakBefore` (US-025) for this chapter only. That needs an explicit precedence rule in the story.
- **Tests:** `tests/integration/entry-openers-pdf.test.ts`
- **SCAR check:** *(at G3; expected focus 017, 019, 021)*

## D-10 — Presets without facing pages

- **User story:** US-031, non-facing fallback
- **Description:** With `facingPages: false`, a spread becomes two consecutive pages, with no left-page start and no blank pages. Pairs and openers still apply as consecutive pages.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected: the D-03 chapter with `facingPages: false` has no blank pages and no `ENTRY_BLANK_PAGE` warning.
- **Tests:** a parameterised run of D-07, D-08 and D-09 with facing pages on and off (SCAR-019)
- **SCAR check:** *(at G3; expected focus 019)*

## D-11 — Measured layout read-back for entries

- **User story:** US-032, the measurement that the automatic choice, overflow and empty-page warning rely on
- **Description:** The compile reports, for each entry:
  - the height of its text at each candidate layout
  - the space left on its pages

  The plugin feeds these back into a second compile, in the same way US-028 reads back its fit decisions.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - for a fixture entry of 1 page + about 6 lines, the read-back says "does not fit `page-text`" and the second page is about 85 % empty
  - two consecutive compiles give byte-identical Typst (agent rule 7)
- **Implementation notes:**
  - Reuse the US-028 mechanism (TICKET-092, #116 settle rules) and do not start a second one (SCAR-017).
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

- **User story:** US-032: shrink to `images.minScale`, overflow, "(continued)" heading, pair partner moves, `ENTRY_SPREAD_EMPTY`
- **Description:**
  - When text doesn't fit, the image shrinks in steps down to `images.minScale` (silently).
  - If the text still doesn't fit, it continues on the next page under a small "<name> (continued)" heading, with `ENTRY_OVERFLOW`.
  - A `full-image` image is never shrunk.
  - A spread whose right page is at least `entries.emptyWarn` empty gives `ENTRY_SPREAD_EMPTY`.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - the fixture's overflowing page entry: image at `minScale`, continuation page heading "Cave Wyrm (continued)", partner on the next spread, warning naming both
  - `emptyWarn: 50%` fires for an 85 % empty right page and not for a 40 % empty one
  - with `emptyWarn: 90%`, neither fires (SCAR-019)
- **Implementation notes:** "(continued)" headings are not TOC entries and not link targets (D-14).
- **Tests:** `tests/integration/entry-overflow-pdf.test.ts`
- **SCAR check:** *(at G3; expected focus 002, 019, 021)*

## D-14 — Navigation and quick reference

- **User story:** US-033: TOC lists every entry, running header shows the section, links go to an entry's first page, quick-reference table
- **Description:**
  - Entries are TOC entries.
  - The running header on entry pages is the section name, with none on `full-image` pages.
  - Page references to an entry give its first page.
  - After the last entry, a generated table lists every entry with its stat values, its section and its page. It is sorted by name, starts on a left page, its header row repeats, and `entries.quickReference` switches it on or off.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - the fixture's TOC has all 12 entries
  - the table has 12 rows with page numbers equal to the entries' first pages
  - a missing value shows `—`
- **Implementation notes:** the page numbers come from the US-018 mechanism. The table is output that depends on its own layout (SCAR-021).
- **Tests:** `tests/integration/entry-navigation-pdf.test.ts`
- **SCAR check:** *(at G3; expected focus 021, 015)*

## D-15 — Image resolution check

- **User story:** US-034, `images.minDpi`
- **Description:** For every block image, compare its pixel width with its final printed width (after fit, shrink or float). Below `images.minDpi`, give `IMAGE_LOW_DPI "<file>": 187 dpi at 62 mm (min 300)`. A file used several times is checked at its largest size. `0` switches the check off.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - the fixture's 272 px image printed 50 mm wide → 138 dpi → warning
  - `minDpi: 0` → no warning
  - `minDpi: 120` → no warning (SCAR-019)
- **Implementation notes:** the printed width comes from the drawn image matrix in the PDF, the same reading as US-028 AC-6, or from the read-back. Choose by measurement (SCAR-024).
- **Tests:** `tests/integration/image-dpi-pdf.test.ts`
- **SCAR check:** *(at G3; expected focus 019, 024, 028)*

## D-16 — Word gaps: justification limits and the wide-gap warning

- **User story:** US-034, `entries.narrowJustification`, `entries.maxWordGap`, calibration pin
- **Description:**
  - Columns narrower than 60 % of the text width get `par(justification-limits: …)` from the preset.
  - After compiling, the plugin reads the PDF content streams. For every justified body line, each space's width is its advance plus the negative `TJ` adjustment that follows it, divided by its advance.
  - Lines over `maxWordGap` give `TEXT_WIDE_GAP "<entry>": "<line>" (264 %)`.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - calibration lines set with `text(spacing: 200%)` and `300%` measure 200 % and 300 % (±2 %)
  - the fixture's known gap line warns
  - full-width fixture text doesn't warn at 200 %
  - quoted text never joins two columns on the same baseline
- **Implementation notes:**
  - Spike results (2026-11-05, Typst 0.14.2):
    - exact on calibration
    - a 45 % column had 7 lines over 200 % without limits and 2 with `spacing (80 %, 150 %)`, `tracking (-0.01 em, 0.03 em)`
    - full-width text peaked at 159 %
  - Move the content-stream reader of `tests/support/pdf.ts` (`contentTokens`, `literalBytes`, `readCMap`) into `src/core`, as pure code on the PDF bytes, and make the tests use it (SCAR-001: document its transforms).
  - A naive regex misreads literal strings that hold balanced, unescaped parentheses.
  - Split runs on a large horizontal jump.
  - Leave out header and footer artifacts and non-justified blocks.
  - The line → entry mapping uses the entries' page ranges from D-14.
- **Tests:**
  - `tests/unit/pdf-gaps.test.ts`: tokenizer with parentheses, gap arithmetic
  - `tests/integration/word-gaps-pdf.test.ts`: calibration pin (fails if the Typst PDF writer changes), the fixture line, no warning on full-width text
- **SCAR check:** *(at G3; expected focus 001, 015, 023, 024, 028, 030, 032)*

## D-17 — Data checks: sum rule, attacks without dice, unmapped tags

- **User story:** US-030, data warnings
- **Description:**
  - An optional sum rule from the preset (`entries.statblock.sum: {total: vigour, of: [might, wits, speed]}`) gives `STAT_SUM_MISMATCH "<name>": 20 ≠ 4+8+3`.
  - An attack without a `NdM` dice pool gives `STAT_ATTACK_NO_DICE`.
  - A tag that isn't in `entries.tagLabels` is not printed and gives `TAG_UNMAPPED`.
- **Acceptance criteria (from the story):** *(at step 3)*. Expected:
  - the three warnings on the fixture's prepared entries
  - no sum rule set → no sum warning
- **Tests:** `tests/unit/entry-checks.test.ts`
- **SCAR check:** *(at G3; expected focus 007, 019)*

## D-18 — Build, documents and manual test

- **User story:** US-030 to US-034, end to end
- **Description:**
  - update the manual (entries chapter), `docs/technical/warning-codes.md`, `architecture.md` and `tests.md`
  - make a test build
  - hand over a manual test with the sample vault and an environment checklist
- **Acceptance criteria (from the story):** *(at step 3)*. Expected: the M-check of the D-03 chapter at 100 % zoom, with every layout, opener, pair, warning and the quick-reference table checked against a list.
- **Implementation notes:**
  - The environment must be ready and the build identifiable before handover (SCAR-012).
  - Inspect rendered output at 100 % or larger (SCAR-025).
  - The full quality gate must pass (SCAR-006).
- **Tests:** the full quality gate
- **SCAR check:** *(at G3/G4; expected focus 006, 012, 018, 025, 028, 029, 030)*
