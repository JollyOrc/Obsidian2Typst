# US-011 — Set a cover image

**Status:** Done (2026-10-17, M4 passed)
**Introduced:** v0.1.0
**Implemented:** 0.1.0
**Supersedes:** —

---

## Story

**As an** author,
**I want** a full-page cover taken from the first image of my note or chosen
in the plugin, with an optional blank page after it,
**so that** the PDF starts with my cover and the first text page falls where my
printer expects it.

---

## Acceptance criteria

- **AC-1 (fields in the preset note; preset notes only):**
  ```
  cover:
    mode: auto               # auto | file | none   (default auto)
    file: "Layouting/Cover/front.png"   # vault path, used when mode is file
    blankPageAfter: false    # default false
    cropWarningPercent: 5    # default 5
    back: ...                # reserved for the back cover, see AC-10
  ```
  The cover settings exist in preset notes only, not in the Defaults of the
  settings tab (decided by the user 2026-10-17); the built-in values are the
  defaults above. An invalid value makes the preset invalid (US-008 AC-4) with
  the first of these messages, with the line of the field: `cover.mode must be
  auto, file or none`; `cover.file must be a vault path written as text`;
  `cover.file is needed when cover.mode is file` (mode `file` with no file or an
  empty one; line of `mode`); `cover.blankPageAfter must be true or false`;
  `cover.cropWarningPercent must be a number from 0 to 100`. `null` is unset.
  Examples: `mode: front` → `cover.mode must be auto, file or none (line 4)`;
  `cropWarningPercent: -1` → `cover.cropWarningPercent must be a number from 0
  to 100 (line 7)`; `mode: file` without `file` → `cover.file is needed when
  cover.mode is file (line 4)`. `cover.back` may hold any value.

- **AC-2 (auto cover; what counts as the first block):** With `mode: auto`, the
  first block of the document is the first paragraph after the frontmatter,
  blank lines and comment blocks (`<!-- -->`; they write nothing). If
  it consists of exactly one image and nothing else, that image is the cover
  and is removed from the body so it is not shown twice. The image is
  `![alt](path)` or `![[file]]` with any alt text or Obsidian size, e.g. the
  first line of `compiledtext.md`, `![](assets/cover_plate_1000.png)`. There is
  no cover, and nothing is removed, when the first block is a heading, text, a
  list, a quote, a table, a code block, a note embed (`![[Other note]]`), an
  image from a web address (`![](https://…)`), an image wrapped in a link
  (`[![](a.png)](https://x.org)`), a paragraph with an image and text
  (`![](a.png) Title`), or a paragraph with two images (also on two lines
  without a blank line between). (Confirmed by the user: first image as the
  cover.)

- **AC-3 (chosen file, no cover):** With `mode: file` the image at `file` is
  the cover; an image in first position of the document (AC-2) is still removed
  from the body (it is the former auto cover) but not used. With `mode: none`
  there is no cover and no image is removed. The path `file` is a vault path
  written exactly (no search by name; `/` as separator; case as on disk).

- **AC-4 (worked output, no blank page):**
  ```
  #page(margin: 0pt, header: none, footer: none)[
    #image("assets/cover_plate_1000.png", width: 100%, height: 100%, fit: "cover")
  ]
  #counter(page).update(1)
  ```
  followed by the body on the next page. The path in `#image` is the name the
  file has in the export folder (AC-9). The page size is the full size of
  US-009 including bleed; with A5 + 3 mm bleed the cover fills 154×216 mm
  (measured: 436.5 × 612.3 pt). With a slug (US-009 AC-9, AC-11) the page margin
  is the slug, so the cover fills trim + bleed only. `fit: "cover"` crops, it never distorts. The
  cover page has no header, footer or page number. A note that consists only of
  the cover gives a PDF with one page.

- **AC-5 (blank page after the cover; order of the page counter):** With
  `blankPageAfter: true` page 2 of the PDF is blank (no text, no images, no
  page number) and the body starts on page 3; with `false` the body starts on
  page 2:
  ```
  #page(margin: 0pt, header: none, footer: none)[ #image(…) ]
  #page(margin: 0pt, header: none, footer: none)[]
  #counter(page).update(1)
  ```
  The `#counter(page).update(1)` comes after the last front page, so the first
  body page has counter value 1 in both cases (measured: placed before the
  blank page it gives 2). With facing pages (US-009), the cover is page 1
  (right-hand), the blank page is page 2 (left-hand) and the body starts on
  page 3 (right-hand); without the blank page it starts on page 2 (left-hand).
  The blank page is made whenever it is configured, also when the note has
  no body (cover and blank page: 2 pages).

