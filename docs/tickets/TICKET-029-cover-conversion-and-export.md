# TICKET-029 — Cover in the conversion, the export and the PDF

**Status:** Done (2026-10-17, M4 passed on build `0.1.0-m4.1`)
**User story:** [US-011](../user-stories/US-011-cover.md) (also closes [US-007](../user-stories/US-007-in-plugin-typst-compilation.md) AC-7 for the cover part)
**ACs addressed:** AC-2 to AC-10 (conversion, warnings, copy, PDF), AC-1 (reaches the export)
**Depends on:** TICKET-028, TICKET-023
**SCARs:** SCAR-010 (joins), SCAR-015 (content), SCAR-012 (test build and handover)

---

## Description

Use the cover core in `convert`: take the image in first position out of the
body, resolve the cover file, write the cover pages as rule 90 of the preamble
order, report the `COVER_*` warnings, put the cover image first in the list of
files to copy, and read a larger head for it. Wire the preset's cover settings
into the export command. Check the PDF with the real compiler and in Obsidian.

---

## Implementation notes

- **`ConvertSettings.cover?: CoverSettings`:** missing means mode `none` (US-015
  AC-3 amended); `AssetIndex.readHead(path, length = 16)`.
- **`convert`:** finds the cover candidate before the body is emitted and
  removes that block from the tree; resolves the cover (the chosen file as an
  exact vault path with a leading `/`, or the image in first position through
  the resolver) before any body image, so the cover gets its name first;
  reads the head of the cover with `IMAGE_SIZE_READ_BYTES` once and does not
  read it again in the first pass; never reports an `ASSET_*` code for the
  image in first position, only `COVER_*` (AC-7) and `ASSET_AMBIGUOUS`;
  the cover pages come after the blank line that ends the preamble and before
  the body, one blank line between; the line map keeps the body lines right.
- **Warnings:** `COVER_MISSING`, `COVER_TYPE_UNSUPPORTED`, `COVER_CROPPED`,
  `COVER_BACK_UNSUPPORTED` become `active` in `docs/technical/warning-codes.md`.
- **Plugin:** `vault-access.ts` `readHead(path, length = 16)`; the export command
  already passes the settings of the active preset, so `settings.cover` reaches
  `convert`.
- **M4 (manual):** the procedure, fixtures and expected results are in `docs/technical/manual-checks.md` (M4). Prepared by the developer on build `0.1.0-m4.1` (SCAR-012); content checks per SCAR-015, ending with the open question. Note found while preparing it: the export prints no page numbers yet, so the counter is checked by the PDF tests only.

---

## Tests

- `tests/unit/us-011-cover-convert.test.ts` (includes the clash with a natural name `front-2.png`, SCAR-011, and a cover name with quotes and a backslash, SCAR-001/010)
- `tests/plugin/us-011-cover-asset.test.ts`, `tests/plugin/us-008-export-command.test.ts` (US-011 block)
- `tests/integration/us-011-cover-pdf.test.ts` (real compiler: page sizes, content per page, blank page, page counter, every kind of first body block)

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: first-block removal, mode handling, `COVER_*` codes and
      lines, crop threshold, blank page, counter order, copy once and the
      larger head each switched off alone are caught by a test.
- [x] Full quality gate passes.
- [x] M4 run by the user on a build with its own version (SCAR-012).
- [x] `docs/technical/tests.md` AC-to-test map updated; US-007 AC-7 note updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
