# TICKET-067 — The template hook in the export and the preview (plugin)

**Status:** Done (2026-10-22)
**User story:** [US-023](../user-stories/US-023-templates-that-style-the-document.md)
**ACs addressed:** AC-1, AC-2, AC-5 (in the export), AC-7, AC-9
**Depends on:** TICKET-066
**SCARs:** SCAR-001, SCAR-002, SCAR-016, SCAR-017, SCAR-018, SCAR-019, SCAR-023

---

## Description

The plugin tells the core whether the template copy defines the hook: the
export preparation reads the template text where the preset or the Defaults
select it (as today) and sets `templateHook` from that text, so the export
and the preview (which share the preparation) write the hook line.

---

## Acceptance criteria (from user story)

- **AC-1, AC-9:** a hook template from the preset or only from the Defaults
  gives the hook line; the preset's template wins over the Defaults'.
- **AC-2, AC-9:** a plain template gives the import only; none or a missing
  one gives neither.
- **AC-5:** the warning reaches the export's warnings.
- **AC-7:** the preview source is the export document, with the same
  template copy; a template edited between two previews is read again.

---

## Implementation notes

- `src/plugin/prepare-note.ts` (`convertNote`): after `effectiveSettings`,
  the settings handed to `convert` get `templateHook: definesTemplateHook(
  templateText)` when the template exists (`effective.settings.template` and
  `templateText !== null`), else false. The template is read where it is
  read today, at each preparation (SCAR-016: no cached text).
- The preview (`preview/request.ts`) and the export (`export-command.ts`)
  call the same preparation; nothing to change there.

### Guards searched before the ticket (SCAR-023)

- `tests/plugin/us-008-export-command.test.ts` AC-9 to AC-11: templates
  `#let accent …`, `#let quote(body) …` (no hook): line 2 stays the import;
  not affected.
- `tests/plugin/us-012-request.test.ts` AC-10, AC-13: `#let x = 1` (no hook);
  not affected.

---

## Tests

- `tests/plugin/us-023-template-hook-preview.test.ts` (all).
- US-008, US-012, US-016 to US-019 preview and export tests stay green.
- Mutation checks (SCAR-018): the hook flag always true; always false; read
  from the Defaults' template instead of the selected one; set for a missing
  template.

---

## SCAR check (2026-10-22, item by item against the Prevention lists)

- **SCAR-001** (1) new call site of `definesTemplateHook` (TICKET-066's
  register row); (2) fits; (3) no flag added to the scan; (4) edge: a missing
  template, the Defaults' template.
- **SCAR-002** (1–5) composed: the template from the preset over the
  Defaults, the preview and the export, a template edited between previews;
  checked against US-008, US-012.
- **SCAR-003** (1) red tests exist; (2) AC list read; (3) map.
- **SCAR-006** (1–4) full gate, counts, TICKET-068 tracked.
- **SCAR-007** (1–3) exact lines in the tests.
- **SCAR-008** (1–6) n/a beyond TICKET-066 (no new third-party call).
- **SCAR-009, SCAR-010, SCAR-011** n/a.
- **SCAR-012** n/a here (TICKET-068).
- **SCAR-013, SCAR-014** n/a (no dialog, no write).
- **SCAR-015** (1–5) AC-8 is TICKET-066's; M13 in TICKET-068.
- **SCAR-016** (1) the template text is read at each preparation; (2) the
  preview follows through the same preparation; (3–4) the draw → change →
  use test (a template edited between two previews); (5) M13 with the panel
  open; (6–8) n/a.
- **SCAR-017** (1) one place sets the flag (`convertNote`); grep for
  `templateHook` after the code: `prepare-note.ts` and the core only; (2–7)
  as TICKET-066.
- **SCAR-018** (1–8) backups of `prepare-note.ts` by full path with a
  checksum, checked restores, baseline, survivors read first.
- **SCAR-019** (1–5) preset, Defaults only, both, none, missing.
- **SCAR-020, SCAR-021, SCAR-022** n/a (no choice offered, no layout rule,
  no callback).
- **SCAR-023** (1–7) guards searched (above); whole lines compared; the
  mutation run.

---

## Definition of done

- [x] Tests named above green
- [x] Mutation checks run (SCAR-018), results in the result
- [x] ESLint and Prettier clean; pass counts in the result (SCAR-006)

---

## Result (2026-10-22)

Changed: `src/plugin/prepare-note.ts` (`convertNote`: the settings handed to
`convert` get `templateHook: templateText !== null &&
definesTemplateHook(templateText)`, from the text read in the same
preparation; doc comment). Register row "Template scan" names the new call
site (TICKET-066 row).

- Gate (scratchpad `gate067.log`): typecheck, build (`main.js` sha256
  `cdbc3da5a4d9…`), lint green; `npm test` 1775 passed, 0 failed, 1 todo;
  integration 380 passed, 1 skipped.
- AC → tests: AC-1, AC-2, AC-5, AC-7, AC-9 in
  `tests/plugin/us-023-template-hook-preview.test.ts` (7) — green.
- Change against the notes (reported): the ticket's condition also checked
  `effective.settings.template`; a mutant without it survived as equivalent
  (that flag is true exactly when the template text is not null, through the
  `templateExists` callback built from the same text), so the check was
  dropped and the comment says why.
- Mutants (scratchpad `mut067/run.py`; US-023, US-008, US-012, US-016 to
  US-019 plugin tests; baseline 0 failed, 67 passed): the hook always on, always
  off, read from the Defaults' template instead of the selected one — all
  caught; the fourth (the template flag not checked) was equivalent and led
  to the change above. Backups by full path, `shasum -a 256 -c`: OK.
- SCAR-017 grep after the code: `templateHook` in `convert/types.ts`,
  `convert/preamble.ts` (reader) and `plugin/prepare-note.ts` (the one
  writer).
