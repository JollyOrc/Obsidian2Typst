# TICKET-035 — Reset confirmation on the older Defaults rows

**Status:** Done (2026-10-17, M2 step 13 passed on build `0.1.0-m5.4`)
**User story:** [US-008](../user-stories/US-008-presets-and-settings.md)
**ACs addressed:** AC-18 (also changes the last sentence of US-010 AC-6)
**Depends on:** TICKET-033
**SCARs:** SCAR-014 (destructive action without confirmation), SCAR-012, SCAR-015, SCAR-016 (added after the defect)

---

## Description

Every row of the Defaults (highlight colour, heading numbering, footnotes,
template, page rows) gets the reset icon with the question that the Fonts rows
already have. Today the toggle icon removes its value at once and text and
number rows have no icon.

---

## Implementation notes

- `resetConfirmation` and `resetDefaultField` take `string | number | boolean`;
  a boolean is shown as `on` / `off`; `false` is a value (it asks). The doc
  comment of `resetConfirmation` lists this transform (SCAR-001).
- `showDefaults`: toggle icon uses `resetDefaultField` with `ConfirmModal`; text
  and number rows get the same icon; share one helper with `fillFonts` so both
  loops use the same code. After `Reset` the tab redraws.
- Emptying a field by typing stays editing, without a question.
- SCAR review (2026-10-17): SCAR-014 (dialog default is Cancel, the three
  global rows have no stored value to lose, worst misplaced click listed in
  AC-18), SCAR-003 (each part of AC-18 has a test or a manual step), SCAR-007
  (concrete example in AC-18), SCAR-001 (transform comment), SCAR-012 and
  SCAR-015 (new version, M2 step 13 states what is expected and ends with the
  open question).
- Defect found by M2 on `0.1.0-m5.3` (reported 2026-10-17): the icon used the
  value read when the row was drawn, so a value typed afterwards was ignored
  (no question, no reset) until the tab was reopened. Fixed in `0.1.0-m5.4`:
  `resetDefaultField` takes a reader function, the tab reads the Defaults at the
  click (3 more tests).
- Not testable without Obsidian beyond the pure helpers: manual check M2
  (a step for the Defaults reset icons) on a new test build `0.1.0-m5.3`.

---

## Tests

- `tests/plugin/us-008-reset-confirmation.test.ts`: texts and flow (7 tests, 1
  failing and 4 type errors before the code) and a text check of the wiring
  (one reset helper in `settings-tab.ts`, used by both loops, no icon calls
  `save(undefined)` itself; SCAR-013/014 pattern).

---

## Acceptance

- [x] Tests green, mutation checks caught, full gate green
- [x] M2 step passed by the user
