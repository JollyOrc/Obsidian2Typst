# TICKET-038 — Shared preparation, preview controller, preview request, settings change event

**Status:** Done
**User story:** [US-012](../user-stories/US-012-style-preview-panel.md)
**ACs addressed:** AC-4, AC-5, AC-6, AC-8, AC-9, AC-10, AC-11, AC-12 (request), AC-13 (same preparation), AC-14 (store event)
**Depends on:** TICKET-037
**SCARs:** SCAR-001 (new call site of the conversion: all its transforms are the export's), SCAR-016 (events instead of values kept), SCAR-017 (one preparation, no second copy), SCAR-006

---

## Description

Everything between the settings and the compiler that does not need Obsidian.

---

## Implementation notes

- `plugin/prepare-note.ts`: `prepareNote(deps, path)` moved out of `exportCurrentNote` (preset choice, template, effective settings, fonts, `convert`, warnings) → `{ok: true, active, typ, warnings, uses, template, fonts}` or `{ok: false, status: 'presets-note' | 'no-preset' | 'invalid-preset', message}`. `compileFonts(bundled, vault)` (`plugin/compile-fonts.ts`) builds the font list for the compiler and replaces the spread `[...(await embeddedFonts()), ...request.fonts]` in `main.ts`; the export and the preview both call it (a text check, US-010 AC-7: the preview wiring is checked here). `exportCurrentNote` calls it and keeps the folder question and the run; it no longer calls `convert` (a text check keeps it so). `PrepareDeps` is the part of `ExportCommandDeps` it uses. No behavior change of the export: the 1205 tests stay green.
- `plugin/preview/request.ts`: `buildPreviewRequest({noteName, typ, uses, template, fonts, readAsset, downsample})` → `CompileRequest` (file `exportNames(noteName).typ`, files under `use.to`, each read once, template under `template.typ`); `downsample(bytes, extension)` is called for `png`, `jpg`, `jpeg` only (WebP amended out, US-012 AC-12), `null` keeps the bytes. `preparePreview(deps, path, {downsample, bundledFonts?})` → `{ok: true, request, warnings: number}` or `{ok: false, error}`; a strict-mode stop gives `Preview stopped: N warnings (strict mode)`. No file under `src/plugin/preview/` writes, copies, shows a notice or takes the export lock (a text check).
- `plugin/preview/controller.ts`: `createPreviewController({setTimer, clearTimer, prepare, compile, onState})` with `setNote`, `renamed`, `deleted`, `refresh`, `styleChanged` (`PREVIEW_DELAY_MS = 500`), `setRange`, `exportStarted`, `exportFinished`, `dispose` and `state` (see the test for the fields). `CompileJob = {result, cancel()}`. A request counter marks results stale; a running job is cancelled when the next one starts; `exportStarted` cancels, `exportFinished` compiles again only when a compile was cancelled or due; `PreviewCompile.release()` frees the renderer document: called for a replaced result, a result dropped as stale, the shown result on `dispose` or when its note is deleted, never for the last good result of an error state (memory, spike risk 1); a throwing `prepare` becomes `Preview failed: <message>`.
- `plugin/settings/data.ts`: `SettingsStore.onChange(listener)` → unsubscribe; one event after `update`, `setDefaults` (when it succeeds) and `setLastExportFolder`; none after a refused value (US-008 AC-3 style, as the preset store).

---

## Tests

`tests/plugin/us-012-controller.test.ts`, `us-012-request.test.ts`, the store
cases of `us-012-panel.test.ts`; the existing export command tests as the
guard. Mutation checks: debounce without reset, stale check removed,
`exportFinished` always compiles, downsample called for svg, a write in the
request builder.

---

## SCAR check (2026-10-18, item by item against the Prevention lists)

- **SCAR-001:** new call sites of `convert` (via `prepareNote`), `resolveFonts`/font list and the asset resolver. The transforms are the export's; the edge-case test at the new call site is `asset names with spaces, hyphens, non-ASCII letters…` in `us-012-request.test.ts` (distinct files equal to the export's `to` paths).
- **SCAR-011:** the same test has `x.png`, `x-2.png` and a second `x.png` in another folder.
- **SCAR-016:** `saveDefaultsField` and the controller read state when called (the mutable-holder test is in the panel test); the panel listens to `settings.onChange` and `presets.onChange` (TICKET-040).
- **SCAR-017:** one `prepareNote`, one `compileFonts`; text checks keep a second copy out of `export-command.ts` and `main.ts`.
- **SCAR-006:** the 1205 existing tests stay the guard of the extraction; pass count noted when done.
- SCAR-007, SCAR-002, SCAR-003: ACs have numbers and composed cases (AC-13 with cover, font, preset switch); every AC has tests (register). SCAR-009, SCAR-010, SCAR-013, SCAR-014: not affected here.

---

## Definition of done

- [x] The tests of the listed files are green (controller, request, settings events; two text checks wait for TICKET-040: `main.ts` second `compileFonts`, panel); the whole gate is red by design until TICKET-040
- [x] No file in `src/plugin/preview/` imports Obsidian (the panel file is added in TICKET-040 and is the only one that does)
- [x] Rows of `docs/technical/tests.md` set to ✅, pass count noted (SCAR-006)


## Result (2026-10-18)

New: `prepare-note.ts`, `compile-fonts.ts`, `preview/request.ts`, `preview/controller.ts`, `SettingsStore.onChange`. `npm test`: 1572 passed, 2 US-012 files and 2 tests red on missing tickets 039/040 only; ESLint and Prettier clean. Mutants: 16, all caught after two added tests (debounce reset, asset used twice).
