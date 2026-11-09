# US-037 — Facing pages open as spreads in a PDF viewer

**Status:** Ready (G1 2026-11-09)
**Introduced:** v0.13.1 (planned)
**Implemented:** —
**Supersedes:** —

Epic #147. Spike: [`spike-page-layout.md`](../technical/spike-page-layout.md).

---

## Story

**As an** author who exports a book with facing pages,
**I want** a PDF viewer's two-page view to show the spreads of my book
(page 1 alone, then 2+3, 4+5, …),
**so that** I see on screen the pairs of pages a reader sees in print, and
not half of two spreads in every pair.

Decided by the author (2026-11-09): for every export with facing pages the
plugin writes the PDF catalog entry `/PageLayout /TwoPageRight`; exports
without facing pages do not change.

Today (US-009 AC-5): with `page.facingPages: true` page 1 is a right-hand
page (`inside` margin on the left), so odd pages are right and even pages
left. Typst 0.14.2 writes no `/PageLayout` (measured, see below), and a
viewer's two-page view pairs 1+2, 3+4 by default.

### What the readers of the PDF do (SCAR-024, SCAR-040)

The output is read by PDF viewers. Measured on 2026-11-09 (scope in the
spike; Typst 0.14.2, macOS 27.0.1):

- **pdf.js 6.5.438** (the viewer of Firefox and of many web pages):
  *measured* through its API: `getPageLayout()` gives `TwoPageRight` for the
  updated file and `""` for Typst's; page count, page labels, outline and
  text are the same. *Read from its source, not run in a browser:* on
  opening, `TwoPageRight` sets the spread mode "even" (page 1 alone, then
  2+3, …), the scroll mode stays; it is applied only when the user has set
  no spread or scroll mode preference and the viewer has no remembered view
  of the document. pdf.js remembers a Typst PDF by its first 1,024 bytes,
  which a re-export of a similar book shares, so a re-export opened in the
  same browser can open in the remembered mode instead.
- **macOS, Apple's PDF parser (CoreGraphics):** *measured:* reads
  `/PageLayout /TwoPageRight` from the updated file. **PDFKit's `PDFView`**
  does not apply it by itself (its display mode stays single page,
  continuous). **Preview:** *not measured* — checked by the user in M26.
- **Adobe Acrobat DC:** *not measured* — checked by the user in M26.

---

## Acceptance criteria

### The update

- **AC-1 (the bytes appended):** For a PDF in the form Typst 0.14.2 writes,
  the plugin writes Typst's bytes unchanged, followed by one incremental
  update: a line end pair, a new revision of the catalog under the
  catalog's own object number and generation, an xref section with that one
  object, and a trailer. Example (a minimal file in Typst's form; offsets in
  bytes, `⏎` = `\n`, `␍` = `\r`):

  Typst's file (324 bytes): `%PDF-1.7⏎`, `%` and four bytes 0x80, `⏎⏎`;
  object 1 at 16 (`/Type /Pages /Count 0 /Kids []`, one key per line as
  below), object 2 at 75:

  ```
  2 0 obj
  <<
    /Type /Catalog
    /Pages 1 0 R
    /ViewerPreferences <<
      /Direction /L2R
    >>
  >>
  endobj
  ```

  then `xref` at 178 (`0 3`, three entries), and

  ```
  trailer
  <<
    /Size 3
    /Root 2 0 R
    /ID [(abc) (abc)]
  >>
  startxref
  178
  %%EOF
  ```

  with no line end after `%%EOF`. The plugin writes 575 bytes: the 324,
  then `⏎⏎` and

  ```
  2 0 obj
  <<
    /PageLayout /TwoPageRight
    /Type /Catalog
    /Pages 1 0 R
    /ViewerPreferences <<
      /Direction /L2R
    >>
  >>
  endobj

  xref
  2 1
  0000000326 00000 n␍⏎
  trailer
  <<
    /Size 3
    /Root 2 0 R
    /ID [(abc) (abc)]
    /Prev 178
  >>
  startxref
  457
  %%EOF
  ```

  again with no line end after `%%EOF`. The rules behind the example:
  the catalog's text as Typst wrote it, with `⏎  /PageLayout /TwoPageRight`
  inserted directly after its opening `<<`; the xref entry is the offset of
  `2 0 obj` (326), ten digits, the generation in five, `n`, `␍⏎` (20 bytes,
  as Typst writes its entries); the trailer is Typst's trailer dictionary as
  written with `  /Prev <Typst's startxref>⏎` before its closing `>>`;
  `startxref` is the offset of the new `xref` (457).

- **AC-2 (the book, measured):** The spike's eight-page book (catalog object
  147, Typst's `startxref` 40685, 43,797 bytes) is written as 44,457 bytes:
  the catalog revision at 43,799, `xref` at 44,271, the trailer
  `/Size 148 /Root 147 0 R /Info 145 0 R /ID [as Typst wrote it] /Prev
  40685`. The revision keeps every key of Typst's catalog with its value
  (`/Type`, `/Pages`, `/Metadata`, `/PageLabels`, `/Lang`,
  `/StructTreeRoot`, `/MarkInfo`, `/ViewerPreferences << /Direction /L2R
  >>`, `/Outlines`, `/Names`). No object number is added (`/Size` stays);
  `/Info` and `/ID` stay as Typst wrote them.

- **AC-3 (deterministic):** The same compiled bytes give the same written
  bytes, in two separate runs (rule 7 holds for the PDF as for the `.typ`).

### Which files