- **AC-6 (crop warning):** The share of the image that is cropped is
  `1 − min(a/b, b/a)` where `a` is the image's width/height ratio and `b` the
  page's. It is written as a percentage rounded to one decimal, and that
  rounded value is compared: if it is greater than `cropWarningPercent`,
  warning `COVER_CROPPED` is reported (it never stops the export unless strict
  mode is on); exactly 5.0 with threshold 5 does not warn. Examples:
  ```
  image 2000×3000 (ratio 0.667), page 154×216 mm (ratio 0.713) → 6.5%, warns at 5
  image 1540×2160 (same ratio)                                   → 0.0%, no warning
  image 1000×1000, page 154×216                                  → 28.7%, warns
  ```
  Message: `Cover image is cropped by 6.5% (image 2000×3000 px, page 154×216 mm)`
  (the sign is `×`; page sizes are written with at most one decimal and no
  trailing zero, `154.5×216 mm`). The warning has line 0 for a cover file and
  the line of the image for an auto cover. The page is the full size including
  bleed (AC-4). Image sizes are read from the file head: PNG (IHDR), GIF,
  WebP (lossy, lossless, extended), JPEG (the first frame marker, searched in
  the first 1 MiB), and SVG (`viewBox`, else `width` and `height` in the same
  unit or without unit). JPEG files with an EXIF orientation of 5 to 8 are
  shown turned by Typst (measured: orientation 6 is applied), so width and
  height are swapped before the ratio is taken. If no size can be read (SVG
  without `viewBox` and sizes, a JPEG whose frame marker lies after 1 MiB, a
  damaged file) the check is skipped silently.

- **AC-7 (missing or unsupported cover; also in auto mode):** If the cover
  file, or the image in first position in auto mode, is missing or its type is
  not `png`, `jpg`, `jpeg`, `gif`, `webp`, or `svg` (or its content does not fit
  its extension, US-003 AC-5b), no cover page is made and warning
  `COVER_MISSING` (`Cover image not found: <path>`) / `COVER_TYPE_UNSUPPORTED`
  (`Cover image type .bmp is not supported: <path>`, or `Cover image is not a
  valid .png image: <path>`) is reported (line 0 for a cover file, the line of
  the image for an auto cover). The image in first position
  is removed from the body in these cases too, and not reported again as an
  image problem (decided by the user 2026-10-17). The body is generated
  normally. A name that matches several files uses the first and reports
  `ASSET_AMBIGUOUS` as in US-003.

- **AC-8 (composed: auto cover with an Obsidian size, with a cover file and
  blank page):** `![[cover.png|600]]` as the first block is still the cover; the
  width hint is ignored. With `mode: file`, `blankPageAfter: true` and a cover
  that needs cropping, the PDF has the cover, a blank page, and the body, and
  the report lists exactly one `COVER_CROPPED`.

- **AC-9 (asset copy):** The cover image is copied to the export folder like
  any asset (US-003 AC-4), once, even when the same image also appears later in
  the body; the name in `#image` is the one of that single copy. A cover that
  has the same file name as another asset gets the name the collision rule of
  US-003 gives it.

- **AC-10 (back cover field reserved):** The field name `cover.back` is
  reserved for the future back cover. In this version, if it is present and not
  `null`, warning `COVER_BACK_UNSUPPORTED` (`cover.back is not supported yet and is ignored`, line 0) is reported once on export and the value is otherwise ignored, whatever it holds. The plugin never
  rewrites a preset note except to copy or rename it (US-008 AC-5, byte copy),
  so the value is kept.

---

## Notes

- Decided by the user: first-image detection as written; blank page is
  configurable; crop and warn; `cover.back` reserved.
- Title/author overlay and a separate inside-cover page are in the backlog. The
  warning threshold default of 5 is my proposal.
- Reading image sizes is new code: `core/assets/image-size.ts` reads sizes from
  bytes (pure); the vault index of US-015 gives it more than 16 bytes
  (`AssetIndex.readHead(path, length)`); register it in the shared utilities
  register with its transforms (SCAR-001: EXIF swap).
- Measured with the real compiler (2026-10-17): page counts and the counter
  value of AC-4 and AC-5, `#page[]` makes a blank page, Typst applies EXIF
  orientation 6 to a JPEG; `tests/integration/us-011-cover-pdf.test.ts` repeats
  these measurements as tests (SCAR-008, SCAR-009, SCAR-010).
- Content checks (SCAR-015): the PDF tests check that page 1 holds the image and
  no text, and that the blank page holds nothing, not only page counts.
- The export of this version prints no page numbers (no numbering rule exists
  yet), so the counter of AC-5 is not visible in a real export; the PDF tests
  switch numbering on (`#set page(numbering: "1")`) and read the printed
  number in the footer (not the PDF page label, which Typst computes from the
  page start and shows 3 for the first body page after a blank page).
- Warning codes `COVER_*` become `active` in `docs/technical/warning-codes.md`.

---

## Related tickets

- [TICKET-028](../tickets/TICKET-028-cover-core.md) — core: image sizes, crop share, first-block rule, cover pages, `cover` preset fields (AC-1 to AC-6, AC-10)
- [TICKET-029](../tickets/TICKET-029-cover-conversion-and-export.md) — conversion, plugin wiring, PDF checks, manual check M4 (AC-2 to AC-10)
