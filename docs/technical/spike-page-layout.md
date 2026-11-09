# Spike: facing pages as spreads in PDF viewers (`/PageLayout`)

**Date:** 2026-11-09. **Code:** `spikes/page-layout/make.spike.ts`
(git-ignored; run with `npx vitest run --config
spikes/page-layout/vitest.config.ts`), pdf.js and Swift scripts in the
session scratchpad. Inputs: a synthetic eight-page note (nonsense words, six
chapters, links between them) converted with the A5 print page settings and
compiled through the plugin's compiler path (`compileBook`, bundled fonts),
once with `facingPages: true` and once with `false`; a third compile of the
facing book with `#set par(justify: true)` for the word-gap scan. Typst
0.14.2 (typst.ts 0.7.0), Node 26.12.0, macOS 27.0.1 on Apple silicon.

## Question

A book with facing pages puts page 1 on the right (odd pages right, even
pages left). A viewer's two-page view pairs pages 1+2, 3+4, so every pair on
screen is half of two spreads. The PDF catalog entry `/PageLayout
/TwoPageRight` asks a viewer to show page 1 alone and then 2+3, 4+5. Can the
plugin write it, does it survive the readers that come after the export, and
which viewers honour it?

## What Typst writes (measured)

- The catalog of a compiled PDF (both settings) has `/Type /Catalog`,
  `/Pages`, `/Metadata`, `/PageLabels` (with folios on), `/Lang`,
  `/StructTreeRoot`, `/MarkInfo`, `/ViewerPreferences << /Direction /L2R >>`,
  `/Outlines` and `/Names`; **no `/PageLayout` and no `/PageMode`**. The
  facing and the single-sided PDF have the same catalog keys.
- The cross-reference is a classic `xref` table (entries of 20 bytes,
  `nnnnnnnnnn 00000 n\r\n`), no object streams, no xref streams; the
  trailer has `/Size`, `/Root`, `/Info` and `/ID`. The file ends with
  `%%EOF` and **no line end**.
- Typst offers no way to set the entry: the `document` element has `title`,
  `author`, `description`, `keywords` and `date` only (its parameter docs in
  the compiler WASM). The names `PageLayout`, `TwoPageRight` and `PageMode`
  occur in the WASM only in the PDF writer's name table, next to every other
  catalog key; no compiled PDF carries them.
- `/ID` is written as two equal literal strings of 24 characters (base64
  text), not 16 bytes.

## The incremental update (prototype, measured)

The prototype appends, after Typst's `%%EOF`:

```
\n
<root> 0 obj
<<
  /PageLayout /TwoPageRight
  …the catalog's keys as Typst wrote them…
>>
endobj
xref
<root> 1
<offset of "<root> 0 obj", 10 digits> 00000 n\r\n
trailer
<<
  /Size <as before>
  /Root <root> 0 R
  /Info <as before> 0 R
  /ID [<as before>]
  /Prev <Typst's startxref>
>>
startxref
<offset of "xref">
%%EOF
```

It is a new revision of the catalog under its own object number; no object
is added, so `/Size` stays. On the eight-page book it adds 658 bytes
(43,797 → 44,455).

Every reader of the repository gives the **same result** on the original and
the updated file (`toEqual` over the whole result):

| Reader | Result on both files |
|---|---|
| `readPdfPages` (text, header, footer, folios, images per page) | 8 pages |
| `readPdfBookmarks` | 19 bookmarks |
| `readPdfLinks` | 6 links |
| `scanWordGaps` (product), the unjustified book | 0 lines (no adjusted space) |
| `scanWordGaps`, the justified book, `maxWordGap: 120` | 198 lines, 75 warnings |

They work because `objectIndex` keeps the last definition of an object
number, and the readers that look for `/Root` take the first trailer's
number, which the update does not change. A reader that took the first
`/Type /Catalog` in the file would read the old revision; none of them does.

## Viewers

### pdf.js 6.5.438 (measured through its API; the viewer's code read)

Measured with `pdfjs-dist` 6.5.438 (legacy build, Node) on the four files:

