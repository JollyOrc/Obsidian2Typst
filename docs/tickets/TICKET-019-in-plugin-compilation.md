# TICKET-019 — In-plugin compilation: compile service, export run, packaging

**Status:** Done
**User story:** [US-007](../user-stories/US-007-in-plugin-typst-compilation.md)
**ACs addressed:** AC-1, AC-1b, AC-2, AC-3, AC-3b, AC-4, AC-5, AC-8, AC-9, AC-10, AC-11, AC-12 (AC-6 and AC-7 wait for the pipeline)
**Depends on:** TICKET-001 (spike results), TICKET-018 (`finishExport`), TICKET-017 (`copyAssets`)

---

## Description

Compile the generated Typst to a PDF inside Obsidian with the bundled
`typst.ts` compiler, in a Web Worker, and write the export folder: `.typ`,
assets, template copy, PDF and the warnings report. The command that starts an
export and the "remember the folder per preset" setting are wired by US-015 and
US-008; this ticket delivers what they call.

Decided by the user on 2026-10-17: export folder anywhere on disk; the compiler
WASM embedded in `main.js` as gzip + base64; service plus wiring with a manual
check in Obsidian; a note named `template` is exported as `template-note.*`.

---

## Acceptance criteria (from user story)

See US-007.

---

## Implementation notes

- **`src/core/compile`** (pure): `exportNames`, `formatCompileError`, `CompileRequest`, `CompileResult`.
- **`src/plugin/compiler/worker-core.ts`:** `createWorkerCore(post)`; the logic of the worker over `postMessage`, with the real `typst.ts`. Messages: `init`, `compile`; answers `ready`, `compiled`, `compile-error`, `failed`.
- **`src/plugin/compiler/worker.ts`:** the worker entry, built as an IIFE and embedded as text.
- **`src/plugin/compiler/index.ts`:** `createTypstCompiler({createWorker, compilerWasm})`, one worker per compile, ids, `dispose`.
- **`src/plugin/compiler/wasm-codec.ts`:** `decodeWasm`, `lazyWasm`; **`embedded-wasm.ts`** and **`start-worker.ts`** connect the embedded modules.
- **`build/embed.mjs`, `build/build-plugin.mjs`:** `gzipBase64`, `buildPlugin({outfile})` with the esbuild plugin for `embedded:compiler-wasm` and `embedded:worker-source`; `esbuild.config.mjs` calls it.
- **`src/plugin/run-export.ts`:** `runExport`, `createExportLock`; **`src/plugin/disk-writer.ts`:** `createDiskWriter(root)`.
- **`src/plugin/warning-flow.ts`:** `writeOutput` may return `{failed: true}`.
- **`src/plugin/main.ts`:** the compiler, `onunload`, the developer command `Check compiler (developer)`.

---

## Tests

- `tests/unit/us-007-compile-names-errors.test.ts`
- `tests/plugin/us-007-compiler-service.test.ts`, `us-007-export-run.test.ts`, `us-007-disk-writer.test.ts`, `us-007-wasm-codec.test.ts`, `us-007-plugin-wiring.test.ts`
- `tests/integration/us-007-compile-service.test.ts`, `us-007-broken-compiler.test.ts`, `us-007-packaging.test.ts`, `us-007-cli.test.ts`, `us-007-composed-export.test.ts` (replaced the todo of AC-7)
- Manual: M1 in `docs/technical/manual-checks.md`

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: each rule switched off alone is caught by a test.
- [x] M1 run in Obsidian and recorded (2026-10-17: longest gap 12 ms).
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story file updated if ACs were refined during implementation.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [ ] Ticket status set to `Done` in `docs/tickets/README.md`.

---

## Implementation result

- Typst's `pdf()` throws only a debug string of the diagnostic (no line); the worker therefore calls the compiler's `compile` with `CompileFormatEnum.pdf` and `diagnostics: 'full'`, which returns `path`, `range` (`line:column`, counted from 0) and `message`. The worker turns each into `<path>:<line>:<column>: error: <first line>` (counted from 1) and `formatCompileError` reads that form.
- The format must be the enum value, not the string `'pdf'`: the string silently produced the vector format (368 bytes, no `%PDF-`).
- A missing image gives `failed to load file (access denied)` at the place of the image call; the file name is not in the message (US-003 normally replaces a missing image with a placeholder, so this is rare).
- typst.ts keeps the first WASM it loads for the whole process, so the test with a broken WASM is in its own file; a real worker is always fresh.
- `main.js` is 14 MB with the compiler embedded (gzip + base64) and the worker as text.
- The embedded WASM is decoded on the main thread (`atob` plus a stream); M1 measured a longest gap of 12 ms including the decode, so it stays on the main thread.
- Mutation check C1 to C8, W1 and W2, D1 and D3, S1 to S6, R1 to R11, F1, K1, K3 to K5 and K7, B1 and B2 (38 mutants): all caught, except S6 which is equivalent (a promise settles once). K5 was checked with the real risk (`assets: ['text']` would fetch fonts).

---

## Follow-ups (not part of this ticket)

- **typst CLI in CI:** install the `typst` CLI (0.14.x) in CI so that `tests/integration/us-007-cli.test.ts` runs instead of being skipped.
- **Default fonts:** the compiler has no fonts built in; a PDF has no visible text until fonts are passed in `CompileRequest.fonts` (US-010).
- **Export command and per-preset folder:** US-015 and US-008.
- **Reference export (AC-6) and composed export (AC-7):** US-015, US-010, US-011.
