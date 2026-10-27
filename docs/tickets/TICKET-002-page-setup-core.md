# TICKET-002 — Page setup core: geometry, validation, and `#set page` output

**Status:** Done
**User story:** [US-009](../user-stories/US-009-page-setup.md)
**ACs addressed:** AC-1 (values and named sizes), AC-2, AC-3, AC-4, AC-6, AC-7, AC-8 (page size), AC-9, AC-10

---

## Description

Implement `src/core/layout/page-setup.ts`: pure functions that turn page settings (mm) into a validated page geometry and one exact `#set page(...)` line. No Obsidian or I/O imports. This is the first code of the project, so it also sets up the folder `src/core/` and (if not yet present) the `build` and `lint` scripts of the quality gate.

---

## Acceptance criteria (from user story)

See [US-009](../user-stories/US-009-page-setup.md) AC-1 to AC-4, AC-6, AC-7, AC-8, AC-9, AC-10. Not in this ticket: reading the preset note (US-008), the cover page emitter (US-011), and the PDF measurement of AC-5 (integration).

---

## Implementation notes

- The test file fixes the API; do not change it without changing the test first: `NAMED_SIZES`, `BUILTIN_PAGE_PRESETS`, `formatMm`, `resolvePageSetup`, `emitPageSetup`, type `PageSettingsInput`.
- Omitted `gutter`, `bleed`, `slug` count as 0. Errors are `{ field, message }`; messages are exact (see the tests).
- Rounding is half up to 2 decimals (`formatMm`), and every length in the output goes through it.
- With `facingPages: false` the output uses `left`/`right`, not `inside`/`outside`, and the gutter is ignored.
- Unknown or missing trim size: story AC-10 (decided by the user): reject, error on field `trimSize`, exact messages in the tests.
- Implemented in `src/core/layout/page-setup.ts`. `build` and `lint` scripts are still planned (own ticket).

---

## Tests

- `tests/unit/us-009-page-setup.test.ts` — 19 real tests plus 2 todo that belong to other stories (AC-1 note parsing, AC-8 cover page).

The tests are red until this ticket is done (module missing). This is the tracked, expected red state of SCAR-006; the quality gate is not green on the first commit of the tests.

---

## Definition of done

- [x] All listed tests pass.
- [x] Full quality gate passes (`typecheck`, `test`, `test:integration`; `build` and `lint` do not exist yet, so this ticket did not add them).
- [x] User story file updated if ACs were refined during implementation (AC-2 example, AC-10).
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.
