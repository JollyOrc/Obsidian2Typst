# US-003 — Convert images and copy their assets

**Status:** Done (the preamble that defines `fit-image` is built by US-015)
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author with illustrated chapters,
**I want** every image linked from the note to appear in the Typst output and be
copied next to it,
**so that** the exported folder compiles on its own and nothing is missing.

---

## Acceptance criteria

- **AC-1 (standard Markdown image):**
  ```
  md : ![A crypt](assets/crypt.png)
  typ: #figure(fit-image("assets/crypt.png"), caption: [A crypt], numbering: none)
  md : ![](assets/crypt.png)
  typ: #fit-image("assets/crypt.png")
  ```
  An image without a size is placed by the `fit-image` helper of AC-2b; with a
  size (AC-2) `image(...)` with `width:` is used. Alt text is the caption when it is not empty; an image without alt text is
  placed without a caption. The caption text is escaped (US-001 AC-3). No
  "Figure 3:" prefix is added by default (`numbering: none`); how captions look
  is controlled later by styles. In an Obsidian embed, a pipe part that is not a
  size is the alt text: `![[crypt.png|A crypt]]` gives the same output as the
  first example.

- **AC-1b (pipe in the alt text):** In the alt text of a standard image, a
  pipe splits caption and size, as in Obsidian. The part before the first pipe
  (trimmed) is the caption; a numeric part after it (`300` or `300x200`) is a
  size (AC-2), any other part after it is ignored. The vault compiler writes
  the title twice (8 images in `The Rules/compiledtext.md`); decided by the
  user 2026-10-16:
  ```
  md : ![Limb Regeneration|Limb Regeneration ](assets/limb.png)
  typ: #figure(fit-image("assets/limb.png"), caption: [Limb Regeneration], numbering: none)
  md : ![A crypt|300](assets/crypt.png)
  typ: #figure(image("assets/crypt.png", width: 225pt), caption: [A crypt], numbering: none)
  md : ![|300](assets/crypt.png)
  typ: #image("assets/crypt.png", width: 225pt)
  ```
  47 of the 64 images of the real file have no alt text and get no caption.

- **AC-1c (image in a paragraph with other content):** 5 paragraphs of the
  real file mix images with text. An image is always a block, never part of a
  line of text. A paragraph is split at each image: text before and after stay
  separate paragraphs in the original order, each image becomes its own
  figure (AC-1). Nothing is dropped; a paragraph that contains only images
  becomes only figures. Decided by the user 2026-10-16 (proposal confirmed):
  ```
  md : See ![A crypt](a.png) below.
  typ: See

       #figure(fit-image("a.png"), caption: [A crypt], numbering: none)

       below.
  ```
  (Separate paragraphs, so a blank line on each side; the story first showed
  single newlines.) In table cells and list items the same split applies inside
  the cell or item. Text after an image starts a block again, so a text that
  begins with `=`, `-`, `+`, `/` or a digit followed by `.` is escaped as in
  US-001. In emphasis, strike, highlight and link text the function form
  (`#strong[...]`, `#link(...)[...]`) is used, because a paragraph break cannot
  sit between `*` delimiters.

- **AC-1d (image in a heading, link, footnote):** (Decided by the user
  2026-10-17.) An image in a heading is not part of the heading line: the
  heading keeps its text, the figure follows it as its own block, and warning
  `IMAGE_IN_HEADING` ("Image in a heading placed after the heading") is
  reported with the line of the image. A link whose text is an image,
  `[![](a.png)](https://x.org)`, becomes `#link("https://x.org")[#fit-image("a.png")]`
  with no address footnote (the text is empty). An image in footnote text stays
  in the note (block form of US-005 AC-4). The real file has none of these.