| File | `getPageLayout()` | pages | `getPageLabels()` | outline items | text characters |
|---|---|---|---|---|---|
| facing, original | `""` | 8 | 1 to 8 | 19 | 16,056 |
| facing, updated | `"TwoPageRight"` | 8 | 1 to 8 | 19 | 16,056 (same hash) |
| single-sided | `""` | 8 | 1 to 8 | 19 | 16,064 |
| justified, updated | `"TwoPageRight"` | 8 | 1 to 8 | 19 | 16,057 |

`getPageMode()` is `UseNone` on all (no entry); `getViewerPreferences()`
returns `{}` although Typst writes `/Direction /L2R`.

Read from the source of the generic viewer (`web/viewer.mjs` of the
official 6.5.438 release, the viewer Firefox builds on), not run in a
browser:

- On load, `pageLayout` is mapped by `apiPageLayoutToViewerModes`:
  `TwoPageRight` and `TwoColumnRight` → spread mode `EVEN` (page 1 alone,
  then 2+3, 4+5); `TwoPageLeft` / `TwoColumnLeft` → `ODD`. Only the spread
  mode is taken from it; the scroll mode is not.
- It is applied only when **both** the scroll mode and the spread mode are
  still unknown: the user preferences `scrollModeOnLoad` and
  `spreadModeOnLoad` (default −1) and the **remembered view** of the
  document win over it. With the default `viewOnLoad` (0, previous), a
  document that was opened before restores its stored modes.
- The remembered view is keyed by the document's fingerprint. Typst's `/ID`
  strings are not 16 bytes, so pdf.js falls back to the MD5 of the first
  1,024 bytes; all four files of this spike have the **same fingerprint**
  (`0694bb61…5949`): the update changes no byte at the start, and two
  exports of similar books start alike. An export opened in the same
  browser as an earlier one is "the same document" to pdf.js and opens in
  the remembered spread mode.
- `getViewerPreferences()` is never called by the viewer; `/Direction` plays
  no part in its spreads.

### macOS (Apple's PDF stack measured; Preview not measured)

A Swift script (macOS 27.0.1) on the three files:

- CoreGraphics (`CGPDFDocument`, catalog `PageLayout`): reads
  `TwoPageRight` from the updated file and nothing from the originals; 8
  pages each.
- PDFKit (`PDFDocument`): 8 pages, the same text length (16,312 characters)
  and outline on the original and the updated file.
- A `PDFView` given the updated document keeps its default display mode
  (`singlePageContinuous`, `displaysAsBook` false): PDFKit's view does not
  apply `/PageLayout` by itself.
- **Not measured: Preview.** Preview is built on PDFKit but may read the
  catalog itself; whether it opens the file as two pages, and whether its
  two-page view then puts page 1 alone, can only be seen in Preview (the
  manual check).

### Adobe Acrobat DC (installed; not measured)

Not measured: Acrobat can only be judged in its window. Its preferences have
a default page layout of their own; which wins over the document's entry is
not measured (SCAR-037). Left to the manual check.

## Findings

1. **The plugin can write the entry as an incremental update,** and all its
   PDF readers, product and test, read the updated file as before.
2. **pdf.js honours it on a first opening** (spread mode "even"), and only
   then: a remembered view or the user's own spread preference wins. Because
   pdf.js identifies a Typst PDF by its first 1,024 bytes, a re-export opened
   in the same browser counts as already seen.
3. **Apple's parser reads it; PDFKit's view does not apply it.** Preview
   and Acrobat are not measured.
4. `/PageMode` (the side panel on opening) and `/ViewerPreferences
   /Direction` do not affect the pairing in pdf.js; Typst's `/Direction
   /L2R` is kept as it is.

## Consequence (proposal for G1)

- A pure function in `src/core/pdf/` appends the catalog revision; the
  export run applies it to the book PDF when `page.facingPages` is on; the
  A4 encounter sheet (single-sided) and single-sided books are written as
  compiled.
- The word-gap scan reads the bytes that are written.
- Where the update cannot be made (a structure Typst 0.14.2 does not write,
  such as an xref stream), the PDF is written as compiled with a warning;
  the export never stops for it (as the print checks of US-034).
- The story states what is measured (pdf.js, Apple's parser) and what is
  not (Preview, Acrobat), and the manual check measures the user's viewers.
