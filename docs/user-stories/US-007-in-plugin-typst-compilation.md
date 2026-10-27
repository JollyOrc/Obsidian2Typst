# US-007 — Compile to PDF inside Obsidian with a bundled Typst compiler

**Status:** Done (2026-10-17, AC-by-AC check; AC-5 run with typst 0.14.2, see Notes)
**Introduced:** v0.1.0
**Implemented:** —
**Supersedes:** —

---

## Story

**As an** author,
**I want** the plugin to turn my note into a PDF without installing anything,
**so that** I can export a print-ready file straight from Obsidian.

---

## Acceptance criteria

- **AC-1 (export command; delivered by US-008 AC-15):** Command `Obsidian2Typst: Export current note`
  asks for an export folder (and remembers the last one per preset), then
  writes into it:
  ```
  <name>.typ          generated Typst source
  <name>.pdf          compiled PDF
  assets/…            copied assets (US-003)
  template.typ        copy of the configured template, if any (US-008)
  export-warnings.md  (US-006)
  ```
  `<name>` is the note's file name without extension. The export folder may be
  anywhere on disk (decided by the user 2026-10-17): the command opens the
  system folder dialog and keeps the chosen absolute path; the files are
  written with Node's file system (the plugin is desktop-only, AC-8), the
  assets are read from the vault. Missing folders are created. A file that is
  already there is overwritten; no other file of the folder is touched or
  deleted. The command itself and the "last folder per preset" setting are
  wired with US-015 (which supplies `convert`) and US-008 (presets); this story
  delivers what they call (AC-11).

- **AC-1b (a note called `template`):** The note's own files never replace the
  template copy (decided by the user 2026-10-17). If `<name>` equals `template`
  ignoring case (`Template` would replace `template.typ` on a case-insensitive
  disk), the note's files are `template-note.typ` and `template-note.pdf`;
  the template copy is always `template.typ`. Invariant: for every note name
  the three names `<note>.typ`, `<note>.pdf` and `template.typ` are pairwise
  different, also compared ignoring case.
  ```
  Rules      -> Rules.typ, Rules.pdf
  template   -> template-note.typ, template-note.pdf
  Template   -> template-note.typ, template-note.pdf
  template-note -> template-note.typ, template-note.pdf   (a natural name that looks generated: fine, still different from template.typ)
  ```

- **AC-2 (no installation, no network):** Export works with the Obsidian
  application offline and without a `typst` binary on the machine. The generated
  `.typ` uses no `@preview/...` packages.

- **AC-3 (compiler runs off the UI thread):** Compilation runs in a Web Worker;
  while it runs the Obsidian UI stays responsive and a notice shows
  `Compiling…`. A second export started while one runs is refused with the
  notice `An export is already running`. The lock is released when the export
  ends in any way (success, compile error, a failing worker, a thrown error).

- **AC-3b (worker life cycle):** One worker per export; it is terminated when
  the export ends, so that the memory of the compile (about 2.5 GB for the
  reference note, spike S7) is returned, and when the plugin is unloaded while
  a compile runs. Messages carry a request id; an answer with another id is
  ignored. A worker error or crash fails the export with the notice
  `Typst compiler failed: <text>`, writes no PDF, and does not stop the
  warnings report (AC-4).

- **AC-4 (compile errors):** If Typst reports an error, no PDF is written (the
  `.typ` and assets still are, so the user can debug), and a notice shows the
  first error with its line and column in `<name>.typ`. The compiler returns
  errors as `<path>:<line>:<column>: error: <text>` (spike S4); the plugin
  shows them as, for example,
  `Typst error at test.typ:41:8: unknown variable: foo`. The path is shown
  without its leading `/`; an error in another file shows that file (for
  example `template.typ`). A message that does not have this form is shown as
  `Typst error: <text>`. The export-warnings report (US-006) is still written
  and the notice `Exported with N warnings` is not shown, because the export
  did not succeed. In strict mode (US-006 AC-4) nothing is compiled when there
  is a warning.

- **AC-5 (the generated .typ also compiles outside the plugin):** The `.typ`
  compiles with the official `typst` CLI of the same major version as the
  bundled compiler, given the font folder (integration test, skipped with a
  linked ticket if the CLI is not available in CI).

- **AC-6 (reference input):** the sample note `Book.md` (US-024) exports
  with zero compile errors, and its PDF holds the manifest's first known
  sentence. Time limit: 30 s on the reference machine (proposed;
  measured in Obsidian by spike S7: 9.1 s cold, 0.15 s unchanged rerun; Obsidian
  process memory about 2.5 GB). Memory is reported, not asserted. Checked
  end to end by `tests/integration/us-007-export-compiledtext.test.ts`
  (conversion, export run and the real compiler in Node, stand-in images; about
  1 s) and, in Obsidian, by manual check M3 (US-008).

- **AC-9 (main thread stays free):** The compiler runs in a Web Worker. While a
  compile runs, the longest gap between two event-loop turns on Obsidian's main
  thread is at most 100 ms (approved by the user 2026-10-16; measured in spike
  S7). Obsidian cannot run in the automated tests: the check is the manual
  procedure M1 in `docs/technical/manual-checks.md`, run with the command
  `Obsidian2Typst: Check compiler (developer)`, which compiles a test document
  through the real worker and the embedded compiler and reports the longest gap.

- **AC-10 (offline):** Compiling the reference input opens no network
  connection (spike S10). A `@preview` package import fails with the compiler's
  error message (AC-4); packages are not supported in the first release.
  Automated: a compile with an image, with `fetch`, `net`, `tls` and `dns`
  instrumented, makes zero calls.