- **AC-2 (Obsidian embed with size):**
  ```
  md : ![[crypt.png|300]]        typ: #image("assets/crypt.png", width: 225pt)
  md : ![[crypt.png|300x200]]    typ: #image("assets/crypt.png", width: 225pt, height: 150pt)
  ```
  Obsidian sizes are CSS pixels; 1 px = 0.75 pt. (Decided, approved by the user
  2026-10-16.) Most notes leave the size out; the size an image gets is then
  decided by the style settings (backlog "Image rules"), and until those exist
  the image keeps its natural size scaled down to the text width if it is wider.
  The embed is looked up by file name anywhere in the vault; if two files share
  the name, the one in the note's own folder wins (no warning), otherwise the
  first by path order, with warning `ASSET_AMBIGUOUS`. (Details: AC-2c.)

- **AC-2c (size and alt forms, lookup rules):**
  - A size is `N` or `NxM` with whole numbers greater than 0; any other text is
    not a size. A zero width or height is ignored (no size, no alt text).
    Decimals are not sizes. Pixels become points as N x 0.75, written without
    trailing zeros (`301` gives `225.75pt`).
  - An embed's text after the first `|` is split at every `|`: the first part
    that is a size is the size, the first part that is not is the alt text:
    `![[a.png|A crypt|300]]` gives caption `A crypt` and `width: 225pt`.
  - A standard image path is looked up exactly (decided by the user
    2026-10-17): relative to the note's folder, a leading `/` meaning the vault
    root, `..` allowed. If no file is there the image is missing
    (`ASSET_MISSING`); there is no search by file name.
  - An embed (`![[x.png]]`, also `![[assets/x.png]]`) is looked up by file name
    anywhere in the vault; a path part narrows the match to files whose path
    ends with it. Two files with that name: the one in the note's own folder,
    else the first by path order, and `ASSET_AMBIGUOUS` ("\"x.png\" matches 2
    files; the first is used") with the line of the embed. When the note's own
    folder decides, there is no warning (decided 2026-10-17).
  - Names are compared exactly (Unicode NFC, case-sensitive).
  - An embed whose name has no extension or ends in `.md` is a note embed and
    belongs to US-004 (`EMBED_NOTE_UNEXPANDED`).

- **AC-2b (scaling of images without size):** Without a size, the converter
  emits a call that places the image at its natural size, never larger than the
  available width and never taller than the available height; small images are
  not enlarged. Measured with the bundled compiler (probe `s18`): "natural"
  size is decided by Typst from the file (PNG without resolution: 1 px = 1 pt;
  JPEG at 96 dpi: 0.75 pt/px; PNG at 300 dpi: 0.24 pt/px; SVG: 0.75 pt per
  user unit), so the core does not need pixel sizes or dpi. The emitted code
  is a helper defined once in the generated file's preamble and called as
  `#fit-image("assets/crypt.png")`; the helper is:
  ```
  #let fit-image(path) = layout(size => {
    let m = measure(image(path))
    let w = calc.min(m.width, size.width)
    let h = m.height * (w / m.width)
    image(path, width: w * calc.min(1, size.height / h))
  })
  ```
  Measured results at a text width of 160 pt and height of 260 pt: 1000x500
  px → 160 x 80 pt; 100x50 px → 100 x 50 pt; 300x2000 px → 39 x 260 pt; SVG
  400x200 → 160 x 80 pt. The same helper gives the right width inside a list
  item (154.5 pt), a table cell (150 pt) and a figure (160 pt). Images with an
  explicit size (AC-2) do not use the helper. Note the order `m.height * (w /
  m.width)`: Typst cannot multiply two lengths.

- **AC-3 (URL-encoded and external paths):**
  `![](Rulebook/Rulebook%20images/Cover%20Draft%201000.png)` is decoded to
  `Rulebook/Rulebook images/Cover Draft 1000.png` before lookup. Percent
  sequences that are not valid UTF-8 (`%zz`, a lone `%`) are kept as written.
  Image URLs with a scheme (`http(s)://`, `data:`, `file:`) are not downloaded or
  read: the placeholder of AC-5 is emitted with warning `ASSET_REMOTE`
  ("Remote image is not downloaded: <url>").

- **AC-4 (copy into the export folder):** Each used asset is copied, never
  moved, to `<export folder>/<path relative to the note's folder>`. Example:
  note in `Sample/`, image `Sample/assets/crypt.png` →
  `<export>/assets/crypt.png`. A path that leaves the note's folder (`../x.png`)
  is copied to `<export>/assets/_external/x.png`. Source files are never
  modified. An asset referenced N times is copied once.

- **AC-4b (two sources, one destination):** If two different source files would
  get the same destination (`../a/x.png` and `../b/x.png` both map to
  `assets/_external/x.png`, also when the names differ only in case), the first
  one keeps the name and each later one gets `-2`, `-3` before the extension
  (`assets/_external/x-2.png`); a name that is already taken is skipped. The
  export folder is the same on every export, so destinations are the same for
  the same input.

- **AC-5 (missing or unsupported file):** If the file does not exist, or its
  type is not `png`, `jpg`, `jpeg`, `gif`, `webp`, or `svg`, the output contains
  ```
  #rect(width: 100%, height: 4cm, stroke: 1pt + red)[Missing image: assets/crypt.png]
  ```
  and one warning with the source line, the placeholder showing the path as
  written (decoded, escaped for Typst markup):
  - `ASSET_MISSING` "Image file not found: assets/crypt.png"
  - `ASSET_TYPE_UNSUPPORTED` "Image type .bmp is not supported: assets/x.bmp"
  - `ASSET_INVALID` (AC-5b), `ASSET_REMOTE` (AC-3)

  In strict mode (US-006) the export aborts instead. Extensions are compared
  without regard to case (`X.PNG` is a PNG).

- **AC-5b (file content does not match):** (Decided by the user 2026-10-17.)
  Measured with the bundled compiler (probe `s32`): a JPEG named `.png`, an
  empty file or a corrupt file is a compile error that stops the whole PDF. The
  plugin therefore reads the first bytes of every used file and checks them
  against the extension (PNG `89 50 4E 47`, JPEG `FF D8`, GIF `GIF8`, WebP
  `RIFF....WEBP`, SVG: after optional BOM and blanks `<svg` or `<?xml`). On a
  mismatch the placeholder is emitted with `ASSET_INVALID` ("Image file is not a
  valid .png image: assets/x.png") and nothing is copied. The check is a pure
  function of the extension and the first 16 bytes, so the core stays free of
  file access.

- **AC-6 (composed: image inside a list item and a table cell):** An image in
  a list item stays in that item; an image in a table cell stays in that cell.
  Both copy the asset once and compile. A captioned image in a list item keeps
  its caption inside that item:
  ```
  md : - item
         ![Map](assets/map.png)
  typ: - item

         #figure(fit-image("assets/map.png"), caption: [Map], numbering: none)
  ```
  (Blocks inside an item are separated by a blank line, as in US-001 AC-5b.)

- **AC-7 (path escaping):** A path containing `"` or `\` is escaped for a Typst
  string: `a"b.png` → `image("a\"b.png")`.

---

- **AC-8 (interfaces; the core stays pure):** The emitter asks an injected
  `AssetResolver` (`resolve({source: 'image' | 'embed', target, line})`) and
  never reads files. The result is `found` (with the destination path inside the
  export folder), `ambiguous` (also with the destination and the number of
  files), `missing` or `invalid`; the emitter itself decides `remote` and
  `unsupported` from the text. A pure `createAssetResolver({notePath, files})`
  (files: vault path and first bytes) implements AC-2c, AC-4, AC-4b and AC-5b
  and records the used assets as `{from, to}` pairs; the plugin copies exactly
  those, in order, once each (AC-4). Without a resolver the emitter keeps the
  fallback of US-015 AC-12 (alt text, `NODE_UNSUPPORTED`). The helper text of
  AC-2b is exported as `FIT_IMAGE_HELPER`; the preamble that contains it is built
  by the pipeline (US-015).

---

## Notes

- Image placement rules, full-bleed pages, and keep-with-text are separate
  stories (backlog), built on this one.
- Principle (decided by the user): problems with the source, such as a missing
  image, are reported and made visible, never repaired by the converter. They
  are fixed in the source note.

---

## Related tickets

- [TICKET-017](../tickets/TICKET-017-images-and-assets.md)
