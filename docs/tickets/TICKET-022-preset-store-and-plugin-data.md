# TICKET-022 — Preset store, plugin data and the Obsidian vault port

**Status:** Done
**User story:** [US-008](../user-stories/US-008-presets-and-settings.md)
**ACs addressed:** AC-1 (Defaults store), AC-3, AC-4 (list, notices, refusal), AC-5 (operations), AC-6, AC-7, AC-8, AC-12 (store part)
**Depends on:** TICKET-021

---

## Description

Keep the presets and the plugin settings alive in the running plugin: read the
preset notes of the vault, watch them, create, duplicate, rename and delete
them, create the two built-in notes on first start, and load and save
`data.json`. The store talks to the vault only through a small port
(`VaultPort`), so it is tested with an in-memory vault; the port over
Obsidian's API is part of this ticket and is checked by text and by the manual
check M2.

---

## Acceptance criteria (from user story)

See US-008. This ticket covers:

- **AC-1:** `setDefaults` keeps the previous value when a new one is refused.
- **AC-3:** a changed note is re-read within 2 s; one event per note; a body
  change sends none; changes within 300 ms are read once.
- **AC-4:** the list marks invalid presets with error and line; one notice per
  change; `use(name)` refuses an invalid preset; the active preset is not
  switched.
- **AC-5:** create (empty or copy), duplicate, rename through Obsidian's file
  manager, delete to the trash; the last preset cannot be deleted; deleting the
  active preset activates the first in alphabetical order.
- **AC-6:** the two built-in notes are created only when the folder does not
  exist.
- **AC-7:** the store never modifies a note; the last export folder per preset
  is in `data.json`.
- **AC-8:** `data.json` schema version 1, per-field reset with the notice
  `Some settings were reset`, no crash on any shape of file.
- **AC-12:** a changed preset reaches the next read without restart.

---

## Implementation notes

- **`src/plugin/presets/store.ts`:** `createPresetStore`, `VaultPort`,
  `VaultEvent`, entries sorted by name; debounce 300 ms per path; `dispose()`
  removes the watcher and the timers.
- **`src/plugin/settings/data.ts`:** `PluginData`, `DEFAULT_PLUGIN_DATA`,
  `loadPluginData` (per-field validation, unknown fields dropped with
  `reset: true`), `createSettingsStore` over `SettingsStorage`, `setDefaults`
  (uses `validateFields` of TICKET-021).
- **`src/plugin/obsidian/vault-port.ts`:** `VaultPort` over `app.vault`;
  renames with `fileManager.renameFile`, deletes with `fileManager.trashFile`
  (so links and the user's "Deleted files" setting are respected); never
  `vault.modify`, `vault.delete`, `process` or `append`. Events: create,
  modify, delete, rename.
- **`src/plugin/main.ts`:** `loadData`/`saveData` through `SettingsStorage`,
  store started in `onLayoutReady`, disposed in `onunload`; `RESET_NOTICE` is
  shown once when `load()` reports a reset.
- `tests/support/fake-vault.ts` records every write; the AC-7 tests compare
  files and write logs before and after.
- Own-write events: the plugin's own `create`, `rename` and `trash` come back
  as vault events; the store must not show a second notice for them.

---

## Tests

- `tests/plugin/us-008-preset-store.test.ts` — AC-3, AC-4, AC-5, AC-6, AC-7,
  AC-12, US-009 AC-2.
- `tests/plugin/us-008-plugin-data.test.ts` — AC-1, AC-7, AC-8, AC-13 (notice
  for Defaults), US-001 AC-13, US-009 AC-2.
- `tests/plugin/us-008-wiring.test.ts` — vault port and `main.ts` text checks
  (AC-3, AC-7, AC-8).

---

## Definition of done

- [x] All listed tests pass.
- [x] Mutation check: debounce, event filter, own-write handling, last-preset
      rule, folder-exists rule and per-field reset each switched off alone are
      caught by a test.
- [x] Full quality gate passes (`npm run typecheck && npm run lint && npm run build && npm test && npm run test:integration`).
- [x] User story file updated if ACs were refined during implementation.
- [x] `docs/technical/tests.md` AC-to-test map updated.
- [x] Ticket status set to `Done` in `docs/tickets/README.md`.

## Implementation result

- `plugin/presets/store.ts`: `createPresetStore` over `VaultPort`; one debounce timer of 300 ms that restarts at each change; a batch re-reads only the notes that were listed, compares the text with the last one (own writes and touches change nothing), and sends one event for the batch when the outcome (validity, error, fields, lines) differs; `load()` can be called again (changed presets folder).
- `plugin/settings/data.ts`: `loadPluginData` (per-field reset, unknown fields dropped, version 1, never throws), `createSettingsStore`, `setDefaults` (uses `validateFields`).
- `plugin/obsidian/vault-port.ts`: the port over Obsidian (`fileManager.renameFile`, `fileManager.trashFile`, events `create`, `modify`, `delete`, `rename`; folders are skipped).
- `plugin/main.ts`: `loadData`/`saveData` through the settings store, `RESET_NOTICE`, the store is loaded in `onLayoutReady` and disposed in `onunload`.
- Mutation check (47 mutants of store and data): all caught. Gaps closed with tests: the wait restarts at each change, a modify event without a change of text, other files cause no work, lines that only move, a removed listener, the presets folder created again, an unknown field of `data.json` and of the Defaults, a replaced numbering in `data.json`, a disposed store does not announce.
- Code removed after the check: a `disposed` flag that duplicated `clearTimeout`, and a check for known field names that `validateFields` already makes.