- **AC-4 (facing pages only):** The book's PDF gets the update when the
  effective `page.facingPages` is `true` (built-in `A5 print`); with
  `false` (built-in `A4 digital`) the bytes written are the compiled bytes,
  byte for byte. A preset that turns `facingPages` on in a preset whose
  Defaults have it off gets the update; one that turns it off does not.
  The setting decides, not the template: a template's own `#set page(…)`
  does not change which PDFs get the update.

- **AC-5 (the encounter sheet):** The A4 encounter sheet
  (`<note> - Encounter Sheet.pdf`, US-036 AC-5; single-sided) is written as
  compiled, also when the book has facing pages.

- **AC-6 (composed exports):** With facing pages on, the update is applied
  to the PDF that is written, once:
  - with a cover and with the blank page after it (US-011, US-026): page 1
    is the cover and stands alone;
  - after the image fit's compiles (US-028 AC-15) and after the fallback at
    100 (AC-16): the PDF of the compile that is kept;
  - with roman front matter folios (US-026): `/PageLabels` unchanged;
  - with the encounter sheet on (US-036): the book updated, the sheet not;
  - in strict mode (US-006): the export is not stopped by the update.

### What stays

- **AC-7 (content kept):** On the updated PDF every reader gives the
  result it gives on Typst's PDF: the pages with their text, header,
  footer, folio and images (`readPdfPages`), the bookmarks
  (`readPdfBookmarks`), the links (`readPdfLinks`) and the word-gap scan's
  lines and warnings (`scanWordGaps`). Measured in the spike: 8 pages, 19
  bookmarks, 6 links; on a justified variant 198 lines and 75 warnings at
  `maxWordGap: 120`, the same on both files.

- **AC-8 (the word-gap scan reads what is written):** The export's
  word-gap scan (US-034 AC-7) reads the bytes written to `<note>.pdf`
  (with the update when facing pages are on).

### When the update cannot be made

- **AC-9 (other PDF forms):** The update is made only for the form Typst
  0.14.2 writes: the file ends with `startxref⏎<n>⏎%%EOF` (a line end after
  `%%EOF` allowed); the offset `<n>` points at the keyword `xref` (a classic
  table, not an xref stream); one trailer dictionary before `startxref`
  with `/Root <n> <g> R` and `/Size`, without `/Prev` and without
  `/Encrypt`; the catalog object is found and its text starts with `<<`.
  Any other PDF is written as compiled and the export reports one warning
  `PDF_PAGE_LAYOUT_FAILED` with the message `The PDF could not be set to
  open as spreads (<reason>); it is written as compiled`, `<reason>` one of
  `no startxref`, `no xref table`, `no trailer`, `no catalog`, `encrypted`,
  `already updated`. No source line (line 0). The export completes, also in
  strict mode (as the print checks, US-034 decision 1).

- **AC-10 (already set):** A catalog that already has a `/PageLayout`
  entry (any value) is written as compiled, without a warning: the
  document's own choice is kept. (Typst 0.14.2 never writes one.)

### Guards

- **AC-11 (what Typst writes, guarded):** A test compiles a facing-pages
  book and a single-sided one with the bundled compiler and asserts what
  this story relies on: no `/PageLayout` in the file, a classic `xref`
  table at `startxref`, one trailer without `/Prev` and `/Encrypt`, the
  file ends with `%%EOF` and no line end. A Typst update that changes this
  fails the test (SCAR-024).

- **AC-12 (one writer):** `/PageLayout` is written by one function in
  `src/core/pdf/`; a text check over `src` finds the name in that file only,
  and the export run is its only caller (SCAR-017).

---

## Notes

- **Decisions of this story (provisional, for the user at M26):**
  (1) a PDF that cannot be updated is written as compiled with
  `PDF_PAGE_LAYOUT_FAILED` and never stops the export, also in strict mode
  (AC-9); (2) a `/PageLayout` already in the catalog is kept (AC-10);
  (3) `/ID` stays as Typst wrote it (the update changes no content).
- **`TwoPageRight`, not `TwoColumnRight`:** the author's choice. In pdf.js
  both set the same spread mode; in other viewers `TwoPage…` shows one
  spread at a time and `TwoColumn…` scrolls (not measured).
- **Not written:** `/PageMode` (the side panel on opening; Typst writes
  none) and changes to `/ViewerPreferences` (Typst's `/Direction /L2R` is
  kept; pdf.js does not read it for spreads).
- **The view on opening only:** `/PageLayout` asks for the view a document
  opens in. A view the reader picks in the viewer afterwards, a viewer's own
  preference, or a remembered view of the same document may win (measured
  for pdf.js from its source; not measured for Preview and Acrobat).
- **Not in scope:** the page layout itself (US-009), the encounter sheet
  (single-sided, AC-5), the preview panel (no PDF).
- **Users of the written PDF (SCAR-027):** the word-gap scan (AC-8; reads
  the last definition of an object, `objectIndex`), the test readers
  (`tests/support/pdf.ts`, `entries-pdf.ts`; each takes `/Root` from the
  first trailer, whose number the update keeps, and the last definition),
  the user's viewers (above) and printing (an incremental update is part of
  the PDF standard; not measured with a print shop).
- **SCAR-001:** the update reads the catalog with `openPdf` (`objectIndex`:
  latin1, the last definition of a number wins — the rule the update relies
  on); `reader.ts`'s scope note is widened to "one incremental update as
  US-037 writes it".

---

## Related tickets

- #148 — the catalog revision as an incremental update (AC-1, AC-2 form, AC-3, AC-9, AC-10)
- #149 — the export writes facing-pages PDFs to open as spreads (AC-2 book, AC-4 to AC-10 in the export, AC-12)
- #150 — manual check M26, documents and the test build
