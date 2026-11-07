# Architecture

Moved from `CLAUDE.md` on 2026-11-01; the modules of epic #121 added 2026-11-07 (#137).

The plugin is split into a **pure core** and a thin **Obsidian shell**.

| Module | Responsibility | Side effects |
|--------|----------------|--------------|
| `src/core/parse` | Markdown (incl. Obsidian syntax: wikilinks, embeds, callouts, frontmatter) to an intermediate document tree | none |
| `src/core/assets` | Resolve image links to asset references (path, type) via an injected resolver | none |
| `src/core/markers` | Recognise author-defined markup for examples, glossary entries, and other styles | none |
| `src/core/layout` | Apply image-placement and page-break rules to the tree | none |
| `src/core/emit` | Document tree plus settings to Typst source, including escaping | none |
| `src/core/entries` | Epic #121: the statblock model shared by the PDF and the Obsidian preview (`model.ts`), the layout and sheet warnings made from the compile's facts (`report.ts`), the encounter sheet (`sheet.ts`) | none |
| `src/core/checks` | Epic #121, US-034: the print checks — low resolution from the drawn widths (`print.ts`), the word-gap scan of a PDF (`word-gaps.ts`, small so the worker can load it) | none |
| `src/core/pdf` | Epic #121, US-034 AC-9: the PDF reader on bytes (`reader.ts`: object index, strings, CMaps, streams), FlateDecode (`inflate.ts`), the text runs with positions (`text.ts`); the tests read PDFs through it too | none |
| `src/core/settings` | Typed settings model, defaults, and validation (fonts, decoration, cover, print) | none |
| `src/plugin` | Obsidian API: commands, settings UI, side-panel view, vault file reading, writing output | file I/O, UI |
| `src/plugin/entries` | Epic #121, US-035: the `o2t-entry` code-block processor and the drawing API (`processor.ts`) | DOM (Obsidian's element helpers) |
| `src/plugin/engine` | Loads the WASM compiler in a Web Worker; compile and render requests | worker, memory |

Invariants:

- `src/core/**` must **not** import from `obsidian` or any Node/DOM I/O API.
  File access happens in `src/plugin` and is passed into the core as data or
  as injected interfaces. This keeps the core unit-testable in plain Node.
- Dependencies point one way: `plugin` -> `core/emit` -> `core/layout` ->
  `core/markers` / `core/assets` -> `core/parse`. No module imports "upward".
- Side effects (reading the vault, writing output, showing notices) occur only
  in `src/plugin`.
- Typst escaping lives in exactly one function in `core/emit`. Any new call
  site of it must document its transforms (SCAR-001).
- Epic #121's layout decisions are made inside one Typst compile
  (`measure()`), recorded as `metadata` facts (`<o2t-entry>`,
  `<o2t-entry-end>`, `<o2t-section>`, `<o2t-image>`, `<o2t-sheet>`) and read
  back by the worker after the compile; `core/entries/report.ts` and
  `core/checks/print.ts` turn them into warnings. These never stop a strict
  export (they exist only after the PDF does).
- `core/entries` and `core/emit` draw with the same Typst helpers: the
  statblock and the encounter sheet share `ENTRY_MARKS_DEF` (boxes, cells,
  icons); the preview shares the model and `statblockLookValues`.
- Behaviour that is configurable is defined in `core/settings`; no formatting
  constants are hard-coded in `emit`.

Tooling (proposed defaults, to be confirmed in the first user story): Node,
npm, esbuild for bundling (as in the official Obsidian sample plugin), Vitest
for tests. Typst compilation uses a **bundled WASM compiler** (`typst.ts`), so
the plugin needs no installed `typst` binary; the CLI is used only in the
integration tests as a second check that generated `.typ` files compile
outside the plugin.
