# Obsidian2Typst

An Obsidian plugin that converts a single Markdown file (with its linked image
assets) into a valid [Typst](https://typst.app) file, ready to be compiled into
a print-ready PDF.

This plugin was created as an excercise to learn how to use AI agents for coding. None of the code was written by hand. I am not a developer - use this at your own discretion.

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

## Repository layout

```
CLAUDE.md          development process, code style, and agent rules
scars/             known failure patterns; review before starting any work
docs/
  user-stories/    user stories with acceptance criteria (source of truth)
  tickets/         work items derived from the stories
  technical/       dependencies and quality gates / AC-to-test map
releases/          release notes and history
tests/fixtures/sample/  generated sample vault, the tests' large input
```

## Development process

Every piece of work follows the loop defined in `CLAUDE.md`:

0. SCAR review before writing anything
1. User story with concrete acceptance criteria
2. Tests for every acceptance criterion
3. Tickets
4. Implementation, with a fully green test suite before release

## Status

Project setup. No user stories or code yet; the files under `docs/` are still
template examples.

## License

MIT — see [`LICENSE`](LICENSE). The bundled fonts keep their own licences
(`assets/fonts/Libertinus-OFL.txt`, `assets/fonts/DejaVu-LICENSE.txt`).
