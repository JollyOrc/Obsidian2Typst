# Images and the cover

[Back to the manual](manual.md)

## Contents

- [Images in the note](#images-in-the-note)
- [How images are found and copied](#how-images-are-found-and-copied)
- [Keeping images with their text](#keeping-images-with-their-text)
- [The cover](#the-cover)

## Images in the note

Supported types: PNG, JPEG, GIF, WebP and SVG. The plugin checks the first
bytes of each file, so a file whose content does not match its extension is
refused.

| In the note | In the PDF |
| --- | --- |
| `![](assets/map.png)` | the image, no caption |
| `![A map](assets/map.png)` | the image with the caption `A map` |
| `![[map.png]]` | the image, no caption |
| `![[map.png\|A map]]` | the image with the caption `A map` |
| `![[map.png\|300]]` | 300 px wide |
| `![[map.png\|300x200]]` | 300 × 200 px |
| `![[map.png\|A map\|300]]` | caption and width |

Obsidian sizes are in CSS pixels; 1 px is printed as 0.75 pt (300 px become
225 pt, about 79 mm). Without a size, an image
gets its natural size but is never wider than the text area and never taller
than the page's text height; small images are not enlarged.

An image is always a block of its own. If a paragraph has text and an image,
the paragraph is split: the text before, the image, the text after.

Images that cannot be placed get a red box with `Missing image: <path>` and a
warning:

| Warning | Cause |
| --- | --- |
| `ASSET_MISSING` | the file does not exist |
| `ASSET_TYPE_UNSUPPORTED` | not one of the supported types |
| `ASSET_INVALID` | the content does not match the extension, or the file is empty |
| `ASSET_REMOTE` | an image from a web address; it is not downloaded |

An image inside a heading is placed after the heading
(`IMAGE_IN_HEADING`).

## How images are found and copied

- A Markdown image `![](path)` is looked up exactly: relative to the note's
  folder, or from the vault root when the path starts with `/`.
- An embed `![[map.png]]` is looked up by file name anywhere in the vault, as
  Obsidian does. A path part (`![[plates/map.png]]`) narrows the search. If
  several files match, the one in the note's own folder wins; otherwise the
  first by path, with the warning `ASSET_AMBIGUOUS`.

At export, each image is copied (never moved) into the export folder, keeping
its path relative to the note: `Sample/assets/map.png` for a note in `Sample/`
becomes `<export>/assets/map.png`. Images from outside the note's folder go to
`<export>/assets/_external/`.

## Keeping images with their text

A large image that does not fit on the rest of the page normally jumps to the
next page and leaves a gap. The setting **Smallest image size**
(`images.minScale`) lets the plugin shrink the image instead, down to that
percentage of its size, so it stays after its text.

```yaml
images:
  minScale: 70   # whole number 10 to 100; built-in 100 = off
```

With 70, an image that does not fit is handled like this:

| Situation | Result | Warning |
| --- | --- | --- |
| It fits at full size | full size after its text | — |
| It fits at 70 % or more | shrunk to fit, after its text | — |
| It does not fit even at 70 %, on a left page (or without facing pages) | full size at the top of the next page; the text after it moves up and fills the gap | `IMAGE_FLOATED` |
| It does not fit even at 70 %, on a right page | full size on the next page; the gap stays (a float would leave the open spread) | `IMAGE_MOVED` |
| The next block starts with a page break, or nothing follows the image | moved to the next page | `IMAGE_MOVED` |

Inside a callout, quote or list item, and in the back notes, images only
shrink; they never float out of their box. If they still do not fit, they
move to the next page with `IMAGE_MOVED`.

The rule does not apply to the cover, to images in table cells, links,
headings or footnotes, or to missing images.

`IMAGE_FLOATED` and `IMAGE_MOVED` are found after the compile. They are
listed in the report and counted in the preview, but they never stop an
export, even in strict mode.

Rarely, after a floated image the next paragraph does not fit in the gap
either, and the gap stays.

## The cover

The cover is a full-page picture on page 1, edge to edge (it fills the trim
size and the bleed), with no page number or header. The cover is set in
preset notes only.

```yaml
cover:
  mode: auto                 # auto, file, none; built-in auto
  file: "Sample/assets/cover.png"   # used with mode: file
  blankPageAfter: false      # built-in false
  cropWarningPercent: 5      # 0 to 100; built-in 5
```

### Modes

- **`auto`** (built-in): if the first block of the note (after the
  frontmatter) is exactly one image and nothing else, that image is the
  cover and is removed from the body. A heading, text, two images, an image
  with text, an image from the web or an image inside a link are not a cover.
- **`file`**: the image at `file` (a vault path, written exactly) is the
  cover. An image at the start of the note is still removed from the body.
- **`none`**: no cover; nothing is removed.

### Setting the cover from a menu

- In the editor, click into a line with an image, right-click and choose
  **Use as cover** (with several images on the line: `Use "<file>" as cover`).
- In the file explorer, right-click an image file and choose **Use as
  cover**.

Both set `cover.mode: file` and `cover.file` in the active preset after a
question. On the image that is already the cover, the item reads **Stop using
as cover** and sets the mode back to `auto`.

### The blank page and the page numbers

With `blankPageAfter: true`, page 2 is left blank and the body starts on page
3, a right page. Without it, the body starts on page 2. Either way, the first
body page is page number 1.

If the book has a colophon or contents (see
[Book structure](book-structure.md)), page 2 is always left blank and the
colophon starts on page 3.

### Cropping

The picture fills the whole page and is cut to the page's shape. If more than
`cropWarningPercent` of it is cut off, the export reports `COVER_CROPPED`:

```text
Cover image is cropped by 6.5% (image 2000×3000 px, page 154×216 mm)
```

To avoid cropping, make the image the same shape as the page including bleed.

### Problems

A missing cover file gives `COVER_MISSING`, an unsupported or broken one
`COVER_TYPE_UNSUPPORTED`; the export then has no cover page. `cover.back` is
reserved for a back cover that is not supported yet (`COVER_BACK_UNSUPPORTED`).
