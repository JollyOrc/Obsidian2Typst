# Architecture

Moved from `CLAUDE.md` on 2026-11-01, unchanged.

The plugin is split into a **pure core** and a thin **Obsidian shell**.

| Module | Responsibility | Side effects |
|--------|----------------|--------------|
| `src/core/parse` | Markdown (incl. Obsidian syntax: wikilinks, embeds, callouts, frontmatter) to an intermediate document tree | none |
| `src/core/assets` | Resolve image links to asset references (path, type) via an injected resolver | none |
| `src/core/markers` | Recognise author-defined markup for examples, glossary entries, and other styles | none |
| `src/core/layout` | Apply image-placement and page-break rules to the tree | none |
| `src/core/emit` | Document tree plus settings to Typst source, including escaping | none |
| `src/core/settings` | Typed settings model, defaults, and validation (fonts, decoration, cover, print) | none |
| `src/plugin` | Obsidian API: commands, settings UI, side-panel view, vault file reading, writing output | file I/O, UI |
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
- Behaviour that is configurable is defined in `core/settings`; no formatting
  constants are hard-coded in `emit`.

Tooling (proposed defaults, to be confirmed in the first user story): Node,
npm, esbuild for bundling (as in the official Obsidian sample plugin), Vitest
for tests. Typst compilation uses a **bundled WASM compiler** (`typst.ts`), so
the plugin needs no installed `typst` binary; the CLI is used only in the
integration tests as a second check that generated `.typ` files compile
outside the plugin.
