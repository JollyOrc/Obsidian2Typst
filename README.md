# Obsidian2Typst

An Obsidian plugin that converts a single Markdown file (with its linked image
assets) into a valid [Typst](https://typst.app) file, ready to be compiled into
a print-ready PDF.

This plugin was created as an exercise to learn how to use AI agents for coding. None of the code was written by hand. I am not a developer - use this at your own discretion.

## Goal

As an Obsidian user and author, I want to turn one Markdown note, including the
images it links to, into a valid `.typst` file without leaving Obsidian, and to
control how the printed result looks. The plugin is not just a converter: it
also helps me format the Typst output.

The plugin should let me:

- **Convert** a single Markdown file and its linked image assets into valid
  Typst that compiles to a PDF suitable for print.
- **Set typography**: choose fonts and related text settings.
- **Add decorative elements** to the layout.
- **Mark up content** for special formatting, such as examples, glossary
  entries, and other custom styles, easily and directly in the note.
- **Control layout**: rules for image placement and page breaks, and a cover
  picture.
- **Adjust other print-relevant settings** useful for producing a printed
  document.

The generated sample vault `tests/fixtures/sample/` (`npm run fixtures`, US-024)
serves as the test input for the conversion.

## Manual

How to install and use the plugin: [`manual/manual.md`](manual/manual.md).

## Repository layout

```
manual/            user manual (start with manual/manual.md)
src/
  core/            pure conversion: parse, assets, markers, layout, emit, presets
  plugin/          Obsidian shell: commands, menus, settings tab, style panel,
                   export, the Typst compiler in a Web Worker
assets/fonts/      bundled fonts (Libertinus Serif, DejaVu Sans Mono)
build/             build and install scripts used by esbuild and npm
tests/
  unit/            tests of the pure core
  plugin/          tests of the Obsidian shell with fakes
  integration/     whole notes converted and compiled to PDF
  tooling/         checks of the repository itself
  fixtures/sample/ generated sample vault, the tests' large input
CLAUDE.md          development process, code style, and agent rules
scars/             known failure patterns; review before starting any work
docs/
  user-stories/    user stories with acceptance criteria (source of truth)
  tickets/         work items derived from the stories
  technical/       dependencies, quality gates, AC-to-test map, warning codes,
                   manual checks
releases/          release notes and history
```

## Building from source

Requires Node and npm.

```bash
npm ci                     # install the pinned dependencies
npm run build              # type check and bundle to main.js
npm run lint               # eslint and prettier --check
npm test                   # unit, plugin and tooling tests
npm run test:integration   # converts the sample vault and compiles the PDFs
npm run fixtures           # regenerates the sample vault
```

To install a build, copy `main.js`, `manifest.json` and `styles.css` into
`<vault>/.obsidian/plugins/obsidian2typst/` (see the
[manual](manual/manual.md#installation)).

## Development process

Every piece of work follows the loop defined in `CLAUDE.md`:

0. SCAR review before writing anything
1. User story with concrete acceptance criteria
2. Tests for every acceptance criterion
3. Tickets
4. Implementation, with a fully green test suite before release

## Status

Version 0.10.0 (desktop Obsidian 1.5.0 or later). Release notes:
[`releases/RELEASES.md`](releases/RELEASES.md).

Working today (user stories US-001 to US-028, all done):

- Conversion of one note to Typst: text formatting, numbered headings,
  lists, task lists, quotes, code, tables, footnotes, internal links and
  wikilinks, web links with address footnotes, images with Obsidian sizes.
- PDF export and a live page preview inside Obsidian with the bundled Typst
  compiler; no Typst installation and no network needed.
- Presets as vault notes on top of Defaults and built-in values, with groups
  and a details pop-up.
- Page setup (trim size, margins, gutter, bleed, slug, facing pages), fonts
  from a vault folder with a glyph check, a cover page.
- Callouts as styled boxes, glossary sections, page numbers and running
  headers, page numbers after internal links.
- Book structure: page breaks by heading level, colophon and back notes,
  roman front matter, signature padding, a table of contents, images that
  shrink or float to stay with their text.
- Typst templates that style the whole document.
- A warning report with clickable source lines, and an optional strict mode.

Not yet done (see the backlog in
[`docs/user-stories/README.md`](docs/user-stories/README.md)): math, crop
marks, a back cover, decorations, an index, a command that wraps
selected text, and mapping Typst errors back to the note's lines.

## License

MIT — see [`LICENSE`](LICENSE). The bundled fonts keep their own licences
(`assets/fonts/Libertinus-OFL.txt`, `assets/fonts/DejaVu-LICENSE.txt`).