- **AC-7 (composed export):** A note with a cover (US-011), a custom font
  from the vault (US-010), an image inside a list item (US-003), a wikilink
  (US-004), and a table (US-005) exports to a folder containing exactly the
  files of AC-1, the PDF opens with the cover as page 1, and the log of
  warnings is empty. Checked by
  `tests/integration/us-007-composed-export.test.ts` (real compiler, real disk)
  and, in Obsidian, by M5.

- **AC-8 (platform):** The first release is desktop-only
  (`isDesktopOnly: true` in `manifest.json`). (Decided: desktop-only, approved by the user 2026-10-16.)

- **AC-11 (interfaces; what is pure and what is injected):**
  - `core/compile` (pure): `exportNames(noteName)` (AC-1b),
    `formatCompileError(raw)` (AC-4), and the types `CompileRequest`
    (`file` = name of the main file such as `Rules.typ`, `source`, `files` by
    path below the export folder, `fonts`) and `CompileResult`
    (`{ok: true, pdf}` or `{ok: false, error}`).
  - `plugin/compiler` : `TypstCompiler.compile(request)` runs the compiler. The
    real one talks to a worker (`WorkerLike`: `postMessage`, `terminate`,
    `onmessage`, `onerror`), one worker per call (AC-3b); the answers are `ready`, `compiled`,
    `compile-error` (the compiler's raw text) and `failed` (a worker problem),
    each with the request id. The worker's logic
    (`createWorkerCore`) is a plain function over `postMessage`, so the tests
    run it in Node with the real `typst.ts`.
  - `plugin/run-export`: `runExport` takes the conversion (`typ`, assets to
    copy, warnings), the note name, the export folder, the settings of US-006,
    a host (notices, writers for the export folder and the vault), a file
    reader for assets, the compiler, an optional template, the fonts, and an
    `ExportLock`. It calls `finishExport` (US-006) with a `writeOutput` that
    writes `<name>.typ`, the assets and `template.typ`, compiles, and writes
    `<name>.pdf`.
  - `plugin/disk-writer`: writes text and bytes below a folder on disk and
    creates folders; used for the export folder.
  - `finishExport` (US-006) accepts `{failed: true}` from `writeOutput`: the
    report files are still written and the success notice is left out (AC-4).

- **AC-12 (packaging, decided by the user 2026-10-17):** The compiler WASM
  (28 MB) is embedded in `main.js` as gzip + base64 (about 15 MB) and decoded
  on the first export only; the worker's code is embedded as text and started
  from a Blob URL. The release has no file besides `main.js`, `manifest.json`
  and `styles.css`. The 1 MB renderer WASM is not embedded until the preview
  (US-012) needs it. Checks: the embedded bytes decode to the original WASM
  (hash), `main.js` of the build stays under 25 MB, and the manual procedure
  M1 shows that the worker starts from the embedded copy in Obsidian.

- **AC-13 (the PDF has text; default fonts, found by M3 on 2026-10-17; SCAR-015):**
  The plugin ships a default text font and a default monospace font inside
  `main.js` and gives them to every compile, so an export has visible text
  without any vault font: body text in `Libertinus Serif` (regular, bold,
  italic, bold italic; SIL OFL 1.1) and code in `DejaVu Sans Mono` (regular and
  bold; Bitstream Vera licence). The licence texts are in `assets/fonts/` and
  named in `docs/technical/dependencies.md`. Example: compiling `Hello World`
  with the default fonts gives a PDF that names `LibertinusSerif` as an embedded
  font and whose text can be extracted as `Hello World`; the same source
  compiled with no font gives a PDF that names no font (the guard). The export
  of the sample note names `LibertinusSerif` and `DejaVuSansMono`
  in the PDF. The fonts are decoded on first use only (as AC-12), nothing is
  fetched (AC-2), and the plugin folder still holds only `main.js`,
  `manifest.json` and `styles.css`. Vault fonts and per-role choices stay with
  US-010, which loads on top of these defaults.

---

## Notes

- The bundled compiler is [`typst.ts`](https://github.com/Myriad-Dreamin/typst.ts)
  0.7.0 (WebAssembly, Typst 0.14.2). Spike findings:
  [`spike-typst-wasm.md`](../technical/spike-typst-wasm.md). Fonts and images are
  supplied from memory (spike S4, S5).
- Without fonts the compiler still succeeds but the PDF has no visible text
  (spike S2, S4). The default fonts are delivered by AC-13 (TICKET-027);
  `CompileRequest.fonts` is where they and the vault fonts go.
- PDF/A, PDF/UA and PDF/X cannot be selected through typst.ts 0.7.0 (spike S9);
  they are not part of the first release.
- Typst's documented PDF standards (typst.app/docs/reference/pdf): PDF 1.4–2.0,
  PDF/A-1…A-4, PDF/UA-1. PDF/X is not listed there; see the backlog item
  "Print output". The bundled typst.ts API does not expose them (see above).
- AC-5: the `typst` CLI is not installed in the development environment, so the
  test is skipped there; ticket TICKET-019 carries the follow-up (install the
  CLI in CI).

- AC-5 was run on 2026-10-17 with typst 0.14.2 (official CLI, same major version as the bundled compiler 0.14): `tests/integration/us-007-cli.test.ts` 2 tests passed. The test skips where the CLI is absent (this project has no CI yet; the follow-up to install the CLI in CI stays in TICKET-019 and starts when a CI exists).

---

## Related tickets

- [TICKET-001](../tickets/TICKET-001-typst-wasm-spike.md) — Spike: bundled WASM Typst compiler
- [TICKET-019](../tickets/TICKET-019-in-plugin-compilation.md) — compile service, export run, packaging
- [TICKET-027](../tickets/TICKET-027-default-fonts.md) — bundled default fonts (AC-13)
