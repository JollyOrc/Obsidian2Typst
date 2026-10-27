# US-012 — Side-panel preview driven by style settings

**Status:** Done (2026-10-18)
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author tuning the look of my book,
**I want** a side panel with the formatting controls and a live preview of the
resulting pages,
**so that** I can judge fonts, page setup, and cover without exporting.

---

## Acceptance criteria

- **AC-1 (open the panel):** Command `Obsidian2Typst: Open style panel` opens a
  view in the right sidebar. A second call shows the open panel; there is never
  more than one. The panel holds, from top to bottom: the preset selector, the
  rows of the groups Page, Fonts and Cover (AC-2), the page range field
  (AC-6), a `Refresh` button, one status line (AC-11) and the page preview
  area.

- **AC-2 (the rows and who owns a value):** The rows of Page (US-009), Fonts
  (US-010) and Cover (US-011) have the labels, hints, order and input kinds
  of the same rows of the Settings tab (AC-15). Each row shows the **effective**
  value, the one the next export uses (Defaults, then the active preset on top,
  US-008 AC-12). A row whose value is set by the active preset is disabled and
  its description reads `Set by preset "A5 print"; change it in the preset
  note`. An owned row has no reset icon (it would ask about the Defaults value while
  the row shows the preset's). The panel never writes a preset note.
  Example: preset `Slug 5` sets `page.bleed: 5`; the panel shows Bleed `5`,
  disabled, with that description; Trim size is enabled and shows the Defaults
  value.

- **AC-3 (a change is a saved change):** An enabled row saves to the Defaults
  exactly as the Settings tab does: the same validation message under the row
  and the old value kept when a value is refused (US-008 AC-4, AC-18), the same
  questions (`Remove the custom trim size?`, US-009 AC-14, and the reset
  question of US-008 AC-18), the same notices, the same disabled gutter without
  facing pages (US-009 AC-13). Text and number fields save when the field is
  left or Enter is pressed, never per key (AC-15). The preset selector sets the
  active preset (US-008 AC-12) and shows the presets of the store, valid ones
  only; an invalid preset is listed greyed out with its error as tooltip and
  cannot be chosen.
  Example: Bleed set to `3` in the panel gives `defaults.page.bleed = 3` in
  `data.json` and the Settings tab shows `3` without being reopened (AC-14).

- **AC-4 (which note is shown):** The preview shows the last Markdown note that
  was active in the workspace; focusing the panel does not change it. Opening
  the panel with such a note compiles it once, at once (no delay). The
  status line starts with `Preview of: <note name>`. With no such note the
  preview area says `Open a note to preview it` and nothing is compiled. When
  another note becomes the last active one, the panel shows the new name and the
  hint `Note changed; press Refresh`; nothing is compiled by itself (AC-5) and the
  pages of the earlier note stay, greyed (as in AC-11). A
  note that is renamed keeps being the previewed one under its new name; a note
  that is deleted gives the no-note state.

- **AC-5 (refresh on style change, not on typing):** A change of any value the
  conversion reads (a row, the active preset, a preset note, the Defaults from
  the Settings tab) compiles the previewed note again **500 ms after the last
  change**; changes closer together than that start one compile. Example: a
  change at 0 ms, one at 400 ms and one at 900 ms start one compile at 1400 ms.
  Example: trim A5 (148×210) to A4 (210×297) changes the aspect ratio of the
  drawn pages from 0.705 to 0.707 (width ÷ height of the canvas, three
  decimals) and the page count of the document. Editing the text of the note
  does not compile; `Refresh` re-reads the note and compiles at once (no
  delay). Changing the page range (AC-6) never compiles.

- **AC-6 (page range):** The field takes `All pages` (also empty, or `all` in
  any case) or `N` or `N-M` with whole numbers and `1 ≤ N ≤ M`; spaces around
  the numbers are ignored. `3-5` shows exactly pages 3, 4 and 5 (fewer if the
  book is shorter: `250-300` of 263 pages shows 250 to 263). The full document
  is still compiled; only the displayed pages differ. The field is applied when
  it is left or Enter is pressed, never per key, so typing `3-` on the way to
  `3-5` shows nothing. Any other text is refused and the previous range stays:
  `5-3`, `0`, `abc`, `3-`, `-2`, `3,5`, `1.5`; the message under the field is
  `Enter all, a page such as 4, or a range such as 3-5`, and no notice appears.
  A range wholly behind the end (`300-310` of 263) shows
  `The document has 263 pages` instead of pages. The range is kept while the
  panel stays open and after a refresh (it is not a saved setting).

- **AC-7 (drawing the pages):** Pages are drawn by the renderer one canvas per
  page (`renderCanvas` with a page offset, spike S8), each canvas made by the
  one page canvas helper (`plugin/preview`; SCAR-008): a 2D context, the canvas
  sized to page size × `pixelPerPt`, the CSS size set separately. The area keeps
  one placeholder of the right aspect ratio per displayed page, but a canvas
  is drawn only for the pages within one panel height of the visible part and
  released (size set to 0) when it is more than three panel heights away; the
  choice of pages is one pure function (`visiblePages`) with a unit test. A
  page that was drawn is not drawn again while it stays in range and nothing was
  compiled. A drawn page is not blank: the check reads the pixels. No other code
  creates a canvas (`createElement('canvas')`, `OffscreenCanvas`): the
  downsampler (AC-12) gets its scratch canvas from the same helper; each drawn
  page and each skipped step is logged to the console as `[o2t preview] …`.
  Example (reference input, A5, page 3, 2 px/pt): 6.9 % of the pixels are not
  white (spike S8: 6.9 % A5, 7.1 % A4); a canvas with fewer than 1 % is a defect.

- **AC-8 (stale results and superseded compiles):** At most one preview
  compile runs. When a compile is due while another runs, the running one is
  ended (its worker terminated; spike S11: 193 ms to the next result) and the
  new one starts. The result of an older compile is never shown, also not when
  it arrives after the newer one was requested. The document of a replaced or discarded result is released (`release()`) as
  soon as it is not shown, and the document that is shown is released when the
  panel closes (memory, spike risk 1). Example: compile 1 started for
  A5; at 600 ms the value becomes A4 and compile 2 is due: compile 1 is ended,
  compile 2 runs, only its pages are drawn.

- **AC-9 (export comes first):** The preview and an export never compile at
  the same time. When an export starts while a preview compile runs, the preview
  compile is ended and the status line says `Export running; the preview
  updates afterwards`; a preview request that is due during an export waits
  and runs when the export has finished. A preview never makes an export wait
  or fail, and never takes the export lock (US-007 AC-3).

- **AC-10 (no side effects):** A preview run writes no file: nothing in the
  export folder, nothing in the vault, no warnings report, no `.typ`; assets are
  not copied (US-003 AC-4) but read from the vault into the memory of the
  compile request under the same path names the export would write. It opens
  no notice. Example: after the preview of a note with 3 images and a cover the
  fake host has recorded 0 writes and 0 notices, and the request holds the 4
  files under their export paths.

- **AC-11 (errors, warnings, first run):** A compile error shows its message
  (US-007 AC-4 wording) in the status line, in place of the pages; the last good
  pages stay visible, greyed out (opacity 0.4, no drawing while they are greyed).
  Without a last good result only the message is shown. The next successful
  compile clears the message and the grey. After a success the status line ends
  with the warning count of that run as `2 warnings` (`1 warning`,
  `no warnings`); a strict-mode stop (US-006 AC-4) is shown as an error.
  While a compile runs the line shows `Compiling…` and the pages stay as they
  were.

- **AC-12 (preview images are smaller; the export never is):** In the preview,
  a PNG or JPEG image whose longest side is more than 1200 px is
  re-encoded with the longest side at 1200 px (the other side
  `round(side × 1200 ÷ longest)`, at least 1); smaller images, SVG, GIF and
  WebP are used as they are (a WebP file has no resolution that Typst reads,
  so a smaller copy would shrink on the page, and a PNG under a `.webp` name is
  refused by Typst; measured with typst 0.14.2: a 400×200 WebP places at
  400 pt, its 200×100 copy at 200 pt). JPEG stays JPEG (quality 0.85), PNG
  stays PNG.
  The copy keeps the **placed size** of the original: Typst places an image
  at its pixel size divided by its resolution (`fit-image` measures it,
  US-003 AC-2b), so the copy is written with the resolution of the original
  multiplied by `new px ÷ old px` (PNG `pHYs`, JPEG JFIF density; the original
  default of 72 dpi for a PNG without one). Measured with typst 0.14.2: a
  400×200 PNG places at 400 pt; a 200×100 PNG with `pHYs` of 36 dpi places at
  400 pt, one without at 200 pt. An image that cannot be decoded is used as it
  is. The export code path never calls the downsampler (a text check over the
  export files, SCAR-017).
  Example: a 3000×2000 PNG at 300 dpi becomes 1200×800 at 120 dpi; both place
  at 720 × 480 pt.

- **AC-13 (composed: preview equals export, with content; SCAR-015):** For the
  reference input (the sample note `Book.md`, US-024) and each built-in preset
  (`BUILTIN_PAGE_PRESETS`), the page count of the preview compile equals the
  page count of the exported PDF, with images downsampled (AC-12). The same
  holds for a note with a cover (US-011) and a custom heading font (US-010). The
  font list of the preview request is the one the export gives the compiler
  (US-010 AC-7): one function `compileFonts(bundled, vault)` builds both.
  Switching the active preset changes the preview source with no restart
  (US-008 AC-12): `A5 print` gives the page rule of A5, `A4 digital` that of A4.
  One function prepares the note for both (`prepareNote`): the preview source
  is the text the export writes, only image bytes differ. The test also checks
  content: the counts are above 10 for the reference (not an empty book), page
  1 of the preview of the cover note has the size of the cover page (164 × 226
  mm with slug 5) and the request holds the cover image; the pixel checks of
  the drawn cover (more than 10 % non-white on a full-page image) and of page 3
  (AC-7) are made in Obsidian (manual check M2 step 15). A test with a mutated
  downsampler that drops the resolution makes the counts differ (40 images of
  200 × 280 px: 40 pages become about 14).

- **AC-14 (the panel follows the data; SCAR-016):** The panel reads state when
  a control is used and when it is drawn: a change in the Settings tab, in a
  preset note, or by a command (active preset, Defaults reset) while the panel
  stays open updates the rows, the preset list, the owner descriptions of AC-2
  and the preview (AC-5) without closing the panel. The settings store gives a
  change event (`onChange`) for this, as the preset store does (US-008 AC-3).
  Example order (draw, change, use): the panel is open; the Settings tab sets
  Bleed to 4; the panel row shows `4`; Reset in the panel then asks about `4`,
  not about the value of an earlier drawing. The manual check never closes the
  panel.

- **AC-15 (one set of rows; the rule for the class; SCAR-013, SCAR-017):** The
  Settings tab and the panel build their rows with the same functions in one
  module (`plugin/settings/rows`): row list, trim dropdown, gutter rule, reset
  icon, save of one Defaults field. The module is the only place that calls
  `addText`, `addDropdown`, `addToggle` or `new ConfirmModal` for these rows: a
  text check over `panel.ts` finds none of them and finds the imports from
  `rows`; a text check over `settings-tab.ts` finds no definition of
  `DEFAULT_ROWS`, `addTrimDropdown` or `addResetButton`. Every text field of
  the panel (rows, page range) saves through `commitOnChange` (US-008 AC-20).
  A panel redraw keeps the scroll position of the panel (US-008 AC-19,
  `captureScroll`).

---

## Notes

- Pages are drawn one at a time by the `typst.ts` renderer; the page count
  matches the PDF (spike S8, Node). Confirmed in Obsidian (spike S8): page 3 of
  the reference draws in 53 ms (A5) and 96 ms (A4), compile to vector 3.7 s
  then 1.4 s; process memory after export and preview reached 4.3 GB. An SVG of
  the whole document is not usable (154 MB for the reference).
- Decided by the user (2026-10-16): the preview may downsample images; the
  export never does. Decided by the user (2026-10-18): the panel edits the
  saved settings; the preview shows the last active note; the limit is 1200 px.
- Proposed with this story, to be confirmed by the user: values owned by the
  active preset are shown disabled (AC-2), and a note change asks for `Refresh`
  (AC-4) instead of compiling by itself.
- Sample-page preview (one page per style) needs styles and is in the backlog.
- Worst misplaced click on this screen (SCAR-014): the reset icon of a row, and
  the trim size dropdown that removes a custom size. Both keep their questions
  (AC-3). `Refresh` and the page range change nothing that is saved.
- Open for the tickets: the vector compile result type of the compile service
  (so far only `pdf`), and the renderer WASM of `typst.ts` in the plugin
  package (as the compiler WASM, US-007 AC-12).

---

## Related tickets

- [TICKET-001](../tickets/TICKET-001-typst-wasm-spike.md) — Spike: bundled WASM Typst compiler
- [TICKET-037](../tickets/TICKET-037-preview-core-pure-modules.md) — pure preview core
- [TICKET-038](../tickets/TICKET-038-preview-controller-and-preparation.md) — preparation, controller, request, settings event
- [TICKET-039](../tickets/TICKET-039-vector-compile-renderer-canvas.md) — vector compile, renderer, canvas, downsampler
- [TICKET-040](../tickets/TICKET-040-style-panel-view-rows-and-m2-15.md) — panel view, shared rows, command, manual check
