# TICKET-036 — Page setup: facing pages in the PDF, cover with a slug, trim size and gutter in the settings tab

**Status:** Done (2026-10-18, M2 step 14 passed on build `0.1.0-m5.7`)
**User story:** [US-009](../user-stories/US-009-page-setup.md)
**ACs addressed:** AC-5 (done, tests green), AC-11, AC-12, AC-13, AC-14; US-008 AC-19, AC-20
**Depends on:** TICKET-002, TICKET-024, TICKET-029
**SCARs:** SCAR-014 (the custom size is removed only after a question), SCAR-016 (dropdown, rows and gutter change at once), SCAR-015 (measured in the PDF), SCAR-012, SCAR-001

---

## Description

US-009 is built except for three things found in the AC-by-AC check of
2026-10-18: the cover fills the slug (AC-11), the `Trim size` row is a text field
and the gutter field is never disabled (AC-12, AC-13). AC-5 (the x position of
the first text line on facing pages) had only `todo` stubs and is now measured
in the real PDF.

---

## Implementation notes

- **AC-11:** `PageGeometry.slug` (mm, 0 when not set). `emitCoverPages` takes
  `slug` and writes `margin: <slug>mm` (number format of AC-7) or `0pt` for 0;
  the blank page after the cover uses the same margin. `convert/cover.ts`
  measures the crop against `pageWidth − 2·slug` × `pageHeight − 2·slug`.
- **AC-12, AC-13:** a pure module `src/plugin/settings/page-fields.ts`
  (`TRIM_CHOICES`, `trimChoiceOf`, `planTrimChoice`, `gutterEnabled`; transforms:
  `planTrimChoice` returns a new object, never changes its argument, and removes
  `trimWidth`/`trimHeight` for a name, all three for `(built-in)`). The tab uses
  `ConfirmModal` and one `setDefaults` call; the tab redraws after the choice
  and after the `Facing pages` switch.
- `tests/support/pdf.ts`: `PdfPage.firstLineX` and `PdfPage.clip` (measuring
  helpers; the guard test shows `null` for a page without text).
- Not testable without Obsidian beyond the pure helpers: manual check M2 step 14.

---

- **Defects found by M2 step 14 on `0.1.0-m5.5` (2026-10-18), fixed in
  `0.1.0-m5.6`:** (1) each typed width alone was a lone value: every preset was
  invalid and showed a toast; the two fields are now saved together
  (`planTrimSizes`) and always visible, disabled unless `Custom`; (2) behind it,
  a custom size of the Defaults overrode a preset's own `trimSize`: the trim size
  is one group in `overlayPage` (AC-14); (3) the tab jumped to the top on every
  redraw: `captureScroll` keeps the position (US-008 AC-19); (4) the gutter row
  now stands under `Facing pages`.
- **Defect found by M2 step 14 on `0.1.0-m5.6` (2026-10-18), fixed in
  `0.1.0-m5.7` (SCAR-017, class fix):** typing `2` into `Trim height (mm)` (next
  to a stored width) saved 2 mm and every preset showed a notice; the guard of
  `m5.6` covered only the lone value. The pattern "text field saved on every
  key" was searched in the whole tab; all five instances are fixed by one helper
  (`commit.ts`, `commitOnChange`, saves on `change`):
  Defaults rows (generic loop), the trim width/height rows, the Fonts text rows
  (folder, sizes), `Presets folder` (typed `a/b` would have created a folder per
  character) and `Warnings note folder`. Not affected: the switches and dropdowns
  (one click is one value) and the fields of the modals (`NameModal` keeps its
  Enter handling, SCAR-013). Not done, decided by the user later if wanted: a
  Defaults-level minimum of 50 mm for the trim size fields.

## Tests

- `tests/integration/us-009-facing-pages-pdf.test.ts` (4, AC-5 and AC-9, green;
  the margin swap is caught).
- `tests/unit/us-009-cover-slug.test.ts` (7) and
  `tests/integration/us-009-cover-slug-pdf.test.ts` (2): AC-11.
- `tests/plugin/us-009-settings-page.test.ts`: AC-12, AC-13; `tests/unit/us-009-trim-group.test.ts` (7): AC-14; `tests/plugin/us-008-scroll.test.ts`: US-008 AC-19; `tests/plugin/us-008-text-commit.test.ts` (5): US-008 AC-20 (helper and a text check over the whole tab).
- Mutation checks: 9 mutants (cover margin, crop sheet, slug not passed, width
  kept, no question, gutter always enabled, no redraw, not disabled, custom flag),
  7 caught at once, the last 2 by two more text checks.

---

## Acceptance

- [x] Tests green, mutation checks caught, full gate green
- [x] M2 step 14 passed by the user
