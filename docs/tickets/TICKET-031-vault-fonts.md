# TICKET-031 — Fonts from the vault: font info, font set, export seam

**Status:** Done (2026-10-17)
**User story:** [US-010](../user-stories/US-010-fonts.md)
**ACs addressed:** AC-3, AC-7 (plugin part)
**Depends on:** TICKET-030
**SCARs:** SCAR-015 (content), SCAR-007 (compiler worker rules of US-007)

---

## Description

Read the font files of the folder of the preset, tell the compiler about them,
and give the catalog and the files to the conversion and to the export run.

---

## Implementation notes

- **Compile service:** `fontInfo(fonts: readonly Uint8Array[])` returns one
  entry per file: the faces `{family, coverage}` or `null` for bytes that are
  no font. One worker per call, started with `init`, then a `font-info` message,
  answered by `font-info-result`; the worker is terminated at the end; no
  worker for an empty list; a failure rejects with `Typst compiler failed: …`.
  `worker-core.ts` uses `TypstFontBuilderDriver.getFontInfo` (empty info means
  `null`).
- **`src/plugin/fonts/`:** `createFontSet({bundled, vault, compiler})` returns
  `(folder | null) => Promise<{catalog, files, warnings}>`. The bundled fonts
  are inspected once and kept; the vault folder is read again on every call.
  `.ttf` and `.otf` (any case of the extension) of the folder and below, sorted
  by path; a folder named `Fonts` does not match `Fonts2`. Warnings: zips first
  (`FONT_ARCHIVE_IGNORED`, one per zip), then invalid files
  (`FONT_FILE_INVALID`), each sorted by path; a missing folder is
  `FONT_FOLDER_MISSING` and the bundled fonts remain. `files` holds the bytes of
  the readable vault fonts only.
- **Export command:** `ExportCommandDeps.fonts?` (optional); folder = the
  preset's `fonts.folder`, else the Defaults', else `null`; the catalog goes to
  `convert`; `ExportRequest.fonts` carries the vault fonts and `main.ts` adds
  them to the embedded ones; warning order: template, font set, conversion.
  Without the dependency the names are written as given and nothing is
  reported.
- Font files are never copied to the export folder and never appear in the
  list of assets.
- `docs/technical/warning-codes.md`: `FONT_ARCHIVE_IGNORED`,
  `FONT_FOLDER_MISSING`, `FONT_FILE_INVALID` become `active`.

---

## Tests

- `tests/plugin/us-010-fonts-plugin.test.ts` (service with scripted workers, font
  set, export command)
- `tests/integration/us-010-fonts-pdf.test.ts` (real font info, the font set over
  real files)

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: extension and case, recursion, folder prefix, zip and
      invalid warnings, bundled cache, order of warnings and the vault files
      in the request each switched off alone are caught by a test.
- [x] Full quality gate passes.
- [x] `docs/technical/tests.md` rows set to pass.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
