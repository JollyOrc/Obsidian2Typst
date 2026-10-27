# TICKET-025 — Enter key in dialogs and confirmation before a preset is deleted

**Status:** Done
**User story:** [US-008](../user-stories/US-008-presets-and-settings.md)
**ACs addressed:** AC-17 (and AC-5 for the delete flow)
**Depends on:** TICKET-024
**SCARs:** SCAR-013, SCAR-014

---

## Description

Result of the first manual run of M2: Enter in the name dialogs must confirm,
and `Delete` must ask first. The key rule and the texts of the confirmation
are small functions without UI imports, tested directly; the dialogs call them.

---

## Acceptance criteria (from user story)

See US-008 AC-17.

---

## Implementation notes

- **`src/plugin/settings/dialog.ts`** (no `obsidian` import): `isConfirmKey(event)`
  (`Enter`, not composing, key code not 229), `deleteConfirmation(name, plan)`
  returns `{title, lines}` with the texts of AC-17.
- **`settings-tab.ts`:** `NameModal` focuses the field and handles `keydown`
  with `isConfirmKey`; the click on `OK` and Enter run the same function.
  `ConfirmModal` (`Delete`, `Cancel`, focus on `Cancel`) is opened by the
  `Delete` button after `planDelete` (via the store's `canRemove`) accepted;
  `presets.remove` is called only from the confirm button.
- **`PresetStore.canRemove(name, active)`:** the plan without the side effect,
  so the tab can refuse the last preset before asking and show who becomes
  active.
- M2 gets steps for AC-17 (keyboard only; cancel; Escape; active preset).

---

## Tests

- `tests/plugin/us-008-dialogs.test.ts` — key rule (Enter, Shift+Enter, other
  keys, composing, 229), confirmation texts, `canRemove` has no effect.
- `tests/plugin/us-008-wiring.test.ts` — NameModal uses `isConfirmKey`; the
  `remove(` call appears only inside the confirm callback; `Cancel` has focus.

---

## Definition of done

- [ ] All listed tests pass.
- [ ] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] M2 steps 3 and 10 repeated by the user with the keyboard and with Cancel.
- [ ] `docs/technical/tests.md` AC-to-test map updated.
- [ ] Ticket status set to `Done` in `docs/tickets/README.md`.

---

## Implementation result

`dialog.ts` (`isConfirmKey`, `deleteConfirmation`, `deletePreset`), `PresetStore.canRemove`,
`NameModal` with Enter and focus, `ConfirmModal` with the focus on `Cancel`.
The Delete button calls `deletePreset` only. Mutation check: 13 mutants of
`dialog.ts` (composing rules, Enter test, texts, order of refusal, confirm,
cancel, error of `remove`, active preset) and 2 survivors that got tests; all
caught. Decision taken: in a destructive confirmation Enter acts on the focused
button, which is `Cancel` (SCAR-014), whereas in an input dialog Enter confirms
(SCAR-013). Not covered: resetting a single Default field with its reset button
has no confirmation (the value is one field typed by the user); say if SCAR-014
should apply there too.
