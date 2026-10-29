# Fonts

[Back to the manual](manual.md)

The plugin brings two fonts: **Libertinus Serif** for text and **DejaVu Sans
Mono** for code. You can use any other font by putting its files in a vault
folder.

## Roles

Fonts are set per role:

| Role | Used for | Without its own family | Without its own size |
| --- | --- | --- | --- |
| `body` | paragraphs, lists, tables, footnotes, quotes, link text | the default font | 10 pt |
| `heading` | headings | the default font | Typst's sizes per heading level |
| `caption` | image captions | the default font | 0.9 × body size |
| `code` | inline code and code blocks | DejaVu Sans Mono | 0.9 × body size |

The **default font** (built-in Libertinus Serif) is used by every role except
`code` that has no family of its own.

```yaml
fonts:
  folder: "Layout/Fonts"         # vault folder with .ttf and .otf files
  default: "Libertinus Serif"
  body:    {family: "EB Garamond", size: 10}
  heading: {family: "Cinzel", size: 18}
  caption: {size: 9}
  code:    {family: "DejaVu Sans Mono"}
```

Sizes are in points, greater than 0 and at most 200. A `heading.size` is one
size for all heading levels. Callout styles can set their own font, see
[Callout styles](callouts.md).

You can set fonts in a preset note or in the **Fonts** section of the settings
tab (the Defaults).

## Using your own fonts

1.  Create a folder in your vault, for example `Layout/Fonts`.
2.  Copy the `.ttf` or `.otf` files into it (sub-folders are read, too).
3.  Set it as **Font folder** in the settings tab, or as `fonts.folder` in a
    preset.
4.  Choose the family in the dropdowns, or write its name in the preset note.

The family name is the name the font file reports, for example `EB Garamond`
(case does not matter). The dropdowns list the bundled fonts and the fonts in
the folder of the active preset (its `fonts.folder`, else the Defaults'
folder).

Things to know:

- A `.zip` file is not opened; unzip it first (warning
  `FONT_ARCHIVE_IGNORED`).
- A file that cannot be read as a font is skipped (`FONT_FILE_INVALID`).
- A folder that does not exist gives `FONT_FOLDER_MISSING`; only the bundled
  fonts are used.
- Fonts are never copied into the export folder (for licence reasons). The
  `.typ` file names the families only, so to compile it outside Obsidian you
  need the fonts installed there.

## Missing fonts

A family that is neither in the font folder nor bundled is replaced, and the
export reports `FONT_MISSING`:

- a role's family is replaced by the default font (`code` by DejaVu Sans
  Mono);
- the default font is replaced by Libertinus Serif.

```text
Font "Cinzel" for heading was not found; "Libertinus Serif" is used
```

In the dropdowns, a family that is not found is shown as
`<name> (not found)`.

## Missing characters

Before compiling, the plugin checks that each font has every character your
note uses in that role. Missing characters are reported once per font with
`FONT_GLYPH_MISSING`, listing up to ten of them and the first line where one
occurs:

```text
Font "Libertinus Serif" lacks 2 characters: ☠ U+2620, ⚔ U+2694 (first at line 12)
```

Task lists use the check-box characters ☐ and ☒. If the body font lacks
them, the plugin writes `[ ]` and `[x]` instead. Under the Default font and
Body font rows, the settings tab tells you which of the two the chosen font
lacks, for example:

```text
Missing: ☐ U+2610, ☒ U+2612. Task lists will use [ ] and [x].
```
