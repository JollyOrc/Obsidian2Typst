# TICKET-033 — Fonts section of the settings tab

**Status:** Done (2026-10-17, M5 passed on build `0.1.0-m5.2`)
**User story:** [US-010](../user-stories/US-010-fonts.md)
**ACs addressed:** AC-6
**Depends on:** TICKET-030, TICKET-031
**SCARs:** SCAR-014 (reset of a Defaults field), SCAR-015 (content)

---

## Description

A Fonts section in the Defaults of the settings tab: folder, default family,
and per role family and size, with dropdowns of the available families and the
notice about the glyphs that task lists need.

---

## Implementation notes

- **`core/fonts/picker.ts`:** `familyOptions(available, current, {allowUnset})`
  (sorted, a current value that is not found first as `<name> (not found)`,
  `(default family)` entry for a role) is pure and tested.
- **Settings tab:** rows in `DEFAULT_ROWS` use the generic `getField/withField`
  paths (`fonts.default`, `fonts.heading.family`, …); the families come from the
  font set of the folder in effect for the active preset; the notice
  `Missing: ☐ U+2610, ☒ U+2612. Task lists will use [ ] and [x].` appears under
  the default family when the family lacks a glyph (only the missing one is
  named); invalid values show the validation message of AC-1.
- **Reset icon with a question (SCAR-014):** `resetConfirmation` and
  `resetDefaultField` in `settings/dialog.ts` (pure, next to the delete flow);
  every Fonts row has the icon, which asks before the value is removed; the
  other Defaults rows are not changed. Emptying a text field stays without a
  question.
- Not testable without Obsidian beyond the pure helpers: checked in M5.

---

## Tests

- `tests/unit/us-010-fonts-core.test.ts` (picker helpers)
- `tests/plugin/us-010-fonts-plugin.test.ts` (Defaults in `data.json`)
- `tests/plugin/us-010-reset-confirmation.test.ts` (question texts and flow)
- Manual check M5, steps 1 and 7 (the dialog itself)

---

## Definition of done

- [x] All listed tests pass.
- [x] Full quality gate passes.
- [x] M5 steps 1 and 7 run by the user on a build with its own version.
- [x] `docs/technical/tests.md` rows set to pass.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
