# Dependencies

> Keep this file coherent with `../user-stories/userstories.md` and `tests.md`.

## Runtime dependencies

<!-- List runtime dependencies with versions and why each is needed. -->

| Package | Version | Purpose |
|---------|---------|---------|
| `@myriaddreamin/typst.ts`, `typst-ts-web-compiler`, `typst-ts-renderer` (WASM; bundles Typst 0.14.2) | 0.7.0 (exact) | Compile Typst to PDF and render previews inside Obsidian, offline |

| `markdown-it` | 15.0.3 (exact) | Markdown to token stream (CommonMark, tables, strikethrough, linkify). Decided 2026-10-16, `markdown-parser.md`. Adds about 108 kB minified to `main.js` |
| `markdown-it-footnote` | 4.0.0 (exact) | `[^1]` and inline `^[…]` footnotes |
| `markdown-it-mark` | 4.0.0 (exact) | `==highlight==` |
| `yaml` | 2.9.1 (exact) | Reads the frontmatter of preset notes with the line and column of errors (US-008, decided by the user 2026-10-17). ISC licence. About 97 kB minified when `parseDocument`, `LineCounter`, `isMap` and `isScalar` are bundled alone |
| Libertinus Serif 7.051 (4 faces, `assets/fonts/`; SIL OFL 1.1, licence in `Libertinus-OFL.txt`) | exact files | Default text font, embedded in `main.js` as gzip + base64 (about 1.2 MB packed). Reserved font names: the font is not modified or renamed. US-007 AC-13, TICKET-027 |
| DejaVu Sans Mono (regular, bold, `assets/fonts/`; Bitstream Vera licence, `DejaVu-LICENSE.txt`) | exact files | Default monospace font for code, embedded in `main.js`. The licence text must stay with the fonts |
| `markdown-it-task-lists` | 2.1.1 (exact) | `- [ ]` items; ISC licence, unmaintained, to be replaced by an own rule (US-005 ticket) |

Licences in the bundle: MIT, ISC (task-lists, yaml), BSD-2-Clause (entities). Installed by TICKET-010 (exact versions in `package.json`; `@types/markdown-it` 14.2.0).

## Development dependencies

<!-- List dev/build/test dependencies. -->

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | 5.0.5 | Unit, plugin, and integration tests (`it.todo` stubs, fake timers) |
| `typescript` | 5.9.3 | Strict type checking. TypeScript 7 exists but is not used: pinned to the 5.x line; typescript-eslint 8.71.2 supports `>=4.8.4 <6.1.0` |
| `@myriaddreamin/typst.ts`, `typst-ts-web-compiler`, `typst-ts-renderer` | 0.7.0 (exact) | Dev dependency for now: the test harness compiles Typst in Node (`tests/support/typst-node.ts`, TICKET-007). Becomes a runtime dependency with US-007's ticket |
| `esbuild` | 0.28.2 | Bundles `src/plugin/main.ts` to `main.js` (as in the official sample plugin) |
| `eslint`, `@eslint/js` | 10.12.0, 10.0.1 | Lint; also enforces that `src/core` imports no Obsidian or Node modules |
| `typescript-eslint` | 8.71.2 | TypeScript rules for ESLint (recommended set) |
| `prettier` | 3.9.10 | Formatting with the Google TypeScript style choices (`.prettierrc.json`); the Google lint package `gts` is not used |
| `obsidian` | 1.14.4 | Type definitions for the plugin API (types only; the app provides it at runtime) |
| `@types/markdown-it` | 14.2.0 (exact) | Types for markdown-it (it ships none) |
| `@types/node` | 22.20.5 | Node types for the build test and the ESLint test |

## Build requirements

- Node 22.12 or newer (required by Vitest 5; tested with 22.23).
- npm.
- Desktop Obsidian only (US-007 AC-8).

## Dependency policy

- Prefer standard-library or zero-dependency solutions for core logic.
- Every new dependency requires a documented justification above.
- Audit transitive dependencies for licence compatibility before adding any
  new direct dependency.
