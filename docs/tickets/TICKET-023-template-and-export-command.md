# TICKET-023 — Template file and the export command

**Status:** Done
**User story:** [US-008](../user-stories/US-008-presets-and-settings.md) (also delivers [US-007](../user-stories/US-007-in-plugin-typst-compilation.md) AC-1 and AC-6)
**ACs addressed:** AC-9, AC-10, AC-11, AC-12, AC-14 (wiring), AC-15
**Depends on:** TICKET-020, TICKET-021, TICKET-022, TICKET-019

---

## Description

Make an export from the command: scan the template for names that shadow a
Typst built-in, copy the template next to the `.typ`, join the effective
settings of the active preset to `convert`, ask for the export folder, and hand
the result to `runExport`. This is the first ticket that runs the whole
chain, so it also carries the real-compiler test of The Rules.

---

## Acceptance criteria (from user story)

See US-008. This ticket covers:

- **AC-9:** the template is copied to `<export>/template.typ` on every export;
  the `.typ` imports it before any generated rule; the vault copy is never
  modified.
- **AC-10:** `TEMPLATE_SHADOWS_BUILTIN` with the template line; the template
  stays in effect.
- **AC-11:** a missing template: export continues, `TEMPLATE_MISSING`.
- **AC-12:** switching the active preset changes the next export; `bleed: 5`
  gives 158×220 mm.
- **AC-14:** `effectiveSettings` feeds `convert`.
- **AC-15:** the command, the remembered folder per preset, the refusals
  (`Open a note to export it`, `Presets are not exported`, the invalid-preset
  notice, no preset).
- **US-007 AC-1** (command and folder) and **AC-6** (`compiledtext.md` exports
  with zero compile errors in 30 s).

---

## Implementation notes

- **`src/core/template/`:** `std-names.ts` (`STD_NAMES`, generated from the
  bundled compiler with `dictionary(std).keys()`, 157 names for Typst 0.14.2,
  with the generating snippet in a comment), `scan.ts` (`scanTemplate`: `#let
  name` or `#let name(` at line start, spaces or tabs after `#let`, CRLF),
  `warnings.ts` (`templateWarnings`, `missingTemplateWarning`, line 0), `index.ts`.
  Both warnings are flipped to `active` in `docs/technical/warning-codes.md`.
- **`src/plugin/export-command.ts`:** `exportCurrentNote(deps)`; dependencies
  are injected (`notes`, `vault`, `presets`, `settings`, `chooseFolder`, `run`,
  `notice`), so it is tested without Obsidian. Template warnings come before
  the conversion warnings. The head of an image file (16 bytes) is read only
  for files whose name an image reference uses (US-015 first pass).
- **`src/plugin/main.ts`:** command id `export-current-note`, name `Export
  current note`; the folder dialog is the desktop one already used by M1; the
  fonts list stays empty until US-010.
- The scan drops a leading byte-order mark before it counts lines; the copied template text is not changed.
- A template named `template.md` or a note called `Template` must not collide
  with the copy: the existing `exportNames` rule (`template-note`) applies and
  is tested again with the disk writer.
- The template is copied as text; it is the user's file and is never parsed
  beyond the scan (SCAR-001: the scan is the only transform, documented in its
  doc comment).
- `STD_NAMES` is compared with the compiler by
  `tests/integration/us-008-typst-facts.test.ts`, so a compiler update that
  adds a name fails until the list is regenerated (SCAR-008).

---

## Tests

- `tests/unit/us-008-presets.test.ts` — AC-9 (scan), AC-10, AC-11 (message).
- `tests/plugin/us-008-export-command.test.ts` — AC-3, AC-4, AC-7, AC-9 to
  AC-12, AC-15, US-007 AC-1.
- `tests/integration/us-008-template-copy.test.ts` — AC-9, AC-11 on a real
  disk.
- `tests/integration/us-008-typst-facts.test.ts` — AC-10 (list equals compiler).
- `tests/integration/us-007-export-compiledtext.test.ts` — US-007 AC-6.
- `tests/plugin/us-008-wiring.test.ts` — command registration (US-007 AC-1).

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: scan rules, import placement, template precedence
      (preset over Defaults), missing-template path, folder memory and each
      refusal switched off alone are caught by a test.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story files updated (US-008 AC-15, US-007 AC-1 and AC-6 marked delivered).
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

## Implementation result

- `plugin/export-command.ts`: `exportCurrentNote(deps)` with injected notes, vault, presets, settings, folder dialog, run and notice. The folder dialog opens only after the preset is known to be valid; the note is read after the folder is chosen. Template warnings come before the conversion warnings.
- `plugin/obsidian/`: `vault-access` (open note, files, heads, bytes, text), `export-host` (export folder on disk through the disk writer; the warnings note is created or replaced in the vault; preset notes are never written), `folder-dialog` (Electron's `dialog` from `@electron/remote` or `electron.remote`; not testable outside Obsidian, so M3 checks it).
- `plugin/main.ts`: command `export-current-note` (shown as `Obsidian2Typst: Export current note`), one export lock for all runs.
- The real-compiler test of The Rules (US-007 AC-6) passes in about a second per run (limit 30 s).
- Mutation check (24 mutants of the command): all caught after three tests were added (the Defaults reach the typ, a preset that the Defaults made invalid is refused, the note name in any case of `.md`).
- Not done here and left to M3: the real folder dialog and the real vault.

Manual check M3 passed on 2026-10-17 (build 0.1.0-m3.1).
